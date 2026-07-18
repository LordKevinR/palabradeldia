import React, { useState } from 'react';
import { X, Key, Fingerprint, Lock, ShieldCheck, LogOut, ArrowRight, UserPlus } from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export default function AuthModal({ user, onClose, onAuthSuccess, onLogout }) {
  const [step, setStep] = useState(user ? 'profile' : 'username'); // username -> (login_options | register) -> profile
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hasPasskey, setHasPasskey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Check if username exists
  const handleCheckUsername = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }

      setHasPasskey(data.hasPasskey);
      if (data.exists) {
        setStep('login_options');
      } else {
        setStep('register');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Login with Password
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión.');
        return;
      }

      onAuthSuccess(data.user);
      setStep('profile');
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Register with Password
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error en el registro.');
        return;
      }

      onAuthSuccess(data.user);
      setStep('profile');
      setSuccessMsg('¡Cuenta creada con éxito! Ahora puedes registrar una Passkey para no usar contraseñas.');
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Passkey Login
  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Get options
      const optionsRes = await fetch('/api/auth/passkey/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      if (!optionsRes.ok) {
        const errData = await optionsRes.json();
        setError(errData.error || 'Error al obtener opciones de Passkey.');
        return;
      }
      
      const options = await optionsRes.json();

      // Trigger WebAuthn API via simplewebauthn
      const authResp = await startAuthentication(options);

      // Verify response
      const verifyRes = await fetch('/api/auth/passkey/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          ...authResp
        })
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.error || 'Error de verificación de Passkey.');
        return;
      }

      onAuthSuccess(verifyData.user);
      setStep('profile');
    } catch (err) {
      console.error(err);
      if (err.name === 'NotAllowedError') {
        setError('Inicio de sesión cancelado o denegado.');
      } else {
        setError('Error al autenticar con Passkey.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 5. Register new Passkey (logged-in state)
  const handleRegisterPasskey = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const optionsRes = await fetch('/api/auth/passkey/register-options', {
        method: 'POST'
      });

      if (!optionsRes.ok) {
        const errData = await optionsRes.json();
        setError(errData.error || 'Error al obtener opciones de registro.');
        return;
      }

      const options = await optionsRes.json();
      const regResp = await startRegistration(options);

      const verifyRes = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regResp)
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.error || 'Error al verificar la Passkey.');
        return;
      }

      setSuccessMsg('¡Passkey registrada con éxito! Ya puedes iniciar sesión con FaceID/Huella en este dispositivo.');
      setHasPasskey(true);
    } catch (err) {
      console.error(err);
      if (err.name === 'NotAllowedError') {
        setError('Registro cancelado por el usuario.');
      } else {
        setError('Error al registrar Passkey.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      onLogout();
      setUsername('');
      setPassword('');
      setStep('username');
      setSuccessMsg('');
    } catch (err) {
      console.error(err);
      setError('Error al cerrar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="auth-modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {step === 'profile' ? 'Tu Cuenta' : 'Acceso Jugadores'}
          </h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} id="close-auth-btn">
              <X size={20} />
            </button>
          )}
        </div>

        {error && <div className="error-msg">{error}</div>}
        {successMsg && <div style={{ color: 'var(--color-correct)', fontSize: '13px', textAlign: 'center', marginBottom: '12px', fontWeight: 500 }}>{successMsg}</div>}

        {step === 'username' && (
          <form onSubmit={handleCheckUsername} className="flex-col gap-md">
            <p className="help-text text-center">
              Ingresa tu nombre de usuario para iniciar sesión o registrarte.
            </p>
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                placeholder="Ej. mi_apodo"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} id="auth-username-next-btn">
              {loading ? 'Cargando...' : 'Siguiente'} <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === 'login_options' && (
          <div className="flex-col gap-md">
            <p className="help-text text-center">
              Inicia sesión como <strong>@{username}</strong>.
            </p>

            {hasPasskey && (
              <button 
                onClick={handlePasskeyLogin} 
                className="btn btn-passkey" 
                disabled={loading}
                id="login-passkey-btn"
              >
                <Fingerprint size={20} />
                {loading ? 'Autenticando...' : 'Acceder con Passkey'}
              </button>
            )}

            {hasPasskey && <div className="divider">o usa tu contraseña</div>}

            <form onSubmit={handlePasswordLogin} className="flex-col gap-md">
              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="Tu contraseña"
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn btn-secondary" disabled={loading} id="login-password-btn">
                {loading && !hasPasskey ? 'Cargando...' : 'Iniciar Sesión'}
              </button>
            </form>

            <button 
              className="btn btn-secondary" 
              onClick={() => { setStep('username'); setError(''); }}
              disabled={loading}
              style={{ border: 'none', color: 'var(--text-secondary)' }}
            >
              Volver
            </button>
          </div>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegister} className="flex-col gap-md">
            <p className="help-text text-center">
              El usuario <strong>@{username}</strong> está disponible. Registra una contraseña para crear tu cuenta.
            </p>
            <div className="form-group">
              <label htmlFor="reg-password">Contraseña (Mín. 4 caracteres)</label>
              <input
                type="password"
                id="reg-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Crea una contraseña"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} id="register-btn">
              <UserPlus size={16} /> {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => { setStep('username'); setError(''); }}
              disabled={loading}
              style={{ border: 'none', color: 'var(--text-secondary)' }}
            >
              Volver
            </button>
          </form>
        )}

        {step === 'profile' && (
          <div className="flex-col gap-md align-center text-center">
            <ShieldCheck size={48} color="var(--color-correct)" />
            <div>
              <div className="user-badge">@{user?.username}</div>
              <p className="help-text">
                Tu progreso y estadísticas están sincronizados de forma segura con la nube.
              </p>
            </div>

            <button 
              onClick={handleRegisterPasskey} 
              className="btn btn-passkey margin-top-md" 
              disabled={loading}
              id="register-passkey-btn"
            >
              <Fingerprint size={20} />
              {hasPasskey ? 'Registrar otra Passkey' : 'Activar Passkey en este móvil'}
            </button>

            <div className="logout-btn-container w-full">
              <button onClick={handleLogout} className="btn btn-secondary" disabled={loading} id="logout-btn">
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
