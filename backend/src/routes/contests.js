import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, requireContestCD } from '../middleware/auth.js';

const router = Router();

// GET /api/contests — list contests (public ones + ones you're in)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // CD sees their own contests; pilots see contests they're registered in
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', req.user.id).single();

    let query = supabase.from('contests').select(`
      id, name, location, start_date, end_date, status, cd_id,
      profiles!contests_cd_id_fkey(full_name)
    `);

    if (profile?.role === 'cd') {
      query = query.eq('cd_id', req.user.id);
    } else {
      // Pilot: contests they're registered in
      const { data: regs } = await supabase
        .from('contest_registrations')
        .select('contest_id')
        .eq('pilot_id', req.user.id);
      const ids = (regs || []).map(r => r.contest_id);
      if (!ids.length) return res.json([]);
      query = query.in('id', ids);
    }

    const { data, error } = await query.order('start_date', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/contests — CD creates a contest
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', req.user.id).single();
    if (profile?.role !== 'cd') return res.status(403).json({ error: 'CD role required' });

    const { name, location, start_date, end_date, frequency, penalties } = req.body;
    const { data, error } = await supabase
      .from('contests')
      .insert({
        cd_id: req.user.id,
        name, location, start_date, end_date,
        frequency: frequency || '123.5',
        status: 'setup',
        penalties: penalties || {
          earlyStartMultiplier: 20,
          invalidStartPenaltySecs: 600,
          belowMinAltPerFoot: 10,
          ceilingBustPenaltySecs: 0,
          maxTimeFactor: 1.5,
        },
      })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// GET /api/contests/:contestId — get single contest with full details
router.get('/:contestId', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('contests')
      .select(`
        *,
        profiles!contests_cd_id_fkey(full_name, email:id),
        contest_registrations(
          id, pilot_id, handicap_override, status,
          profiles!contest_registrations_pilot_id_fkey(
            full_name, competition_number, glider_manufacturer,
            glider_model, n_number, adjusted_handicap, base_handicap,
            takeoff_weight_lbs, wl_formula
          )
        ),
        tasks(id, date, status, gate_open, task_points, settings)
      `)
      .eq('id', req.params.contestId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// PUT /api/contests/:contestId — CD updates contest settings
router.put('/:contestId', async (req, res, next) => {
  try {
    const contestId = req.params.contestId;
    req.params.contestId = contestId;
    req.body.contestId = contestId;

    // Inline auth check
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = header.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: contest } = await supabase.from('contests').select('cd_id').eq('id', contestId).single();
    if (contest?.cd_id !== user.id) return res.status(403).json({ error: 'Not the CD' });

    const allowed = ['name','location','start_date','end_date','frequency','status','penalties'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('contests').update(updates).eq('id', contestId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/contests/:contestId/register — pilot registers for a contest
router.post('/:contestId/register', requireAuth, async (req, res, next) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('adjusted_handicap, base_handicap')
      .eq('id', req.user.id).single();

    const { data, error } = await supabase
      .from('contest_registrations')
      .upsert({
        contest_id: req.params.contestId,
        pilot_id: req.user.id,
        status: 'pending',
        effective_handicap: profile?.adjusted_handicap || profile?.base_handicap,
      }, { onConflict: 'contest_id,pilot_id' })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// PUT /api/contests/:contestId/pilots/:pilotId — CD approves pilot / overrides handicap
router.put('/:contestId/pilots/:pilotId', requireAuth, async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    const { data: contest } = await supabase.from('contests').select('cd_id').eq('id', req.params.contestId).single();
    if (contest?.cd_id !== user?.id) return res.status(403).json({ error: 'Not the CD' });

    const { status, handicap_override } = req.body;
    const updates = {};
    if (status) updates.status = status;

    // If CD sets handicap override, use it; else recompute from pilot profile
    if (handicap_override != null) {
      updates.handicap_override = handicap_override;
      updates.effective_handicap = handicap_override;
    } else {
      // Clear override, revert to profile handicap
      const { data: profile } = await supabase
        .from('profiles').select('adjusted_handicap, base_handicap')
        .eq('id', req.params.pilotId).single();
      updates.handicap_override = null;
      updates.effective_handicap = profile?.adjusted_handicap || profile?.base_handicap;
    }

    const { data, error } = await supabase
      .from('contest_registrations')
      .update(updates)
      .eq('contest_id', req.params.contestId)
      .eq('pilot_id', req.params.pilotId)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/contests/:contestId/pilots — list registered pilots with handicaps
router.get('/:contestId/pilots', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('contest_registrations')
      .select(`
        id, pilot_id, status, handicap_override, effective_handicap,
        profiles!contest_registrations_pilot_id_fkey(
          full_name, competition_number, glider_manufacturer,
          glider_model, n_number, adjusted_handicap, base_handicap,
          takeoff_weight_lbs, wl_formula, ref_weight_lbs
        )
      `)
      .eq('contest_id', req.params.contestId)
      .order('created_at');
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
