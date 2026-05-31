import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import './CharacterPage.css';

// ─── Shared image-upload helper ──────────────────────────────────────────────
const uploadImage = async (file, bucket, prefix) => {
  const path = `${prefix}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
};

const deleteImage = async (url, bucket) => {
  if (!url) return;
  try {
    const parts = url.split(`/${bucket}/`);
    if (parts[1]) await supabase.storage.from(bucket).remove([parts[1]]);
  } catch (_) {}
};

// ─── Add-item modal shared by Cages / Toys / Outfits / Locations ─────────────
const AddItemModal = ({ title, bucket, storagePrefix, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { alert('Name is required'); return; }
    setSaving(true);
    try {
      let imageUrl = null;
      if (file) imageUrl = await uploadImage(file, bucket, storagePrefix);
      await onSave({ name: name.trim(), description: description.trim() || null, image_url: imageUrl });
      onClose();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Add {title}</h3>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={`${title} name`} required />
          </div>
          <div className="modal-field">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Optional description" />
          </div>
          <div className="modal-field">
            <label>Photo</label>
            <input type="file" accept="image/*" onChange={handleFile} />
            {preview && <img className="modal-preview" src={preview} alt="preview" />}
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add'}</button>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Item card used in Cages / Toys / Outfits ────────────────────────────────
const ItemCard = ({ item, equipLabel, onEquip, onToggle, onDelete, isEquipMode }) => (
  <div className={`char-card ${item.is_active ? 'active' : ''}`}>
    {item.image_url
      ? <img className="char-card-img" src={item.image_url} alt={item.name} />
      : <div className="char-card-img placeholder" />}
    <div className="char-card-body">
      <p className="char-card-name">{item.name}</p>
      {item.description && <p className="char-card-desc">{item.description}</p>}
      <div className="char-card-actions">
        {isEquipMode ? (
          <button
            className={`btn-equip ${item.is_active ? 'equipped' : ''}`}
            onClick={() => onEquip(item)}
          >
            {item.is_active ? 'Unequip' : equipLabel}
          </button>
        ) : (
          <button
            className={`btn-toggle ${item.is_active ? 'active' : ''}`}
            onClick={() => onToggle(item)}
          >
            {item.is_active ? '✓ Active' : '○ Inactive'}
          </button>
        )}
        <button className="btn-delete" onClick={() => onDelete(item)} title="Delete">×</button>
      </div>
    </div>
  </div>
);

// ─── Section wrapper with header + Add button ─────────────────────────────────
const Section = ({ title, children, onAdd }) => (
  <section className="char-section">
    <div className="char-section-header">
      <h3 className="char-section-title">{title}</h3>
      <button className="btn-add" onClick={onAdd}>+ Add</button>
    </div>
    {children}
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
const CharacterPage = () => {
  // ── Status state ─────────────────────────────────────────────────────────────
  const [stateId, setStateId] = useState(null);
  const [status, setStatus] = useState({
    in_chastity: false,
    chastity_start_time: '',
    last_orgasm: '',
    last_shave: '',
  });
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  // ── Inventory sections ────────────────────────────────────────────────────────
  const [cages, setCages] = useState([]);
  const [toys, setToys] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  // ── Modal ─────────────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(null); // { type: 'cage'|'toy'|'outfit'|'location' }

  // ── Load everything ───────────────────────────────────────────────────────────
  const loadPlayerState = useCallback(async () => {
    setStatusLoading(true);
    try {
      const { data, error } = await supabase
        .from('player-state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading player state:', error);
      } else if (data) {
        setStateId(data.id);
        const toLocal = (ts) => ts ? new Date(ts).toISOString().slice(0, 16) : '';
        setStatus({
          in_chastity: data.in_chastity ?? false,
          chastity_start_time: toLocal(data.chastity_start_time),
          last_orgasm: toLocal(data.last_orgasm),
          last_shave: toLocal(data.last_shave),
        });
      }
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) { console.error('Error loading inventory:', error); return; }
      const all = data || [];
      setCages(all.filter(i => i.category === 'cage'));
      setToys(all.filter(i => !i.category || i.category === 'toy'));
      setOutfits(all.filter(i => i.category === 'outfit'));
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('Error loading locations:', error); return; }
    setLocations(data || []);
  }, []);

  useEffect(() => {
    loadPlayerState();
    loadInventory();
    loadLocations();
  }, [loadPlayerState, loadInventory, loadLocations]);

  // ── Status save ────────────────────────────────────────────────────────────────
  const handleStatusSave = async (e) => {
    e.preventDefault();
    setStatusSaving(true);
    const toIso = (s) => s ? new Date(s).toISOString() : null;
    const payload = {
      in_chastity: status.in_chastity,
      chastity_start_time: toIso(status.chastity_start_time),
      last_orgasm: toIso(status.last_orgasm),
      last_shave: toIso(status.last_shave),
    };
    try {
      if (stateId) {
        await supabase.from('player-state').update(payload).eq('id', stateId);
      } else {
        const { data } = await supabase.from('player-state').insert([payload]).select().single();
        if (data) setStateId(data.id);
      }
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setStatusSaving(false);
    }
  };

  // ── Inventory helpers ──────────────────────────────────────────────────────────
  const addInventoryItem = async ({ name, description, image_url }, category) => {
    const { data, error } = await supabase
      .from('inventory')
      .insert([{ name, description, image_url, category, is_active: false }])
      .select()
      .single();
    if (error) throw error;
    if (category === 'cage') setCages(p => [data, ...p]);
    else if (category === 'toy') setToys(p => [data, ...p]);
    else if (category === 'outfit') setOutfits(p => [data, ...p]);
  };

  const deleteInventoryItem = async (item, setter) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    const { error } = await supabase.from('inventory').delete().eq('id', item.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    await deleteImage(item.image_url, 'inventory-images');
    setter(p => p.filter(i => i.id !== item.id));
  };

  const toggleInventoryActive = async (item, setter) => {
    const newVal = !item.is_active;
    const { error } = await supabase.from('inventory').update({ is_active: newVal }).eq('id', item.id);
    if (error) { alert('Update failed: ' + error.message); return; }
    setter(p => p.map(i => i.id === item.id ? { ...i, is_active: newVal } : i));
  };

  // Equip / unequip cage — also updates in_chastity and chastity_start_time at the top
  const equipCage = async (cage) => {
    const toLocal = (ts) => ts ? new Date(ts).toISOString().slice(0, 16) : '';

    if (cage.is_active) {
      // ── Unequip ──────────────────────────────────────────────────────────────
      if (!window.confirm(`Remove ${cage.name}? This will clear your chastity start time.`)) return;

      const { error } = await supabase
        .from('inventory')
        .update({ is_active: false })
        .eq('id', cage.id);
      if (error) { alert('Failed: ' + error.message); return; }

      const stateUpdate = { in_chastity: false, chastity_start_time: null, chastity_device: null };
      if (stateId) {
        await supabase.from('player-state').update(stateUpdate).eq('id', stateId);
      }

      setCages(p => p.map(c => c.id === cage.id ? { ...c, is_active: false } : c));
      setStatus(s => ({ ...s, in_chastity: false, chastity_start_time: '' }));

    } else {
      // ── Equip ─────────────────────────────────────────────────────────────────
      const { error: deactivateErr } = await supabase
        .from('inventory')
        .update({ is_active: false })
        .eq('category', 'cage')
        .neq('id', cage.id);
      if (deactivateErr) { alert('Failed: ' + deactivateErr.message); return; }

      const { error: activateErr } = await supabase
        .from('inventory')
        .update({ is_active: true })
        .eq('id', cage.id);
      if (activateErr) { alert('Failed: ' + activateErr.message); return; }

      // Only set a new start time if not already in chastity (switching cages keeps streak)
      const nowIso = new Date().toISOString();
      const alreadyLocked = status.in_chastity && status.chastity_start_time;
      const newStartTime = alreadyLocked ? null : nowIso;

      const stateUpdate = { in_chastity: true, chastity_device: cage.name };
      if (!alreadyLocked) stateUpdate.chastity_start_time = nowIso;

      if (stateId) {
        await supabase.from('player-state').update(stateUpdate).eq('id', stateId);
      } else {
        const { data } = await supabase
          .from('player-state')
          .insert([{ ...stateUpdate }])
          .select()
          .single();
        if (data) setStateId(data.id);
      }

      setCages(p => p.map(c => ({ ...c, is_active: c.id === cage.id })));
      setStatus(s => ({
        ...s,
        in_chastity: true,
        chastity_start_time: alreadyLocked ? s.chastity_start_time : toLocal(nowIso),
      }));
    }
  };

  // ── Location helpers ───────────────────────────────────────────────────────────
  const addLocation = async ({ name, description, image_url }) => {
    const { data, error } = await supabase
      .from('locations')
      .insert([{ name, description, image_url, is_active: false }])
      .select()
      .single();
    if (error) throw error;
    setLocations(p => [data, ...p]);
  };

  const deleteLocation = async (loc) => {
    if (!window.confirm(`Delete "${loc.name}"?`)) return;
    const { error } = await supabase.from('locations').delete().eq('id', loc.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    await deleteImage(loc.image_url, 'location-images');
    setLocations(p => p.filter(l => l.id !== loc.id));
  };

  const equipLocation = async (loc) => {
    if (loc.is_active) return;
    const { error: deactivateErr } = await supabase
      .from('locations')
      .update({ is_active: false })
      .neq('id', loc.id);
    if (deactivateErr) { alert('Failed: ' + deactivateErr.message); return; }

    const { error: activateErr } = await supabase
      .from('locations')
      .update({ is_active: true })
      .eq('id', loc.id);
    if (activateErr) { alert('Failed: ' + activateErr.message); return; }

    if (stateId) {
      await supabase.from('player-state').update({ location: loc.name }).eq('id', stateId);
    }
    setLocations(p => p.map(l => ({ ...l, is_active: l.id === loc.id })));
    setStatus(s => ({ ...s })); // trigger re-render for display
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="character-page">
      <h2 className="character-title">Character</h2>

      {/* ── Status ── */}
      <section className="char-section status-section">
        <h3 className="char-section-title">Status</h3>
        {statusLoading ? (
          <p className="loading-text">Loading...</p>
        ) : (
          <form className="status-form" onSubmit={handleStatusSave}>
            <div className="status-grid">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={status.in_chastity}
                  onChange={e => setStatus(s => ({ ...s, in_chastity: e.target.checked }))}
                />
                <span>In Chastity</span>
              </label>

              <div className="status-field">
                <label>Chastity Start Time</label>
                <input
                  type="datetime-local"
                  value={status.chastity_start_time}
                  onChange={e => setStatus(s => ({ ...s, chastity_start_time: e.target.value }))}
                />
              </div>

              <div className="status-field">
                <label>Last Orgasm</label>
                <input
                  type="datetime-local"
                  value={status.last_orgasm}
                  onChange={e => setStatus(s => ({ ...s, last_orgasm: e.target.value }))}
                />
              </div>

              <div className="status-field">
                <label>Last Shave</label>
                <input
                  type="datetime-local"
                  value={status.last_shave}
                  onChange={e => setStatus(s => ({ ...s, last_shave: e.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className="btn-save" disabled={statusSaving}>
              {statusSaving ? 'Saving...' : 'Save Status'}
            </button>
          </form>
        )}
      </section>

      {/* ── Chastity Cages ── */}
      <Section title="Chastity Cages" onAdd={() => setModal({ type: 'cage' })}>
        {inventoryLoading ? <p className="loading-text">Loading...</p> : (
          cages.length === 0
            ? <p className="empty-text">No cages added yet.</p>
            : <div className="char-grid">
                {cages.map(c => (
                  <ItemCard
                    key={c.id}
                    item={c}
                    equipLabel="Equip"
                    isEquipMode
                    onEquip={equipCage}
                    onDelete={item => deleteInventoryItem(item, setCages)}
                  />
                ))}
              </div>
        )}
      </Section>

      {/* ── Toys ── */}
      <Section title="Toys" onAdd={() => setModal({ type: 'toy' })}>
        {inventoryLoading ? <p className="loading-text">Loading...</p> : (
          toys.length === 0
            ? <p className="empty-text">No toys added yet.</p>
            : <div className="char-grid">
                {toys.map(t => (
                  <ItemCard
                    key={t.id}
                    item={t}
                    isEquipMode={false}
                    onToggle={item => toggleInventoryActive(item, setToys)}
                    onDelete={item => deleteInventoryItem(item, setToys)}
                  />
                ))}
              </div>
        )}
      </Section>

      {/* ── Outfits ── */}
      <Section title="Outfits" onAdd={() => setModal({ type: 'outfit' })}>
        {inventoryLoading ? <p className="loading-text">Loading...</p> : (
          outfits.length === 0
            ? <p className="empty-text">No outfits added yet.</p>
            : <div className="char-grid">
                {outfits.map(o => (
                  <ItemCard
                    key={o.id}
                    item={o}
                    isEquipMode={false}
                    onToggle={item => toggleInventoryActive(item, setOutfits)}
                    onDelete={item => deleteInventoryItem(item, setOutfits)}
                  />
                ))}
              </div>
        )}
      </Section>

      {/* ── Locations ── */}
      <Section title="Location" onAdd={() => setModal({ type: 'location' })}>
        {locations.length === 0
          ? <p className="empty-text">No locations added yet.</p>
          : <div className="char-grid">
              {locations.map(l => (
                <ItemCard
                  key={l.id}
                  item={l}
                  equipLabel="Set Location"
                  isEquipMode
                  onEquip={equipLocation}
                  onDelete={deleteLocation}
                />
              ))}
            </div>
        }
      </Section>

      {/* ── Modals ── */}
      {modal?.type === 'cage' && (
        <AddItemModal
          title="Cage"
          bucket="inventory-images"
          storagePrefix="inventory-images"
          onSave={d => addInventoryItem(d, 'cage')}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'toy' && (
        <AddItemModal
          title="Toy"
          bucket="inventory-images"
          storagePrefix="inventory-images"
          onSave={d => addInventoryItem(d, 'toy')}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'outfit' && (
        <AddItemModal
          title="Outfit"
          bucket="inventory-images"
          storagePrefix="inventory-images"
          onSave={d => addInventoryItem(d, 'outfit')}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'location' && (
        <AddItemModal
          title="Location"
          bucket="location-images"
          storagePrefix="location-images"
          onSave={addLocation}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default CharacterPage;
