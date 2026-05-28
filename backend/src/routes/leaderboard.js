import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

// GET /api/leaderboard/:contestId — public cumulative leaderboard
router.get('/:contestId', async (req, res, next) => {
  try {
    // Load all finalized tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, date, status, winner_time, max_time, max_time_factor, below_threshold')
      .eq('contest_id', req.params.contestId)
      .eq('status', 'finalized')
      .order('date');

    // Load all approved pilots
    const { data: regs } = await supabase
      .from('contest_registrations')
      .select(`
        pilot_id, effective_handicap,
        profiles!contest_registrations_pilot_id_fkey(
          full_name, competition_number, glider_manufacturer, glider_model
        )
      `)
      .eq('contest_id', req.params.contestId)
      .eq('status', 'approved');

    if (!regs?.length) return res.json({ tasks: tasks || [], standings: [] });

    // Load all results for finalized tasks
    const taskIds = (tasks || []).map(t => t.id);
    let results = [];
    if (taskIds.length) {
      const { data } = await supabase
        .from('results')
        .select('task_id, pilot_id, status, final_status, elapsed_secs, final_time, penalty_secs')
        .in('task_id', taskIds);
      results = data || [];
    }

    // Build standings
    const standings = regs.map(reg => {
      let totalTime = 0;
      let scoredDays = 0;
      const dayResults = (tasks || []).map(task => {
        const r = results.find(r => r.task_id === task.id && r.pilot_id === reg.pilot_id);
        const time = r?.final_time ?? null;
        if (time != null) { totalTime += time; scoredDays++; }
        return {
          taskId: task.id,
          date: task.date,
          status: r?.final_status || r?.status || null,
          finalTime: time,
          elapsed: r?.elapsed_secs,
          penalty: r?.penalty_secs,
        };
      });

      return {
        pilotId: reg.pilot_id,
        name: reg.profiles?.full_name,
        compNumber: reg.profiles?.competition_number,
        glider: `${reg.profiles?.glider_manufacturer || ''} ${reg.profiles?.glider_model || ''}`.trim(),
        handicap: reg.effective_handicap,
        totalTime: scoredDays > 0 ? totalTime : null,
        scoredDays,
        dayResults,
      };
    });

    // Sort: scored pilots by totalTime asc, unscored last
    standings.sort((a, b) => {
      if (a.scoredDays === 0 && b.scoredDays === 0) return 0;
      if (a.scoredDays === 0) return 1;
      if (b.scoredDays === 0) return -1;
      return (a.totalTime ?? Infinity) - (b.totalTime ?? Infinity);
    });

    res.json({ tasks: tasks || [], standings });
  } catch (e) { next(e); }
});

// GET /api/leaderboard/:contestId/day/:taskId — single day results
router.get('/:contestId/day/:taskId', async (req, res, next) => {
  try {
    const { data: task } = await supabase
      .from('tasks').select('*').eq('id', req.params.taskId).single();

    const { data: results } = await supabase
      .from('results')
      .select(`
        *, profiles!results_pilot_id_fkey(
          full_name, competition_number, glider_manufacturer, glider_model
        )
      `)
      .eq('task_id', req.params.taskId)
      .order('final_time', { ascending: true, nullsLast: true });

    res.json({ task, results: results || [] });
  } catch (e) { next(e); }
});

export default router;
