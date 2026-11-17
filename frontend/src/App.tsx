import { useCallback, useEffect, useState } from 'react';
import './App.css';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  database: 'connected' | 'disconnected' | string;
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const checkHealth = useCallback(() => {
    setLoading(true);
    fetch(`${apiUrl}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: HealthData) => {
        setHealth(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [apiUrl]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="app-container">
      <div className="header-section">
        <h1 className="app-title">Portfolio Profile System</h1>
        <p className="app-subtitle">Step 1: Auth &amp; Onboarding</p>
      </div>

      <div className="status-card">
        <div className="card-header">
          <h2 className="card-title">System Status</h2>
          <button className="refresh-btn" onClick={checkHealth} disabled={loading}>
            {loading ? 'Checking...' : 'Refresh'}
          </button>
        </div>

        {error ? (
          <div className="info-box badge-error" style={{ display: 'block' }}>
            <strong>Backend Unreachable:</strong> {error}
            <div style={{ marginTop: '4px' }}>
              Verify that the backend server is running on <code>{apiUrl}</code>.
            </div>
          </div>
        ) : health ? (
          <div className="status-grid">
            <div className="status-row">
              <span className="status-label">Backend API</span>
              <span className="badge badge-success">
                <span className="dot dot-green"></span>
                ONLINE (HTTP 200)
              </span>
            </div>

            <div className="status-row">
              <span className="status-label">PostgreSQL Database</span>
              {health.database === 'connected' ? (
                <span className="badge badge-success">
                  <span className="dot dot-green"></span>
                  CONNECTED
                </span>
              ) : (
                <span className="badge badge-warning">
                  <span className="dot dot-orange"></span>
                  DISCONNECTED
                </span>
              )}
            </div>

            <div className="status-row">
              <span className="status-label">Server Time</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>
                {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="status-row">
              <span className="status-label">Uptime</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>
                {Math.floor(health.uptime)} seconds
              </span>
            </div>

            {health.database === 'disconnected' && (
              <div className="info-box">
                <strong>Database Not Connected</strong>
                <div style={{ marginTop: '6px' }}>
                  PostgreSQL is not responding on <code>localhost:5432</code>. Starting PostgreSQL will automatically switch the status to Connected.
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--text)' }}>Loading status...</p>
        )}
      </div>
    </div>
  );
}
