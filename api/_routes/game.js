import express from 'express';
import db from './db.js';
import { getDailyWord, isValidWord, cleanWord } from './words.js';

const router = express.Router();

// Helper to evaluate guess letters (Wordle algorithm)
export function evaluateGuess(target, guess) {
  const result = Array(5).fill('absent');
  const targetLetters = target.split('');
  const guessLetters = guess.split('');
  const targetUsed = Array(5).fill(false);
  const guessUsed = Array(5).fill(false);

  // First pass: exact matches
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = 'correct';
      targetUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // Second pass: partial matches
  for (let i = 0; i < 5; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < 5; j++) {
      if (!targetUsed[j] && guessLetters[i] === targetLetters[j]) {
        result[i] = 'present';
        targetUsed[j] = true;
        break;
      }
    }
  }

  return result;
}

// Helper to get date difference in days (YYYY-MM-DD format)
function getDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return null;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Update user stats after a word is completed
async function updateUserStats(userId, won, attempts, dateStr) {
  try {
    // Fetch current stats
    const statsRes = await db.execute({
      sql: 'SELECT games_played, games_won, current_streak, max_streak, last_played_date, guess_distribution FROM user_stats WHERE user_id = ?',
      args: [userId]
    });

    let stats;
    if (statsRes.rows.length === 0) {
      // Create default
      stats = {
        games_played: 0,
        games_won: 0,
        current_streak: 0,
        max_streak: 0,
        last_played_date: null,
        guess_distribution: JSON.stringify({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })
      };
      await db.execute({
        sql: 'INSERT INTO user_stats (user_id, games_played, games_won, current_streak, max_streak, last_played_date, guess_distribution) VALUES (?, 0, 0, 0, 0, NULL, ?)',
        args: [userId, stats.guess_distribution]
      });
    } else {
      stats = statsRes.rows[0];
    }

    const dist = JSON.parse(stats.guess_distribution);
    let newPlayed = stats.games_played + 1;
    let newWon = stats.games_won + (won ? 1 : 0);
    let newCurrentStreak = stats.current_streak;
    let newMaxStreak = stats.max_streak;

    if (won) {
      dist[attempts] = (dist[attempts] || 0) + 1;
      
      if (!stats.last_played_date) {
        newCurrentStreak = 1;
      } else {
        const diff = getDaysDifference(stats.last_played_date, dateStr);
        if (diff === 1) {
          // Played consecutive day
          newCurrentStreak += 1;
        } else if (diff > 1) {
          // Streak broken
          newCurrentStreak = 1;
        }
        // If diff === 0, it is the same day. Streak remains unchanged.
      }
      newMaxStreak = Math.max(newMaxStreak, newCurrentStreak);
    } else {
      // Losing doesn't break the streak immediately if they still have other words to win today,
      // but we do not increment streak here.
    }

    await db.execute({
      sql: `UPDATE user_stats 
            SET games_played = ?, games_won = ?, current_streak = ?, max_streak = ?, last_played_date = ?, guess_distribution = ?
            WHERE user_id = ?`,
      args: [
        newPlayed,
        newWon,
        newCurrentStreak,
        newMaxStreak,
        won ? dateStr : (stats.last_played_date || dateStr),
        JSON.stringify(dist),
        userId
      ]
    });
  } catch (err) {
    console.error('Error updating user stats:', err);
  }
}

