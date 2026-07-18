import React from 'react';

export default function Cell({ value, status, delayIndex, isPop, isFocused, onClick }) {
  const statusClass = status ? ` ${status}` : '';
  const delayClass = status && delayIndex !== undefined ? ` delay-${delayIndex}` : '';
  const popClass = isPop ? ' pop' : '';
  const focusClass = isFocused ? ' focused' : '';
  const clickableClass = onClick ? ' clickable' : '';

  return (
    <div 
      className={`cell${statusClass}${delayClass}${popClass}${focusClass}${clickableClass}`}
      onClick={onClick}
    >
      {value}
    </div>
  );
}
