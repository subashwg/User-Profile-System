import { useCallback, useEffect, useState } from 'react';
import './App.css';
import LoginForm from './components/LoginForm.js';
import RegisterForm from './components/RegisterForm.js';
import ResetPasswordForm from './components/ResetPasswordForm.js';
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

interface DevEmail {
  to: string;
  subject: string;
  link: string;
  token: string;
  type: string;
  sentAt: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [devEmails, setDevEmails] = useState<DevEmail[]>([]);

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

  const fetchDevMailbox = useCallback(() => {
    fetch(`${apiUrl}/health/dev-mailbox`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDevEmails(data);
      })
      .catch(() => {});
  }, [apiUrl]);

  // Handle URL tokens (verification or password reset)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify_token');
    const paramResetToken = params.get('reset_token');

    if (verifyToken) {
      fetch(`${apiUrl}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            setNotice({ type: 'success', message: 'Email verified successfully! Your account is now confirmed.' });
            checkSession();
          } else {
            setNotice({ type: 'error', message: data.message || 'Verification link expired or invalid.' });
          }
        })
        .catch((err) => {
          setNotice({ type: 'error', message: err.message });
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (paramResetToken) {
      setResetToken(paramResetToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [apiUrl, checkSession]);

  useEffect(() => {
    checkSession();
    checkHealth();
    fetchDevMailbox();
    const interval = setInterval(() => {
      checkHealth();
      fetchDevMailbox();
    }, 5000);
    return () => clearInterval(interval);
  }, [checkSession, checkHealth, fetchDevMailbox]);

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
    checkHealth();
    fetchDevMailbox();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthTab('login');
    checkHealth();
  };

  const handleVerifyDirectly = async (token: string) => {
    try {
      const res = await fetch(`${apiUrl}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ type: 'success', message: 'Email verified successfully!' });
        checkSession();
        fetchDevMailbox();
      } else {
        setNotice({ type: 'error', message: data.message });
      }
    } catch (e) {
      setNotice({ type: 'error', message: (e as Error).message });
    }
  };

  return (
    <div className="app-container">
      <header className="header-section">
        <h1 className="app-title">Portfolio Profile System</h1>
        <p className="app-subtitle">Step 1: Auth &amp; Onboarding</p>
      </header>

      {notice && (
        <div className={`alert ${notice.type === 'success' ? 'alert-info' : 'alert-error'}`} style={{ marginBottom: '20px' }}>
          <span>{notice.type === 'success' ? '✅' : '⚠️'}</span>
          <div>
            <strong>{notice.message}</strong>
          </div>
          <button
            onClick={() => setNotice(null)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      <main className="main-content">
        {authLoading ? (
          <div className="status-card" style={{ textAlign: 'center', padding: '40px' }}>
            <p>Checking authentication session...</p>
          </div>
        ) : resetToken ? (
          <div className="auth-card-container">
            <div className="auth-card-body">
              <ResetPasswordForm
                token={resetToken}
                apiUrl={apiUrl}
                onSuccess={() => {
                  setResetToken(null);
                  setAuthTab('login');
                  setNotice({
                    type: 'success',
                    message: 'Password reset successfully! Please log in with your new password.',
                  });
                }}
                onCancel={() => setResetToken(null)}
              />
            </div>
          </div>
        ) : currentUser ? (
          <UserDashboard
            user={currentUser}
            apiUrl={apiUrl}
            onLogout={handleLogout}
            onRefresh={() => {
              checkSession();
              fetchDevMailbox();
            }}
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

        {/* Local Dev Inbox Box */}
        {devEmails.length > 0 && (
          <div className="status-card" style={{ marginTop: '24px', borderLeft: '4px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ color: 'var(--text-h)', fontSize: '0.95rem' }}>
                📬 Local Dev Mailbox ({devEmails.length} sent)
              </strong>
              <small style={{ color: 'var(--text)' }}>Dev Mode Mailer</small>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
              Latest to <strong>{devEmails[0].to}</strong>: <em>{devEmails[0].subject}</em>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {devEmails[0].type === 'verify_email' ? (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => handleVerifyDirectly(devEmails[0].token)}
                >
                  Verify Email Now (1-Click Test)
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => setResetToken(devEmails[0].token)}
                >
                  Open Reset Password Form (1-Click Test)
                </button>
              )}
              <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                Token: <code>{devEmails[0].token.slice(0, 10)}...</code>
              </span>
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
