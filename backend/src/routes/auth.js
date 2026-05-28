import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { searchGliders, lookupHandicap } from '../lib/handicaps.js';
import { applyWingLoading } from '../lib/scoring.js';

const router = Router();

// GET /api/auth/me — get current user profile
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// PUT /api/auth/me — update profile (pilots fill in glider info)
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const {
      full_name, competition_number, n_number,
      glider_manufacturer, glider_model,
      takeoff_weight_lbs, wl_formula
    } = req.body;

    // Auto-lookup handicap from SSA table
    let base_handicap = req.body.base_handicap || null;
    let ref_weight_lbs = req.body.ref_weight_lbs || null;

    if (glider_manufacturer && glider_model) {
      const entry = lookupHandicap(glider_manufacturer, glider_model);
      if (entry) {
        base_handicap = entry.handicap;
        ref_weight_lbs = entry.refWeight;
      }
    }

    // Compute adjusted handicap
    const adjusted_handicap = applyWingLoading(
      base_handicap,
      takeoff_weight_lbs,
      ref_weight_lbs,
      wl_formula || 'none'
    );

    const updates = {
      full_name, competition_number, n_number,
      glider_manufacturer, glider_model,
      takeoff_weight_lbs, wl_formula,
      base_handicap, ref_weight_lbs, adjusted_handicap,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/auth/gliders/search?q=ventus — search SSA table
router.get('/gliders/search', async (req, res) => {
  const results = searchGliders(req.query.q || '');
  res.json(results);
});

// GET /api/auth/gliders/lookup?manufacturer=X&model=Y
router.get('/gliders/lookup', async (req, res) => {
  const entry = lookupHandicap(req.query.manufacturer, req.query.model);
  res.json(entry || null);
});

export default router;
