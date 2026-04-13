import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const PLAN_TEMPLATES = [
  { name: 'Starter Plan',    days: 90,  amount: 2999  },
  { name: 'Basic Plan',      days: 180, amount: 4999  },
  { name: 'Standard Plan',   days: 300, amount: 8999  },
  { name: 'Professional Plan', days: 365, amount: 14999 },
  { name: 'Premium Plan',    days: 548, amount: 21999 },
  { name: 'Enterprise Plan', days: 730, amount: 34999 },
];

const MASTER_TYPES = [
  { key: 'priority', label: 'Priority' },
  { key: 'batchType', label: 'Batch Type' },
  { key: 'taskStatus', label: 'Task Status' },
  { key: 'schedStatus', label: 'Schedule Status' },
  { key: 'infoCategory', label: 'Info Category' },
  { key: 'dayRating', label: 'Day Rating' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'weekday', label: 'Weekday' },
  { key: 'weekPosition', label: 'Week Position' },
  { key: 'recurringStatus', label: 'Recurring Status' },
];

const ALL_PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'quick-capture', label: 'Quick Capture' },
  { id: 'someday-list', label: 'Someday List' },
  { id: 'daily-schedule', label: 'Daily Schedule' },
  { id: 'recurring-tasks', label: 'Recurring Tasks' },
  { id: 'info-system', label: 'Information System' },
  { id: 'daily-report', label: 'Daily Report' },
  { id: 'weekly-scorecard', label: 'Weekly Scorecard' },
  { id: 'next-week-plan', label: 'Week Plan' },
  { id: 'performance-analytics', label: 'Performance Analytics' },
  { id: 'settings', label: 'Settings' },
  { id: 'user-management', label: 'User Management' },
];

const THEMES = [
  {
    id: 'light',
    label: 'Classic Light',
    emoji: '☀️',
    sidebarGrad: 'linear-gradient(180deg,#1E293B 0%,#334155 100%)',
    bg: '#F8FAFC',
    primary: '#6366F1',
    accent: '#fff',
    desc: 'Clean white workspace with indigo accent',
  },
  {
    id: 'dark',
    label: 'Midnight Dark',
    emoji: '🌙',
    sidebarGrad: 'linear-gradient(180deg,#0D1117 0%,#161B22 100%)',
    bg: '#0A0B0E',
    primary: '#818CF8',
    accent: '#1E293B',
    desc: 'Dark mode for night-time focus',
  },
  {
    id: 'ocean',
    label: 'Ocean Blue',
    emoji: '🌊',
    sidebarGrad: 'linear-gradient(180deg,#0369A1 0%,#0EA5E9 100%)',
    bg: '#F0F9FF',
    primary: '#0EA5E9',
    accent: '#E0F2FE',
    desc: 'Cool blue tones for calm productivity',
  },
  {
    id: 'forest',
    label: 'Forest Green',
    emoji: '🌿',
    sidebarGrad: 'linear-gradient(180deg,#14532D 0%,#166534 100%)',
    bg: '#F0FDF4',
    primary: '#16A34A',
    accent: '#DCFCE7',
    desc: 'Natural green for focused deep work',
  },
  {
    id: 'purple',
    label: 'Royal Purple',
    emoji: '💜',
    sidebarGrad: 'linear-gradient(180deg,#2E1065 0%,#4C1D95 100%)',
    bg: '#FAF5FF',
    primary: '#7C3AED',
    accent: '#EDE9FE',
    desc: 'Elegant purple for creative thinkers',
  },
  {
    id: 'sunset',
    label: 'Sunset Orange',
    emoji: '🌅',
    sidebarGrad: 'linear-gradient(180deg,#7C2D12 0%,#C2410C 100%)',
    bg: '#FFF7ED',
    primary: '#EA580C',
    accent: '#FFEDD5',
    desc: 'Warm tones for energetic mornings',
  },
  // ── ANIMATED ──
  {
    id: 'aurora',
    label: 'Aurora Night',
    emoji: '🌌',
    animated: true,
    sidebarGrad: 'linear-gradient(180deg,#03091A 0%,#061228 100%)',
    bg: '#03091A',
    primary: '#22D3EE',
    accent: 'rgba(34,211,238,0.12)',
    previewBg: 'linear-gradient(-45deg,#03091A,#061228,#0A1A40,#041020)',
    desc: 'Animated northern lights on deep space',
  },
  {
    id: 'neon',
    label: 'Neon Cyber',
    emoji: '⚡',
    animated: true,
    sidebarGrad: 'linear-gradient(180deg,#07000F 0%,#0F0020 100%)',
    bg: '#07000F',
    primary: '#FF2D78',
    accent: 'rgba(255,45,120,0.12)',
    previewBg: 'radial-gradient(ellipse at 30% 50%,rgba(255,45,120,0.15) 0%,#07000F 60%)',
    desc: 'Hot pink & cyan neon with pulsing glow',
  },
  {
    id: 'gradient',
    label: 'Gradient Flow',
    emoji: '🌈',
    animated: true,
    sidebarGrad: 'linear-gradient(180deg,#1A0050 0%,#3B0087 50%,#6D28D9 100%)',
    bg: '#FDF4FF',
    primary: '#8B5CF6',
    accent: 'rgba(255,255,255,0.75)',
    previewBg: 'linear-gradient(-45deg,#FDF4FF,#F0EAFF,#E8F4FF,#FFF0F7)',
    desc: 'Soft pastel gradient that flows & breathes',
  },
];

