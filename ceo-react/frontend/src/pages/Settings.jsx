import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../App';

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

export default function Settings() {
  const { showToast, hasPermission } = useApp();
  const [activeTab, setActiveTab] = useState('general');
  const [masters, setMasters] = useState({});
  const [loading, setLoading] = useState(true);

  // Masters edit
  const [editType, setEditType] = useState(null);
  const [editValues, setEditValues] = useState('');

  // Users
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', fullName: '', email: '', roleId: '' });

  // Roles
  const [roleModal, setRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [mastersRes, usersRes, rolesRes] = await Promise.all([
        api.getMasters(), api.getUsers(), api.getRoles(),
      ]);
      if (mastersRes.success) setMasters(mastersRes.masters || {});
      if (usersRes.success) setUsers(usersRes.users || []);
      if (rolesRes.success) setRoles(rolesRes.roles || []);
    } catch {}
    setLoading(false);
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
    setEditingUser(null);
    setUserForm({ username: '', password: '', fullName: '', email: '', roleId: roles[0]?.id || '' });
    setUserModal(true);
  }
  function openEditUser(u) {
    setEditingUser(u.id);
    setUserForm({ username: u.username, password: '', fullName: u.fullName, email: u.email, roleId: u.roleId || '' });
    setUserModal(true);
  }
  async function saveUser() {
    if (!userForm.username) { showToast('Username required', 'warning'); return; }
    if (!editingUser && !userForm.password) { showToast('Password required for new user', 'warning'); return; }
    try {
      const data = { ...userForm };
      if (!data.password) delete data.password;
      const res = editingUser
        ? await api.updateUser(editingUser, data)
        : await api.createUser(data);
      if (res.success) { showToast(editingUser ? 'User updated' : 'User created', 'success'); setUserModal(false); loadAll(); }
      else showToast(res.error || 'Failed', 'error');
    } catch { showToast('Error saving user', 'error'); }
  }
  async function toggleUserActive(u) {
    try {
      await api.updateUser(u.id, { isActive: !u.isActive });
      showToast(`User ${u.isActive ? 'disabled' : 'enabled'}`, 'success');
      loadAll();
    } catch { showToast('Error', 'error'); }
  }
  async function deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    try { await api.deleteUser(id); showToast('User deleted', 'success'); loadAll(); }
    catch { showToast('Error', 'error'); }
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
        <div className="page-header"><div><h2>Settings</h2></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Settings</h2><p>Application configuration & user management</p></div>
        <button className="btn btn-outline btn-sm" onClick={loadAll}>Refresh</button>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {[
          { id: 'general', label: 'General' },
          { id: 'masters', label: 'Masters' },
          { id: 'users', label: 'Users' },
          { id: 'roles', label: 'Roles & Permissions' },
          { id: 'about', label: 'About' },
        ].map(tab => (
          <button key={tab.id} className={`tab-btn${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      {/* General */}
      {activeTab === 'general' && (
        <div className="grid-2">
          <div className="glass-card">
            <div className="glass-card-header"><h3>Database Connection</h3></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="sync-dot online" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Connected</span>
            </div>
            <div className="form-group"><label className="form-label">Server</label><input className="form-input" value="MSSQL - 103.122.85.118:51440" readOnly /></div>
            <div className="form-group"><label className="form-label">Database</label><input className="form-input" value="CEO_ProductivityDB" readOnly /></div>
          </div>
          <div className="glass-card">
            <div className="glass-card-header"><h3>Application Info</h3></div>
            <div className="form-group"><label className="form-label">Company</label><input className="form-input" value="WIZONE IT NETWORK INDIA PVT LTD" readOnly /></div>
            <div className="form-group"><label className="form-label">Version</label><input className="form-input" value="2.0 (React + MSSQL)" readOnly /></div>
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
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>User Management</h3>
            <button className="btn btn-primary btn-sm" onClick={openAddUser}>+ Add User</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Username</th><th>Full Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No users found</td></tr>
                ) : users.map((u, i) => (
                  <tr key={u.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td>{u.fullName}</td>
                    <td>{u.email || '-'}</td>
                    <td><span className="badge badge-active">{u.role || 'N/A'}</span></td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-active' : 'badge-stopped'}`} style={{ cursor: 'pointer' }} onClick={() => toggleUserActive(u)}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-xs" onClick={() => openEditUser(u)}>Edit</button>
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

      {/* About */}
      {activeTab === 'about' && (
        <div className="glass-card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>WIZONE</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2, marginTop: 4 }}>CEO PRODUCTIVITY SYSTEM</div>
          <div className="mt-16" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <p>Version 2.0 - React + MSSQL</p>
            <p className="mt-8">WIZONE IT NETWORK INDIA PVT LTD</p>
            <p className="mt-8">Role-based access with {roles.length} roles and {users.length} users</p>
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
    </div>
  );
}
