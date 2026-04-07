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

  useEffect(() => {
    const saved = localStorage.getItem('ceo_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
  }, []);

  async function login(username, password) {
    setLoginLoading(true);
    try {
      // Try admin login first
      const res = await api.login(username, password);
      if (res.success && res.user) {
        // Add admin flag + registered-companies permission for admin accounts
        const userData = { ...res.user };
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
        setUser(compRes.user);
        localStorage.setItem('ceo_user', JSON.stringify(compRes.user));
        setLoginLoading(false);
        return { success: true };
      }

      setLoginLoading(false);
      return { success: false, error: compRes.error || res.error || 'Invalid credentials' };
    } catch {
      // Fallback to hardcoded if DB not available
      const fallback = [
        { username: 'ceo', password: 'ceo123', name: 'CEO', role: 'CEO', isAdmin: true, permissions: ['dashboard','quick-capture','someday-list','daily-schedule','recurring-tasks','info-system','daily-report','weekly-scorecard','next-week-plan','performance-analytics','settings','user-management','registered-companies'] },
        { username: 'ea', password: 'ea123', name: 'Executive Assistant', role: 'EA', permissions: ['dashboard','quick-capture','someday-list','daily-schedule','recurring-tasks','info-system','daily-report','weekly-scorecard','next-week-plan','performance-analytics'] },
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

  function logout() {
    setUser(null);
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

  const ctx = { user, currentPage, setCurrentPage, showToast, logout, hasPermission };

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

  return (
    <AppContext.Provider value={ctx}>
      <Layout />
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
