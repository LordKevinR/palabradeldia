import React from 'react';
import Cell from './Cell.jsx';

export default function Row({ guess, evaluation, isCurrent, isShake, focusedCellIndex, onCellClick }) {
  const cells = [];
  
  if (guess && evaluation) {
    // Previous guess row
    for (let i = 0; i < 5; i++) {
      cells.push(
        <Cell 
          key={i} 
          value={guess[i]} 
          status={evaluation[i]} 
          delayIndex={i} 
        />
      );
    }
  } else if (isCurrent) {
    // Current active row (user is typing)
    for (let i = 0; i < 5; i++) {
      const char = guess && guess[i] ? guess[i] : '';
      cells.push(
        <Cell 
          key={i} 
          value={char} 
          isPop={char !== ''}
          isFocused={i === focusedCellIndex}
          onClick={() => onCellClick && onCellClick(i)}
        />
      );
    }
  } else {
    // Empty future row
    for (let i = 0; i < 5; i++) {
      cells.push(<Cell key={i} value="" />);
    }
  }

  return (
    <div className={`grid-row${isShake ? ' shake' : ''}`}>
      {cells}
    </div>
  );
}