// Endpoint: Get progress of all 10 words for today
router.get('/today', async (req, res) => {
  const dateStr = req.query.date; // Client passes YYYY-MM-DD
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'Fecha requerida en formato YYYY-MM-DD.' });
  }

  const userId = req.user ? req.user.id : null;

  try {
    const results = [];
    
    // If user is logged in, fetch guesses from DB
    let dbGuessesMap = new Map();
    if (userId) {
      const guessesRes = await db.execute({
        sql: 'SELECT word_index, guesses, won, attempts FROM user_guesses WHERE user_id = ? AND date = ?',
        args: [userId, dateStr]
      });
      guessesRes.rows.forEach(row => {
        dbGuessesMap.set(row.word_index, row);
      });
    }

    // Generate 10 entries
    for (let index = 1; index <= 10; index++) {
      const correctWord = getDailyWord(dateStr, index);
      const dbRecord = dbGuessesMap.get(index);
      
      let guesses = [];
      let won = 0;
      let attempts = 0;

      if (dbRecord) {
        guesses = JSON.parse(dbRecord.guesses);
        won = dbRecord.won;
        attempts = dbRecord.attempts;
      }

      // Hide the solution unless the user completed the word (won=1 or attempts=6)
      const finished = won === 1 || attempts >= 6;
      const evaluations = guesses.map(g => evaluateGuess(correctWord, g));
      results.push({
        index,
        guesses,
        evaluations,
        won,
        attempts,
        solution: finished ? correctWord : null
      });
    }

    return res.json({ date: dateStr, words: results });
  } catch (error) {
    console.error('Error fetching today game states:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Endpoint: Submit a guess
router.post('/guess', async (req, res) => {
  const { date, index, guess } = req.body;
  
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Fecha inválida.' });
  }
  const wordIndex = parseInt(index, 10);
  if (isNaN(wordIndex) || wordIndex < 1 || wordIndex > 10) {
    return res.status(400).json({ error: 'Índice de palabra inválido (debe ser 1 a 10).' });
  }
  if (!guess || guess.length !== 5) {
    return res.status(400).json({ error: 'El intento debe tener exactamente 5 letras.' });
  }

  const cleanedGuess = cleanWord(guess);
  if (!isValidWord(cleanedGuess)) {
    return res.status(400).json({ error: 'La palabra no existe en el diccionario español.' });
  }

  const targetWord = getDailyWord(date, wordIndex);
  const evaluation = evaluateGuess(targetWord, cleanedGuess);
  const isCorrect = targetWord === cleanedGuess;

  const userId = req.user ? req.user.id : null;

  try {
    let guesses = [];
    let won = 0;
    let attempts = 0;

    if (userId) {
      // 1. Fetch current progress from DB
      const progressRes = await db.execute({
        sql: 'SELECT id, guesses, won, attempts FROM user_guesses WHERE user_id = ? AND date = ? AND word_index = ?',
        args: [userId, date, wordIndex]
      });

      if (progressRes.rows.length > 0) {
        const record = progressRes.rows[0];
        guesses = JSON.parse(record.guesses);
        won = record.won;
        attempts = record.attempts;

        if (won || attempts >= 6) {
          return res.status(400).json({ error: 'Ya has completado esta palabra.' });
        }
      }

      // Add the new guess
      guesses.push(cleanedGuess);
      attempts += 1;
      won = isCorrect ? 1 : 0;

      // 2. Save guess to DB
      if (progressRes.rows.length > 0) {
        await db.execute({
          sql: 'UPDATE user_guesses SET guesses = ?, won = ?, attempts = ? WHERE user_id = ? AND date = ? AND word_index = ?',
          args: [JSON.stringify(guesses), won, attempts, userId, date, wordIndex]
        });
      } else {
        const id = crypto.randomUUID();
        await db.execute({
          sql: 'INSERT INTO user_guesses (id, user_id, date, word_index, guesses, won, attempts) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [id, userId, date, wordIndex, JSON.stringify(guesses), won, attempts]
        });
      }

      // 3. Update stats if game finished
      if (won || attempts >= 6) {
        await updateUserStats(userId, won === 1, attempts, date);
      }
    } else {
      // Guest logic: we don't save to DB but we check attempts to return correct word if completed
      // The client holds guesses, but sends them all or just the current state.
      // Let's assume the client tracks the count and checks if finished.
      // We will let the client pass their current guesses list so we can double-check state.
      const clientGuesses = req.body.clientGuesses || [];
      guesses = [...clientGuesses, cleanedGuess];
      attempts = guesses.length;
      won = isCorrect ? 1 : 0;
    }

    const finished = won === 1 || attempts >= 6;

    return res.json({
      success: true,
      evaluation,
      won,
      attempts,
      guesses,
      solution: finished ? targetWord : null
    });
  } catch (error) {
    console.error('Error handling guess:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Endpoint: Fetch stats
router.get('/stats', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión para ver estadísticas.' });
  }

  const userId = req.user.id;

  try {
    const statsRes = await db.execute({
      sql: 'SELECT games_played, games_won, current_streak, max_streak, last_played_date, guess_distribution FROM user_stats WHERE user_id = ?',
      args: [userId]
    });

    if (statsRes.rows.length === 0) {
      return res.json({
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        lastPlayedDate: null,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      });
    }

    const stats = statsRes.rows[0];
    return res.json({
      gamesPlayed: stats.games_played,
      gamesWon: stats.games_won,
      currentStreak: stats.current_streak,
      maxStreak: stats.max_streak,
      lastPlayedDate: stats.last_played_date,
      guessDistribution: JSON.parse(stats.guess_distribution)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

// Endpoint: Sync guest progress to DB when they log in
router.post('/sync', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const userId = req.user.id;
  const { localGames } = req.body; // Array of { date, index, guesses, won, attempts }

  if (!Array.isArray(localGames) || localGames.length === 0) {
    return res.json({ success: true, message: 'Nada que sincronizar.' });
  }

  try {
    for (const game of localGames) {
      const { date, index, guesses, won, attempts } = game;
      if (!date || !index || !Array.isArray(guesses)) continue;

      // Check if DB already has progress for this word
      const checkRes = await db.execute({
        sql: 'SELECT id FROM user_guesses WHERE user_id = ? AND date = ? AND word_index = ?',
        args: [userId, date, index]
      });

      if (checkRes.rows.length === 0) {
        // Safe to insert local game
        const id = crypto.randomUUID();
        await db.execute({
          sql: 'INSERT INTO user_guesses (id, user_id, date, word_index, guesses, won, attempts) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [id, userId, date, index, JSON.stringify(guesses), won, attempts]
        });

        // If completed, update user stats
        if (won || attempts >= 6) {
          await updateUserStats(userId, won === 1, attempts, date);
        }
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error syncing guest progress:', error);
    return res.status(500).json({ error: 'Error al sincronizar el progreso.' });
  }
});

export default router;
