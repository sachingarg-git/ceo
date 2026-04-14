import React, { useState } from 'react';
import { api } from '../api';

const GST_STEPS = [
  { num: 1, label: 'GST Verify' },
  { num: 2, label: 'Company Details' },
  { num: 3, label: 'Mobile Number' },
  { num: 4, label: 'Create Account' },
];

const NOGST_STEPS = [
  { num: 1, label: 'Company Info' },
  { num: 2, label: 'Mobile Number' },
  { num: 3, label: 'Create Account' },
];

const BUSINESS_TYPES = [
  '', 'Proprietorship', 'Partnership', 'Private Limited', 'Public Limited',
  'LLP', 'Trust / Society / NGO', 'HUF', 'Other',
];

export default function SignUp({ onBackToLogin, initialMode = null }) {
  /* ── mode: null = choose, 'gst' = GST flow, 'no-gst' = manual ── */
  const [mode, setMode] = useState(initialMode); // pre-set if launched from a specific button
  const [step, setStep] = useState(1);

  /* GST flow */
  const [gstin, setGstin] = useState('');
  const [gstData, setGstData] = useState(null);

  /* Manual / no-GST flow */
  const [manual, setManual] = useState({
    legalName: '', tradeName: '', businessType: '',
    address: '', pincode: '', contactName: '', contactMobile: '',
  });

  /* Common */
  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const STEPS = mode === 'no-gst' ? NOGST_STEPS : GST_STEPS;
  const mobileStep = mode === 'no-gst' ? 2 : 3;
  const accountStep = mode === 'no-gst' ? 3 : 4;

  function goToStep(n) { setError(''); setStep(n); }
  function selectMode(m) { setMode(m); setStep(1); setError(''); }
  function backToModeSelect() { setMode(null); setStep(1); setError(''); setGstData(null); setGstin(''); }

  function setManualField(k, v) { setManual(prev => ({ ...prev, [k]: v })); }

  /* ── GST verify ── */
  async function handleVerifyGST() {
    if (!gstin || gstin.length !== 15) { setError('Please enter a valid 15-character GSTIN'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.verifyGST(gstin);
      if (res.success && res.company) { setGstData(res.company); goToStep(2); }
      else setError(res.error || 'GST verification failed.');
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  }

  /* ── Manual company info continue ── */
  function handleManualContinue() {
    if (!manual.legalName.trim()) { setError('Company / Legal Name is required'); return; }
    if (!manual.address.trim()) { setError('Address is required'); return; }
    goToStep(2);
  }

  /* ── Final submit ── */
  async function handleCompleteRegistration() {
    if (!username.trim()) { setError('Username is required'); return; }
    if (!userEmail.trim() || !userEmail.includes('@')) { setError('A valid email address is required'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      let res;
      if (mode === 'gst') {
        res = await api.companySignup({ gstin, registeredMobile: mobile, username, password, userEmail, gstData });
      } else {
        // no-GST: uses same /signup endpoint with noGst flag — no separate route needed
        res = await api.companySignup({ noGst: true, manualData: manual, registeredMobile: mobile, username, password, userEmail });
      }
      if (res && res.success) setSuccess(true);
      else setError(res?.error || 'Registration failed. Please try again.');
    } catch (err) { setError('Unable to connect to server. Please check your connection and try again.'); }
    setLoading(false);
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <div style={pageBg}>
        <div style={{ ...card, textAlign: 'center', maxWidth: 440 }}>
          <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg, #10B981, #34D399)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff', marginBottom: 16 }}>&#10003;</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', marginBottom: 8 }}>Registration Submitted!</h2>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.7 }}>
            Your company registration has been submitted successfully.<br />
            Please wait for admin approval before logging in.
          </p>
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 4 }}>📧 What happens next?</div>
            <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.7 }}>
              Once our admin reviews and approves your account, you will receive a <strong>welcome email</strong> at <strong style={{ color: '#15803D' }}>{userEmail}</strong> with your login credentials and a direct link to access the platform.
            </div>
          </div>
          <button style={primaryBtn} onClick={onBackToLogin}>Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageBg}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <img src="/wizone-logo.png" alt="Wizone" style={{ height: 50, marginBottom: 6 }} />
        <div style={{ fontSize: 14, color: '#1E293B', letterSpacing: 2, fontWeight: 800 }}>EA to M.D</div>
      </div>

      {/* ── MODE SELECTION ── */}
      {mode === null && (
        <div style={card}>
          <h2 style={heading}>Company Registration</h2>
          <p style={subText}>How would you like to register your company?</p>

          {/* GST Option */}
          <div
            onClick={() => selectMode('gst')}
            style={modeCard('#2563EB')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28 }}>🏢</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>Register with GST</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 1.5 }}>
                  Enter your GSTIN to auto-fetch company details from government records
                </div>
              </div>
              <div style={{ color: '#2563EB', fontWeight: 800, fontSize: 18 }}>→</div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Auto-verified', 'Faster approval', 'GST data pre-filled'].map(t => (
                <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          </div>

          {/* No-GST Option */}
          <div
            onClick={() => selectMode('no-gst')}
            style={modeCard('#6366F1')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28 }}>📝</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>Register without GST</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 1.5 }}>
                  Don't have a GST number? Manually enter your company details
                </div>
              </div>
              <div style={{ color: '#6366F1', fontWeight: 800, fontSize: 18 }}>→</div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['No GSTIN needed', 'Manual entry', 'Quick setup'].map(t => (
                <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#F0F0FF', color: '#6366F1', fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP INDICATOR (only after mode selected) ── */}
      {mode && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, marginBottom: 16, width: '100%', maxWidth: 520, padding: '0 20px' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.num}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                  background: step >= s.num ? 'linear-gradient(135deg, #2563EB, #3B82F6)' : '#E2E8F0',
                  color: step >= s.num ? '#fff' : '#94A3B8',
                  boxShadow: step === s.num ? '0 0 0 4px rgba(59,130,246,0.2)' : 'none',
                  transition: 'all 0.3s',
                }}>
                  {step > s.num ? '\u2713' : s.num}
                </div>
                <span style={{ fontSize: 9, color: step >= s.num ? '#2563EB' : '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700, textAlign: 'center', maxWidth: 80 }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 3, margin: '18px 6px 0', background: step > s.num ? 'linear-gradient(90deg, #2563EB, #3B82F6)' : '#E2E8F0', borderRadius: 2, transition: 'all 0.3s' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── CARD (only after mode selected) ── */}
      {mode && (
        <div style={card}>

          {/* ══ GST FLOW ══ */}

          {/* GST Step 1: Enter GSTIN */}
          {mode === 'gst' && step === 1 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h2 style={{ ...heading, marginBottom: 0, textAlign: 'left' }}>GST Verification</h2>
                <button style={changeModeBtn} onClick={backToModeSelect}>← Change</button>
              </div>
              <p style={subText}>Enter your 15-character GSTIN to verify</p>
              <div style={formGroup}>
                <label style={label}>GSTIN (15 Characters)</label>
                <input style={input} type="text" maxLength={15} value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="e.g. 22AAAAA0000A1Z5" />
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{gstin.length}/15 characters</div>
              </div>
              {error && <div style={errStyle}>{error}</div>}
              <button style={primaryBtn} onClick={handleVerifyGST} disabled={loading}>
                {loading ? 'Verifying...' : 'VERIFY GST'}
              </button>
            </>
          )}

          {/* GST Step 2: Display verified company details */}
          {mode === 'gst' && step === 2 && gstData && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ ...heading, marginBottom: 0, textAlign: 'left' }}>Company Details</h2>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: '#ECFDF5', padding: '4px 12px', borderRadius: 20, border: '1px solid #D1FAE5' }}>&#10003; Verified</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
                <DI label="GSTIN" value={gstData.gstin} />
                <DI label="Legal Name" value={gstData.legalName} />
                <DI label="Trade Name" value={gstData.tradeName} />
                <DI label="Business Type" value={gstData.businessType} />
                <DI label="Registration Date" value={gstData.registrationDate} />
                <DI label="GST Status" value={gstData.gstStatus} />
                <DI label="Address" value={gstData.address} full />
                <DI label="State Jurisdiction" value={gstData.stateJurisdiction} full />
                {gstData.members?.length > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <span style={detailLabel}>Directors</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {gstData.members.map((m, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                          {typeof m === 'string' ? m : m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {error && <div style={errStyle}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={outlineBtn} onClick={() => { setGstData(null); setGstin(''); goToStep(1); }}>Try Different GST</button>
                <button style={{ ...primaryBtn, flex: 1 }} onClick={() => goToStep(3)}>Confirm & Continue</button>
              </div>
            </>
          )}

          {/* ══ NO-GST FLOW ══ */}

          {/* No-GST Step 1: Manual company details */}
          {mode === 'no-gst' && step === 1 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h2 style={{ ...heading, marginBottom: 0, textAlign: 'left' }}>Company Information</h2>
                <button style={changeModeBtn} onClick={backToModeSelect}>← Change</button>
              </div>
              <p style={subText}>Fill in your company details manually</p>

              {/* Info notice */}
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
                📌 No GST number? No problem — enter your basic company information below.
                Your registration will be reviewed and approved by our admin team.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {/* Legal / Company Name — full width, required */}
                <div style={{ ...formGroup, gridColumn: '1/-1' }}>
                  <label style={label}>Company / Legal Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input style={input} type="text" value={manual.legalName} onChange={e => setManualField('legalName', e.target.value)} placeholder="e.g. ABC Enterprises" />
                </div>

                {/* Trade Name */}
                <div style={formGroup}>
                  <label style={label}>Trade / Brand Name</label>
                  <input style={input} type="text" value={manual.tradeName} onChange={e => setManualField('tradeName', e.target.value)} placeholder="Trade name (if any)" />
                </div>

                {/* Business Type */}
                <div style={formGroup}>
                  <label style={label}>Business Type</label>
                  <select
                    style={{ ...input, cursor: 'pointer' }}
                    value={manual.businessType}
                    onChange={e => setManualField('businessType', e.target.value)}
                  >
                    {BUSINESS_TYPES.map(t => (
                      <option key={t} value={t}>{t || '— Select type —'}</option>
                    ))}
                  </select>
                </div>

                {/* Address — full width, required */}
                <div style={{ ...formGroup, gridColumn: '1/-1' }}>
                  <label style={label}>Business Address <span style={{ color: '#EF4444' }}>*</span></label>
                  <textarea
                    style={{ ...input, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }}
                    value={manual.address}
                    onChange={e => setManualField('address', e.target.value)}
                    placeholder="Full address including city & state"
                  />
                </div>

                {/* Pincode */}
                <div style={formGroup}>
                  <label style={label}>Pincode</label>
                  <input style={input} type="text" maxLength={6} value={manual.pincode} onChange={e => setManualField('pincode', e.target.value.replace(/\D/g, ''))} placeholder="6-digit pincode" />
                </div>

                {/* Contact Person */}
                <div style={formGroup}>
                  <label style={label}>Contact Person Name</label>
                  <input style={input} type="text" value={manual.contactName} onChange={e => setManualField('contactName', e.target.value)} placeholder="Owner / Manager name" />
                </div>

              </div>

              {error && <div style={errStyle}>{error}</div>}
              <button style={primaryBtn} onClick={handleManualContinue}>
                Continue →
              </button>
            </>
          )}

          {/* ══ COMMON STEPS ══ */}

          {/* Mobile Number step */}
          {step === mobileStep && (
            <>
              <h2 style={heading}>Registered Mobile</h2>
              <p style={subText}>Enter the mobile number registered with your company</p>
              <div style={formGroup}>
                <label style={label}>Mobile Number</label>
                <input style={input} type="tel" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile number" />
              </div>
              {error && <div style={errStyle}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={outlineBtn} onClick={() => goToStep(mobileStep - 1)}>Back</button>
                <button style={{ ...primaryBtn, flex: 1 }} onClick={() => {
                  if (!mobile || mobile.length !== 10) { setError('Enter a valid 10-digit number'); return; }
                  goToStep(accountStep);
                }}>Continue</button>
              </div>
            </>
          )}

          {/* Create Account step */}
          {step === accountStep && (
            <>
              <h2 style={heading}>Create Account</h2>
              <p style={subText}>Set up your login credentials — approval confirmation will be sent to your email</p>
              <div style={formGroup}>
                <label style={label}>Username</label>
                <input style={input} type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" autoComplete="off" />
              </div>
              <div style={formGroup}>
                <label style={label}>Email Address <span style={{ color: '#EF4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...input, paddingLeft: 40 }}
                    type="email"
                    value={userEmail}
                    onChange={e => setUserEmail(e.target.value)}
                    placeholder="your@company.com"
                    autoComplete="email"
                  />
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: 0.4 }}>✉</span>
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                  Your login credentials will be emailed here once approved by admin
                </div>
              </div>
              <div style={formGroup}>
                <label style={label}>Password</label>
                <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password (min 4 chars)" />
              </div>
              <div style={formGroup}>
                <label style={label}>Confirm Password</label>
                <input style={input} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
              </div>
              {error && <div style={errStyle}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={outlineBtn} onClick={() => goToStep(mobileStep)}>Back</button>
                <button style={{ ...primaryBtn, flex: 1 }} onClick={handleCompleteRegistration} disabled={loading}>
                  {loading ? 'Registering...' : 'Complete Registration'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Back to Login */}
      <div style={{ marginTop: 20 }}>
        <span onClick={onBackToLogin} style={{ color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>&#8592; Back to Login</span>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, color: '#94A3B8', fontSize: 11 }}>
        &copy; {new Date().getFullYear()} Wizone AI Labs Pvt Ltd &mdash; All Rights Reserved
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function DI({ label: l, value: v, full }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <span style={detailLabel}>{l}</span>
      <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 500 }}>{v || '-'}</div>
    </div>
  );
}

/* ── Styles ── */

function modeCard(accentColor) {
  return {
    background: '#FAFBFF',
    border: `1.5px solid ${accentColor}22`,
    borderRadius: 14,
    padding: '16px 18px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.2s',
    outline: 'none',
    fontFamily: 'inherit',
    boxShadow: `0 2px 12px ${accentColor}11`,
  };
}

const pageBg = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #e8edf5 0%, #c9d6e8 50%, #e8edf5 100%)',
  backgroundSize: '400% 400%', animation: 'gradientShift 12s ease infinite',
  zIndex: 20000, overflow: 'auto', padding: '20px',
};

const card = {
  background: '#FFFFFF', borderRadius: 20, padding: '28px 32px',
  width: 500, maxWidth: '94vw', boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
  border: '1px solid #E2E8F0',
};

const heading = { fontSize: 20, fontWeight: 800, color: '#1E293B', marginBottom: 4, textAlign: 'center' };
const subText = { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 20 };
const formGroup = { marginBottom: 16 };
const label = { display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 };
const detailLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 };

const input = {
  width: '100%', padding: '12px 16px', background: '#F8FAFC',
  border: '1.5px solid #E2E8F0', borderRadius: 10, color: '#1E293B',
  outline: 'none', fontSize: 14, fontFamily: 'inherit', fontWeight: 500,
  transition: 'border-color 0.2s', boxSizing: 'border-box',
};

const primaryBtn = {
  width: '100%', height: 48, background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
  borderRadius: 10, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1, textTransform: 'uppercase',
  boxShadow: '0 4px 15px rgba(59,130,246,0.3)', transition: 'all 0.3s',
};

const outlineBtn = {
  padding: '12px 20px', background: '#fff', border: '1.5px solid #E2E8F0',
  borderRadius: 10, color: '#64748B', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
};

const changeModeBtn = {
  padding: '4px 10px', background: '#F1F5F9', border: '1px solid #E2E8F0',
  borderRadius: 6, color: '#64748B', fontSize: 11, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};

const errStyle = {
  color: '#EF4444', fontSize: 12, marginBottom: 12, textAlign: 'center',
  fontWeight: 600, background: '#FEF2F2', padding: '8px 12px', borderRadius: 8,
};
