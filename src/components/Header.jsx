import React from 'react';
import { HelpCircle, BarChart2, User, LogOut } from 'lucide-react';

export default function Header({ user, onOpenAuth, onOpenStats, onOpenHelp }) {
  return (
    <header>
      <button className="icon-btn" onClick={onOpenHelp} title="Cómo jugar" id="help-btn">
        <HelpCircle size={22} />
      </button>
      
      <h1>Palabras Diarias</h1>
      
      <div className="header-icons">
        <button className="icon-btn" onClick={onOpenStats} title="Estadísticas" id="stats-btn">
          <BarChart2 size={22} />
        </button>
        <button 
          className={`icon-btn ${user ? 'active' : ''}`} 
          onClick={onOpenAuth} 
          title={user ? `Usuario: ${user.username}` : 'Iniciar sesión'}
          id="auth-btn"
          style={user ? { color: 'var(--color-correct)' } : {}}
        >
          <User size={22} />
        </button>
      </div>
    </header>
  );
}
