import React from 'react';
import { X, Award, Flame, Calendar, Percent } from 'lucide-react';

export default function StatsModal({ stats, onClose, activeWordSolution, gameStatus }) {
  const { gamesPlayed = 0, gamesWon = 0, currentStreak = 0, maxStreak = 0, guessDistribution = {} } = stats;

  const winPercentage = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  // Find max value in distribution to scale bars
  const distValues = Object.values(guessDistribution);
  const maxDistValue = distValues.length > 0 ? Math.max(...distValues, 1) : 1;

  return (
    <div className="modal-overlay" onClick={onClose} id="stats-modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Estadísticas</h2>
          <button className="icon-btn" onClick={onClose} id="close-stats-btn">
            <X size={20} />
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-val">{gamesPlayed}</div>
            <div className="stat-lbl">Jugadas</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{winPercentage}%</div>
            <div className="stat-lbl">Victorias</div>
          </div>
          <div className="stat-item">
            <div className="stat-val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
              <Flame size={20} fill={currentStreak > 0 ? "orange" : "none"} stroke={currentStreak > 0 ? "orange" : "currentColor"} />
              {currentStreak}
            </div>
            <div className="stat-lbl">Racha Act.</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{maxStreak}</div>
            <div className="stat-lbl">Racha Máx.</div>
          </div>
        </div>

        <h3>Distribución de Intentos</h3>
        <div className="dist-chart">
          {Object.keys(guessDistribution).map((attempts) => {
            const count = guessDistribution[attempts] || 0;
            const pct = Math.max((count / maxDistValue) * 100, 7); // minimum width for styling label inside

            // Highlight the row if the user just won in this number of attempts
            const isHighlighted = gameStatus && gameStatus.won === 1 && gameStatus.attempts === parseInt(attempts, 10);

            return (
              <div key={attempts} className="dist-row">
                <div className="dist-num">{attempts}</div>
                <div className="dist-bar-wrapper">
                  <div 
                    className={`dist-bar${isHighlighted ? ' highlight' : ''}`} 
                    style={{ width: `${pct}%` }}
                  >
                    {count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeWordSolution && (
          <div className="margin-top-md text-center flex-col gap-md align-center" style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <Award size={28} color="var(--color-correct)" />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                La palabra secreta era
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-correct)', letterSpacing: '4px', margin: '4px 0' }}>
                {activeWordSolution}
              </div>
            </div>
          </div>
        )}

        <div className="margin-top-md">
          <button className="btn btn-primary" onClick={onClose} id="confirm-stats-btn">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
