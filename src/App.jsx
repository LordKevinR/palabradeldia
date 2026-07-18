import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import WordSelector from './components/WordSelector.jsx';
import Grid from './components/Grid.jsx';
import Keyboard from './components/Keyboard.jsx';
import StatsModal from './components/StatsModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import { Award, Copy, CheckCircle2, RotateCcw, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeIndex, setActiveIndex] = useState(() => {
    const saved = localStorage.getItem('palabradeldia_last_word_index');
    const parsed = parseInt(saved, 10);
    return parsed >= 1 && parsed <= 10 ? parsed : 1;
  });
  const [dateStr, setDateStr] = useState('');
  const [todayDateStr, setTodayDateStr] = useState('');
  const [currentGuess, setCurrentGuess] = useState(['', '', '', '', '']);
  const [focusedCellIndex, setFocusedCellIndex] = useState(0);
  const [isShake, setIsShake] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // 'help' | 'stats' | 'auth' | null
  const [submitting, setSubmitting] = useState(false);
  
  // Game states for all 10 words
  // Format: { [index]: { guesses: [], evaluations: [], won: 0, attempts: 0, solution: null } }
  const [wordsState, setWordsState] = useState({});
  
  // Consolidated stats
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  });

  // Toast notifications helper
  const showToast = useCallback((msg, duration = 2000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  // Format local date YYYY-MM-DD
  useEffect(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    setDateStr(today);
    setTodayDateStr(today);
  }, []);

  const handlePrevDay = () => {
    if (!dateStr) return;
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDateStr(`${year}-${month}-${day}`);
    setCurrentGuess(['', '', '', '', '']);
    setFocusedCellIndex(0);
  };

  const handleNextDay = () => {
    if (!dateStr || dateStr === todayDateStr) return;
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDateStr(`${year}-${month}-${day}`);
    setCurrentGuess(['', '', '', '', '']);
    setFocusedCellIndex(0);
  };

  const handleDateChange = (e) => {
    const selected = e.target.value;
    if (!selected) return;
    if (selected > todayDateStr) {
      showToast('No puedes jugar en el futuro.');
      return;
    }
    setDateStr(selected);
    setCurrentGuess(['', '', '', '', '']);
    setFocusedCellIndex(0);
  };

  const getFormattedDate = () => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // 1. Fetch User Session on Load
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not logged in');
      })
      .then(data => {
        if (data.user) {
          setUser(data.user);
        } else {
          setModal('auth');
        }
      })
      .catch(() => {
        setModal('auth');
      });
  }, []);

  // 2. Fetch or Load Stats & Progress
  const loadGameData = useCallback(async () => {
    if (!dateStr) return;

    if (user) {
      // Authenticated flow: fetch from API
      try {
        // Today's words
        const todayRes = await fetch(`/api/game/today?date=${dateStr}`);
        const todayData = await todayRes.json();
        if (todayData.words) {
          const newState = {};
          todayData.words.forEach(w => {
            newState[w.index] = {
              guesses: w.guesses || [],
              evaluations: w.evaluations || [],
              won: w.won || 0,
              attempts: w.attempts || 0,
              solution: w.solution || null
            };
          });
          setWordsState(newState);
        }

        // Stats
        const statsRes = await fetch('/api/game/stats');
        const statsData = await statsRes.json();
        setStats({
          gamesPlayed: statsData.gamesPlayed || 0,
          gamesWon: statsData.gamesWon || 0,
          currentStreak: statsData.currentStreak || 0,
          maxStreak: statsData.maxStreak || 0,
          lastPlayedDate: statsData.lastPlayedDate || null,
          guessDistribution: statsData.guessDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
        });
      } catch (err) {
        console.error('Error loading API game data:', err);
        showToast('Error al conectar con el servidor.');
      }
    } else {
      // Guest flow: load from localStorage
      // Daily guesses
      const localDailyKey = `palabradeldia_daily_${dateStr}`;
      const savedDaily = localStorage.getItem(localDailyKey);
      
      const defaultState = {};
      for (let i = 1; i <= 10; i++) {
        defaultState[i] = { guesses: [], evaluations: [], won: 0, attempts: 0, solution: null };
      }
      
      if (savedDaily) {
        try {
          const parsed = JSON.parse(savedDaily);
          setWordsState({ ...defaultState, ...parsed });
        } catch (e) {
          setWordsState(defaultState);
        }
      } else {
        setWordsState(defaultState);
      }

      // Stats
      const savedStats = localStorage.getItem('palabradeldia_stats');
      if (savedStats) {
        try {
          setStats(JSON.parse(savedStats));
        } catch (e) {
          // Keep default stats
        }
      }
    }
  }, [dateStr, user, showToast]);

  useEffect(() => {
    loadGameData();
  }, [loadGameData]);

  // 3. Sync LocalStorage Guest Data to DB on Login
  const handleAuthSuccess = async (loggedInUser) => {
    setUser(loggedInUser);
    showToast(`¡Bienvenido @${loggedInUser.username}!`);
    setModal(null);

    // Sync guest progress to DB
    const keys = Object.keys(localStorage);
    const localGames = [];

    keys.forEach(key => {
      if (key.startsWith('palabradeldia_daily_')) {
        const date = key.replace('palabradeldia_daily_', '');
        try {
          const dailyData = JSON.parse(localStorage.getItem(key));
          Object.keys(dailyData).forEach(index => {
            const game = dailyData[index];
            if (game.attempts > 0) {
              localGames.push({
                date,
                index: parseInt(index, 10),
                guesses: game.guesses,
                won: game.won,
                attempts: game.attempts
              });
            }
          });
        } catch (e) {
          // Skip corrupted data
        }
      }
    });

    if (localGames.length > 0) {
      try {
        const syncRes = await fetch('/api/auth/game/sync', { // wait, our endpoint is /api/game/sync!
          // Ah, in game.js we wrote router.post('/sync') and mounted app.use('/api/game', gameRouter).
          // So it is /api/game/sync ! Let's fix this URL path.
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localGames })
        });
        
        if (syncRes.ok) {
          // Clear synced local storage daily keys to avoid re-syncing
          localGames.forEach(g => {
            localStorage.removeItem(`palabradeldia_daily_${g.date}`);
          });
        }
      } catch (err) {
        console.error('Error syncing local progress:', err);
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    showToast('Sesión cerrada.');
    setModal('auth');
  };

  // Keyboard character status calculation
  const getCharStatuses = () => {
    const currentWordState = wordsState[activeIndex] || { guesses: [], evaluations: [] };
    const { guesses, evaluations } = currentWordState;
    const statuses = {};

    guesses.forEach((guess, guessIdx) => {
      const evaluation = evaluations[guessIdx] || [];
      for (let i = 0; i < guess.length; i++) {
        const char = guess[i];
        const status = evaluation[i];
        
        if (!statuses[char]) {
          statuses[char] = status;
        } else if (statuses[char] === 'present' && status === 'correct') {
          statuses[char] = 'correct';
        } else if (statuses[char] === 'absent' && (status === 'correct' || status === 'present')) {
          statuses[char] = status;
        }
      }
    });

    return statuses;
  };

  const activeWordState = wordsState[activeIndex] || { guesses: [], evaluations: [], won: 0, attempts: 0, solution: null };

  // 4. Handle Typing and Submitting Guesses
  const onChar = (char) => {
    if (activeWordState.won === 1 || activeWordState.attempts >= 6) return;
    
    // Normalize Ñ to keep it, but ignore non-alphabetical characters
    const upperChar = char.toUpperCase();
    if (/^[A-ZÑ]$/.test(upperChar)) {
      const nextGuess = [...currentGuess];
      nextGuess[focusedCellIndex] = upperChar;
      setCurrentGuess(nextGuess);
      
      // Auto-advance focus to the next empty cell (wrapping around)
      let nextFocus = focusedCellIndex;
      for (let i = 1; i <= 5; i++) {
        const idx = (focusedCellIndex + i) % 5;
        if (nextGuess[idx] === '') {
          nextFocus = idx;
          break;
        }
      }
      setFocusedCellIndex(nextFocus);
    }
  };

  const onDelete = () => {
    if (activeWordState.won === 1 || activeWordState.attempts >= 6) return;
    
    const nextGuess = [...currentGuess];
    if (nextGuess[focusedCellIndex] !== '') {
      // Clear focused cell if it's not empty, keep focus there
      nextGuess[focusedCellIndex] = '';
      setCurrentGuess(nextGuess);
    } else if (focusedCellIndex > 0) {
      // If already empty, move focus to the previous cell and clear it (only if not already at the first cell)
      const prevFocus = focusedCellIndex - 1;
      nextGuess[prevFocus] = '';
      setCurrentGuess(nextGuess);
      setFocusedCellIndex(prevFocus);
    }
  };

  const onEnter = async () => {
    if (activeWordState.won === 1 || activeWordState.attempts >= 6 || submitting) return;
    
    const guessString = currentGuess.join('');
    if (guessString.length !== 5) {
      showToast('No hay suficientes letras.');
      setIsShake(true);
      setTimeout(() => setIsShake(false), 500);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/game/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          index: activeIndex,
          guess: guessString,
          clientGuesses: activeWordState.guesses
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'La palabra no es válida.');
        setIsShake(true);
        setTimeout(() => setIsShake(false), 500);
        setSubmitting(false);
        return;
      }

      // Update state for active word
      const updatedWordState = {
        guesses: data.guesses,
        evaluations: data.guesses.map((_, idx) => {
          // If server returns evaluation for the last guess, use it
          if (idx === data.guesses.length - 1) return data.evaluation;
          // Otherwise, reuse previous evaluations
          return activeWordState.evaluations[idx];
        }),
        won: data.won,
        attempts: data.attempts,
        solution: data.solution
      };

      const newWordsState = {
        ...wordsState,
        [activeIndex]: updatedWordState
      };

      setWordsState(newWordsState);
      setCurrentGuess(['', '', '', '', '']);
      setFocusedCellIndex(0);

      // Save to localStorage if guest
      if (!user) {
        localStorage.setItem(`palabradeldia_daily_${dateStr}`, JSON.stringify(newWordsState));
        
        // Update local stats if finished
        if (data.won === 1 || data.attempts >= 6) {
          const dist = { ...stats.guessDistribution };
          let newPlayed = stats.gamesPlayed + 1;
          let newWon = stats.gamesWon;
          let newCurrentStreak = stats.currentStreak;
          let newMaxStreak = stats.maxStreak;

          if (data.won === 1) {
            newWon += 1;
            dist[data.attempts] = (dist[data.attempts] || 0) + 1;
            
            // Check streak
            if (!stats.lastPlayedDate) {
              newCurrentStreak = 1;
            } else {
              // Quick date difference calculation
              const last = new Date(stats.lastPlayedDate);
              const current = new Date(dateStr);
              const diffTime = Math.abs(current - last);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays === 1) {
                newCurrentStreak += 1;
              } else if (diffDays > 1) {
                newCurrentStreak = 1;
              }
            }
            newMaxStreak = Math.max(newMaxStreak, newCurrentStreak);
          }

          const newStats = {
            gamesPlayed: newPlayed,
            gamesWon: newWon,
            currentStreak: newCurrentStreak,
            maxStreak: newMaxStreak,
            lastPlayedDate: data.won === 1 ? dateStr : (stats.lastPlayedDate || dateStr),
            guessDistribution: dist
          };

          setStats(newStats);
          localStorage.setItem('palabradeldia_stats', JSON.stringify(newStats));
        }
      } else {
        // Authenticated: fetch latest stats from backend
        const statsRes = await fetch('/api/game/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats({
            gamesPlayed: statsData.gamesPlayed || 0,
            gamesWon: statsData.gamesWon || 0,
            currentStreak: statsData.currentStreak || 0,
            maxStreak: statsData.maxStreak || 0,
            lastPlayedDate: statsData.lastPlayedDate || null,
            guessDistribution: statsData.guessDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
          });
        }
      }

      // Check results toasts
      if (data.won === 1) {
        showToast(getRandomWinMsg());
        setTimeout(() => setModal('stats'), 1500);
      } else if (data.attempts >= 6) {
        showToast(`Se agotaron los intentos. Solución: ${data.solution}`);
        setTimeout(() => setModal('stats'), 2000);
      }

    } catch (err) {
      console.error(err);
      showToast('Error de red al procesar palabra.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRandomWinMsg = () => {
    const msgs = ['¡Sensacional!', '¡Magnífico!', '¡Excelente!', '¡Genial!', '¡Muy bien!', '¡Logrado!'];
    return msgs[Math.floor(Math.random() * msgs.length)];
  };

  // 5. Physical Keyboard Input Support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (modal) return; // Ignore typing if modal is open
      
      if (e.key === 'Enter') {
        onEnter();
      } else if (e.key === 'Backspace') {
        onDelete();
      } else {
        onChar(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, activeWordState, modal]);

  // 6. Share result grid (viral feature)
  const handleShareResult = () => {
    if (activeWordState.attempts === 0) return;
    
    let resultGrid = `La Palabra del Día #${activeIndex} (${activeWordState.won ? activeWordState.attempts : 'X'}/6)\n\n`;
    
    activeWordState.evaluations.forEach(row => {
      const emojis = row.map(status => {
        if (status === 'correct') return '🟩';
        if (status === 'present') return '🟨';
        return '⬛';
      }).join('');
      resultGrid += `${emojis}\n`;
    });
    
    resultGrid += '\nJuega aquí: ' + window.location.origin;
    
    navigator.clipboard.writeText(resultGrid)
      .then(() => showToast('¡Resultados copiados al portapapeles!'))
      .catch(() => showToast('Error al copiar resultados.'));
  };

  return (
    <>
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>

      {/* Main Layout */}
      <Header 
        user={user} 
        onOpenAuth={() => setModal('auth')} 
        onOpenStats={() => setModal('stats')} 
        onOpenHelp={() => setModal('help')} 
      />

      <div className="date-navigator">
        <button onClick={handlePrevDay} className="date-nav-btn" title="Día Anterior">
          &larr;
        </button>
        <div className="date-picker-wrapper">
          <input 
            type="date" 
            value={dateStr} 
            max={todayDateStr}
            onChange={handleDateChange} 
            className="date-input"
          />
          <span className="date-display">{getFormattedDate()}</span>
        </div>
        <button 
          onClick={handleNextDay} 
          className="date-nav-btn" 
          disabled={dateStr === todayDateStr}
          title="Día Siguiente"
        >
          &rarr;
        </button>
      </div>

      <WordSelector 
        activeIndex={activeIndex} 
        wordsState={wordsState} 
        onChangeIndex={(idx) => {
          setActiveIndex(idx);
          localStorage.setItem('palabradeldia_last_word_index', idx);
          setCurrentGuess(['', '', '', '', '']);
          setFocusedCellIndex(0);
        }} 
      />

      <Grid 
        guesses={activeWordState.guesses} 
        evaluations={activeWordState.evaluations} 
        currentGuess={currentGuess} 
        isShake={isShake} 
        focusedCellIndex={focusedCellIndex}
        onCellClick={(idx) => {
          if (activeWordState.won !== 1 && activeWordState.attempts < 6) {
            setFocusedCellIndex(idx);
          }
        }}
      />

      {/* Share card helper at top of board if finished */}
      {(activeWordState.won === 1 || activeWordState.attempts >= 6) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '10px' }}>
          <button className="btn btn-primary" onClick={handleShareResult} style={{ width: 'auto', borderRadius: '20px', padding: '8px 16px', fontSize: '13px' }}>
            <Copy size={14} /> Compartir #{activeIndex}
          </button>
        </div>
      )}

      <Keyboard 
        charStatuses={getCharStatuses()} 
        onChar={onChar} 
        onEnter={onEnter} 
        onDelete={onDelete} 
      />

      {/* Help Modal */}
      {modal === 'help' && (
        <div className="modal-overlay" onClick={() => setModal(null)} id="help-modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cómo jugar</h2>
              <button className="icon-btn" onClick={() => setModal(null)} id="close-help-btn">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-col gap-md help-text">
              <p>Adivina la palabra oculta en 6 intentos.</p>
              <p>Cada palabra del día tiene exactamente 5 letras. Tienes <strong>10 palabras diferentes por día</strong> para competir.</p>
              <p>Cada intento debe ser una palabra válida en español. Las tildes no importan.</p>
              <p>Después de cada intento, el color de las letras cambiará para mostrar qué tan cerca estás:</p>
              
              <div className="help-example-grid">
                <div className="help-example-cell correct">V</div>
                <div className="help-example-cell">E</div>
                <div className="help-example-cell">R</div>
                <div className="help-example-cell">D</div>
                <div className="help-example-cell">E</div>
              </div>
              <p>La letra <strong>V</strong> está en la palabra y en la posición correcta.</p>

              <div className="help-example-grid">
                <div className="help-example-cell">C</div>
                <div className="help-example-cell present">A</div>
                <div className="help-example-cell">L</div>
                <div className="help-example-cell">O</div>
                <div className="help-example-cell">R</div>
              </div>
              <p>La letra <strong>A</strong> está en la palabra pero en una posición incorrecta.</p>

              <div className="help-example-grid">
                <div className="help-example-cell">M</div>
                <div className="help-example-cell">U</div>
                <div className="help-example-cell absent">N</div>
                <div className="help-example-cell">D</div>
                <div className="help-example-cell">O</div>
              </div>
              <p>La letra <strong>N</strong> no forma parte de la palabra.</p>

              <p style={{ fontWeight: 600, color: 'var(--color-correct)', marginTop: '8px' }}>
                ¡Registra una Passkey en tu perfil para no perder tus estadísticas y jugar desde cualquier iPhone o móvil!
              </p>
            </div>

            <div className="margin-top-md">
              <button className="btn btn-primary" onClick={() => setModal(null)} id="confirm-help-btn">
                ¡Entendido!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {modal === 'stats' && (
        <StatsModal 
          stats={stats} 
          onClose={() => setModal(null)} 
          activeWordSolution={activeWordState.solution}
          gameStatus={{ won: activeWordState.won, attempts: activeWordState.attempts }}
        />
      )}

      {/* Auth / Profile Modal */}
      {modal === 'auth' && (
        <AuthModal 
          user={user} 
          onClose={user ? () => setModal(null) : undefined} 
          onAuthSuccess={handleAuthSuccess} 
          onLogout={handleLogout} 
        />
      )}
    </>
  );
}
