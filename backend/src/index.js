import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import contestRoutes from './routes/contests.js';
import taskRoutes from './routes/tasks.js';
import pilotRoutes from './routes/pilots.js';
import scoringRoutes from './routes/scoring.js';
import leaderboardRoutes from './routes/leaderboard.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth', authRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/pilots', pilotRoutes);
app.use('/api/scoring', scoringRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`API running on :${PORT}`));
