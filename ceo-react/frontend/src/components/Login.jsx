import React, { useState } from 'react';

export default function Login({ onLogin, loading, onSignUp }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

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

  return (
    <div className="login-page-bg">

      {/* Brand Header with Logo */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <img src="/wizone-logo.png" alt="Wizone AI Labs" style={{ height: 60, marginBottom: 6 }} />
        <div style={{ fontSize: 18, color: '#1E293B', letterSpacing: 3, fontWeight: 800 }}>EA to M.D</div>
      </div>

      {/* Sliding Login/Register Container */}
      <div className={`login-container${isRegisterMode ? ' active' : ''}`}>
        {/* Login Form */}
        <div className="login-form-box login-side">
          <form onSubmit={handleSubmit}>
            <h1>Login</h1>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: -6, marginBottom: 18 }}>Access your productivity dashboard</p>
            <div className="login-input-box">
              <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
              <i className="login-icon">&#128100;</i>
            </div>
            <div className="login-input-box">
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <i className="login-icon">&#128274;</i>
            </div>
            <button type="submit" className="login-btn-submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Login'}
            </button>
            {error && <div className="login-error">{error}</div>}
          </form>
        </div>

        {/* Register Panel */}
        <div className="login-form-box register-side">
          <form onSubmit={e => { e.preventDefault(); if (onSignUp) onSignUp('gst'); }}>
            <h1>Sign Up</h1>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: -6, marginBottom: 12 }}>Register your company with GST</p>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 70, height: 70, borderRadius: 20, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 12 }}>&#127970;</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>Company Registration</div>
              <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                Verify your GST number to register<br />your company and get started
              </div>
            </div>
            <button type="submit" className="login-btn-submit" style={{ marginBottom: 10 }}>
              Register with GST &rarr;
            </button>
            <button
              type="button"
              onClick={() => onSignUp && onSignUp('no-gst')}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8,
                border: '1.5px solid #CBD5E1', background: '#fff',
                color: '#475569', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Register without GST Number
            </button>
          </form>
        </div>

        {/* Toggle Panel */}
        <div className="login-toggle-box">
          <div className="login-toggle-panel login-toggle-left">
            <h1>Hello, Welcome!</h1>
            <p>Don't have an account?</p>
            <button className="login-toggle-btn" onClick={() => setIsRegisterMode(true)}>Register</button>
          </div>
          <div className="login-toggle-panel login-toggle-right">
            <h1>Welcome Back!</h1>
            <p>Already have an account?</p>
            <button className="login-toggle-btn" onClick={() => setIsRegisterMode(false)}>Login</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <div style={{ color: '#1E293B', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
          &copy; {new Date().getFullYear()}{' '}
          <a href="https://wizone.ai/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 700 }}>
            Wizone AI Labs Pvt Ltd
          </a>
          {' '}&mdash; All Rights Reserved
        </div>
      </div>
    </div>
  );
}
