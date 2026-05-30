import React from 'react';
import './Navigation.css';

const Navigation = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="navigation">
      <div className="nav-container">
        <h1 className="nav-logo">Sissy Trainer Ai</h1>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
          <button
            className={`nav-tab ${activeTab === 'character' ? 'active' : ''}`}
            onClick={() => setActiveTab('character')}
          >
            Character
          </button>
          <button
            className={`nav-tab ${activeTab === 'girls' ? 'active' : ''}`}
            onClick={() => setActiveTab('girls')}
          >
            Girls
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
