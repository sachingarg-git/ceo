import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../App';

export default function RegisteredCompanies() {
  const { showToast } = useApp();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [pwdModal, setPwdModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => { loadCompanies(); }, []);

  async function loadCompanies() {
    setLoading(true);
    try {
      const res = await api.getCompanies();
      if (res.success) setCompanies(res.companies || []);
    } catch {
      showToast('Failed to load companies', 'error');
    }
    setLoading(false);
  }

  async function handleApprove(id) {
    setActionLoading(id);
    try {
      const res = await api.approveCompany(id);
      if (res.success) {
        showToast('Company approved', 'success');
        loadCompanies();
      } else {
        showToast(res.message || 'Failed to approve', 'error');
      }
    } catch {
      showToast('Error approving company', 'error');
    }
    setActionLoading(null);
  }

  async function handleReject(id) {
    setActionLoading(id);
    try {
      const res = await api.rejectCompany(id);
      if (res.success) {
        showToast('Company rejected', 'success');
        loadCompanies();
      } else {
        showToast(res.message || 'Failed to reject', 'error');
      }
    } catch {
      showToast('Error rejecting company', 'error');
    }
    setActionLoading(null);
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this company?')) return;
    setActionLoading(id);
    try {
      const res = await api.deleteCompany(id);
      if (res.success) {
        showToast('Company deleted', 'success');
        loadCompanies();
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Error deleting company', 'error');
    }
    setActionLoading(null);
  }

  function openPasswordModal(company) {
    setPwdModal(company);
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleResetPassword() {
    if (!newPassword) { showToast('Password is required', 'warning'); return; }
    if (newPassword.length < 4) { showToast('Password must be at least 4 characters', 'warning'); return; }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'warning'); return; }
    const id = pwdModal?._id || pwdModal?.id;
    try {
      const res = await api.updateCompanyPassword(id, newPassword);
      if (res.success) { showToast('Password updated successfully', 'success'); setPwdModal(null); }
      else showToast(res.error || 'Failed to update password', 'error');
    } catch { showToast('Error updating password', 'error'); }
  }

  const filtered = companies.filter(c => {
    if (filter !== 'all' && (c.approvalStatus || 'pending') !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (c.gstin || '').toLowerCase().includes(s) ||
        (c.legalName || '').toLowerCase().includes(s) ||
        (c.tradeName || '').toLowerCase().includes(s) ||
        (c.username || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const counts = {
    total: companies.length,
    pending: companies.filter(c => (c.approvalStatus || 'pending') === 'pending').length,
    approved: companies.filter(c => c.approvalStatus === 'approved').length,
    rejected: companies.filter(c => c.approvalStatus === 'rejected').length,
  };

  function statusBadge(status) {
    const s = status || 'pending';
    const map = {
      pending: 'badge badge-paused',
      approved: 'badge badge-active',
      rejected: 'badge badge-stopped',
    };
    return <span className={map[s] || 'badge'}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Registered Companies</h1>
        <p>Manage company registrations and approvals</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Companies</div>
          <div className="kpi-value">{counts.total}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending Approval</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{counts.pending}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Approved</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{counts.approved}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Rejected</div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>{counts.rejected}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card">
        <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div className="tab-bar">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
            ].map(t => (
              <button key={t.key} className={`tab-btn${filter === t.key ? ' active' : ''}`} onClick={() => setFilter(t.key)}>{t.label}</button>
            ))}
          </div>
          <input
            className="form-input"
            type="text"
            placeholder="Search by GSTIN, company name, username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading companies...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>No companies found</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>GSTIN</th>
                  <th>Company Name</th>
                  <th>Business Type</th>
                  <th>GST Status</th>
                  <th>Registered Mobile</th>
                  <th>Username</th>
                  <th>Approval Status</th>
                  <th>Registered Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const status = c.approvalStatus || 'pending';
                  const cId = c._id || c.id;
                  return (
                    <tr key={cId || i} style={{ cursor: 'pointer' }} onClick={() => setDetailModal(c)}>
                      <td>{i + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.gstin || '-'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.legalName || '-'}</div>
                        {c.tradeName && <div style={{ fontSize: 11, opacity: 0.7 }}>{c.tradeName}</div>}
                      </td>
                      <td>{c.businessType || '-'}</td>
                      <td>{c.gstStatus || '-'}</td>
                      <td>{c.registeredMobile || '-'}</td>
                      <td>{c.username || '-'}</td>
                      <td>{statusBadge(status)}</td>
                      <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {status === 'pending' && (
                            <>
                              <button className="btn btn-success btn-xs" disabled={actionLoading === cId} onClick={() => handleApprove(cId)}>Approve</button>
                              <button className="btn btn-danger btn-xs" disabled={actionLoading === cId} onClick={() => handleReject(cId)}>Reject</button>
                            </>
                          )}
                          {status === 'approved' && (
                            <button className="btn btn-danger btn-xs" disabled={actionLoading === cId} onClick={() => handleReject(cId)}>Revoke</button>
                          )}
                          {status === 'rejected' && (
                            <button className="btn btn-success btn-xs" disabled={actionLoading === cId} onClick={() => handleApprove(cId)}>Approve</button>
                          )}
                          <button className="btn btn-outline btn-xs" disabled={actionLoading === cId} onClick={() => openPasswordModal(c)}>Reset Pwd</button>
                          <button className="btn btn-outline btn-xs" disabled={actionLoading === cId} onClick={() => handleDelete(cId)} style={{ color: '#ef4444', borderColor: '#ef4444' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <div className={`modal-overlay show`} onClick={() => setDetailModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Company Details</h3>
              <button className="modal-close" onClick={() => setDetailModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                <ModalDetail label="GSTIN" value={detailModal.gstin} />
                <ModalDetail label="Legal Name" value={detailModal.legalName} />
                <ModalDetail label="Trade Name" value={detailModal.tradeName} />
                <ModalDetail label="Business Type" value={detailModal.businessType} />
                <ModalDetail label="Registration Date" value={detailModal.registrationDate} />
                <ModalDetail label="GST Status" value={detailModal.gstStatus} />
                <ModalDetail label="Address" value={detailModal.address} full />
                <ModalDetail label="Pincode" value={detailModal.pincode} />
                <ModalDetail label="State Jurisdiction" value={detailModal.stateJurisdiction} />
                <ModalDetail label="Central Jurisdiction" value={detailModal.centralJurisdiction} />
                <ModalDetail label="Contact Name" value={detailModal.contactName} />
                <ModalDetail label="Contact Mobile" value={detailModal.contactMobile} />
                <ModalDetail label="Contact Email" value={detailModal.contactEmail} />
                <ModalDetail label="Username" value={detailModal.username} />
                <ModalDetail label="Registered Mobile" value={detailModal.registeredMobile} />
                <ModalDetail label="Approval Status" value={
                  <span>{statusBadge(detailModal.approvalStatus)}</span>
                } />
                {detailModal.natureOfBusiness && detailModal.natureOfBusiness.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontWeight: 600 }}>Nature of Business</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {detailModal.natureOfBusiness.map((n, i) => (
                        <span key={i} className="badge badge-active" style={{ fontSize: 11 }}>{n}</span>
                      ))}
                    </div>
                  </div>
                )}
                {detailModal.members && detailModal.members.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontWeight: 600 }}>Members / Directors</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {detailModal.members.map((m, i) => (
                        <span key={i} className="badge" style={{ fontSize: 11 }}>{typeof m === 'string' ? m : m.name || JSON.stringify(m)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {(detailModal.approvalStatus || 'pending') === 'pending' && (
                <>
                  <button className="btn btn-success btn-sm" onClick={() => { handleApprove(detailModal._id || detailModal.id); setDetailModal(null); }}>Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { handleReject(detailModal._id || detailModal.id); setDetailModal(null); }}>Reject</button>
                </>
              )}
              {detailModal.approvalStatus === 'approved' && (
                <button className="btn btn-danger btn-sm" onClick={() => { handleReject(detailModal._id || detailModal.id); setDetailModal(null); }}>Revoke</button>
              )}
              {detailModal.approvalStatus === 'rejected' && (
                <button className="btn btn-success btn-sm" onClick={() => { handleApprove(detailModal._id || detailModal.id); setDetailModal(null); }}>Approve</button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setDetailModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {pwdModal && (
        <div className="modal-overlay show" onClick={() => setPwdModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="modal-close" onClick={() => setPwdModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>COMPANY</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{pwdModal.legalName || pwdModal.tradeName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Username: <strong>{pwdModal.username}</strong></div>
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password"
                  onKeyDown={e => { if (e.key === 'Enter') handleResetPassword(); }} />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <div style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 600, marginTop: -8, marginBottom: 8 }}>Passwords do not match</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPwdModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={!newPassword || newPassword !== confirmPassword}>Update Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalDetail({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value || '-'}</div>
    </div>
  );
}
