import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import './TasksPage.css';

const TasksPage = () => {
  const [pendingTasks, setPendingTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completingId, setCompletingId] = useState(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Error loading tasks:', error);
      } else {
        const tasks = data || [];
        setPendingTasks(tasks.filter(t => !t.status || t.status === 'pending'));
        setCompletedTasks(tasks.filter(t => t.status === 'completed'));
      }
    } catch (err) {
      console.error('Unexpected error loading tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (task) => {
    setCompletingId(task.id);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) {
        console.error('Error completing task:', error);
      } else {
        const completed = { ...task, status: 'completed', completed_at: new Date().toISOString() };
        setPendingTasks(prev => prev.filter(t => t.id !== task.id));
        setCompletedTasks(prev => [completed, ...prev]);
      }
    } catch (err) {
      console.error('Error completing task:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleDelete = async (task) => {
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) { console.error('Error deleting task:', error); return; }
    setCompletedTasks(prev => prev.filter(t => t.id !== task.id));
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all completed tasks?')) return;
    const ids = completedTasks.map(t => t.id);
    const { error } = await supabase.from('tasks').delete().in('id', ids);
    if (error) { console.error('Error deleting tasks:', error); return; }
    setCompletedTasks([]);
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <h2>My Tasks</h2>
        <button className="refresh-button" onClick={loadTasks} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Pending Tasks */}
      <section className="task-section">
        <h3 className="section-title pending-title">
          Pending
          <span className="task-count">{pendingTasks.length}</span>
        </h3>

        {isLoading ? (
          <div className="empty-state">
            <p>Loading tasks...</p>
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="empty-state">
            <p>No pending tasks. Ask Daddy for one in chat.</p>
          </div>
        ) : (
          <div className="tasks-list">
            {pendingTasks.map((task) => (
              <div key={task.id} className="task-card pending">
                <div className="task-card-header">
                  <h4 className="task-name">{task.name}</h4>
                  <button
                    className="complete-button"
                    onClick={() => handleComplete(task)}
                    disabled={completingId === task.id}
                    title="Mark as complete"
                  >
                    {completingId === task.id ? '...' : '✓ Done'}
                  </button>
                </div>
                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}
                {task.assigned_at && (
                  <span className="task-meta">Assigned {formatDate(task.assigned_at)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Completed Tasks */}
      <section className="task-section completed-section">
        <button
          className="section-toggle"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          <h3 className="section-title completed-title">
            Completed
            <span className="task-count completed-count">{completedTasks.length}</span>
          </h3>
          <span className="toggle-arrow">{showCompleted ? '▲' : '▼'}</span>
        </button>

        {showCompleted && (
          completedTasks.length === 0 ? (
            <div className="empty-state">
              <p>No completed tasks yet.</p>
            </div>
          ) : (
            <>
              <div className="completed-actions">
                <button className="clear-all-button" onClick={handleDeleteAll}>
                  Clear All
                </button>
              </div>
              <div className="tasks-list">
                {completedTasks.map((task) => (
                  <div key={task.id} className="task-card completed">
                    <div className="task-card-header">
                      <h4 className="task-name completed-name">{task.name}</h4>
                      <div className="completed-card-actions">
                        <span className="done-badge">Done</span>
                        <button
                          className="delete-button"
                          onClick={() => handleDelete(task)}
                          title="Delete task"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {task.description && (
                      <p className="task-description completed-description">{task.description}</p>
                    )}
                    {task.completed_at && (
                      <span className="task-meta">Completed {formatDate(task.completed_at)}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </section>
    </div>
  );
};

export default TasksPage;
