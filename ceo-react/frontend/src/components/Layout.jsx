import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useApp } from '../App';

import Dashboard from '../pages/Dashboard';
import QuickCapture from '../pages/QuickCapture';
import SomedayList from '../pages/SomedayList';
import DailySchedule from '../pages/DailySchedule';
import RecurringTasks from '../pages/RecurringTasks';
import InfoSystem from '../pages/InfoSystem';
import DailyReport from '../pages/DailyReport';
import WeeklyScorecard from '../pages/WeeklyScorecard';
import NextWeekPlan from '../pages/NextWeekPlan';
import PerformanceAnalytics from '../pages/PerformanceAnalytics';
import Settings from '../pages/Settings';
import RegisteredCompanies from '../pages/RegisteredCompanies';

const PAGES = {
  dashboard: Dashboard,
  'quick-capture': QuickCapture,
  'someday-list': SomedayList,
  'daily-schedule': DailySchedule,
  'recurring-tasks': RecurringTasks,
  'info-system': InfoSystem,
  'daily-report': DailyReport,
  'weekly-scorecard': WeeklyScorecard,
  'next-week-plan': NextWeekPlan,
  'performance-analytics': PerformanceAnalytics,
  settings: Settings,
  'registered-companies': RegisteredCompanies,
};

function AccessDenied() {
  return (
    <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>&#128274;</div>
      <h3 style={{ color: 'var(--danger)', marginBottom: 8 }}>Access Denied</h3>
      <p style={{ color: 'var(--muted)', fontSize: 12 }}>You don't have permission to access this page. Contact your administrator.</p>
    </div>
  );
}

export default function Layout() {
  const { currentPage, hasPermission } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowed = hasPermission(currentPage);
  const PageComponent = allowed ? (PAGES[currentPage] || Dashboard) : AccessDenied;

  return (
    <div id="appShell" style={{ display: 'block' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <div className="main-content">
        <PageComponent />
      </div>
    </div>
  );
}
