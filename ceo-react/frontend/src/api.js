const API_BASE = '/api';

function getCompanyId() {
  try {
    const user = JSON.parse(localStorage.getItem('ceo_user') || '{}');
    // Company users get their company ID; admin users get 0
    if (user.type === 'company') return String(user.id || 0);
    return '0';
  } catch { return '0'; }
}

function getSubUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('ceo_user') || '{}');
    return user.isSubUser && user.subUserId ? String(user.subUserId) : '';
  } catch { return ''; }
}

async function request(url, options = {}) {
  const subId = getSubUserId();
  const headers = {
    'Content-Type': 'application/json',
    'x-company-id': getCompanyId(),
    ...(subId ? { 'x-sub-user-id': subId } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(API_BASE + url, { ...options, headers });
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
  // syncRecurringTasks removed — recurring tasks no longer auto-inserted into QC
  getTaskVisibility: () => request('/companies/task-visibility'),
  updateTaskVisibility: (setting) => request('/companies/task-visibility', { method: 'PUT', body: JSON.stringify({ setting }) }),
  getTaskAccess: () => request('/companies/task-access'),
  grantTaskAccess: (viewerUserId, ownerUserId) => request('/companies/task-access', { method: 'POST', body: JSON.stringify({ viewerUserId, ownerUserId }) }),
  revokeTaskAccess: (id) => request(`/companies/task-access/${id}`, { method: 'DELETE' }),
  updateUserPrivacy: (userId, privacy) => request(`/companies/users/my/${userId}/privacy`, { method: 'PUT', body: JSON.stringify({ privacy }) }),

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
  getNextWeekPlan: (weekOffset = 0) => request(`/next-week-plan?weekOffset=${weekOffset}`),

  // Info System
  getInfoSystem: () => request('/info-system'),
  updateInfoSystem: (data) => request('/info-system', { method: 'POST', body: JSON.stringify(data) }),
  deleteInfoSystem: (id) => request(`/info-system/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: () => request('/dashboard'),

  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  heartbeat: (data) => request('/auth/heartbeat', { method: 'POST', body: JSON.stringify(data) }),
  getOnlineUsers: () => request('/auth/online-users'),

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

  // Companies
  verifyGST: (gstin) => request('/companies/verify-gst', { method: 'POST', body: JSON.stringify({ gstin }) }),
  companySignup: (data) => request('/companies/signup', { method: 'POST', body: JSON.stringify(data) }),
  companySignupNoGst: (data) => request('/companies/signup-no-gst', { method: 'POST', body: JSON.stringify(data) }),
  companyLogin: (username, password) => request('/companies/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getCompanies: () => request('/companies'),
  approveCompany: (id) => request(`/companies/${id}/approve`, { method: 'PUT' }),
  rejectCompany: (id) => request(`/companies/${id}/reject`, { method: 'PUT' }),
  deleteCompany: (id) => request(`/companies/${id}`, { method: 'DELETE' }),
  updateCompanyPassword: (id, password) => request(`/companies/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),

  // Company Sub-Users (max 3 per company)
  getCompanyUsers: () => request('/companies/users/my'),
  createCompanyUser: (data) => request('/companies/users/my', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyUser: (id, data) => request(`/companies/users/my/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompanyUser: (id) => request(`/companies/users/my/${id}`, { method: 'DELETE' }),

  // Plans / Subscriptions
  getMyPlan: () => request('/plans/my'),
  getAllPlans: () => request('/plans'),
  createPlan: (data) => request('/plans', { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (id, data) => request(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlan: (id) => request(`/plans/${id}`, { method: 'DELETE' }),

  // Plan Products (catalog)
  getPlanProducts: () => request('/plan-products'),
  createPlanProduct: (data) => request('/plan-products', { method: 'POST', body: JSON.stringify(data) }),
  updatePlanProduct: (id, data) => request(`/plan-products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  publishPlanProduct: (id, isPublished) => request(`/plan-products/${id}/publish`, { method: 'PATCH', body: JSON.stringify({ isPublished }) }),
  deletePlanProduct: (id) => request(`/plan-products/${id}`, { method: 'DELETE' }),
  activatePlanProduct: (id) => request(`/plan-products/${id}/activate`, { method: 'POST' }),

  // Internal Ads
  getActiveAd: () => request('/ads/active'),
  getAllAds: () => request('/ads'),
  createAd: (data) => request('/ads', { method: 'POST', body: JSON.stringify(data) }),
  updateAd: (id, data) => request(`/ads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  activateAd: (id, isActive) => request(`/ads/${id}/activate`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  deleteAd: (id) => request(`/ads/${id}`, { method: 'DELETE' }),
};
