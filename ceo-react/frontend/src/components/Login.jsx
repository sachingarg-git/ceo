import React, { useState, useRef } from 'react';

export default function Login({ onLogin, loading, onSignUp }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [lampOn, setLampOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await onLogin(username, password);
    setSubmitting(false);
    if (!result?.success) {
      setError(result?.error || 'Invalid credentials. Please try again.');
    }
  }

  function toggleLamp() { setLampOn(v => !v); }
  function onPointerDown(e) { e.stopPropagation(); setDragging(true); startYRef.current = e.clientY; setDragY(0); }
  function onPointerMove(e) { if (!dragging) return; setDragY(Math.max(0, Math.min(60, e.clientY - startYRef.current))); }
  function onPointerUp() { if (!dragging) return; if (dragY > 30) toggleLamp(); setDragging(false); setDragY(0); }
  function handleCordClick(e) { e.stopPropagation(); toggleLamp(); }

  return (
    <div className="anime-login-bg" data-on={lampOn}>
      {!lampOn && (
        <div style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(0,210,255,0.4)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
          animation: 'pulse 2s infinite', zIndex: 2,
        }}>
          Pull the cord to turn on
        </div>
      )}

      <div className="anime-container">
        {/* Lamp */}
        <div className="lamp-wrapper">
          <svg className="lamp-svg" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
            <ellipse className="inner-glow" cx="100" cy="110" rx="60" ry="30" />
            <rect className="lamp-base-part" x="92" y="100" width="16" height="160" rx="8" />
            <rect className="lamp-base-part" x="60" y="250" width="80" height="12" rx="6" />
            <g className="pull-cord">
              <line className="cord-line" x1="130" y1="110" x2="130" y2={180 + dragY} stroke="#444" strokeWidth="2" />
              <circle className="cord-bead" cx="130" cy={190 + dragY} r="6" />
              <circle cx="130" cy={190 + dragY} r="25" fill="transparent" style={{ cursor: 'pointer' }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp} onClick={handleCordClick} />
            </g>
            <path className="lamp-shade" d="M30 110 C 30 50, 170 50, 170 110 C 170 125, 30 125, 30 110 Z" />
          </svg>
        </div>

        {/* Login Form */}
        <div className="anime-login-form" style={{
          opacity: lampOn ? 1 : 0,
          transform: lampOn ? 'translateY(0)' : 'translateY(30px)',
          pointerEvents: lampOn ? 'all' : 'none',
          border: lampOn ? '1px solid rgba(0,210,255,0.5)' : '1px solid rgba(0,210,255,0.2)',
          boxShadow: lampOn ? '0 0 50px rgba(0,210,255,0.15)' : '0 0 30px rgba(0,0,0,0.5)',
          transition: 'all 0.7s cubic-bezier(0.175,0.885,0.32,1.275)',
        }}>
          <h2>CEO LOGIN</h2>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'rgba(0,210,255,0.5)', letterSpacing: 3, textTransform: 'uppercase' }}>WIZONE IT NETWORK</div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="anime-form-group">
              <label>Access ID</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required />
            </div>
            <div className="anime-form-group">
              <label>Security Key</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button className="anime-login-btn" type="submit" disabled={submitting}>
              {submitting ? 'Authenticating...' : 'Initialize'}
            </button>
            {error && (
              <div style={{ color: '#ff4d4d', fontSize: 12, marginTop: 12, textAlign: 'center', textShadow: '0 0 10px rgba(255,77,77,0.3)' }}>{error}</div>
            )}
          </form>

          {/* Sign Up Link */}
          {onSignUp && (
            <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,210,255,0.15)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>New company?</div>
              <button onClick={onSignUp} style={{
                background: 'transparent', border: '1px solid rgba(0,210,255,0.3)', borderRadius: 10,
                color: '#00d2ff', fontSize: 12, fontWeight: 600, padding: '8px 24px', cursor: 'pointer',
                transition: '0.3s', letterSpacing: 1,
              }}
                onMouseOver={e => { e.target.style.background = 'rgba(0,210,255,0.1)'; e.target.style.borderColor = '#00d2ff'; }}
                onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'rgba(0,210,255,0.3)'; }}
              >
                SIGN UP WITH GST
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="anime-footer">
        CEO Productivity System &mdash; <b>WIZONE</b>
      </div>
    </div>
  );
}
