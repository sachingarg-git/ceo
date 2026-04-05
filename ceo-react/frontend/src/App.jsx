import React, { useState, useEffect, createContext, useContext } from 'react';
import { api } from './api';
import Login from './components/Login';
import Layout from './components/Layout';

export const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ceo_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
  }, []);

  async function login(username, password) {
    setLoginLoading(true);
    try {
      const res = await api.login(username, password);
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('ceo_user', JSON.stringify(res.user));
        setLoginLoading(false);
        return true;
      }
      setLoginLoading(false);
      return false;
    } catch {
      // Fallback to hardcoded if DB not available
      const fallback = [
        { username: 'ceo', password: 'ceo123', name: 'CEO', role: 'CEO', permissions: ['dashboard','quick-capture','someday-list','daily-schedule','recurring-tasks','info-system','daily-report','weekly-scorecard','next-week-plan','performance-analytics','settings','user-management'] },
        { username: 'ea', password: 'ea123', name: 'Executive Assistant', role: 'EA', permissions: ['dashboard','quick-capture','someday-list','daily-schedule','recurring-tasks','info-system','daily-report','weekly-scorecard','next-week-plan','performance-analytics'] },
      ];
      const found = fallback.find(u => u.username === username && u.password === password);
      if (found) {
        setUser(found);
        localStorage.setItem('ceo_user', JSON.stringify(found));
        setLoginLoading(false);
        return true;
      }
      setLoginLoading(false);
      return false;
    }
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('ceo_user');
    setCurrentPage('dashboard');
  }

  function showToast(msg, type = 'info') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  function hasPermission(page) {
    if (!user || !user.permissions) return true; // allow all if no permissions set
    return user.permissions.includes(page);
  }

  const ctx = { user, currentPage, setCurrentPage, showToast, logout, hasPermission };

  if (!user) {
    return <Login onLogin={login} loading={loginLoading} />;
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
