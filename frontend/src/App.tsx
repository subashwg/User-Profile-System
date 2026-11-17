import { useCallback, useEffect, useState } from 'react';
import './App.css';
import LoginForm from './components/LoginForm.js';
import RegisterForm from './components/RegisterForm.js';
import UserDashboard from './components/UserDashboard.js';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  database: 'connected' | 'disconnected' | string;
  stats?: {
    usersCount: number;
    loginMethodsCount: number;
  };
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');

  const [health, setHealth] = useState<HealthData | null>(null);
  const [showSystemStatus, setShowSystemStatus] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Check current session
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [apiUrl]);

  const checkHealth = useCallback(() => {
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => {});
  }, [apiUrl]);

  useEffect(() => {
    checkSession();
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [checkSession, checkHealth]);

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
    checkHealth();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthTab('login');
    checkHealth();
  };

  return (
    <div className="app-container">
      <header className="header-section">
        <h1 className="app-title">Portfolio Profile System</h1>
        <p className="app-subtitle">Step 1: Auth &amp; Onboarding</p>
      </header>

      <main className="main-content">
        {authLoading ? (
          <div className="status-card" style={{ textAlign: 'center', padding: '40px' }}>
            <p>Checking authentication session...</p>
          </div>
        ) : currentUser ? (
          <UserDashboard
            user={currentUser}
            apiUrl={apiUrl}
            onLogout={handleLogout}
          />
        ) : (
          <div className="auth-card-container">
            <div className="auth-tabs">
              <button
                className={`tab-btn ${authTab === 'register' ? 'active' : ''}`}
                onClick={() => setAuthTab('register')}
              >
                Sign Up
              </button>
              <button
                className={`tab-btn ${authTab === 'login' ? 'active' : ''}`}
                onClick={() => setAuthTab('login')}
              >
                Log In
              </button>
            </div>

            <div className="auth-card-body">
              {authTab === 'register' ? (
                <RegisterForm
                  apiUrl={apiUrl}
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={() => setAuthTab('login')}
                />
              ) : (
                <LoginForm
                  apiUrl={apiUrl}
                  onSuccess={handleAuthSuccess}
                  onSwitchToRegister={() => setAuthTab('register')}
                />
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="footer-section">
        <div className="system-pill" onClick={() => setShowSystemStatus(!showSystemStatus)}>
          <span className="dot dot-green"></span>
          <span>System Live</span>
          <span className="badge badge-success" style={{ marginLeft: '4px' }}>
            DB {health?.database?.toUpperCase() || 'CHECKING'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text)' }}>
            {showSystemStatus ? '▲ Hide Status' : '▼ View System & DB Info'}
          </span>
        </div>

        {showSystemStatus && health && (
          <div className="status-card" style={{ marginTop: '12px' }}>
            <div className="status-grid">
              <div className="status-row">
                <span className="status-label">API Health:</span>
                <span className="badge badge-success">● {health.status.toUpperCase()}</span>
              </div>
              <div className="status-row">
                <span className="status-label">Database Connection:</span>
                <span className="badge badge-success">● {health.database.toUpperCase()}</span>
              </div>
              {health.stats && (
                <div className="status-row">
                  <span className="status-label">Registered Accounts:</span>
                  <span style={{ fontFamily: 'var(--mono)' }}>{health.stats.usersCount} users</span>
                </div>
              )}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
