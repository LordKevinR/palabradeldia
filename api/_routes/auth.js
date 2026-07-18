import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import db from './db.js';
import { registerSchema, loginSchema, validate } from './validation.js';

// Rate limiters for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Relaxed slightly for development
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Helper to hash passwords securely
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split(':');
  const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === checkHash;
}

// Helpers to handle base64url conversion
function bufferToBase64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function base64urlToBuffer(base64url) {
  return Buffer.from(base64url, 'base64url');
}

// Helper to get WebAuthn RP settings dynamically
function getRPInfo(req) {
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  let expectedOrigin = `${protocol}://${host}`;
  
  if (req.headers.referer) {
    try {
      expectedOrigin = new URL(req.headers.referer).origin;
    } catch (e) {
      // Fallback
    }
  }

  let rpID = expectedOrigin.replace(/^https?:\/\//, '').split(':')[0];
  try {
    rpID = new URL(expectedOrigin).hostname;
  } catch (e) {
    // Fallback
  }

  return {
    rpName: 'La Palabra del Día',
    rpID: process.env.RP_ID || rpID,
    expectedOrigin: process.env.EXPECTED_ORIGIN || expectedOrigin,
  };
}

// Check username existence and passkey eligibility
router.post('/check-username', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'El usuario es obligatorio.' });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const userRes = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [cleanUsername]
    });

    if (userRes.rows.length === 0) {
      return res.json({ exists: false, hasPasskey: false });
    }

    const userId = userRes.rows[0].id;
    const credRes = await db.execute({
      sql: 'SELECT id FROM credentials WHERE user_id = ?',
      args: [userId]
    });

    return res.json({
      exists: true,
      hasPasskey: credRes.rows.length > 0
    });
  } catch (error) {
    console.error('Error checking username:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Register user with password fallback
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = username.trim().toLowerCase();
  
  try {
    const checkRes = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [cleanUsername]
    });

    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe.' });
    }

    const userId = crypto.randomUUID();
    const pwHash = hashPassword(password);

    // Create user
    await db.execute({
      sql: 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      args: [userId, cleanUsername, pwHash]
    });

    // Create initial user_stats
    await db.execute({
      sql: `INSERT INTO user_stats (user_id, games_played, games_won, current_streak, max_streak, last_played_date, guess_distribution) 
            VALUES (?, 0, 0, 0, 0, NULL, ?)`,
      args: [userId, JSON.stringify({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })]
    });

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

    await db.execute({
      sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      args: [sessionId, userId, expiresAt]
    });

    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.json({
      success: true,
      user: { id: userId, username: cleanUsername }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Login with password
router.post('/login-password', authLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = username.trim().toLowerCase();

  try {
    const userRes = await db.execute({
      sql: 'SELECT id, password_hash FROM users WHERE username = ?',
      args: [cleanUsername]
    });

    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const user = userRes.rows[0];
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

    await db.execute({
      sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      args: [sessionId, user.id, expiresAt]
    });

    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.json({
      success: true,
      user: { id: user.id, username: cleanUsername }
    });
  } catch (error) {
    console.error('Error during password login:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('session_id');
  return res.json({ success: true });
});

// Fetch current user details
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username
    }
  });
});

// --- PASSKEY (WEBAUTHN) ENDPOINTS ---

// 1. Generate options for registering a new Passkey
router.post('/passkey/register-options', authLimiter, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión primero.' });
  }

  const { rpName, rpID } = getRPInfo(req);
  const userId = req.user.id;
  const username = req.user.username;

  try {
    // Exclude existing credentials
    const credRes = await db.execute({
      sql: 'SELECT id FROM credentials WHERE user_id = ?',
      args: [userId]
    });

    const excludeCredentials = credRes.rows.map(row => ({
      id: row.id,
      type: 'public-key'
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(userId),
      userName: username,
      userDisplayName: username,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await db.execute({
      sql: 'UPDATE sessions SET challenge = ? WHERE id = ?',
      args: [options.challenge, req.session.id]
    });

    return res.json(options);
  } catch (error) {
    console.error('Error generating passkey registration options:', error);
    return res.status(500).json({ error: 'Error al generar opciones de registro.' });
  }
});

// 2. Verify new Passkey registration
router.post('/passkey/register-verify', authLimiter, async (req, res) => {
  if (!req.user || !req.session) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { rpID, expectedOrigin } = getRPInfo(req);
  const userId = req.user.id;
  const challenge = req.session.challenge;

  if (!challenge) {
    return res.status(400).json({ 
      error: 'No se encontró un desafío de registro activo. Inténtalo de nuevo.'
    });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

      const pubKeyBase64url = bufferToBase64url(credentialPublicKey);
      const transports = req.body.response.transports ? req.body.response.transports.join(',') : '';

      await db.execute({
        sql: 'INSERT INTO credentials (id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)',
        args: [credentialID, userId, pubKeyBase64url, counter, transports]
      });

      // Clear challenge
      await db.execute({
        sql: 'UPDATE sessions SET challenge = NULL WHERE id = ?',
        args: [req.session.id]
      });

      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: 'Falló la verificación del registro.' });
    }
  } catch (error) {
    console.error('Error verifying passkey registration:', error);
    return res.status(500).json({ error: 'Error al verificar registro de Passkey.' });
  }
});