/* ── Reusable theme preview card ── */
function ThemeCard({ t, active, onSelect }) {
  const mainBg = t.previewBg || t.bg;
  const isAnimated = t.animated;
  return (
    <div
      onClick={onSelect}
      style={{
        cursor: 'pointer', borderRadius: 16, overflow: 'hidden',
        border: active ? `3px solid ${t.primary}` : '3px solid var(--border)',
        boxShadow: active
          ? `0 0 0 3px ${t.primary}33, 0 8px 28px rgba(0,0,0,0.14)`
          : isAnimated
            ? `0 2px 12px rgba(0,0,0,0.1), 0 0 0 1px ${t.primary}22`
            : '0 2px 10px rgba(0,0,0,0.06)',
        transition: 'all 0.22s',
        transform: active ? 'translateY(-4px)' : 'none',
        background: 'var(--card-bg)',
        position: 'relative',
      }}
    >
      {/* Animated shimmer outline for animated themes */}
      {isAnimated && !active && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14, pointerEvents: 'none', zIndex: 1,
          background: `linear-gradient(90deg, transparent 0%, ${t.primary}22 50%, transparent 100%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer-border 2.5s linear infinite',
        }} />
      )}

      {/* ── Mini Preview ── */}
      <div style={{ display: 'flex', height: 108, background: mainBg, borderRadius: '13px 13px 0 0', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar strip */}
        <div style={{ width: '30%', background: t.sidebarGrad, display: 'flex', flexDirection: 'column', padding: '9px 7px', gap: 5, flexShrink: 0, zIndex: 1 }}>
          <div style={{ width: '75%', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.5)' }} />
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: 2, background: i===1 ? '#fff' : 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: i===1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)' }} />
            </div>
          ))}
        </div>
        {/* Main content area */}
        <div style={{ flex: 1, padding: '9px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
            <div style={{ width: '38%', height: 5, borderRadius: 3, background: t.primary, opacity: 0.7 }} />
            <div style={{ width: 13, height: 6, borderRadius: 4, background: t.primary }} />
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[t.primary, '#F59E0B', '#10B981'].map((c, ci) => (
              <div key={ci} style={{ flex: 1, height: 18, borderRadius: 5, background: c, opacity: 0.85 }} />
            ))}
          </div>
          {[1,2,3].map(r => (
            <div key={r} style={{
              width: '100%', height: 6, borderRadius: 3,
              background: isAnimated ? `${t.primary}25` : (t.accent || '#fff'),
              border: `1px solid ${t.primary}30`,
            }} />
          ))}
        </div>
        {/* Animated badge in preview */}
        {isAnimated && (
          <div style={{
            position: 'absolute', top: 6, right: 6, zIndex: 2,
            background: t.primary, color: '#fff',
            fontSize: 7, fontWeight: 800, padding: '2px 5px', borderRadius: 6,
            textTransform: 'uppercase', letterSpacing: 0.5,
            boxShadow: `0 0 8px ${t.primary}80`,
          }}>✦ LIVE</div>
        )}
      </div>

      {/* ── Card Footer ── */}
      <div style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15 }}>{t.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{t.label}</span>
            {active && (
              <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 20, background: t.primary, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Active</span>
            )}
            {isAnimated && !active && (
              <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 20, background: `${t.primary}22`, color: t.primary, border: `1px solid ${t.primary}44`, textTransform: 'uppercase', letterSpacing: 0.3 }}>Anim</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>{t.desc}</div>
        </div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0, marginLeft: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.sidebarGrad, border: '1.5px solid rgba(0,0,0,0.1)' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.primary, border: '1.5px solid rgba(0,0,0,0.1)', boxShadow: `0 0 4px ${t.primary}60` }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.bg, border: '1.5px solid rgba(0,0,0,0.1)' }} />
        </div>
      </div>
    </div>
  );
}

function AvailablePlans({ onActivate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getPlanProducts().then(r => {
      if (r.success) setProducts(r.products || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>;
  if (products.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>🛍️</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>Available Plans</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Choose a plan to activate for your account</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {products.map(pp => (
          <div key={pp.ID} style={{ borderRadius: 16, border: '2px solid #6366f130', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), transparent)', padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{pp.Name}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#6366f1', marginBottom: 2 }}>
              ₹{Number(pp.Price).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>{pp.DurationDays} days access</div>
            {pp.Features && (
              <ul style={{ margin: '0 0 16px', padding: '0 0 0 16px', fontSize: 11, color: 'var(--muted)', lineHeight: 2, flex: 1 }}>
                {pp.Features.split('\n').filter(Boolean).map((f, i) => <li key={i}>✓ {f}</li>)}
              </ul>
            )}
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={activating === pp.ID}
              onClick={async () => {
                setActivating(pp.ID);
                await onActivate(pp.ID);
                setActivating(null);
              }}
            >
              {activating === pp.ID ? 'Activating…' : '⚡ Activate Plan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Settings() {
  const { showToast, hasPermission, user: currentUser, theme, setTheme, planInfo, setPlanInfo } = useApp();
  const isCompany = currentUser?.type === 'company';
  // CEO admin = any internal (non-company) user with CEO role, or explicitly flagged isAdmin
  const isCeoAdmin = currentUser?.type === 'ceo' && (currentUser?.isAdmin || currentUser?.role === 'CEO');
  const [activeTab, setActiveTab] = useState('themes');
  const [masters, setMasters] = useState({});
  const [loading, setLoading] = useState(true);

  // Masters edit
  const [editType, setEditType] = useState(null);
  const [editValues, setEditValues] = useState('');

  // Users (admin or company sub-users)
  const [users, setUsers] = useState([]);
  const [userLimit, setUserLimit] = useState(null);
  const [roles, setRoles] = useState([]);
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', fullName: '', email: '', mobile: '', roleId: '' });

  // Reset Password
  const [resetPwdModal, setResetPwdModal] = useState(false);
  const [resetPwdUser, setResetPwdUser] = useState(null); // { id, username }
  const [resetPwdForm, setResetPwdForm] = useState({ newPassword: '', confirmPassword: '' });
  const [resetPwdSaving, setResetPwdSaving] = useState(false);

  // Roles
  const [roleModal, setRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] });

  // Plan Products
  const [planProducts, setPlanProducts] = useState([]);
  const [ppForm, setPpForm] = useState({ name: '', durationDays: 300, price: 0, features: '' });
  const [ppEditing, setPpEditing] = useState(null);
  const [ppSaving, setPpSaving] = useState(false);
  const [ppLoading, setPpLoading] = useState(false);

  // Internal Ads
  const [ads, setAds] = useState([]);
  const [adForm, setAdForm] = useState({ content: '', bgColor: '#1e293b', textColor: '#ffffff', speed: 40, fontSize: 13, fontWeight: 'normal' });
  const [adEditing, setAdEditing] = useState(null);
  const [adSaving, setAdSaving] = useState(false);

  // Plans
  const [allPlans, setAllPlans] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [planForm, setPlanForm] = useState({ planName: 'Free Plan', totalDays: 300, amount: 0, startDate: new Date().toISOString().slice(0,10), notes: '' });
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [companyDropOpen, setCompanyDropOpen] = useState(false);
  const companyDropRef = useRef(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const usersPromise = isCompany ? api.getCompanyUsers() : api.getUsers();
      const [mastersRes, usersRes, rolesRes] = await Promise.all([
        api.getMasters(), usersPromise, api.getRoles(),
      ]);
      if (mastersRes.success) setMasters(mastersRes.masters || {});
      if (usersRes.success) {
        setUsers(usersRes.users || []);
        if (usersRes.limit) setUserLimit(usersRes.limit);
      }
      if (rolesRes.success) setRoles(rolesRes.roles || []);
    } catch {}
    setLoading(false);
  }

  async function loadPlans() {
    setPlanLoading(true);
    try {
      if (isCeoAdmin) {
        const [plansRes, compRes] = await Promise.all([api.getAllPlans(), api.getCompanies()]);
        if (plansRes.success) setAllPlans(plansRes.plans || []);
        if (compRes.success) setCompanies(compRes.companies || []);
      } else if (isCompany) {
        const r = await api.getMyPlan();
        if (r.success && setPlanInfo) setPlanInfo(r);
      }
    } catch {}
    setPlanLoading(false);
  }

  useEffect(() => { if (activeTab === 'plan') loadPlans(); }, [activeTab]);

  async function loadPlanProducts() {
    setPpLoading(true);
    try {
      const r = await api.getPlanProducts();
      if (r.success) setPlanProducts(r.products || []);
    } catch {}
    setPpLoading(false);
  }

  useEffect(() => { if (activeTab === 'plan-products') loadPlanProducts(); }, [activeTab]);

  async function savePlanProduct() {
    if (!ppForm.name) { showToast('Plan name required', 'warning'); return; }
    setPpSaving(true);
    try {
      let res;
      if (ppEditing) {
        res = await api.updatePlanProduct(ppEditing, { ...ppForm, createdBy: currentUser?.username || 'ceo' });
      } else {
        res = await api.createPlanProduct({ ...ppForm, createdBy: currentUser?.username || 'ceo' });
      }
      if (res.success) {
        showToast(ppEditing ? 'Plan updated' : 'Plan created', 'success');
        setPpEditing(null);
        setPpForm({ name: '', durationDays: 300, price: 0, features: '' });
        loadPlanProducts();
      } else showToast(res.error || 'Failed', 'error');
    } catch { showToast('Error saving plan product', 'error'); }
    setPpSaving(false);
  }

  async function togglePublish(pp) {
    try {
      await api.publishPlanProduct(pp.ID, !pp.IsPublished);
      showToast(pp.IsPublished ? 'Plan unpublished' : 'Plan published! Companies can now see it.', 'success');
      loadPlanProducts();
    } catch { showToast('Error', 'error'); }
  }

  async function deletePlanProduct(id) {
    if (!confirm('Delete this plan product?')) return;
    try {
      await api.deletePlanProduct(id);
      showToast('Deleted', 'success');
      loadPlanProducts();
    } catch { showToast('Error', 'error'); }
  }

  async function activatePlanProduct(id) {
    try {
      const res = await api.activatePlanProduct(id);
      if (res.success) {
        showToast(`Plan activated! Expires in ${res.daysLeft} days`, 'success');
        loadPlans(); // refresh current plan
        if (setPlanInfo) {
          const r = await api.getMyPlan();
          if (r.success) setPlanInfo(r);
        }
      } else showToast(res.error || 'Failed to activate', 'error');
    } catch { showToast('Error activating plan', 'error'); }
  }

  async function loadAds() {
    try {
      const r = await api.getAllAds();
      if (r.success) setAds(r.ads || []);
    } catch {}
  }

  useEffect(() => { if (activeTab === 'ads') loadAds(); }, [activeTab]);

  async function saveAd() {
    if (!adForm.content) { showToast('Ad content required', 'warning'); return; }
    setAdSaving(true);
    try {
      let res;
      if (adEditing) {
        res = await api.updateAd(adEditing, adForm);
      } else {
        res = await api.createAd({ ...adForm, createdBy: currentUser?.username || 'ceo' });
      }
      if (res.success) {
        showToast(adEditing ? 'Ad updated' : 'Ad created', 'success');
        setAdEditing(null);
        setAdForm({ content: '', bgColor: '#1e293b', textColor: '#ffffff', speed: 40, fontSize: 13, fontWeight: 'normal' });
        loadAds();
      } else showToast(res.error || 'Failed', 'error');
    } catch { showToast('Error saving ad', 'error'); }
    setAdSaving(false);
  }

  async function toggleAdActive(ad) {
    try {
      await api.activateAd(ad.ID, !ad.IsActive);
      showToast(ad.IsActive ? 'Ad deactivated' : 'Ad is now live!', 'success');
      loadAds();
    } catch { showToast('Error', 'error'); }
  }

  async function deleteAd(id) {
    if (!confirm('Delete this ad?')) return;
    try {
      await api.deleteAd(id);
      showToast('Ad deleted', 'success');
      loadAds();
    } catch { showToast('Error', 'error'); }
  }

  async function savePlan() {
    if (selectedCompanies.length === 0) { showToast('Select at least one company', 'warning'); return; }
    if (!planForm.startDate) { showToast('Select start date', 'warning'); return; }
    setPlanSaving(true);
    try {
      const results = await Promise.all(
        selectedCompanies.map(companyId =>
          api.createPlan({ ...planForm, companyId, createdBy: currentUser?.username || 'ceo' })
        )
      );
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        const firstOk = results.find(r => r.success);
        showToast(`Plan assigned to ${selectedCompanies.length} company${selectedCompanies.length > 1 ? 'ies' : ''}! Expires in ${firstOk?.daysLeft ?? planForm.totalDays} days`, 'success');
        setSelectedCompanies([]);
        setPlanForm(f => ({ ...f, notes: '' }));
        loadPlans();
      } else {
        showToast(`${failed.length} assignment(s) failed`, 'error');
      }
    } catch { showToast('Error saving plan', 'error'); }
    setPlanSaving(false);
  }

  async function deletePlan(id) {
    if (!window.confirm('Delete this plan?')) return;
    try {
      await api.deletePlan(id);
      showToast('Plan deleted', 'success');
      loadPlans();
    } catch { showToast('Error deleting plan', 'error'); }
  }

  // Masters
  async function saveMasterType() {
    if (!editType) return;
    const values = editValues.split('\n').map(v => v.trim()).filter(Boolean);
    const updated = { ...masters, [editType]: values };
    try {
      const res = await api.updateMasters(updated);
      if (res.success) { setMasters(updated); setEditType(null); showToast('Masters updated', 'success'); }
    } catch { showToast('Failed to update', 'error'); }
  }

  // Users CRUD
  function openAddUser() {
    if (isCompany && userLimit && users.length >= userLimit) {
      showToast(`Maximum ${userLimit} users per company`, 'warning');
      return;
    }
    setEditingUser(null);
    setUserForm({ username: '', password: '', fullName: '', email: '', mobile: '', roleId: roles[0]?.id || '', role: 'User' });
    setUserModal(true);
  }
  function openEditUser(u) {
    setEditingUser(u.id);
    setUserForm({ username: u.username, password: '', fullName: u.fullName, email: u.email || '', mobile: u.mobile || '', roleId: u.roleId || '', role: u.role || 'User' });
    setUserModal(true);
  }
  async function saveUser() {
    if (!userForm.username) { showToast('Username required', 'warning'); return; }
    if (!editingUser && !userForm.password) { showToast('Password required for new user', 'warning'); return; }
    try {
      const data = { ...userForm };
      if (!data.password) delete data.password;
      let res;
      if (isCompany) {
        res = editingUser
          ? await api.updateCompanyUser(editingUser, data)
          : await api.createCompanyUser(data);
      } else {
        res = editingUser
          ? await api.updateUser(editingUser, data)
          : await api.createUser(data);
      }
      if (res.success) { showToast(editingUser ? 'User updated' : 'User created', 'success'); setUserModal(false); loadAll(); }
      else showToast(res.error || 'Failed', 'error');
    } catch { showToast('Error saving user', 'error'); }
  }
  async function toggleUserActive(u) {
    try {
      if (isCompany) {
        await api.updateCompanyUser(u.id, { isActive: !u.isActive });
      } else {
        await api.updateUser(u.id, { isActive: !u.isActive });
      }
      showToast(`User ${u.isActive ? 'disabled' : 'enabled'}`, 'success');
      loadAll();
    } catch { showToast('Error', 'error'); }
  }
  async function deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    try {
      if (isCompany) { await api.deleteCompanyUser(id); }
      else { await api.deleteUser(id); }
      showToast('User deleted', 'success'); loadAll();
    } catch { showToast('Error', 'error'); }
  }

  function openResetPwd(u) {
    setResetPwdUser({ id: u.id, username: u.username });
    setResetPwdForm({ newPassword: '', confirmPassword: '' });
    setResetPwdModal(true);
  }

  async function doResetPassword() {
    const { newPassword, confirmPassword } = resetPwdForm;
    if (!newPassword) { showToast('Enter a new password', 'warning'); return; }
    if (newPassword.length < 6) { showToast('Password must be at least 6 characters', 'warning'); return; }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'warning'); return; }
    setResetPwdSaving(true);
    try {
      let res;
      if (isCompany) {
        res = await api.updateCompanyUser(resetPwdUser.id, { password: newPassword });
      } else {
        res = await api.updateUser(resetPwdUser.id, { password: newPassword });
      }
      if (res.success) {
        showToast(`Password reset for ${resetPwdUser.username}`, 'success');
        setResetPwdModal(false);
      } else showToast(res.error || 'Failed to reset password', 'error');
    } catch { showToast('Error resetting password', 'error'); }
    setResetPwdSaving(false);
  }

  // Roles CRUD
  function openAddRole() {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: [] });
    setRoleModal(true);
  }
  function openEditRole(r) {
    setEditingRole(r.id);
    setRoleForm({ name: r.name, description: r.description, permissions: [...(r.permissions || [])] });
    setRoleModal(true);
  }
  function togglePerm(pageId) {
    setRoleForm(f => {
      const perms = f.permissions.includes(pageId)
        ? f.permissions.filter(p => p !== pageId)
        : [...f.permissions, pageId];
      return { ...f, permissions: perms };
    });
  }
  async function saveRole() {
    if (!roleForm.name) { showToast('Role name required', 'warning'); return; }
    try {
      const res = editingRole
        ? await api.updateRole(editingRole, roleForm)
        : await api.createRole(roleForm);
      if (res.success) { showToast(editingRole ? 'Role updated' : 'Role created', 'success'); setRoleModal(false); loadAll(); }
      else showToast(res.error || 'Failed', 'error');
    } catch { showToast('Error saving role', 'error'); }
  }
  async function deleteRole(id) {
    if (!confirm('Delete this role?')) return;
    try { await api.deleteRole(id); showToast('Role deleted', 'success'); loadAll(); }
    catch { showToast('Error', 'error'); }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header"><div></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div></div>
        <button className="btn btn-outline btn-sm" onClick={loadAll}>Refresh</button>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {[
          { id: 'themes', label: '🎨 Themes' },
          { id: 'masters', label: 'Masters' },
          { id: 'users', label: 'Users' },
          { id: 'roles', label: 'Roles & Permissions' },
          { id: 'plan', label: '📋 Plan & Subscription' },
          ...(isCeoAdmin ? [
            { id: 'plan-products', label: '🛍️ Plan Catalog' },
            { id: 'ads', label: '📢 Internal Ads' },
          ] : []),
        ].map(tab => (
          <button key={tab.id} className={`tab-btn${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      {/* ── Themes ── */}
      {activeTab === 'themes' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Choose a theme to personalise the entire interface — sidebar, navigation, cards and dashboard all update instantly.
          </p>

          {/* Section labels */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Static</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Theme Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
            {THEMES.filter(t => !t.animated).map(t => <ThemeCard key={t.id} t={t} active={theme === t.id} onSelect={() => { setTheme(t.id); showToast(`${t.label} theme applied ✨`, 'success'); }} />)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, background: 'linear-gradient(90deg,#22D3EE,#FF2D78,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✦ Animated</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(34,211,238,0.4), rgba(255,45,120,0.4), rgba(139,92,246,0.4), transparent)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            {THEMES.filter(t => t.animated).map(t => <ThemeCard key={t.id} t={t} active={theme === t.id} onSelect={() => { setTheme(t.id); showToast(`${t.label} theme applied ✨`, 'success'); }} />)}
          </div>

          {/* Current theme info bar */}
          <div style={{
            marginTop: 24, padding: '14px 20px', borderRadius: 12,
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            {(() => {
              const cur = THEMES.find(t => t.id === theme) || THEMES[0];
              return (
                <>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: cur.sidebarGrad, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                      {cur.emoji} {cur.label} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>is currently active</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{cur.desc}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                    Theme saved to browser<br />
                    <span style={{ fontSize: 10 }}>Persists across sessions</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Masters */}
      {activeTab === 'masters' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Manage dropdown values used across the application.</p>
          <div className="grid-2">
            {MASTER_TYPES.map(mt => (
              <div key={mt.key} className="glass-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{mt.label}</span>
                  <button className="btn btn-outline btn-xs" onClick={() => { setEditType(mt.key); setEditValues((masters[mt.key] || []).join('\n')); }}>Edit</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(masters[mt.key] || []).join(', ') || 'No values'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Management */}
      {activeTab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>User Management</h3>
              {isCompany && userLimit && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  {users.length} / {userLimit} users created
                  {users.length >= userLimit && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>(Limit reached)</span>}
                </div>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={openAddUser} disabled={isCompany && userLimit && users.length >= userLimit}>+ Add User</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Username</th><th>Full Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No users found</td></tr>
                ) : users.map((u, i) => (
                  <tr key={u.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td>{u.fullName}</td>
                    <td>{u.email || '-'}</td>
                    <td style={{ fontSize: 11 }}>{u.mobile || '-'}</td>
                    <td><span className="badge badge-active">{u.role || 'N/A'}</span></td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-active' : 'badge-stopped'}`} style={{ cursor: 'pointer' }} onClick={() => toggleUserActive(u)}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-xs" onClick={() => openEditUser(u)}>Edit</button>
                        <button className="btn btn-outline btn-xs" style={{ color: '#f59e0b', borderColor: '#f59e0b' }} onClick={() => openResetPwd(u)}>🔑 Pwd</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteUser(u.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles & Permissions */}
      {activeTab === 'roles' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Roles & Permissions</h3>
            <button className="btn btn-primary btn-sm" onClick={openAddRole}>+ Add Role</button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {roles.map(r => (
              <div key={r.id} className="glass-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--secondary)' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-outline btn-xs" onClick={() => openEditRole(r)}>Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={() => deleteRole(r.id)}>Del</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {(r.permissions || []).map(p => {
                    const page = ALL_PAGES.find(pg => pg.id === p);
                    return <span key={p} className="badge badge-scheduled" style={{ fontSize: 9 }}>{page?.label || p}</span>;
                  })}
                  {(!r.permissions || r.permissions.length === 0) && <span style={{ fontSize: 11, color: 'var(--muted)' }}>No permissions assigned</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Masters Edit Modal */}
      <div className={`modal-overlay${editType ? ' show' : ''}`} onClick={() => setEditType(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Edit {MASTER_TYPES.find(m => m.key === editType)?.label || ''}</h3>
            <button className="modal-close" onClick={() => setEditType(null)}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Values (one per line)</label>
              <textarea className="form-textarea" rows={10} value={editValues} onChange={e => setEditValues(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setEditType(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveMasterType}>Save</button>
          </div>
        </div>
      </div>

      {/* User Add/Edit Modal */}
      <div className={`modal-overlay${userModal ? ' show' : ''}`} onClick={() => setUserModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
            <button className="modal-close" onClick={() => setUserModal(false)}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input className="form-input" value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} placeholder="Enter username" disabled={!!editingUser} />
            </div>
            <div className="form-group">
              <label className="form-label">{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input className="form-input" type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Enter password" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={userForm.fullName} onChange={e => setUserForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Mobile Number
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>Used for Telegram bot access</span>
              </label>
              <input className="form-input" type="tel" value={userForm.mobile} onChange={e => setUserForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+91 9876543210" />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={userForm.roleId} onChange={e => setUserForm(f => ({ ...f, roleId: parseInt(e.target.value) }))}>
                <option value="">Select role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setUserModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveUser}>{editingUser ? 'Update' : 'Create User'}</button>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      <div className={`modal-overlay${resetPwdModal ? ' show' : ''}`} onClick={() => setResetPwdModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <h3>🔑 Reset Password</h3>
            <button className="modal-close" onClick={() => setResetPwdModal(false)}>&times;</button>
          </div>
          <div className="modal-body">
            {resetPwdUser && (
              <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', fontSize: 12, color: 'var(--muted)' }}>
                Resetting password for <strong style={{ color: 'var(--text)' }}>{resetPwdUser.username}</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">New Password *</label>
              <input
                className="form-input"
                type="password"
                value={resetPwdForm.newPassword}
                onChange={e => setResetPwdForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input
                className="form-input"
                type="password"
                value={resetPwdForm.confirmPassword}
                onChange={e => setResetPwdForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
              {resetPwdForm.confirmPassword && resetPwdForm.newPassword !== resetPwdForm.confirmPassword && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠ Passwords do not match</div>
              )}
              {resetPwdForm.confirmPassword && resetPwdForm.newPassword === resetPwdForm.confirmPassword && resetPwdForm.newPassword.length >= 6 && (
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>✓ Passwords match</div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setResetPwdModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={doResetPassword}
              disabled={resetPwdSaving || !resetPwdForm.newPassword || resetPwdForm.newPassword !== resetPwdForm.confirmPassword}
              style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
            >
              {resetPwdSaving ? 'Saving…' : '🔑 Reset Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Role Add/Edit Modal */}
      <div className={`modal-overlay${roleModal ? ' show' : ''}`} onClick={() => setRoleModal(false)}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingRole ? 'Edit Role' : 'Add New Role'}</h3>
            <button className="modal-close" onClick={() => setRoleModal(false)}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role Name *</label>
                <input className="form-input" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Manager" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={roleForm.description} onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))} placeholder="Role description" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Permissions (select pages this role can access)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                {ALL_PAGES.map(page => (
                  <label key={page.id} className="form-check" style={{ padding: '6px 8px', background: roleForm.permissions.includes(page.id) ? 'var(--success-bg)' : 'rgba(0,0,0,0.02)', borderRadius: 6, border: '1px solid ' + (roleForm.permissions.includes(page.id) ? 'var(--success)' : 'var(--border)') }}>
                    <input type="checkbox" checked={roleForm.permissions.includes(page.id)} onChange={() => togglePerm(page.id)} />
                    {page.label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-outline btn-xs" onClick={() => setRoleForm(f => ({ ...f, permissions: ALL_PAGES.map(p => p.id) }))}>Select All</button>
              <button className="btn btn-outline btn-xs" style={{ marginLeft: 4 }} onClick={() => setRoleForm(f => ({ ...f, permissions: [] }))}>Clear All</button>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setRoleModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveRole}>{editingRole ? 'Update' : 'Create Role'}</button>
          </div>
        </div>
      </div>

      {/* ── Plan & Subscription ── */}
      {activeTab === 'plan' && (
        <div>
          <style>{`
            @keyframes days-count-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
            @keyframes shimmer-bar { 0%{background-position:-200% center} 100%{background-position:200% center} }
          `}</style>

          {/* ── Company view: own plan card ── */}
          {isCompany && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <span style={{ fontSize: 22 }}>📋</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Your Subscription</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Your active plan and usage details</div>
                </div>
              </div>

              {planLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
              ) : !planInfo?.plan ? (
                <div style={{ textAlign: 'center', padding: 48, borderRadius: 20, background: 'var(--card-bg)', border: '2px dashed var(--border)' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>No Active Plan</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Contact your administrator to assign a subscription plan.</div>
                </div>
              ) : (() => {
                const left  = planInfo.daysLeft ?? 0;
                const total = planInfo.plan.TotalDays || 300;
                const pct   = Math.max(0, Math.min(100, Math.round((left / total) * 100)));
                let barGrad, statusColor, statusLabel;
                if (left > 100) { barGrad = 'linear-gradient(90deg,#10b981,#34d399)'; statusColor = '#10b981'; statusLabel = '🟢 Active'; }
                else if (left > 50) { barGrad = 'linear-gradient(90deg,#f59e0b,#fbbf24)'; statusColor = '#f59e0b'; statusLabel = '🟡 Renew Soon'; }
                else if (left > 20) { barGrad = 'linear-gradient(90deg,#f97316,#fb923c)'; statusColor = '#f97316'; statusLabel = '🟠 Urgent'; }
                else { barGrad = 'linear-gradient(90deg,#ef4444,#f87171)'; statusColor = '#ef4444'; statusLabel = '🔴 Critical'; }

                return (
                  <div style={{ background: 'var(--card-bg)', borderRadius: 20, border: `2px solid ${statusColor}40`, boxShadow: `0 8px 32px ${statusColor}20`, overflow: 'hidden' }}>
                    <div style={{ background: `linear-gradient(135deg, ${statusColor}22, transparent)`, padding: '24px 32px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{statusLabel}</div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>{planInfo.plan.PlanName}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{planInfo.plan.StartDate} → {planInfo.plan.EndDate}</div>
                        </div>
                        <div style={{ textAlign: 'center', animation: 'days-count-up 0.6s ease' }}>
                          <div style={{ fontSize: 56, fontWeight: 900, color: statusColor, lineHeight: 1 }}>{left}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>days remaining</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '20px 32px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Plan Usage</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: statusColor }}>{pct}% remaining</span>
                      </div>
                      <div style={{ height: 14, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barGrad, borderRadius: 8, transition: 'width 1s ease', backgroundSize: '200% auto', animation: 'shimmer-bar 3s linear infinite' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Total Days', value: total, icon: '📅' },
                          { label: 'Days Used', value: total - left, icon: '✅' },
                          { label: 'Days Left', value: left, icon: '⏳', highlight: statusColor },
                          { label: 'Expires On', value: planInfo.plan.EndDate, icon: '📆' },
                        ].map(s => (
                          <div key={s.label} style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '12px 16px', background: s.highlight ? `${s.highlight}15` : 'rgba(0,0,0,0.03)', borderRadius: 12, border: s.highlight ? `1px solid ${s.highlight}40` : '1px solid var(--border)' }}>
                            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: s.highlight || 'var(--text)' }}>{s.value}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {left <= 30 && (
                        <div style={{ marginTop: 20, padding: '14px 20px', borderRadius: 12, background: `${statusColor}15`, border: `1px solid ${statusColor}40`, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 24 }}>⚠️</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: statusColor }}>{left === 0 ? 'Plan Expired!' : `Only ${left} days left!`}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Contact your administrator to renew your subscription and avoid service interruption.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── CEO Admin view: all company plans + create form ── */}
          {isCeoAdmin && (
            <div>
              <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: 24, marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 20 }}>➕</span>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>Assign New Plan to Company</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>

                  {/* Multi-company picker */}
                  <div className="form-group" style={{ margin: 0, gridColumn: 'span 2', position: 'relative' }} ref={companyDropRef}>
                    <label className="form-label">Companies * {selectedCompanies.length > 0 && <span style={{ background: '#6366f1', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, marginLeft: 4 }}>{selectedCompanies.length} selected</span>}</label>
                    <button
                      type="button"
                      className="form-input"
                      style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)' }}
                      onClick={() => setCompanyDropOpen(o => !o)}
                    >
                      <span style={{ color: selectedCompanies.length === 0 ? 'var(--muted)' : 'var(--text)', fontSize: 13 }}>
                        {selectedCompanies.length === 0
                          ? '— Select Companies —'
                          : selectedCompanies.length === companies.length
                            ? 'All Companies Selected'
                            : companies.filter(c => selectedCompanies.includes(c.id)).map(c => c.legalName || c.tradeName || c.username).join(', ')
                        }
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{companyDropOpen ? '▲' : '▼'}</span>
                    </button>
                    {companyDropOpen && (
                      <div
                        style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', marginTop: 4, maxHeight: 220, overflowY: 'auto' }}
                        onMouseDown={e => e.stopPropagation()}
                      >
                        {/* Select All row */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, borderBottom: '1px solid var(--border)', background: 'rgba(99,102,241,0.06)' }}>
                          <input
                            type="checkbox"
                            checked={selectedCompanies.length === companies.length && companies.length > 0}
                            onChange={e => setSelectedCompanies(e.target.checked ? companies.map(c => c.id) : [])}
                          />
                          <span style={{ color: '#6366f1' }}>Select All ({companies.length})</span>
                        </label>
                        {companies.map(c => (
                          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)', background: selectedCompanies.includes(c.id) ? 'rgba(99,102,241,0.07)' : 'transparent' }}>
                            <input
                              type="checkbox"
                              checked={selectedCompanies.includes(c.id)}
                              onChange={e => setSelectedCompanies(prev =>
                                e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                              )}
                            />
                            <span style={{ flex: 1, color: 'var(--text)' }}>{c.legalName || c.tradeName || c.username}</span>
                            {c.approvalStatus !== 'approved' && (
                              <span style={{ fontSize: 9, color: '#f59e0b', background: '#f59e0b18', borderRadius: 4, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase' }}>{c.approvalStatus}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                    {/* Close dropdown on outside click */}
                    {companyDropOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setCompanyDropOpen(false)} />}
                  </div>

                  {/* Fixed Free Plan info */}
                  <div style={{ margin: 0, gridColumn: 'span 2', padding: '12px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>🎁</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#047857' }}>Default Free Plan — 300 Days</div>
                      <div style={{ fontSize: 11, color: '#065f46', marginTop: 2 }}>Companies receive 300 days of free access. To assign paid plans, use the <strong>Plan Catalog</strong> tab.</div>
                    </div>
                  </div>

                  {/* Start Date */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Start Date *</label>
                    <input className="form-input" type="date" value={planForm.startDate} onChange={e => setPlanForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>

                  {/* Notes */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Notes</label>
                    <input className="form-input" value={planForm.notes} onChange={e => setPlanForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
                  </div>
                </div>

                {planForm.startDate && (
                  <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#047857', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span>📅 Free plan starts <strong>{planForm.startDate}</strong> → expires <strong>{new Date(new Date(planForm.startDate + 'T00:00:00').getTime() + 300 * 86400000).toISOString().slice(0,10)}</strong></span>
                    {selectedCompanies.length > 1 && <span>🏢 Assigning to <strong>{selectedCompanies.length} companies</strong></span>}
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={savePlan} disabled={planSaving}>{planSaving ? 'Saving…' : `💾 Assign Plan${selectedCompanies.length > 1 ? ` (${selectedCompanies.length})` : ''}`}</button>
                </div>
              </div>

              {/* All Plans Table */}
              <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>📋 All Company Plans ({allPlans.length})</div>
                  <button className="btn btn-outline btn-sm" onClick={loadPlans} disabled={planLoading}>↻ Refresh</button>
                </div>
                {planLoading ? (
                  <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>
                ) : allPlans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>No plans assigned yet</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Company</th><th>Plan Name</th><th>Duration</th>
                          <th>Amount</th><th>Start</th><th>End</th><th>Days Left</th><th>Status</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allPlans.map(p => {
                          const left = p.daysLeft ?? 0;
                          let dotColor, statusTxt;
                          if (!p.IsActive)     { dotColor = '#94a3b8'; statusTxt = 'Inactive'; }
                          else if (left > 100) { dotColor = '#10b981'; statusTxt = 'Active'; }
                          else if (left > 50)  { dotColor = '#f59e0b'; statusTxt = 'Renew Soon'; }
                          else if (left > 20)  { dotColor = '#f97316'; statusTxt = 'Urgent'; }
                          else if (left > 0)   { dotColor = '#ef4444'; statusTxt = 'Critical'; }
                          else                 { dotColor = '#ef4444'; statusTxt = 'Expired'; }
                          return (
                            <tr key={p.ID} style={{ opacity: p.IsActive ? 1 : 0.5 }}>
                              <td style={{ fontWeight: 600 }}>{p.CompanyName || p.CompanyUsername || `#${p.CompanyID}`}</td>
                              <td>{p.PlanName}</td>
                              <td>{p.TotalDays}d</td>
                              <td style={{ fontSize: 12 }}>{p.Amount > 0 ? `₹${Number(p.Amount).toLocaleString('en-IN')}` : '—'}</td>
                              <td style={{ fontSize: 11 }}>{p.StartDate}</td>
                              <td style={{ fontSize: 11 }}>{p.EndDate}</td>
                              <td>
                                <span style={{ fontWeight: 800, fontSize: 13, color: dotColor, background: `${dotColor}18`, borderRadius: 8, padding: '2px 10px' }}>{left}</span>
                              </td>
                              <td>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                                  {statusTxt}
                                </span>
                              </td>
                              <td>
                                <button className="btn btn-outline btn-xs" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => deletePlan(p.ID)}>🗑</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Company user: show available published plans they can activate */}
          {isCompany && (
            <AvailablePlans onActivate={activatePlanProduct} />
          )}

          {!isCompany && !isCeoAdmin && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
              Plan management is available to administrators only.
            </div>
          )}
        </div>
      )}

      {/* ── Plan Catalog (CEO admin) ── */}
      {activeTab === 'plan-products' && isCeoAdmin && (
        <div>
          <style>{`@keyframes pp-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

          {/* Create / Edit form */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>
              {ppEditing ? '✏️ Edit Plan Product' : '➕ Create Plan Product'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Plan Name *</label>
                <input className="form-input" value={ppForm.name} onChange={e => setPpForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gold Plan" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Duration (days)</label>
                <input className="form-input" type="number" min={1} max={3650} value={ppForm.durationDays} onChange={e => setPpForm(f => ({ ...f, durationDays: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Price (₹)</label>
                <input className="form-input" type="number" min={0} value={ppForm.price} onChange={e => setPpForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                <label className="form-label">Features (one per line)</label>
                <textarea className="form-textarea" rows={3} value={ppForm.features} onChange={e => setPpForm(f => ({ ...f, features: e.target.value }))} placeholder={"Unlimited tasks\nPriority support\nAdvanced analytics"} style={{ resize: 'vertical', minHeight: 60 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={savePlanProduct} disabled={ppSaving}>{ppSaving ? 'Saving…' : ppEditing ? '💾 Update' : '➕ Create Plan'}</button>
              {ppEditing && <button className="btn btn-outline" onClick={() => { setPpEditing(null); setPpForm({ name: '', durationDays: 300, price: 0, features: '' }); }}>Cancel</button>}
            </div>
          </div>

          {/* Plan products list */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>🛍️ Plan Catalog ({planProducts.length})</div>
              <button className="btn btn-outline btn-sm" onClick={loadPlanProducts} disabled={ppLoading}>↻ Refresh</button>
            </div>
            {ppLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>
            ) : planProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🛍️</div>
                No plan products yet. Create one above to get started.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, padding: 20 }}>
                {planProducts.map(pp => (
                  <div key={pp.ID} style={{ borderRadius: 14, border: `2px solid ${pp.IsPublished ? '#6366f1' : 'var(--border)'}`, background: pp.IsPublished ? 'rgba(99,102,241,0.05)' : 'var(--card-bg)', padding: 18, animation: 'pp-fade 0.3s ease', position: 'relative' }}>
                    {pp.IsPublished && (
                      <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 800, background: '#6366f1', color: '#fff', borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Published</div>
                    )}
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{pp.Name}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#6366f1', marginBottom: 4 }}>
                      ₹{Number(pp.Price).toLocaleString('en-IN')}
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>/ {pp.DurationDays} days</span>
                    </div>
                    {pp.Features && (
                      <ul style={{ margin: '8px 0 12px', padding: '0 0 0 16px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
                        {pp.Features.split('\n').filter(Boolean).map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                      <button
                        className="btn btn-sm"
                        style={{ background: pp.IsPublished ? '#f59e0b' : '#10b981', color: '#fff', border: 'none', fontWeight: 700 }}
                        onClick={() => togglePublish(pp)}
                      >
                        {pp.IsPublished ? '🔒 Unpublish' : '🚀 Publish'}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => { setPpEditing(pp.ID); setPpForm({ name: pp.Name, durationDays: pp.DurationDays, price: pp.Price, features: pp.Features || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                      <button className="btn btn-outline btn-sm" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => deletePlanProduct(pp.ID)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Internal Ads (CEO admin) ── */}
      {activeTab === 'ads' && isCeoAdmin && (
        <div>
          {/* Form */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>
              {adEditing ? '✏️ Edit Ad' : '➕ Create Internal Ad'}
            </div>

            {/* Live preview */}
            {adForm.content && (
              <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', background: 'var(--border)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Live Preview</div>
                <div style={{ background: adForm.bgColor, padding: '8px 0', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', animation: 'none' }}>
                    <span style={{ color: adForm.textColor, fontSize: adForm.fontSize + 'px', fontWeight: adForm.fontWeight, padding: '0 40px', whiteSpace: 'nowrap' }}>{adForm.content} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {adForm.content}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
              <div className="form-group" style={{ margin: 0, gridColumn: 'span 3' }}>
                <label className="form-label">Ad Content *</label>
                <textarea className="form-textarea" rows={2} value={adForm.content} onChange={e => setAdForm(f => ({ ...f, content: e.target.value }))} placeholder="Type your ad message here…" style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Background Color</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={adForm.bgColor} onChange={e => setAdForm(f => ({ ...f, bgColor: e.target.value }))} style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                  <input className="form-input" value={adForm.bgColor} onChange={e => setAdForm(f => ({ ...f, bgColor: e.target.value }))} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Text Color</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={adForm.textColor} onChange={e => setAdForm(f => ({ ...f, textColor: e.target.value }))} style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                  <input className="form-input" value={adForm.textColor} onChange={e => setAdForm(f => ({ ...f, textColor: e.target.value }))} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Font Size (px)</label>
                <input className="form-input" type="number" min={10} max={24} value={adForm.fontSize} onChange={e => setAdForm(f => ({ ...f, fontSize: parseInt(e.target.value) || 13 }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Font Weight</label>
                <select className="form-input" value={adForm.fontWeight} onChange={e => setAdForm(f => ({ ...f, fontWeight: e.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="600">Semi Bold</option>
                  <option value="bold">Bold</option>
                  <option value="800">Extra Bold</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Scroll Speed ({adForm.speed})</label>
                <input type="range" min={10} max={100} value={adForm.speed} onChange={e => setAdForm(f => ({ ...f, speed: parseInt(e.target.value) }))} style={{ width: '100%', marginTop: 8 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)' }}><span>Slow</span><span>Fast</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={saveAd} disabled={adSaving}>{adSaving ? 'Saving…' : adEditing ? '💾 Update Ad' : '➕ Create Ad'}</button>
              {adEditing && <button className="btn btn-outline" onClick={() => { setAdEditing(null); setAdForm({ content: '', bgColor: '#1e293b', textColor: '#ffffff', speed: 40, fontSize: 13, fontWeight: 'normal' }); }}>Cancel</button>}
            </div>
          </div>

          {/* Ads list */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>📢 All Internal Ads ({ads.length})</div>
              <button className="btn btn-outline btn-sm" onClick={loadAds}>↻ Refresh</button>
            </div>
            {ads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📢</div>
                No ads created yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {ads.map(a => (
                  <div key={a.ID} style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    {/* Color preview */}
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: a.BgColor, border: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, color: a.TextColor, fontWeight: 700 }}>Aa</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.Content}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Speed: {a.Speed} · Font: {a.FontSize}px {a.FontWeight}</div>
                    </div>
                    {a.IsActive && (
                      <span style={{ fontSize: 9, fontWeight: 800, background: '#10b981', color: '#fff', borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>● LIVE</span>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-sm"
                        style={{ background: a.IsActive ? '#94a3b8' : '#10b981', color: '#fff', border: 'none', fontWeight: 700 }}
                        onClick={() => toggleAdActive(a)}
                      >
                        {a.IsActive ? '⏸ Deactivate' : '▶ Publish'}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => { setAdEditing(a.ID); setAdForm({ content: a.Content, bgColor: a.BgColor, textColor: a.TextColor, speed: a.Speed, fontSize: a.FontSize, fontWeight: a.FontWeight }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                      <button className="btn btn-outline btn-sm" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => deleteAd(a.ID)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
