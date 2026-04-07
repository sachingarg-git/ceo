import React from 'react';
import { useApp } from '../App';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  'quick-capture': 'Quick Capture',
  'someday-list': 'Someday List',
  'daily-schedule': 'Daily Schedule',
  'recurring-tasks': 'Recurring Tasks',
  'info-system': 'Information System',
  'daily-report': 'Daily Report',
  'weekly-scorecard': 'Weekly Scorecard',
  'next-week-plan': 'Week Plan',
  settings: 'Settings',
  'performance-analytics': 'Performance Analytics',
  'registered-companies': 'Registered Companies',
};

export default function Topbar({ onToggleSidebar }) {
  const { currentPage, user } = useApp();

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="hamburger" onClick={onToggleSidebar}>&#9776;</button>
        <h3 className="topbar-title">{PAGE_TITLES[currentPage] || currentPage}</h3>
      </div>
      <div className="topbar-right">
        <div className="user-avatar-small">{user?.name?.charAt(0) || 'C'}</div>
      </div>
    </div>
  );
}
