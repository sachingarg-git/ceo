import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { useApp } from '../App';

function formatDate(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return val;
  }
}

export default function InfoSystem() {
  const { showToast } = useApp();
  const [infoRows, setInfoRows] = useState([]);
  const [qcRows, setQcRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [infoRes, qcRes, masterRes] = await Promise.all([
        api.getInfoSystem(),
        api.getQuickCapture(),
        api.getMasters(),
      ]);
      if (infoRes.success) setInfoRows(infoRes.rows || []);
      if (qcRes.success) {
        const qcFiltered = (qcRes.rows || []).filter(
          r => r.sendTo === 'Information System'
        );
        setQcRows(qcFiltered);
      }
      if (masterRes.success && masterRes.masters) {
        setCategories(masterRes.masters.infoCategory || []);
      }
    } catch {
      showToast('Error loading Information System', 'error');
    } finally {
      setLoading(false);
    }
  }

  /** Combine info-system native rows and QC-sourced rows into a unified list */
  const allRows = useMemo(() => {
    const native = infoRows.map(r => ({
      ...r,
      _source: 'native',
      _displayTitle: r.title || r.description || '',
      _displayDate: r.dateAdded || r.createdAt || '',
      _displayCategory: r.category || 'Uncategorized',
      _displayNotes: r.notes || '',
      _displayPriority: r.priority || '',
    }));

    const fromQc = qcRows.map((r, i) => ({
      ...r,
      _source: 'qc',
      _qcId: r.id,
      _displayTitle: r.description || r.title || r.task || '',
      _displayDate: r.createdAt || r.createdDate || r.schedDate || '',
      _displayCategory: r.category || r.batchType || 'From Quick Capture',
      _displayNotes: r.notes || '',
      _displayPriority: r.priority || '',
    }));

    return [...native, ...fromQc];
  }, [infoRows, qcRows]);

  const filtered = useMemo(() => {
    return allRows.filter(r => {
      if (filterCategory) {
        if (filterCategory === '__qc__') {
          if (r._source !== 'qc') return false;
        } else {
          if (r._displayCategory !== filterCategory) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          (r._displayTitle || '').toLowerCase().includes(q) ||
          (r.content || '').toLowerCase().includes(q) ||
          (r._displayNotes || '').toLowerCase().includes(q) ||
          (r._displayCategory || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allRows, filterCategory, search]);

  const summaryStats = useMemo(() => {
    const total = allRows.length;
    const native = allRows.filter(r => r._source === 'native').length;
    const qc = allRows.filter(r => r._source === 'qc').length;
    const catCount = new Set(allRows.map(r => r._displayCategory)).size;
    return { total, native, qc, catCount };
  }, [allRows]);

  function openAdd() {
    setEditItem({
      category: categories[0] || '',
      title: '',
      content: '',
      notes: '',
    });
    setModalOpen(true);
  }

  function openEdit(item) {
    if (item._source === 'qc') return; // QC items are read-only
    setEditItem({
      id: item.id,
      category: item.category || '',
      title: item.title || '',
      content: item.content || '',
      notes: item.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!editItem.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateInfoSystem(editItem);
      if (res.success) {
        showToast(editItem.id ? 'Entry updated' : 'Entry added', 'success');
        setModalOpen(false);
        setEditItem(null);
        loadData();
      } else {
        showToast(res.error || 'Save failed', 'error');
      }
    } catch {
      showToast('Error saving entry', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      const res = await api.deleteInfoSystem(deleteConfirm.id);
      if (res.success) {
        showToast('Entry deleted', 'success');
        setDeleteConfirm(null);
        loadData();
      } else {
        showToast(res.error || 'Delete failed', 'error');
      }
    } catch {
      showToast('Error deleting entry', 'error');
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Information System</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Information System</h1>
          <p className="page-subtitle">Knowledge base and reference entries</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={loadData}>
            Refresh
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Entry
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent, #4f8cff)' }}>{summaryStats.total}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Total Entries</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4caf50' }}>{summaryStats.native}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Native Entries</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2196f3' }}>{summaryStats.qc}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>From Quick Capture</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#9c27b0' }}>{summaryStats.catCount}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Categories</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="form-group" style={{ minWidth: 180, margin: 0 }}>
          <select
            className="form-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="__qc__">From Quick Capture</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
          <input
            className="form-input"
            type="text"
            placeholder="Search entries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ opacity: 0.6, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          {filtered.length} of {allRows.length} entries
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card">
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 45 }}>#</th>
                <th style={{ width: 120 }}>Created</th>
                <th>Description / Title</th>
                <th style={{ width: 80 }}>Priority</th>
                <th style={{ width: 130 }}>Category</th>
                <th style={{ width: 180 }}>Notes</th>
                <th style={{ width: 100 }}>Date Added</th>
                <th style={{ width: 70 }}>Source</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>
                    No entries found.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const isQc = item._source === 'qc';
                  return (
                    <tr
                      key={isQc ? `qc-${item._qcId || idx}` : `native-${item.id || idx}`}
                      style={isQc ? { background: 'rgba(33, 150, 243, 0.04)' } : undefined}
                    >
                      <td>{idx + 1}</td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatDate(item._displayDate)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item._displayTitle}</div>
                        {item.content && (
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.6,
                              marginTop: 2,
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={item.content}
                          >
                            {item.content}
                          </div>
                        )}
                      </td>
                      <td>
                        {item._displayPriority ? (
                          <span
                            className={`badge ${
                              (item._displayPriority || '').toLowerCase() === 'high'
                                ? 'badge-high'
                                : (item._displayPriority || '').toLowerCase() === 'medium'
                                ? 'badge-medium'
                                : 'badge-low'
                            }`}
                          >
                            {item._displayPriority}
                          </span>
                        ) : (
                          <span style={{ opacity: 0.4 }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{item._displayCategory}</td>
                      <td>
                        {item._displayNotes ? (
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.7,
                              maxWidth: 180,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={item._displayNotes}
                          >
                            {item._displayNotes}
                          </div>
                        ) : (
                          <span style={{ opacity: 0.4 }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {formatDate(item.dateAdded || item._displayDate)}
                      </td>
                      <td>
                        {isQc ? (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 8px',
                              borderRadius: 10,
                              fontWeight: 600,
                              background: '#e3f2fd',
                              color: '#1565c0',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            From QC
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 8px',
                              borderRadius: 10,
                              fontWeight: 600,
                              background: '#e8f5e9',
                              color: '#2e7d32',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Native
                          </span>
                        )}
                      </td>
                      <td>
                        {isQc ? (
                          <span style={{ fontSize: 11, opacity: 0.4, fontStyle: 'italic' }}>Read-only</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => openEdit(item)}
                              style={{ padding: '2px 8px', fontSize: 11 }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setDeleteConfirm(item)}
                              style={{ padding: '2px 8px', fontSize: 11 }}
                            >
                              Del
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && editItem && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem.id ? 'Edit Entry' : 'Add Entry'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={editItem.category}
                  onChange={e => setEditItem({ ...editItem, category: e.target.value })}
                >
                  <option value="">-- Select --</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="form-input"
                  type="text"
                  value={editItem.title}
                  onChange={e => setEditItem({ ...editItem, title: e.target.value })}
                  placeholder="Entry title"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Content</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={editItem.content}
                  onChange={e => setEditItem({ ...editItem, content: e.target.value })}
                  placeholder="Content..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editItem.notes}
                  onChange={e => setEditItem({ ...editItem, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>X</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirm.title || deleteConfirm._displayTitle}</strong>?</p>
              <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
