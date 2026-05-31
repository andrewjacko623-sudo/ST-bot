import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import './KinksPage.css';

const KinksPage = () => {
  const [kinks, setKinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);

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
        .insert([{ name: name.trim(), description: description.trim() || null, is_active: true }])
        .select()
        .single();
      if (error) { alert('Failed to add: ' + error.message); return; }
      setKinks(p => [...p, data]);
      setName('');
      setDescription('');
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (kink) => {
    const newVal = !kink.is_active;
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
      <p className="kinks-subtitle">Active kinks are injected into every chat so Daddy references them when creating tasks.</p>

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
            <button className="btn-kink-add" type="submit" disabled={adding || !name.trim()}>
              {adding ? 'Adding…' : '+ Add'}
            </button>
          </div>
          <textarea
            className="kinks-textarea"
            placeholder="Optional notes (e.g. likes verbal humiliation but not degrading names)"
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
              <li key={k.id} className={`kink-row ${k.is_active ? 'active' : 'inactive'}`}>
                <div className="kink-info">
                  <span className="kink-name">{k.name}</span>
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
                    className="btn-kink-delete"
                    onClick={() => deleteKink(k)}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default KinksPage;
