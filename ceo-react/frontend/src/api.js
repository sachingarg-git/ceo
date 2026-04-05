const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

export const api = {
  // Masters
  getMasters: () => request('/masters'),
  updateMasters: (data) => request('/masters', { method: 'POST', body: JSON.stringify({ data }) }),

  // Quick Capture
  getQuickCapture: () => request('/quick-capture'),
  addTask: (task) => request('/quick-capture', { method: 'POST', body: JSON.stringify(task) }),
  updateTask: (id, data) => request(`/quick-capture/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/quick-capture/${id}`, { method: 'DELETE' }),

  // Someday List
  getSomedayList: () => request('/someday-list'),

  // Recurring Tasks
  getRecurringTasks: () => request('/recurring-tasks'),
  addRecurring: (task) => request('/recurring-tasks', { method: 'POST', body: JSON.stringify(task) }),
  updateRecurring: (id, data) => request(`/recurring-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecurring: (id) => request(`/recurring-tasks/${id}`, { method: 'DELETE' }),

  // Daily Schedule
  getDailySchedule: (date) => request(`/daily-schedule/${date}`),
  markDone: (data) => request('/mark-done', { method: 'POST', body: JSON.stringify(data) }),
  setDayRating: (data) => request('/day-rating', { method: 'POST', body: JSON.stringify(data) }),
  saveDSNotes: (data) => request('/ds-notes', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getDailyReport: () => request('/daily-report'),
  updateDailyReport: (data) => request('/daily-report', { method: 'POST', body: JSON.stringify(data) }),
  getWeeklyScorecard: () => request('/weekly-scorecard'),
  updateWeeklyScorecard: (data) => request('/weekly-scorecard', { method: 'POST', body: JSON.stringify(data) }),
  getNextWeekPlan: () => request('/next-week-plan'),

  // Info System
  getInfoSystem: () => request('/info-system'),
  updateInfoSystem: (data) => request('/info-system', { method: 'POST', body: JSON.stringify(data) }),
  deleteInfoSystem: (id) => request(`/info-system/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: () => request('/dashboard'),

  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  // Users
  getUsers: () => request('/auth/users'),
  createUser: (data) => request('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),

  // Roles
  getRoles: () => request('/auth/roles'),
  createRole: (data) => request('/auth/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id, data) => request(`/auth/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id) => request(`/auth/roles/${id}`, { method: 'DELETE' }),
};
