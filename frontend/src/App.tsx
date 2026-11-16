import { useEffect, useState } from 'react';
import './App.css';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  database: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data: HealthData) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [apiUrl]);

  return (
    <div style={{ maxWidth: '640px', margin: '48px auto', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '0 16px' }}>
      <h1>Portfolio Profile System</h1>
      <p style={{ color: '#666' }}>Step 1: Auth &amp; Onboarding</p>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginTop: '24px', backgroundColor: '#f8fafc' }}>
        <h2 style={{ fontSize: '1.25rem', marginTop: 0 }}>System Health</h2>
        {loading && <p>Checking backend health...</p>}
        {error && (
          <p style={{ color: '#dc2626' }}>
            Backend API unreachable: {error} <br />
            <small style={{ color: '#666' }}>Make sure the backend is running at {apiUrl}</small>
          </p>
        )}
        {health && (
          <div>
            <p><strong>API Server:</strong> <span style={{ color: '#16a34a' }}>● {health.status.toUpperCase()}</span></p>
            <p><strong>Database:</strong> <span style={{ color: health.database === 'connected' ? '#16a34a' : '#ea580c' }}>
              ● {health.database.toUpperCase()}
            </span></p>
            <p><strong>Server Time:</strong> {new Date(health.timestamp).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