// 3. Generate authentication options for login
router.post('/passkey/login-options', authLimiter, async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'El usuario es obligatorio.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const { rpID } = getRPInfo(req);

  try {
    const userRes = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [cleanUsername]
    });

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'El usuario no existe.' });
    }

    const userId = userRes.rows[0].id;

    // Get credentials
    const credRes = await db.execute({
      sql: 'SELECT id, transports FROM credentials WHERE user_id = ?',
      args: [userId]
    });

    if (credRes.rows.length === 0) {
      return res.status(400).json({ error: 'El usuario no tiene Passkeys registradas.' });
    }

    const allowCredentials = credRes.rows.map(row => ({
      id: row.id,
      type: 'public-key',
      transports: row.transports && row.transports.trim() !== '' ? row.transports.split(',') : undefined
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Temp challenge session
    const tempSessionId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 mins

    await db.execute({
      sql: 'INSERT INTO sessions (id, challenge, expires_at) VALUES (?, ?, ?)',
      args: [tempSessionId, options.challenge, expiresAt]
    });

    res.cookie('temp_challenge_session', tempSessionId, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: 10 * 60 * 1000,
      path: '/'
    });

    return res.json(options);
  } catch (error) {
    console.error('Error generating passkey login options:', error);
    return res.status(500).json({ error: 'Error al generar opciones de inicio de sesión.' });
  }
});

// 4. Verify authentication response
router.post('/passkey/login-verify', authLimiter, async (req, res) => {
  const { username } = req.body;
  const tempSessionId = req.cookies.temp_challenge_session;

  if (!username) {
    return res.status(400).json({ error: 'El usuario es obligatorio.' });
  }
  if (!tempSessionId) {
    return res.status(400).json({ error: 'Desafío vencido o no encontrado.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const { rpID, expectedOrigin } = getRPInfo(req);

  try {
    const sessRes = await db.execute({
      sql: "SELECT challenge FROM sessions WHERE id = ? AND expires_at > (strftime('%s', 'now'))",
      args: [tempSessionId]
    });

    if (sessRes.rows.length === 0) {
      return res.status(400).json({ error: 'La sesión temporal ha expirado.' });
    }

    const challenge = sessRes.rows[0].challenge;

    const userRes = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [cleanUsername]
    });

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const userId = userRes.rows[0].id;
    const credId = req.body.id;

    const credRes = await db.execute({
      sql: 'SELECT id, public_key, counter, transports FROM credentials WHERE id = ? AND user_id = ?',
      args: [credId, userId]
    });

    if (credRes.rows.length === 0) {
      return res.status(400).json({ error: 'Credencial no asociada a este usuario.' });
    }

    const dbCred = credRes.rows[0];

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: dbCred.id,
        publicKey: base64urlToBuffer(dbCred.public_key),
        counter: dbCred.counter,
        transports: dbCred.transports && dbCred.transports.trim() !== '' ? dbCred.transports.split(',') : undefined
      }
    });

    if (verification.verified) {
      const newCounter = verification.authenticationInfo.newCounter;
      await db.execute({
        sql: 'UPDATE credentials SET counter = ? WHERE id = ?',
        args: [newCounter, credId]
      });

      const sessionId = crypto.randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

      await db.execute({
        sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
        args: [sessionId, userId, expiresAt]
      });

      // Cleanup
      await db.execute({
        sql: 'DELETE FROM sessions WHERE id = ?',
        args: [tempSessionId]
      });

      res.clearCookie('temp_challenge_session');
      res.cookie('session_id', sessionId, {
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      return res.json({
        success: true,
        user: { id: userId, username: cleanUsername }
      });
    } else {
      return res.status(400).json({ error: 'Falló la verificación del inicio de sesión.' });
    }
  } catch (error) {
    console.error('Error verifying passkey login:', error);
    return res.status(500).json({ error: 'Error al verificar credenciales.' });
  }
});

export default router;
