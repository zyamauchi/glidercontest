import { supabase } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = header.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = user;
  req.token = token;
  next();
}

export async function requireCD(req, res, next) {
  await requireAuth(req, res, async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();
    if (profile?.role !== 'cd') {
      return res.status(403).json({ error: 'CD role required' });
    }
    req.profile = profile;
    next();
  });
}

// Must be CD of the specific contest
export async function requireContestCD(req, res, next) {
  await requireAuth(req, res, async () => {
    const contestId = req.params.contestId || req.body.contestId;
    if (!contestId) return res.status(400).json({ error: 'contestId required' });
    const { data: contest } = await supabase
      .from('contests')
      .select('cd_id')
      .eq('id', contestId)
      .single();
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    if (contest.cd_id !== req.user.id) {
      return res.status(403).json({ error: 'Not the CD of this contest' });
    }
    req.contest = contest;
    next();
  });
}
