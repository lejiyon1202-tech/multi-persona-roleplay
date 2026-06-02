import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import scenariosRouter from './src/routes/scenarios.js';
import sessionsRouter  from './src/routes/sessions.js';
import reportsRouter   from './src/routes/reports.js';
import adminRouter     from './src/routes/admin.js';

const app  = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3011;

// ── 미들웨어 ─────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
    },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimit  = rateLimit({ windowMs: 60_000,     max: 60  });
const chatLimit    = rateLimit({ windowMs: 60_000,     max: 10  });
const evalLimit    = rateLimit({ windowMs: 60_000,     max: 5   });
const sessLimit    = rateLimit({ windowMs: 3_600_000,  max: 10  });
const compareLimit = rateLimit({ windowMs: 60_000,     max: 5   });

app.use(globalLimit);
app.use('/api/chat',              chatLimit);
app.use('/api/evaluate',          evalLimit);
app.post('/api/sessions',         sessLimit);
app.get('/api/sessions/compare',  compareLimit);

// ── 라우터 ────────────────────────────────────────────────────────────────────
app.use('/api/scenarios',  scenariosRouter);
app.use('/api',            sessionsRouter);
app.use('/api',            reportsRouter);
app.use('/api/admin',      adminRouter);

// ── 헬스체크 ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', port: PORT }));

// ── 에러 핸들러 ───────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ── 서버 시작 ─────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[INIT] multi-persona-roleplay server running on port ${PORT}`);
});

process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
