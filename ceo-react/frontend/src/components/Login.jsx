import React, { useState } from 'react';

const PRODUCTS = [
  'Web Development', 'AI Solutions', 'Cloud Services', 'CCTV & Surveillance',
  'IT Support', 'Networking', 'Software Development', 'Digital Marketing',
  'Cyber Security', 'ERP Solutions', 'Mobile App Development', 'Data Analytics',
];

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

  const marqueeItems = [...PRODUCTS, ...PRODUCTS];

  return (
    <div className="login-page-bg">
      {/* Top Marquee Strip */}
      <div className="login-marquee-strip">
        <div className="login-marquee-track">
          {marqueeItems.map((p, i) => (
            <span key={i} className="login-marquee-item">
              <span className="login-marquee-dot" />
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Brand Header with Logo */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/wizone-logo.png" alt="Wizone AI Labs" style={{ height: 70, marginBottom: 8 }} />
        <div style={{ fontSize: 20, color: '#1E293B', letterSpacing: 2, fontWeight: 900 }}>EA to M.D</div>
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
          <form onSubmit={e => { e.preventDefault(); if (onSignUp) onSignUp(); }}>
            <h1>Sign Up</h1>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: -6, marginBottom: 12 }}>Register your company with GST</p>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 70, height: 70, borderRadius: 20, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 12 }}>&#127970;</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>Company Registration</div>
              <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                Verify your GST number to register<br />your company and get started
              </div>
            </div>
            <button type="submit" className="login-btn-submit">
              Register with GST &rarr;
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
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <div style={{ color: '#1E293B', fontSize: 11, letterSpacing: 1, fontWeight: 600 }}>
          &copy; {new Date().getFullYear()} Wizone AI Labs Pvt Ltd &mdash; All Rights Reserved
        </div>
      </div>
    </div>
  );
}
