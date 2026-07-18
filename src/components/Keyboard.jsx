import React from 'react';
import { Check } from 'lucide-react';

export default function Keyboard({ charStatuses, onChar, onEnter, onDelete }) {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
  ];

  const handleKeyClick = (key) => {
    if (key === 'ENTER') {
      onEnter();
    } else if (key === 'BACKSPACE') {
      onDelete();
    } else {
      onChar(key);
    }
  };

  return (
    <div className="keyboard">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="keyboard-row">
          {row.map((key) => {
            const status = charStatuses[key];
            const statusClass = status ? ` ${status}` : '';
            
            if (key === 'ENTER') {
              return (
                <button
                  key={key}
                  className="key wide"
                  onClick={() => handleKeyClick(key)}
                  id="key-enter"
                >
                  <Check size={18} />
                </button>
              );
            }
            
            if (key === 'BACKSPACE') {
              return (
                <button
                  key={key}
                  className="key wide"
                  onClick={() => handleKeyClick(key)}
                  id="key-backspace"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0 -2-2z"></path>
                    <line x1="18" y1="9" x2="12" y2="15"></line>
                    <line x1="12" y1="9" x2="18" y2="15"></line>
                  </svg>
                </button>
              );
            }

            return (
              <button
                key={key}
                className={`key${statusClass}`}
                onClick={() => handleKeyClick(key)}
                id={`key-${key}`}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
