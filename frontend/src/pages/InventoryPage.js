import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import './InventoryPage.css';

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load items from Supabase on mount
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      console.log('Loading inventory from Supabase...');
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading inventory:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // More helpful error messages
        if (error.code === 'PGRST116') {
          alert('❌ Table "inventory" not found. Please run the SQL schema script in Supabase.');
        } else if (error.message.includes('permission denied') || error.message.includes('new row violates row-level security')) {
          alert('❌ Permission denied. Check your Row Level Security policies in Supabase.');
        } else {
          alert('Failed to load inventory: ' + error.message);
        }
      } else {
        console.log('✅ Inventory loaded successfully:', data?.length || 0, 'items');
        setItems(data || []);
      }
    } catch (error) {
      console.error('❌ Unexpected error loading inventory:', error);
      alert('Failed to load inventory: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter an item name');
      return;
    }

    if (!selectedImage) {
      alert('Please upload an image');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload image to Supabase Storage
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${Date.now()}_${formData.name.trim().replace(/\s+/g, '_')}.${fileExt}`;
      const filePath = `inventory-images/${fileName}`;

      // Upload the image
      const { error: uploadError } = await supabase.storage
        .from('inventory-images')
        .upload(filePath, selectedImage, {
          contentType: selectedImage.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        alert('Failed to upload image: ' + uploadError.message);
        setIsSubmitting(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('inventory-images')
        .getPublicUrl(filePath);

      // Insert item into database
      const { data, error } = await supabase
        .from('inventory')
        .insert([
          {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            image_url: publicUrl,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating item:', error);
        alert('Failed to create item: ' + error.message);
      } else {
        setItems((prev) => [data, ...prev]);
        setFormData({ name: '', description: '' });
        setSelectedImage(null);
        setImagePreview(null);
        setIsFormVisible(false);
      }
    } catch (error) {
      console.error('Error creating item:', error);
      alert('Failed to create item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ is_active: newStatus })
        .eq('id', id);

      if (error) {
        console.error('Error updating item status:', error);
        alert('Failed to update item status: ' + error.message);
      } else {
        // Update the item in the local state
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, is_active: newStatus } : item
          )
        );
      }
    } catch (error) {
      console.error('Error updating item status:', error);
      alert('Failed to update item status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      // Find the item to get the image URL
      const item = items.find((item) => item.id === id);
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Error deleting item:', dbError);
        alert('Failed to delete item: ' + dbError.message);
        return;
      }

      // Delete image from storage if it exists
      if (item?.image_url) {
        const imagePath = item.image_url.split('/inventory-images/')[1];
        if (imagePath) {
          const { error: storageError } = await supabase.storage
            .from('inventory-images')
            .remove([`inventory-images/${imagePath}`]);

          if (storageError) {
            console.warn('Error deleting image from storage:', storageError);
            // Don't fail the operation if image deletion fails
          }
        }
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const toggleForm = () => {
    setIsFormVisible(!isFormVisible);
    if (isFormVisible) {
      setFormData({ name: '', description: '' });
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const handleEdit = (item) => {
    setEditingItemId(item.id);
    setEditFormData({
      name: item.name || '',
      description: item.description || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditFormData({ name: '', description: '' });
  };

  const handleUpdate = async (itemId) => {
    if (!editFormData.name.trim()) {
      alert('Please enter an item name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          name: editFormData.name.trim(),
          description: editFormData.description.trim() || null,
        })
        .eq('id', itemId);

      if (error) {
        console.error('Error updating item:', error);
        alert('Failed to update item: ' + error.message);
      } else {
        // Reload items to get updated data
        loadItems();
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <h2>Inventory</h2>
        <button className="add-item-button" onClick={toggleForm}>
          {isFormVisible ? 'Cancel' : '+ Add New Item'}
        </button>
      </div>

      {isFormVisible && (
        <form className="inventory-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Item Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter item name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter item description"
                rows="4"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="image">Photo *</label>
            <div className="image-upload-container">
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageChange}
                className="image-input"
                required
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <button
                    type="button"
                    className="remove-image-button"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                      document.getElementById('image').value = '';
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      )}

      <div className="inventory-grid">
        {isLoading ? (
          <div className="empty-state">
            <p>Loading inventory...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p>No items in inventory yet. Click "Add New Item" to add one!</p>
          </div>
        ) : (
          items.map((item) => {
            const isEditing = editingItemId === item.id;
            return (
              <div key={item.id} className="inventory-card">
                <div className="card-image-container">
                  <img src={item.image_url} alt={item.name} />
                </div>
                <div className="card-content">
                  {isEditing ? (
                    <div className="edit-form">
                      <div className="form-group">
                        <label>Item Name *</label>
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          value={editFormData.description}
                          onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                          rows="3"
                        />
                      </div>
                      <div className="edit-buttons">
                        <button
                          className="save-button"
                          onClick={() => handleUpdate(item.id)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="cancel-button"
                          onClick={handleCancelEdit}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="card-header">
                        <h3>{item.name}</h3>
                        <div className="card-actions-header">
                          <button
                            className="edit-button"
                            onClick={() => handleEdit(item)}
                            title="Edit item"
                          >
                            ✎
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => handleDelete(item.id)}
                            title="Delete item"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {item.description && (
                        <p className="card-description">{item.description}</p>
                      )}
                      <div className="card-actions">
                        <button
                          className={`toggle-active-button ${item.is_active ? 'active' : 'inactive'}`}
                          onClick={() => handleToggleActive(item.id, item.is_active || false)}
                          title={item.is_active ? 'Deactivate item' : 'Activate item'}
                        >
                          {item.is_active ? '✓ Active' : '○ Inactive'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default InventoryPage;
