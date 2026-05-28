import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { parseIGC, scoreIGC } from '../lib/scoring.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/scoring/upload/:taskId — pilot uploads IGC, auto-scores
router.post('/upload/:taskId', requireAuth, upload.single('igc'), async (req, res, next) => {
  try {
    const taskId = req.params.taskId;

    // Load task
    const { data: task, error: te } = await supabase
      .from('tasks').select('*').eq('id', taskId).single();
    if (te || !task) return res.status(404).json({ error: 'Task not found' });
    if (task.status === 'finalized') return res.status(400).json({ error: 'Day is finalized, no more uploads' });

    // Load pilot registration
    const { data: reg } = await supabase
      .from('contest_registrations')
      .select('effective_handicap, pilot_id, status')
      .eq('contest_id', task.contest_id)
      .eq('pilot_id', req.user.id)
      .single();
    if (!reg) return res.status(403).json({ error: 'Not registered in this contest' });
    if (reg.status !== 'approved') return res.status(403).json({ error: 'Registration not yet approved by CD' });

    // Load contest penalties
    const { data: contest } = await supabase
      .from('contests').select('penalties').eq('id', task.contest_id).single();
    const penalties = contest?.penalties || {};

    // Parse IGC
    if (!req.file) return res.status(400).json({ error: 'No IGC file provided' });
    const igcText = req.file.buffer.toString('utf-8');
    const igcData = parseIGC(igcText);

    // Score
    const pilot = { handicap: reg.effective_handicap };
    const taskForScoring = {
      ...task.settings,
      taskPoints: task.task_points,
      referenceHandicap: task.reference_handicap,
      gateOpen: task.gate_open,
    };

    const result = scoreIGC(igcData, pilot, taskForScoring, penalties);

    // Upload IGC to Supabase Storage
    const storagePath = `igc/${task.contest_id}/${taskId}/${req.user.id}_${Date.now()}.igc`;
    await supabase.storage.from('igc-files').upload(storagePath, req.file.buffer, {
      contentType: 'text/plain', upsert: true,
    });

    // Upsert result in DB
    const { data: savedResult, error: re } = await supabase
      .from('results')
      .upsert({
        task_id: taskId,
        contest_id: task.contest_id,
        pilot_id: req.user.id,
        status: result.status,
        elapsed_secs: result.elapsed || null,
        penalty_secs: result.penaltySecs || 0,
        start_secs: result.startSecs || null,
        finish_secs: result.finishSecs || null,
        early_penalty_secs: result.earlyPenalty || 0,
        igc_filename: req.file.originalname,
        igc_storage_path: storagePath,
        detail: result.detail,
        scored_at: new Date().toISOString(),
      }, { onConflict: 'task_id,pilot_id' })
      .select().single();
    if (re) throw re;

    res.json({
      result: savedResult,
      summary: {
        status: result.status,
        elapsed: result.elapsed,
        penaltySecs: result.penaltySecs,
        detail: result.detail,
      }
    });
  } catch (e) { next(e); }
});

// POST /api/scoring/finalize/:taskId — CD finalizes day, applies max time
router.post('/finalize/:taskId', requireAuth, async (req, res, next) => {
  try {
    const { data: task } = await supabase
      .from('tasks').select('*').eq('id', req.params.taskId).single();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Verify CD
    const token = req.headers.authorization?.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    const { data: contest } = await supabase
      .from('contests').select('cd_id, penalties').eq('id', task.contest_id).single();
    if (contest?.cd_id !== user?.id) return res.status(403).json({ error: 'Not the CD' });

    // Load all results for this task
    const { data: results } = await supabase
      .from('results').select('*').eq('task_id', req.params.taskId);

    const finished = (results || []).filter(r => r.status === 'FINISHED' && r.elapsed_secs != null);
    if (!finished.length) return res.status(400).json({ error: 'No finished results to finalize' });

    const maxTimeFactor = req.body.maxTimeFactor ||
      task.settings?.maxTimeFactor ||
      contest?.penalties?.maxTimeFactor || 1.5;

    const winnerTime = Math.min(...finished.map(r => r.elapsed_secs));
    const maxTime = winnerTime * maxTimeFactor;

    // Check 33% rule
    const { data: regs } = await supabase
      .from('contest_registrations')
      .select('pilot_id')
      .eq('contest_id', task.contest_id)
      .eq('status', 'approved');
    const totalPilots = (regs || []).length;
    const completionRate = totalPilots > 0 ? finished.length / totalPilots : 0;

    // Update each result with final_time
    const updates = (results || []).map(r => {
      let final_time = r.elapsed_secs;
      let final_status = r.status;
      if (r.status !== 'FINISHED' || r.elapsed_secs == null) {
        final_time = maxTime;
        final_status = 'MAX_TIME';
      } else if (r.elapsed_secs > maxTime) {
        final_time = maxTime;
        final_status = 'MAX_TIME';
      }
      return supabase.from('results').update({
        final_time, final_status, max_time: maxTime, winner_time: winnerTime,
      }).eq('id', r.id);
    });
    await Promise.all(updates);

    // Mark task finalized
    await supabase.from('tasks').update({
      status: 'finalized',
      winner_time: winnerTime,
      max_time: maxTime,
      max_time_factor: maxTimeFactor,
      below_threshold: completionRate < 0.33,
      finalized_at: new Date().toISOString(),
    }).eq('id', req.params.taskId);

    res.json({
      winnerTime, maxTime, maxTimeFactor,
      finishedCount: finished.length,
      totalPilots,
      completionRate,
      belowThreshold: completionRate < 0.33,
    });
  } catch (e) { next(e); }
});

// GET /api/scoring/results/:taskId — get all results for a task
router.get('/results/:taskId', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('results')
      .select(`
        *, profiles!results_pilot_id_fkey(
          full_name, competition_number, glider_manufacturer, glider_model
        )
      `)
      .eq('task_id', req.params.taskId)
      .order('final_time', { ascending: true, nullsLast: true });
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// DELETE /api/scoring/results/:taskId/:pilotId — CD removes a result (re-upload)
router.delete('/results/:taskId/:pilotId', requireAuth, async (req, res, next) => {
  try {
    const { data: task } = await supabase
      .from('tasks').select('contest_id').eq('id', req.params.taskId).single();
    const token = req.headers.authorization?.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    const { data: contest } = await supabase
      .from('contests').select('cd_id').eq('id', task?.contest_id).single();
    if (contest?.cd_id !== user?.id) return res.status(403).json({ error: 'Not the CD' });

    await supabase.from('results')
      .delete()
      .eq('task_id', req.params.taskId)
      .eq('pilot_id', req.params.pilotId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
