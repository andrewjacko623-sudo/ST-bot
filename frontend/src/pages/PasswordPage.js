import React, { useState } from 'react';
import './PasswordPage.css';

const PASSWORD = 'Suziestan1';

const PasswordPage = ({ onAuthenticate }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate a small delay for better UX
    setTimeout(() => {
      if (password === PASSWORD) {
        // Store authentication in localStorage
        localStorage.setItem('isAuthenticated', 'true');
        onAuthenticate();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="password-page">
      <div className="password-container">
        <div className="password-header">
          <h1>Sissy Trainer Ai</h1>
          <p>Enter password to continue</p>
        </div>
        <form className="password-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Password"
              className="password-input"
              autoFocus
              disabled={isLoading}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button
            type="submit"
            className="submit-button"
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordPage;
