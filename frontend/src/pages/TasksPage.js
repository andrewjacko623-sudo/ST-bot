import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import './TasksPage.css';

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [selectedInventoryIds, setSelectedInventoryIds] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
  });
  const [editSelectedInventoryIds, setEditSelectedInventoryIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load tasks and inventory on mount
  useEffect(() => {
    loadTasks();
    loadInventoryItems();
  }, []);

  const loadInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Error loading inventory:', error);
      } else {
        setInventoryItems(data || []);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  };

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      console.log('Loading tasks from Supabase...');
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading tasks:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // More helpful error messages
        if (error.code === 'PGRST116') {
          alert('❌ Table "tasks" not found. Please run the SQL schema script in Supabase.');
        } else if (error.message.includes('permission denied') || error.message.includes('new row violates row-level security')) {
          alert('❌ Permission denied. Check your Row Level Security policies in Supabase.');
        } else {
          alert('Failed to load tasks: ' + error.message);
        }
      } else {
        console.log('✅ Tasks loaded successfully:', data?.length || 0, 'tasks');
        setTasks(data || []);
      }
    } catch (error) {
      console.error('❌ Unexpected error loading tasks:', error);
      alert('Failed to load tasks: ' + error.message);
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

  const handleInventoryToggle = (inventoryId) => {
    setSelectedInventoryIds((prev) => {
      if (prev.includes(inventoryId)) {
        return prev.filter(id => id !== inventoryId);
      } else {
        return [...prev, inventoryId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a task name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            required_inventory_ids: selectedInventoryIds.length > 0 ? selectedInventoryIds : null,
            requirements: null, // Keep for backward compatibility, but we'll use required_inventory_ids
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        alert('Failed to create task: ' + error.message);
      } else {
        setTasks((prev) => [data, ...prev]);
        setFormData({ name: '', description: '' });
        setSelectedInventoryIds([]);
        setIsFormVisible(false);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);

      if (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task: ' + error.message);
      } else {
        setTasks((prev) => prev.filter((task) => task.id !== id));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const toggleForm = () => {
    setIsFormVisible(!isFormVisible);
    if (isFormVisible) {
      setFormData({ name: '', description: '' });
      setSelectedInventoryIds([]);
    }
  };

  const handleEdit = (task) => {
    setEditingTaskId(task.id);
    setEditFormData({
      name: task.name || '',
      description: task.description || '',
    });
    setEditSelectedInventoryIds(task.required_inventory_ids || []);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditFormData({ name: '', description: '' });
    setEditSelectedInventoryIds([]);
  };

  const handleUpdate = async (taskId) => {
    if (!editFormData.name.trim()) {
      alert('Please enter a task name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          name: editFormData.name.trim(),
          description: editFormData.description.trim() || null,
          required_inventory_ids: editSelectedInventoryIds.length > 0 ? editSelectedInventoryIds : null,
        })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task:', error);
        alert('Failed to update task: ' + error.message);
      } else {
        // Reload tasks to get updated data
        loadTasks();
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get inventory names from IDs
  const getInventoryNames = (inventoryIds) => {
    if (!inventoryIds || !Array.isArray(inventoryIds)) return [];
    return inventoryIds
      .map(id => {
        const item = inventoryItems.find(item => item.id === id);
        return item ? item.name : null;
      })
      .filter(Boolean);
  };

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <h2>Task List</h2>
        <button className="add-task-button" onClick={toggleForm}>
          {isFormVisible ? 'Cancel' : '+ Add New Task'}
        </button>
      </div>

      {isFormVisible && (
        <form className="task-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Task Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter task name"
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
              placeholder="Enter task description"
              rows="4"
            />
          </div>

          <div className="form-group">
            <label htmlFor="requirements">Required Inventory Items</label>
            <div className="inventory-selector">
              {inventoryItems.length === 0 ? (
                <p className="help-text">No inventory items available. Add items in the Inventory page first.</p>
              ) : (
                <div className="inventory-checkboxes">
                  {inventoryItems.map((item) => (
                    <label key={item.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedInventoryIds.includes(item.id)}
                        onChange={() => handleInventoryToggle(item.id)}
                      />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {selectedInventoryIds.length > 0 && (
                <div className="selected-items">
                  <strong>Selected: {selectedInventoryIds.length} item(s)</strong>
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Task'}
          </button>
        </form>
      )}

      <div className="tasks-list">
        {isLoading ? (
          <div className="empty-state">
            <p>Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks yet. Click "Add New Task" to create one!</p>
          </div>
        ) : (
          tasks.map((task) => {
            const requiredItems = getInventoryNames(task.required_inventory_ids || []);
            const isEditing = editingTaskId === task.id;
            
            return (
              <div key={task.id} className="task-card">
                {isEditing ? (
                  <div className="edit-form">
                    <div className="form-group">
                      <label>Task Name *</label>
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
                        rows="4"
                      />
                    </div>
                    <div className="form-group">
                      <label>Required Inventory Items</label>
                      <div className="inventory-selector">
                        <div className="inventory-checkboxes">
                          {inventoryItems.map((item) => (
                            <label key={item.id} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={editSelectedInventoryIds.includes(item.id)}
                                onChange={() => {
                                  if (editSelectedInventoryIds.includes(item.id)) {
                                    setEditSelectedInventoryIds(editSelectedInventoryIds.filter(id => id !== item.id));
                                  } else {
                                    setEditSelectedInventoryIds([...editSelectedInventoryIds, item.id]);
                                  }
                                }}
                              />
                              <span>{item.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="edit-buttons">
                      <button
                        className="save-button"
                        onClick={() => handleUpdate(task.id)}
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
                    <div className="task-header">
                      <h3>{task.name}</h3>
                      <div className="task-actions">
                        <button
                          className="edit-button"
                          onClick={() => handleEdit(task)}
                          title="Edit task"
                        >
                          ✎
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDelete(task.id)}
                          title="Delete task"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {task.description && (
                      <div className="task-field">
                        <strong>Description:</strong>
                        <p>{task.description}</p>
                      </div>
                    )}
                    {requiredItems.length > 0 && (
                      <div className="task-field">
                        <strong>Required Items:</strong>
                        <p>{requiredItems.join(', ')}</p>
                      </div>
                    )}
                    {/* Show old requirements field if it exists (backward compatibility) */}
                    {task.requirements && !task.required_inventory_ids && (
                      <div className="task-field">
                        <strong>Requirements:</strong>
                        <p>{task.requirements}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TasksPage;
