import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function authHelper(req) {
  const token = req.headers.authorization?.slice(7);
  return token ? supabase.auth.getUser(token) : { data: { user: null } };
}

// GET /api/tasks/contest/:contestId — list all tasks for a contest
router.get('/contest/:contestId', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('contest_id', req.params.contestId)
      .order('date');
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/tasks/contest/:contestId — CD creates a task day
router.post('/contest/:contestId', requireAuth, async (req, res, next) => {
  try {
    const { data: { user } } = await authHelper(req);
    const { data: contest } = await supabase
      .from('contests').select('cd_id').eq('id', req.params.contestId).single();
    if (contest?.cd_id !== user?.id) return res.status(403).json({ error: 'Not the CD' });

    const {
      date, gate_open, start_window_mins, permissive_window,
      start_type, start_radius, finish_type, finish_radius,
      start_ceiling_ft, min_finish_alt_ft, max_altitude_ft,
      max_time_factor, task_points
    } = req.body;

    // Compute reference handicap = min effective handicap among approved pilots
    const { data: regs } = await supabase
      .from('contest_registrations')
      .select('effective_handicap')
      .eq('contest_id', req.params.contestId)
      .eq('status', 'approved');

    const hcs = (regs || []).map(r => r.effective_handicap).filter(Boolean);
    const referenceHandicap = hcs.length ? Math.min(...hcs) : 0.5;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        contest_id: req.params.contestId,
        date, gate_open,
        status: 'open',
        reference_handicap: referenceHandicap,
        settings: {
          startWindowMins: start_window_mins || 5,
          permissiveWindow: permissive_window !== false,
          startType: start_type || 'line',
          startRadius: start_radius || 1,
          finishType: finish_type || 'cylinder',
          finishRadius: finish_radius || 1,
          startCeilingFt: start_ceiling_ft || null,
          minFinishAltFt: min_finish_alt_ft || 1280,
          maxAltitudeFt: max_altitude_ft || 17500,
          maxTimeFactor: max_time_factor || 1.5,
        },
        task_points: task_points || [],
      })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// PUT /api/tasks/:taskId — CD updates a task
router.put('/:taskId', requireAuth, async (req, res, next) => {
  try {
    const { data: { user } } = await authHelper(req);
    const { data: task } = await supabase
      .from('tasks').select('contest_id').eq('id', req.params.taskId).single();
    const { data: contest } = await supabase
      .from('contests').select('cd_id').eq('id', task?.contest_id).single();
    if (contest?.cd_id !== user?.id) return res.status(403).json({ error: 'Not the CD' });

    const allowed = ['date','gate_open','status','settings','task_points'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    // Recompute reference_handicap if task_points changed
    if (req.body.task_points) {
      const { data: regs } = await supabase
        .from('contest_registrations')
        .select('effective_handicap')
        .eq('contest_id', task.contest_id)
        .eq('status', 'approved');
      const hcs = (regs || []).map(r => r.effective_handicap).filter(Boolean);
      updates.reference_handicap = hcs.length ? Math.min(...hcs) : 0.5;
    }

    const { data, error } = await supabase
      .from('tasks').update(updates).eq('id', req.params.taskId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/tasks/:taskId/tsk/:pilotId — generate TSK file for a pilot
router.get('/:taskId/tsk/:pilotId', requireAuth, async (req, res, next) => {
  try {
    const { data: task, error: te } = await supabase
      .from('tasks').select('*').eq('id', req.params.taskId).single();
    if (te || !task) return res.status(404).json({ error: 'Task not found' });

    const { data: reg } = await supabase
      .from('contest_registrations')
      .select(`effective_handicap, profiles!contest_registrations_pilot_id_fkey(
        full_name, glider_manufacturer, glider_model, competition_number
      )`)
      .eq('contest_id', task.contest_id)
      .eq('pilot_id', req.params.pilotId)
      .single();

    if (!reg) return res.status(404).json({ error: 'Pilot not registered' });

    const pilot = {
      name: reg.profiles?.full_name || 'Unknown',
      glider: `${reg.profiles?.glider_manufacturer} ${reg.profiles?.glider_model}`,
      compId: reg.profiles?.competition_number,
      handicap: reg.effective_handicap,
    };

    const xml = generateTSK(pilot, task);
    const filename = `${task.date}_${pilot.compId || pilot.name.replace(/\s/g,'_')}.tsk`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  } catch (e) { next(e); }
});

function generateTSK(pilot, task) {
  const ref   = task.reference_handicap;
  const ratio = ref > 0 ? pilot.handicap / ref : 1;
  const s     = task.settings || {};
  const tps   = task.task_points || [];

  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<Task>\n`;
  xml += `  <!-- ${pilot.name} (${pilot.glider}) HC=${pilot.handicap} RefHC=${ref} Scale=${ratio.toFixed(4)} -->\n`;

  tps.forEach((tp, i) => {
    let radius = 0;
    if (i === 0) {
      radius = s.startType === 'cylinder' ? (s.startRadius || 1) * 1852 : 100;
    } else if (i === tps.length - 1) {
      radius = s.finishType === 'cylinder' ? (s.finishRadius || 1) * 1852 : 100;
    } else {
      radius = tp.radiusType === 'fixed'
        ? (tp.radius || 1) * 1852
        : (tp.radius || 1) * ratio * 1852;
    }
    const type = i === 0 ? 'Start' : i === tps.length - 1 ? 'Finish' : 'Turn';
    xml += `  <Point type="${type}">\n`;
    xml += `    <Waypoint>\n`;
    xml += `      <Name>${tp.name}</Name>\n`;
    xml += `      <Latitude>${tp.lat.toFixed(6)}</Latitude>\n`;
    xml += `      <Longitude>${tp.lon.toFixed(6)}</Longitude>\n`;
    xml += `      <Altitude>${tp.elev || 0}</Altitude>\n`;
    xml += `    </Waypoint>\n`;
    xml += `    <ObservationZone type="Cylinder" radius="${Math.round(radius)}"/>\n`;
    xml += `  </Point>\n`;
  });
  xml += `</Task>`;
  return xml;
}

export default router;
