import React from 'react';
import Row from './Row.jsx';

export default function Grid({ guesses, evaluations, currentGuess, isShake, focusedCellIndex, onCellClick }) {
  const rows = [];
  
  // Render 6 rows total
  for (let i = 0; i < 6; i++) {
    if (i < guesses.length) {
      // Previous guess
      rows.push(
        <Row 
          key={i} 
          guess={guesses[i]} 
          evaluation={evaluations[i]} 
        />
      );
    } else if (i === guesses.length) {
      // Current active guess row
      rows.push(
        <Row 
          key={i} 
          guess={currentGuess} 
          isCurrent={true} 
          isShake={isShake} 
          focusedCellIndex={focusedCellIndex}
          onCellClick={onCellClick}
        />
      );
    } else {
      // Empty future row
      rows.push(<Row key={i} />);
    }
  }

  return (
    <div className="board-container">
      <div className="grid">
        {rows}
      </div>
    </div>
  );
}
