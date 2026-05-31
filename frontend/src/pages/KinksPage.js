import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import './KinksPage.css';

const KinksPage = () => {
  const [kinks, setKinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('major');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('major');
  const [saving, setSaving] = useState(false);

  const loadKinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kinks')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) { console.error('Error loading kinks:', error); return; }
      setKinks(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKinks(); }, [loadKinks]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('kinks')
        .insert([{ name: name.trim(), description: description.trim() || null, is_active: true, type }])
        .select()
        .single();
      if (error) { alert('Failed to add: ' + error.message); return; }
      setKinks(p => [...p, data]);
      setName('');
      setDescription('');
      setType('major');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (kink) => {
    setEditingId(kink.id);
    setEditName(kink.name);
    setEditDesc(kink.description || '');
    setEditType(kink.type || 'major');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setEditType('major');
  };

  const saveEdit = async (kink) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('kinks')
        .update({ name: editName.trim(), description: editDesc.trim() || null, type: editType })
        .eq('id', kink.id);
      if (error) { alert('Save failed: ' + error.message); return; }
      setKinks(p => p.map(k => k.id === kink.id
        ? { ...k, name: editName.trim(), description: editDesc.trim() || null, type: editType }
        : k
      ));
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const toggleType = async (kink) => {
    const newType = (kink.type || 'major') === 'major' ? 'minor' : 'major';
    const { error } = await supabase.from('kinks').update({ type: newType }).eq('id', kink.id);
    if (error) { alert('Update failed: ' + error.message); return; }
    setKinks(p => p.map(k => k.id === kink.id ? { ...k, type: newType } : k));
  };

  const toggleActive = async (kink) => {    const newVal = !kink.is_active;
    const { error } = await supabase.from('kinks').update({ is_active: newVal }).eq('id', kink.id);
    if (error) { alert('Update failed: ' + error.message); return; }
    setKinks(p => p.map(k => k.id === kink.id ? { ...k, is_active: newVal } : k));
  };

  const deleteKink = async (kink) => {
    if (!window.confirm(`Remove "${kink.name}"?`)) return;
    const { error } = await supabase.from('kinks').delete().eq('id', kink.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    setKinks(p => p.filter(k => k.id !== kink.id));
  };

  return (
    <div className="kinks-page">
      <h2 className="kinks-title">Kinks</h2>
      <p className="kinks-subtitle">Active kinks are injected into every chat so Daddy references them when creating tasks. The description is the guide for how to build tasks around each kink.</p>

      {/* ── Add form ── */}
      <section className="kinks-section">
        <h3 className="kinks-section-title">Add a Kink</h3>
        <form className="kinks-form" onSubmit={handleAdd}>
          <div className="kinks-form-row">
            <input
              className="kinks-input"
              placeholder="Kink name (e.g. Humiliation, Edging, Worship)"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            <div className="kink-type-toggle-row">
              <button
                type="button"
                className={`btn-type ${type === 'major' ? 'major-active' : ''}`}
                onClick={() => setType('major')}
              >Major</button>
              <button
                type="button"
                className={`btn-type ${type === 'minor' ? 'minor-active' : ''}`}
                onClick={() => setType('minor')}
              >Minor</button>
            </div>
            <button className="btn-kink-add" type="submit" disabled={adding || !name.trim()}>
              {adding ? 'Adding…' : '+ Add'}
            </button>
          </div>
          <textarea
            className="kinks-textarea"
            placeholder="Task guide — how should Daddy build tasks around this kink?"
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </form>
      </section>

      {/* ── Kinks list ── */}
      <section className="kinks-section">
        <h3 className="kinks-section-title">Your Kinks</h3>
        {loading ? (
          <p className="kinks-empty">Loading…</p>
        ) : kinks.length === 0 ? (
          <p className="kinks-empty">No kinks added yet. Add one above.</p>
        ) : (
          <ul className="kinks-list">
            {kinks.map(k => (
              <li key={k.id} className={`kink-row ${k.is_active ? 'active' : 'inactive'} ${editingId === k.id ? 'editing' : ''} type-${k.type || 'major'}`}>
                {editingId === k.id ? (
                  <div className="kink-edit-form">
                    <div className="kinks-form-row">
                      <input
                        className="kinks-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Kink name"
                      />
                      <div className="kink-type-toggle-row">
                        <button
                          type="button"
                          className={`btn-type ${editType === 'major' ? 'major-active' : ''}`}
                          onClick={() => setEditType('major')}
                        >Major</button>
                        <button
                          type="button"
                          className={`btn-type ${editType === 'minor' ? 'minor-active' : ''}`}
                          onClick={() => setEditType('minor')}
                        >Minor</button>
                      </div>
                    </div>
                    <textarea
                      className="kinks-textarea"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Task guide — how should Daddy build tasks around this kink?"
                      rows={3}
                    />
                    <div className="kink-edit-actions">
                      <button
                        className="btn-kink-save"
                        onClick={() => saveEdit(k)}
                        disabled={saving || !editName.trim()}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button className="btn-kink-cancel" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="kink-info">
                      <div className="kink-name-row">
                        <span className="kink-name">{k.name}</span>
                        <span className={`kink-type-badge ${(k.type || 'major') === 'minor' ? 'minor' : 'major'}`}>
                          {(k.type || 'major') === 'minor' ? 'Minor' : 'Major'}
                        </span>
                      </div>
                      {k.description && <span className="kink-desc">{k.description}</span>}
                    </div>
                    <div className="kink-actions">
                      <button
                        className={`btn-kink-toggle ${k.is_active ? 'on' : 'off'}`}
                        onClick={() => toggleActive(k)}
                        title={k.is_active ? 'Disable' : 'Enable'}
                      >
                        {k.is_active ? 'Active' : 'Off'}
                      </button>
                      <button
                        className={`btn-kink-type ${(k.type || 'major') === 'minor' ? 'is-minor' : 'is-major'}`}
                        onClick={() => toggleType(k)}
                        title="Toggle major/minor"
                      >
                        {(k.type || 'major') === 'minor' ? '↑ Major' : '↓ Minor'}
                      </button>
                      <button
                        className="btn-kink-edit"
                        onClick={() => startEdit(k)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="btn-kink-delete"
                        onClick={() => deleteKink(k)}
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default KinksPage;
