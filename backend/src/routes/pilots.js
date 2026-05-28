import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { searchGliders } from '../lib/handicaps.js';

const router = Router();

// GET /api/pilots/gliders?q=discus — search SSA handicap table
router.get('/gliders', async (req, res) => {
  res.json(searchGliders(req.query.q || ''));
});

export default router;
