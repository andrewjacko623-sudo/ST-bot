import React, { useState, useEffect } from 'react';
import './App.css';
import Navigation from './components/Navigation';
import ChatPage from './pages/ChatPage';
import TasksPage from './pages/TasksPage';
import InventoryPage from './pages/InventoryPage';
import GirlsPage from './pages/GirlsPage';
import PlayerStatePage from './pages/PlayerStatePage';
import PasswordPage from './pages/PasswordPage';

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuthenticate = () => {
    setIsAuthenticated(true);
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPage />;
      case 'tasks':
        return <TasksPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'girls':
        return <GirlsPage />;
      case 'player-state':
        return <PlayerStatePage />;
      default:
        return <ChatPage />;
    }
  };

  // Show password page if not authenticated
  if (!isAuthenticated) {
    return <PasswordPage onAuthenticate={handleAuthenticate} />;
  }

  return (
    <div className="App">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
