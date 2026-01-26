import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import './GirlsPage.css';

const GirlsPage = () => {
  const [girls, setGirls] = useState([]);
  const [selectedGirl, setSelectedGirl] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isMaterialFormVisible, setIsMaterialFormVisible] = useState(false);
  const [editingGirlId, setEditingGirlId] = useState(null);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states
  const [girlForm, setGirlForm] = useState({
    name: '',
    physical_description: '',
    relation: ''
  });
  
  const [materialForm, setMaterialForm] = useState({
    name: '',
    description: '',
    file: null,
    fileType: null,
    filePreview: null
  });

  const [editGirlForm, setEditGirlForm] = useState({
    name: '',
    physical_description: '',
    relation: ''
  });

  const [editMaterialForm, setEditMaterialForm] = useState({
    name: '',
    description: ''
  });

  // Load girls on mount
  useEffect(() => {
    loadGirls();
  }, []);

  // Load materials when girl is selected
  useEffect(() => {
    if (selectedGirl) {
      loadMaterials(selectedGirl.id);
    } else {
      setMaterials([]);
    }
  }, [selectedGirl]);

  const loadGirls = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('girls')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading girls:', error);
        alert('Failed to load girls: ' + error.message);
      } else {
        setGirls(data || []);
      }
    } catch (error) {
      console.error('Error loading girls:', error);
      alert('Failed to load girls');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMaterials = async (girlId) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('girl_material')
        .select('*')
        .eq('girl_id', girlId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading materials:', error);
        alert('Failed to load materials: ' + error.message);
      } else {
        setMaterials(data || []);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
      alert('Failed to load materials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGirl = async (e) => {
    e.preventDefault();
    if (!girlForm.name.trim()) {
      alert('Please enter a name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('girls')
        .insert([{
          name: girlForm.name.trim(),
          physical_description: girlForm.physical_description.trim() || null,
          relation: girlForm.relation.trim() || null
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating girl:', error);
        alert('Failed to create girl: ' + error.message);
      } else {
        setGirls([data, ...girls]);
        setGirlForm({ name: '', physical_description: '', relation: '' });
        setIsFormVisible(false);
        setSelectedGirl(data); // Auto-select the new girl
      }
    } catch (error) {
      console.error('Error creating girl:', error);
      alert('Failed to create girl');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGirl = async (id) => {
    if (!window.confirm('Are you sure you want to delete this girl? This will also delete all their material.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('girls')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting girl:', error);
        alert('Failed to delete girl: ' + error.message);
      } else {
        setGirls(girls.filter(g => g.id !== id));
        if (selectedGirl?.id === id) {
          setSelectedGirl(null);
        }
      }
    } catch (error) {
      console.error('Error deleting girl:', error);
      alert('Failed to delete girl');
    }
  };

  const handleUploadMaterial = async (e) => {
    e.preventDefault();
    if (!selectedGirl) {
      alert('Please select a girl first');
      return;
    }

    if (!materialForm.file) {
      alert('Please select a file');
      return;
    }

    if (!materialForm.name.trim()) {
      alert('Please enter a name for the material');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload file to storage (organized by girl_id)
      const fileExt = materialForm.file.name.split('.').pop();
      const fileName = `${selectedGirl.id}/${Date.now()}_${materialForm.name.trim().replace(/\s+/g, '_')}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('girl-material')
        .upload(fileName, materialForm.file, {
          contentType: materialForm.file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        alert('Failed to upload file: ' + uploadError.message);
        setIsSubmitting(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('girl-material')
        .getPublicUrl(fileName);

      // Create material entry
      const { data, error } = await supabase
        .from('girl_material')
        .insert([{
          girl_id: selectedGirl.id,
          name: materialForm.name.trim(),
          description: materialForm.description.trim() || null,
          media_url: publicUrl,
          media_type: materialForm.fileType
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating material:', error);
        alert('Failed to create material: ' + error.message);
      } else {
        setMaterials([data, ...materials]);
        setMaterialForm({ name: '', description: '', file: null, fileType: null, filePreview: null });
        setIsMaterialFormVisible(false);
        document.getElementById('material-file-input').value = '';
      }
    } catch (error) {
      console.error('Error uploading material:', error);
      alert('Failed to upload material');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (id, mediaUrl) => {
    if (!window.confirm('Are you sure you want to delete this material?')) {
      return;
    }

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('girl_material')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Error deleting material:', dbError);
        alert('Failed to delete material: ' + dbError.message);
        return;
      }

      // Delete file from storage
      if (mediaUrl) {
        const urlParts = mediaUrl.split('/girl-material/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          const { error: storageError } = await supabase.storage
            .from('girl-material')
            .remove([`${selectedGirl.id}/${filePath.split('/').pop()}`]);

          if (storageError) {
            console.warn('Error deleting file from storage:', storageError);
            // Don't fail the operation if storage deletion fails
          }
        }
      }

      setMaterials(materials.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('Failed to delete material');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 50MB for videos, 10MB for images)
      const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`File size should be less than ${maxSize / (1024 * 1024)}MB`);
        return;
      }

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        alert('Please select an image or video file');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setMaterialForm({
          ...materialForm,
          file: file,
          fileType: isImage ? 'image' : 'video',
          filePreview: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleGirlForm = () => {
    setIsFormVisible(!isFormVisible);
    if (!isFormVisible) {
      setGirlForm({ name: '', physical_description: '', relation: '' });
    }
  };

  const toggleMaterialForm = () => {
    setIsMaterialFormVisible(!isMaterialFormVisible);
    if (!isMaterialFormVisible) {
      setMaterialForm({ name: '', description: '', file: null, fileType: null, filePreview: null });
      setEditingMaterialId(null);
      const fileInput = document.getElementById('material-file-input');
      if (fileInput) fileInput.value = '';
    }
  };

  const handleEditGirl = (girl) => {
    setEditingGirlId(girl.id);
    setEditGirlForm({
      name: girl.name || '',
      physical_description: girl.physical_description || '',
      relation: girl.relation || ''
    });
  };

  const handleCancelEditGirl = () => {
    setEditingGirlId(null);
    setEditGirlForm({ name: '', physical_description: '', relation: '' });
  };

  const handleUpdateGirl = async (girlId) => {
    if (!editGirlForm.name.trim()) {
      alert('Please enter a name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('girls')
        .update({
          name: editGirlForm.name.trim(),
          physical_description: editGirlForm.physical_description.trim() || null,
          relation: editGirlForm.relation.trim() || null
        })
        .eq('id', girlId);

      if (error) {
        console.error('Error updating girl:', error);
        alert('Failed to update girl: ' + error.message);
      } else {
        loadGirls();
        handleCancelEditGirl();
      }
    } catch (error) {
      console.error('Error updating girl:', error);
      alert('Failed to update girl');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMaterial = (material) => {
    setEditingMaterialId(material.id);
    setEditMaterialForm({
      name: material.name || '',
      description: material.description || ''
    });
    setIsMaterialFormVisible(true);
  };

  const handleCancelEditMaterial = () => {
    setEditingMaterialId(null);
    setEditMaterialForm({ name: '', description: '' });
    setIsMaterialFormVisible(false);
  };

  const handleUpdateMaterial = async (materialId) => {
    if (!editMaterialForm.name.trim()) {
      alert('Please enter a name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('girl_material')
        .update({
          name: editMaterialForm.name.trim(),
          description: editMaterialForm.description.trim() || null
        })
        .eq('id', materialId);

      if (error) {
        console.error('Error updating material:', error);
        alert('Failed to update material: ' + error.message);
      } else {
        if (selectedGirl) {
          loadMaterials(selectedGirl.id);
        }
        handleCancelEditMaterial();
      }
    } catch (error) {
      console.error('Error updating material:', error);
      alert('Failed to update material');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="girls-page">
      <div className="girls-layout">
        {/* Left Sidebar - Girls List */}
        <div className="girls-sidebar">
          <div className="sidebar-header">
            <h2>Girls</h2>
            <button className="add-girl-button" onClick={toggleGirlForm}>
              {isFormVisible ? 'Cancel' : '+ Add Girl'}
            </button>
          </div>
          
          {isFormVisible && (
            <form onSubmit={handleCreateGirl} className="girl-form">
              <input
                type="text"
                placeholder="Name *"
                value={girlForm.name}
                onChange={(e) => setGirlForm({...girlForm, name: e.target.value})}
                required
              />
              <textarea
                placeholder="Physical Description"
                value={girlForm.physical_description}
                onChange={(e) => setGirlForm({...girlForm, physical_description: e.target.value})}
                rows="3"
              />
              <input
                type="text"
                placeholder="Relation"
                value={girlForm.relation}
                onChange={(e) => setGirlForm({...girlForm, relation: e.target.value})}
              />
              <div className="form-buttons">
                <button type="submit" className="submit-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
                <button type="button" className="cancel-button" onClick={toggleGirlForm}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="girls-list">
            {isLoading && girls.length === 0 ? (
              <div className="loading-state">Loading...</div>
            ) : girls.length === 0 ? (
              <div className="empty-state">No girls yet. Click "Add Girl" to create one!</div>
            ) : (
              girls.map(girl => {
                const isEditing = editingGirlId === girl.id;
                return (
                  <div
                    key={girl.id}
                    className={`girl-item ${selectedGirl?.id === girl.id ? 'active' : ''}`}
                    onClick={() => !isEditing && setSelectedGirl(girl)}
                  >
                    {isEditing ? (
                      <div className="edit-girl-form">
                        <input
                          type="text"
                          placeholder="Name *"
                          value={editGirlForm.name}
                          onChange={(e) => setEditGirlForm({...editGirlForm, name: e.target.value})}
                          required
                          onClick={(e) => e.stopPropagation()}
                        />
                        <textarea
                          placeholder="Physical Description"
                          value={editGirlForm.physical_description}
                          onChange={(e) => setEditGirlForm({...editGirlForm, physical_description: e.target.value})}
                          rows="2"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <input
                          type="text"
                          placeholder="Relation"
                          value={editGirlForm.relation}
                          onChange={(e) => setEditGirlForm({...editGirlForm, relation: e.target.value})}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="edit-buttons">
                          <button
                            type="button"
                            className="save-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateGirl(girl.id);
                            }}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEditGirl();
                            }}
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="girl-item-header">
                          <h3>{girl.name}</h3>
                          <div className="girl-item-actions">
                            <button
                              className="edit-girl-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditGirl(girl);
                              }}
                              title="Edit girl"
                            >
                              ✎
                            </button>
                            <button
                              className="delete-girl-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGirl(girl.id);
                              }}
                              title="Delete girl"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {girl.relation && <p className="girl-relation">{girl.relation}</p>}
                        {girl.physical_description && (
                          <p className="girl-description">{girl.physical_description.substring(0, 100)}...</p>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side - Material for Selected Girl */}
        <div className="material-section">
          {selectedGirl ? (
            <>
              <div className="material-header">
                <div>
                  <h2>{selectedGirl.name}'s Material</h2>
                  {selectedGirl.relation && <p className="girl-info">Relation: {selectedGirl.relation}</p>}
                </div>
                <button className="add-material-button" onClick={toggleMaterialForm}>
                  {isMaterialFormVisible ? 'Cancel' : '+ Add Material'}
                </button>
              </div>

              {isMaterialFormVisible && (
                <form onSubmit={editingMaterialId ? (e) => { e.preventDefault(); handleUpdateMaterial(editingMaterialId); } : handleUploadMaterial} className="material-form">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={editingMaterialId ? editMaterialForm.name : materialForm.name}
                    onChange={(e) => editingMaterialId 
                      ? setEditMaterialForm({...editMaterialForm, name: e.target.value})
                      : setMaterialForm({...materialForm, name: e.target.value})
                    }
                    required
                  />
                  <textarea
                    placeholder="Description"
                    value={editingMaterialId ? editMaterialForm.description : materialForm.description}
                    onChange={(e) => editingMaterialId
                      ? setEditMaterialForm({...editMaterialForm, description: e.target.value})
                      : setMaterialForm({...materialForm, description: e.target.value})
                    }
                    rows="3"
                  />
                  {!editingMaterialId && (
                    <div className="file-upload-section">
                      <label htmlFor="material-file-input" className="file-label">
                        Select Image or Video *
                      </label>
                      <input
                        id="material-file-input"
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        required
                      />
                      {materialForm.filePreview && (
                        <div className="file-preview">
                          {materialForm.fileType === 'image' ? (
                            <img src={materialForm.filePreview} alt="Preview" />
                          ) : (
                            <video src={materialForm.filePreview} controls />
                          )}
                          <button
                            type="button"
                            className="remove-file-button"
                            onClick={() => {
                              setMaterialForm({...materialForm, file: null, fileType: null, filePreview: null});
                              document.getElementById('material-file-input').value = '';
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="form-buttons">
                    <button type="submit" className="submit-button" disabled={isSubmitting}>
                      {isSubmitting ? (editingMaterialId ? 'Saving...' : 'Uploading...') : (editingMaterialId ? 'Save' : 'Upload')}
                    </button>
                    <button type="button" className="cancel-button" onClick={editingMaterialId ? handleCancelEditMaterial : toggleMaterialForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {isLoading && materials.length === 0 ? (
                <div className="loading-state">Loading materials...</div>
              ) : materials.length === 0 ? (
                <div className="empty-state">No material yet. Click "Add Material" to upload!</div>
              ) : (
                <div className="materials-grid">
                  {materials.map(material => (
                    <div key={material.id} className="material-card">
                      <div className="material-media">
                        {material.media_type === 'image' ? (
                          <img src={material.media_url} alt={material.name} />
                        ) : (
                          <video src={material.media_url} controls />
                        )}
                        <div className="material-media-actions">
                          <button
                            className="edit-material-button"
                            onClick={() => handleEditMaterial(material)}
                            title="Edit material"
                          >
                            ✎
                          </button>
                          <button
                            className="delete-material-button"
                            onClick={() => handleDeleteMaterial(material.id, material.media_url)}
                            title="Delete material"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="material-info">
                        <h3>{material.name}</h3>
                        {material.description && <p>{material.description}</p>}
                        <span className="media-type-badge">{material.media_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">
              <p>Select a girl from the sidebar to view their material</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GirlsPage;
