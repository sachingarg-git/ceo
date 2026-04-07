import React, { useState } from 'react';
import { api } from '../api';

const STEPS = [
  { num: 1, label: 'GST Verification' },
  { num: 2, label: 'Company Details' },
  { num: 3, label: 'Mobile Number' },
  { num: 4, label: 'Create Account' },
];

export default function SignUp({ onBackToLogin }) {
  const [step, setStep] = useState(1);
  const [gstin, setGstin] = useState('');
  const [gstData, setGstData] = useState(null);
  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [animDir, setAnimDir] = useState('forward');

  function goToStep(n, dir = 'forward') {
    setAnimDir(dir);
    setError('');
    setStep(n);
  }

  async function handleVerifyGST() {
    if (!gstin || gstin.length !== 15) {
      setError('Please enter a valid 15-character GSTIN');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.verifyGST(gstin);
      if (res.success && res.company) {
        setGstData(res.company);
        goToStep(2);
      } else {
        setError(res.message || 'GST verification failed. Please check the number and try again.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  async function handleCompleteRegistration() {
    if (!username.trim()) { setError('Username is required'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.companySignup({
        gstin,
        registeredMobile: mobile,
        username,
        password,
        gstData,
      });
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="anime-login-bg" data-on="true">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', zIndex: 1 }}>
          <div style={cardStyle}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>&#10003;</div>
              <h2 style={{ color: '#fff', marginBottom: 8, textShadow: '0 0 10px rgba(0,210,255,0.5)' }}>Registration Submitted!</h2>
              <p style={{ color: '#8892b0', marginBottom: 24, lineHeight: 1.6 }}>
                Your company registration has been submitted successfully. Please wait for admin approval before logging in.
              </p>
              <button style={primaryBtnStyle} onClick={onBackToLogin}>Back to Login</button>
            </div>
          </div>
        </div>
        <div className="anime-footer">CEO Productivity System &mdash; <b>WIZONE</b></div>
      </div>
    );
  }

  return (
    <div className="anime-login-bg" data-on="true">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', zIndex: 1, padding: '2rem 1rem' }}>

        {/* Step Indicator */}
        <div style={stepIndicatorStyle}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.num}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                  background: step >= s.num ? 'linear-gradient(135deg, #00d2ff, #3a7bd5)' : 'rgba(255,255,255,0.08)',
                  color: step >= s.num ? '#fff' : '#555',
                  border: step === s.num ? '2px solid #00d2ff' : '2px solid transparent',
                  boxShadow: step === s.num ? '0 0 16px rgba(0,210,255,0.5)' : 'none',
                  transition: 'all 0.4s ease',
                }}>
                  {step > s.num ? '\u2713' : s.num}
                </div>
                <span style={{ fontSize: 10, color: step >= s.num ? '#00d2ff' : '#555', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: '0 8px', marginBottom: 22, alignSelf: 'flex-start', marginTop: 18,
                  background: step > s.num ? 'linear-gradient(90deg, #00d2ff, #3a7bd5)' : 'rgba(255,255,255,0.08)',
                  borderRadius: 1, transition: 'background 0.4s ease',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div style={{ ...cardStyle, animation: `slideIn${animDir === 'forward' ? 'Right' : 'Left'} 0.35s ease` }}>

          {/* Step 1: GST Number */}
          {step === 1 && (
            <>
              <h2 style={headingStyle}>Company Registration</h2>
              <p style={subTextStyle}>Enter your GST Identification Number to get started</p>
              <div style={formGroupStyle}>
                <label style={labelStyle}>GSTIN (15 Characters)</label>
                <input
                  style={inputStyle}
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={e => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                />
                <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{gstin.length}/15 characters</div>
              </div>
              {error && <div style={errorStyle}>{error}</div>}
              <button style={primaryBtnStyle} onClick={handleVerifyGST} disabled={loading}>
                {loading ? <span style={spinnerWrapStyle}><span style={spinnerStyle} /> Verifying...</span> : 'Verify GST'}
              </button>
            </>
          )}

          {/* Step 2: Company Details */}
          {step === 2 && gstData && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ ...headingStyle, marginBottom: 0 }}>Company Details</h2>
                <span style={verifiedBadgeStyle}>&#10003; Verified</span>
              </div>
              <div style={detailsGridStyle}>
                <DetailItem label="GSTIN" value={gstData.gstin} />
                <DetailItem label="Legal Name" value={gstData.legalName} />
                <DetailItem label="Trade Name" value={gstData.tradeName} />
                <DetailItem label="Business Type" value={gstData.businessType} />
                <DetailItem label="Registration Date" value={gstData.registrationDate} />
                <DetailItem label="GST Status" value={gstData.gstStatus} />
                <DetailItem label="Address" value={gstData.address} full />
                <DetailItem label="Pincode" value={gstData.pincode} />
                <DetailItem label="State Jurisdiction" value={gstData.stateJurisdiction} />
                <DetailItem label="Central Jurisdiction" value={gstData.centralJurisdiction} />
                <DetailItem label="Contact Name" value={gstData.contactName} />
                <DetailItem label="Contact Mobile" value={gstData.contactMobile} />
                <DetailItem label="Contact Email" value={gstData.contactEmail} />
                {gstData.natureOfBusiness && gstData.natureOfBusiness.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={detailLabelStyle}>Nature of Business</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {gstData.natureOfBusiness.map((n, i) => (
                        <span key={i} style={tagStyle}>{n}</span>
                      ))}
                    </div>
                  </div>
                )}
                {gstData.members && gstData.members.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={detailLabelStyle}>Members / Directors</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {gstData.members.map((m, i) => (
                        <span key={i} style={tagStyle}>{typeof m === 'string' ? m : m.name || JSON.stringify(m)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {error && <div style={errorStyle}>{error}</div>}
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button style={outlineBtnStyle} onClick={() => { setGstData(null); setGstin(''); goToStep(1, 'backward'); }}>Try Different GST</button>
                <button style={{ ...primaryBtnStyle, flex: 1 }} onClick={() => goToStep(3)}>Confirm &amp; Continue</button>
              </div>
            </>
          )}

          {/* Step 3: Mobile Number */}
          {step === 3 && (
            <>
              <h2 style={headingStyle}>Registered Mobile</h2>
              <p style={subTextStyle}>Enter the mobile number registered with your company</p>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Mobile Number</label>
                <input
                  style={inputStyle}
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile number"
                />
              </div>
              {error && <div style={errorStyle}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={outlineBtnStyle} onClick={() => goToStep(2, 'backward')}>Back</button>
                <button style={{ ...primaryBtnStyle, flex: 1 }} onClick={() => {
                  if (!mobile || mobile.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return; }
                  goToStep(4);
                }}>Continue</button>
              </div>
            </>
          )}

          {/* Step 4: Username & Password */}
          {step === 4 && (
            <>
              <h2 style={headingStyle}>Create Account</h2>
              <p style={subTextStyle}>Set up your login credentials</p>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Username</label>
                <input style={inputStyle} type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Confirm Password</label>
                <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
              </div>
              {error && <div style={errorStyle}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={outlineBtnStyle} onClick={() => goToStep(3, 'backward')}>Back</button>
                <button style={{ ...primaryBtnStyle, flex: 1 }} onClick={handleCompleteRegistration} disabled={loading}>
                  {loading ? <span style={spinnerWrapStyle}><span style={spinnerStyle} /> Registering...</span> : 'Complete Registration'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Back to Login link */}
        <div style={{ marginTop: 20, zIndex: 1 }}>
          <span style={backLinkStyle} onClick={onBackToLogin}>&#8592; Back to Login</span>
        </div>
      </div>

      <div className="anime-footer">CEO Productivity System &mdash; <b>WIZONE</b></div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function DetailItem({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <span style={detailLabelStyle}>{label}</span>
      <div style={detailValueStyle}>{value || '-'}</div>
    </div>
  );
}

// --- Inline styles to match anime blue theme ---

const cardStyle = {
  background: 'rgba(10,25,47,0.6)',
  backdropFilter: 'blur(25px)',
  WebkitBackdropFilter: 'blur(25px)',
  padding: '2rem 2.2rem',
  borderRadius: 25,
  width: 480,
  maxWidth: '94vw',
  border: '1px solid rgba(0,210,255,0.3)',
  boxShadow: '0 0 50px rgba(0,210,255,0.1), 0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 1,
};

const headingStyle = {
  color: '#fff',
  margin: '0 0 0.5rem 0',
  fontWeight: 700,
  textAlign: 'center',
  letterSpacing: 1,
  textShadow: '0 0 10px rgba(0,210,255,0.5)',
  fontSize: 20,
};

const subTextStyle = {
  color: '#8892b0',
  fontSize: 12,
  textAlign: 'center',
  marginBottom: 20,
  letterSpacing: 0.5,
};

const formGroupStyle = {
  marginBottom: '1rem',
};

const labelStyle = {
  display: 'block',
  color: '#8892b0',
  fontSize: '0.75rem',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontWeight: 600,
};

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(0,210,255,0.2)',
  borderRadius: 12,
  color: '#e0e0e0',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.3s, box-shadow 0.3s',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const primaryBtnStyle = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, #00d2ff, #3a7bd5)',
  border: 'none',
  borderRadius: 12,
  fontWeight: 700,
  color: '#fff',
  cursor: 'pointer',
  textTransform: 'uppercase',
  fontFamily: 'inherit',
  fontSize: 13,
  letterSpacing: 1.5,
  transition: 'all 0.3s ease',
};

const outlineBtnStyle = {
  padding: '14px 20px',
  background: 'transparent',
  border: '1px solid rgba(0,210,255,0.4)',
  borderRadius: 12,
  fontWeight: 600,
  color: '#00d2ff',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  letterSpacing: 1,
  transition: 'all 0.3s ease',
};

const errorStyle = {
  color: '#ff4d4d',
  fontSize: 12,
  marginBottom: 12,
  textAlign: 'center',
  textShadow: '0 0 10px rgba(255,77,77,0.3)',
};

const backLinkStyle = {
  color: '#00d2ff',
  fontSize: 13,
  cursor: 'pointer',
  letterSpacing: 0.5,
  transition: 'color 0.3s',
};

const stepIndicatorStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  marginBottom: 28,
  width: 480,
  maxWidth: '94vw',
  zIndex: 1,
};

const verifiedBadgeStyle = {
  background: 'rgba(16,185,129,0.15)',
  color: '#10b981',
  border: '1px solid rgba(16,185,129,0.3)',
  borderRadius: 20,
  padding: '4px 14px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
};

const detailsGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px 16px',
  maxHeight: 380,
  overflowY: 'auto',
  paddingRight: 4,
};

const detailLabelStyle = {
  display: 'block',
  color: '#5a6a8a',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  fontWeight: 600,
  marginBottom: 2,
};

const detailValueStyle = {
  color: '#e0e0e0',
  fontSize: 13,
  wordBreak: 'break-word',
};

const tagStyle = {
  background: 'rgba(0,210,255,0.1)',
  color: '#00d2ff',
  border: '1px solid rgba(0,210,255,0.2)',
  borderRadius: 6,
  padding: '3px 10px',
  fontSize: 11,
  fontWeight: 500,
};

const spinnerWrapStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

const spinnerStyle = {
  display: 'inline-block',
  width: 16,
  height: 16,
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
};
