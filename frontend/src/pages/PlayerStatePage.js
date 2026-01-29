import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import './PlayerStatePage.css';

const PlayerStatePage = () => {
  const [playerState, setPlayerState] = useState({
    in_chastity: false,
    chastity_start_time: '',
    lockbox_endtime: '',
    chastity_device: '',
    location: '',
    last_orgasm: '',
    last_shave: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stateId, setStateId] = useState(null);

  // Load player state on mount
  useEffect(() => {
    loadPlayerState();
  }, []);

  const loadPlayerState = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('player-state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // If no record exists, that's okay - we'll create one on save
        if (error.code === 'PGRST116') {
          console.log('No player state found, will create on first save');
          setPlayerState({
            in_chastity: false,
            chastity_start_time: '',
            lockbox_endtime: '',
            chastity_device: '',
            location: '',
            last_orgasm: '',
            last_shave: '',
          });
        } else {
          console.error('Error loading player state:', error);
          alert('Failed to load player state: ' + error.message);
        }
      } else {
        setStateId(data.id);
        const toDatetimeLocal = (ts) =>
          ts ? new Date(ts).toISOString().slice(0, 16) : '';
        setPlayerState({
          in_chastity: data.in_chastity ?? false,
          chastity_start_time: toDatetimeLocal(data.chastity_start_time),
          lockbox_endtime: toDatetimeLocal(data.lockbox_endtime),
          chastity_device: data.chastity_device || '',
          location: data.location || '',
          last_orgasm: toDatetimeLocal(data.last_orgasm),
          last_shave: toDatetimeLocal(data.last_shave),
        });
      }
    } catch (error) {
      console.error('Unexpected error loading player state:', error);
      alert('Failed to load player state: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPlayerState((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const toIso = (s) => (s ? new Date(s).toISOString() : null);
      const updateData = {
        in_chastity: playerState.in_chastity,
        chastity_start_time: toIso(playerState.chastity_start_time),
        lockbox_endtime: toIso(playerState.lockbox_endtime),
        chastity_device: playerState.chastity_device.trim() || null,
        location: playerState.location.trim() || null,
        last_orgasm: toIso(playerState.last_orgasm),
        last_shave: toIso(playerState.last_shave),
      };

      let error;
      if (stateId) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('player-state')
          .update(updateData)
          .eq('id', stateId);
        error = updateError;
      } else {
        // Insert new record
        const { data, error: insertError } = await supabase
          .from('player-state')
          .insert([updateData])
          .select()
          .single();
        error = insertError;
        if (data) {
          setStateId(data.id);
        }
      }

      if (error) {
        console.error('Error saving player state:', error);
        alert('Failed to save player state: ' + error.message);
      } else {
        alert('Player state saved successfully!');
        loadPlayerState(); // Reload to get updated timestamp
      }
    } catch (error) {
      console.error('Error saving player state:', error);
      alert('Failed to save player state');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="player-state-page">
        <div className="loading-state">
          <p>Loading player state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="player-state-page">
      <div className="player-state-header">
        <h2>Player State</h2>
      </div>

      <form className="player-state-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="in_chastity">
            <input
              type="checkbox"
              id="in_chastity"
              name="in_chastity"
              checked={playerState.in_chastity}
              onChange={handleInputChange}
            />
            <span>In Chastity</span>
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="chastity_start_time">Chastity Start Time</label>
          <input
            type="datetime-local"
            id="chastity_start_time"
            name="chastity_start_time"
            value={playerState.chastity_start_time}
            onChange={handleInputChange}
          />
          <small className="form-hint">When you entered chastity</small>
        </div>

        <div className="form-group">
          <label htmlFor="lockbox_endtime">Lockbox End Time</label>
          <input
            type="datetime-local"
            id="lockbox_endtime"
            name="lockbox_endtime"
            value={playerState.lockbox_endtime}
            onChange={handleInputChange}
          />
          <small className="form-hint">When the lockbox period ends</small>
        </div>

        <div className="form-group">
          <label htmlFor="chastity_device">Chastity Device</label>
          <input
            type="text"
            id="chastity_device"
            name="chastity_device"
            value={playerState.chastity_device}
            onChange={handleInputChange}
            placeholder="Enter chastity device name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            type="text"
            id="location"
            name="location"
            value={playerState.location}
            onChange={handleInputChange}
            placeholder="Enter current location"
          />
        </div>

        <div className="form-group">
          <label htmlFor="last_orgasm">Last Orgasm</label>
          <input
            type="datetime-local"
            id="last_orgasm"
            name="last_orgasm"
            value={playerState.last_orgasm}
            onChange={handleInputChange}
          />
          <small className="form-hint">Leave empty if no orgasm recorded</small>
        </div>

        <div className="form-group">
          <label htmlFor="last_shave">Last Shave</label>
          <input
            type="datetime-local"
            id="last_shave"
            name="last_shave"
            value={playerState.last_shave}
            onChange={handleInputChange}
          />
          <small className="form-hint">When you last shaved</small>
        </div>

        <button type="submit" className="save-button" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save State'}
        </button>
      </form>
    </div>
  );
};

export default PlayerStatePage;
