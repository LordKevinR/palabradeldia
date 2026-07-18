import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDB } from './_routes/db.js';
import authRouter from './_routes/auth.js';
import gameRouter from './_routes/game.js';

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware configurations
app.use(express.json());
app.use(cookieParser());

// CORS configuration for local development
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// Session verification middleware
app.use(async (req, res, next) => {
  const sessionId = req.cookies.session_id;
  req.user = null;
  req.session = null;

  if (sessionId) {
    try {
      // Find active session in DB (not expired)
      const sessRes = await db.execute({
        sql: `SELECT s.id, s.user_id, s.challenge, s.expires_at 
              FROM sessions s 
              WHERE s.id = ? AND s.expires_at > strftime('%s', 'now')`,
        args: [sessionId]
      });

      if (sessRes.rows.length > 0) {
        const session = sessRes.rows[0];
        
        if (session.user_id) {
          // Fetch user details
          const userRes = await db.execute({
            sql: 'SELECT id, username FROM users WHERE id = ?',
            args: [session.user_id]
          });

          if (userRes.rows.length > 0) {
            req.user = userRes.rows[0];
            req.session = session;
          }
        } else {
          // Unauthenticated session (temporary session used for WebAuthn registration/login challenge)
          req.session = session;
        }
      }
    } catch (err) {
      console.error('Error verifying session:', err);
    }
  }
  next();
});

// Initialize database tables
initDB().catch(err => {
  console.error('CRITICAL: Failed to initialize database tables!', err);
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/game', gameRouter);

// Serve static frontend assets in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback all non-API requests to React frontend (SPA)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Static build files not found. In development, use Vite server.');
    }
  });
});

// Listen locally if file is executed directly
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
