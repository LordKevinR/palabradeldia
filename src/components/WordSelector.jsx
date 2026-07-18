import React, { useRef, useEffect } from 'react';

export default function WordSelector({ activeIndex, wordsState, onChangeIndex }) {
  const activeTabRef = useRef(null);

  useEffect(() => {
    // Scroll active tab into view smoothly
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeIndex]);

  return (
    <div className="word-selector-container">
      <div className="word-selector">
        {Array.from({ length: 10 }).map((_, idx) => {
          const index = idx + 1;
          const wordState = wordsState[index] || { won: 0, attempts: 0 };
          const isActive = index === activeIndex;

          let dotClass = '';
          if (wordState.won === 1) {
            dotClass = 'won';
          } else if (wordState.attempts >= 6) {
            dotClass = 'lost';
          } else if (isActive) {
            dotClass = 'active';
          }

          return (
            <button
              key={index}
              ref={isActive ? activeTabRef : null}
              className={`word-tab ${isActive ? 'active' : ''}`}
              onClick={() => onChangeIndex(index)}
              id={`word-tab-${index}`}
            >
              <span>#{index}</span>
              <div className={`status-dot ${dotClass}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
