import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { api } from './api';
import Login from './components/Login';
import Layout from './components/Layout';

const SignUp = lazy(() => import('./pages/SignUp'));

export const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [theme, setThemeState] = useState(() => localStorage.getItem('app_theme') || 'light');
  const [planInfo, setPlanInfo] = useState(null); // { plan, daysLeft, expired }
  const [activeAd, setActiveAd] = useState(null);
  const [viewMode, setViewModeState] = useState(() => localStorage.getItem('app_view_mode') || 'all');
  const [taskVisibilitySetting, setTaskVisibilitySetting] = useState('All');
  const [companyUsers, setCompanyUsers] = useState([]);
  const [taskAccessGrants, setTaskAccessGrants] = useState([]);

  function setTheme(t) {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('app_theme', t);
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  function toggleTheme() { setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'light' : 'light'); }

  const isCompanyOwner = user?.type === 'company' && !user?.isSubUser;
  const canViewAll = isCompanyOwner || taskVisibilitySetting === 'All';

  function setViewMode(mode) {
    setViewModeState(mode);
    localStorage.setItem('app_view_mode', mode);
  }

  useEffect(() => {
    const saved = localStorage.getItem('ceo_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        // Migrate old sessions: assign correct type if missing
        if (!u.type) {
          u.type = (u.isAdmin || u.role === 'CEO' || u.role === 'EA' || !u.companyId) ? 'ceo' : 'company';
        }
        setUser(u);
        localStorage.setItem('ceo_user', JSON.stringify(u));
      } catch {}
    }
  }, []);

  async function login(username, password) {
    setLoginLoading(true);
    try {
      // Try admin login first
      const res = await api.login(username, password);
      if (res.success && res.user) {
        // Add admin flag + registered-companies permission for admin accounts
        const userData = { ...res.user, type: 'ceo' };
        if (userData.role === 'CEO' || username === 'ca' || username === 'CA') {
          if (!userData.permissions.includes('registered-companies')) {
            userData.permissions = [...userData.permissions, 'registered-companies'];
          }
          userData.isAdmin = true;
        }
        setUser(userData);
        localStorage.setItem('ceo_user', JSON.stringify(userData));
        setLoginLoading(false);
        return { success: true };
      }

      // Try company login
      const compRes = await api.companyLogin(username, password);
      if (compRes.success && compRes.user) {
        const companyUser = { ...compRes.user, type: 'company' };
        setUser(companyUser);
        localStorage.setItem('ceo_user', JSON.stringify(companyUser));
        setLoginLoading(false);
        return { success: true };
      }

      setLoginLoading(false);
      return { success: false, error: compRes.error || res.error || 'Invalid credentials' };
    } catch {
      // Fallback to hardcoded if DB not available
      const fallback = [
        { username: 'ceo', password: 'ceo123', name: 'CEO', role: 'CEO', type: 'ceo', isAdmin: true, permissions: ['dashboard','quick-capture','someday-list','daily-schedule','recurring-tasks','info-system','daily-report','weekly-scorecard','next-week-plan','performance-analytics','settings','user-management','registered-companies'] },
        { username: 'ea', password: 'ea123', name: 'Executive Assistant', role: 'EA', type: 'ceo', permissions: ['dashboard','quick-capture','someday-list','daily-schedule','recurring-tasks','info-system','daily-report','weekly-scorecard','next-week-plan','performance-analytics'] },
      ];
      const found = fallback.find(u => u.username === username && u.password === password);
      if (found) {
        setUser(found);
        localStorage.setItem('ceo_user', JSON.stringify(found));
        setLoginLoading(false);
        return { success: true };
      }
      setLoginLoading(false);
      return { success: false, error: 'Invalid credentials' };
    }
  }

  // Fetch plan info for company users
  useEffect(() => {
    if (!user || user.type !== 'company') { setPlanInfo(null); return; }
    let cancelled = false;
    async function fetchPlan() {
      try {
        const r = await api.getMyPlan();
        if (!cancelled && r.success) setPlanInfo(r);
      } catch {}
    }
    fetchPlan();
    const id = setInterval(fetchPlan, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user]);

  // Fetch active ad for company users
  useEffect(() => {
    if (!user || user.type !== 'company') { setActiveAd(null); return; }
    let cancelled = false;
    async function fetchAd() {
      try {
        const r = await api.getActiveAd();
        if (!cancelled && r.success) setActiveAd(r.ad || null);
      } catch {}
    }
    fetchAd();
    const id = setInterval(fetchAd, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user]);

  // Fetch task visibility setting for company users
  useEffect(() => {
    if (!user || user.type !== 'company') { setTaskVisibilitySetting('All'); return; }
    api.getTaskVisibility().then(r => {
      if (r.success) setTaskVisibilitySetting(r.setting || 'All');
    }).catch(() => {});
  }, [user]);

  // Fetch company users + access grants (for visibility filtering)
  useEffect(() => {
    if (!user || user.type !== 'company') { setCompanyUsers([]); setTaskAccessGrants([]); return; }
    api.getCompanyUsers().then(r => { if (r.success) setCompanyUsers(r.users || []); }).catch(() => {});
    api.getTaskAccess().then(r => { if (r.success) setTaskAccessGrants(r.grants || []); }).catch(() => {});
  }, [user]);

  function logout() {
    setUser(null);
    setPlanInfo(null);
    localStorage.removeItem('ceo_user');
    setCurrentPage('dashboard');
    setShowSignUp(false);
  }

  function showToast(msg, type = 'info') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  function hasPermission(page) {
    if (!user || !user.permissions) return true;
    return user.permissions.includes(page);
  }

  const ctx = { user, currentPage, setCurrentPage, showToast, logout, hasPermission, theme, setTheme, toggleTheme, planInfo, setPlanInfo, activeAd, setActiveAd, viewMode, setViewMode, taskVisibilitySetting, setTaskVisibilitySetting, isCompanyOwner, canViewAll, companyUsers, setCompanyUsers, taskAccessGrants, setTaskAccessGrants };

  // Show Sign Up page
  if (showSignUp && !user) {
    return (
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0b0e' }}><div className="spinner" /></div>}>
        <SignUp onBackToLogin={() => setShowSignUp(false)} />
      </Suspense>
    );
  }

  // Show Login page
  if (!user) {
    return <Login onLogin={login} loading={loginLoading} onSignUp={() => setShowSignUp(true)} />;
  }

  // Plan expired blocking screen (company users only)
  const planExpired = user?.type === 'company' && planInfo?.expired === true;

  return (
    <AppContext.Provider value={ctx}>
      <Layout />
      {/* Plan expired overlay — blocks the app but keeps it mounted */}
      {planExpired && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999999,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <style>{`
            @keyframes plan-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.08);opacity:0.8} }
            @keyframes plan-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
            @keyframes plan-glow  { 0%,100%{box-shadow:0 0 20px rgba(239,68,68,0.4)} 50%{box-shadow:0 0 60px rgba(239,68,68,0.8)} }
          `}</style>
          {/* Lock icon */}
          <div style={{ fontSize: 80, marginBottom: 24, animation: 'plan-pulse 2s ease-in-out infinite' }}>🔒</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: -0.5 }}>
            Subscription Expired
          </div>
          <div style={{ fontSize: 15, color: '#94a3b8', marginBottom: 32, textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>
            Your {planInfo?.plan?.PlanName || 'plan'} has expired.
            Please contact your administrator to renew your subscription and regain access.
          </div>
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 16, padding: '20px 40px', textAlign: 'center',
            animation: 'plan-glow 2s ease-in-out infinite',
          }}>
            <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Plan Ended</div>
            <div style={{ fontSize: 20, color: '#fff', fontWeight: 800 }}>
              {planInfo?.plan?.PlanName || 'Standard Plan'} · {planInfo?.plan?.TotalDays || 300} days
            </div>
            <div style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>
              Expired on {planInfo?.plan?.EndDate || '—'}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              marginTop: 32, padding: '10px 28px', borderRadius: 12, border: 'none',
              background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
            }}
          >
            Sign Out
          </button>
        </div>
      )}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
