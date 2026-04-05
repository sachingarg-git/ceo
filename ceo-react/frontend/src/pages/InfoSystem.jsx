import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { useApp } from '../App';

export default function InfoSystem() {
  const { showToast } = useApp();
  const [rows, setRows] = useState([]);
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
      const [infoRes, masterRes] = await Promise.all([
        api.getInfoSystem(),
        api.getMasters(),
      ]);
      if (infoRes.success) setRows(infoRes.rows || []);
      if (masterRes.success && masterRes.masters) {
        setCategories(masterRes.masters.infoCategory || []);
      }
    } catch {
      showToast('Error loading information system', 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterCategory && r.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (r.title || '').toLowerCase().includes(q) ||
          (r.content || '').toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, filterCategory, search]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const cat = r.category || 'Uncategorized';
      if (!map[cat]) map[cat] = [];
      map[cat].push(r);
    });
    return map;
  }, [filtered]);

  function openAdd() {
    setEditItem({ category: categories[0] || '', title: '', content: '', notes: '' });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditItem({ ...item });
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
        <div className="page-header"><h1>Information System</h1></div>
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
        <h1>Information System</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Entry</button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="form-group" style={{ minWidth: 180 }}>
          <select
            className="form-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
          <input
            className="form-input"
            type="text"
            placeholder="Search entries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ opacity: 0.6, fontSize: '0.85rem', alignSelf: 'center' }}>
          {filtered.length} of {rows.length} entries
        </div>
      </div>

      {/* Grouped Cards */}
      {Object.keys(grouped).length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ opacity: 0.6 }}>No entries found.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', opacity: 0.8 }}>
              <span className="badge badge-accent" style={{ marginRight: '0.5rem' }}>{items.length}</span>
              {cat}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {items.map(item => (
                <div className="glass-card" key={item.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(item)}>
                  <div className="glass-card-header" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{item.title}</span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(item); }}
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                  <div style={{ padding: '1rem 1.25rem' }}>
                    <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem', whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden' }}>
                      {item.content || 'No content'}
                    </p>
                    {item.notes && (
                      <p style={{ fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic' }}>
                        Notes: {item.notes}
                      </p>
                    )}
                    <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '0.5rem' }}>
                      Added: {item.dateAdded || '--'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

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
              <p>Are you sure you want to delete <strong>{deleteConfirm.title}</strong>?</p>
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
