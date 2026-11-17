import { useState } from 'react';

interface User {
  id: string;
  email: string;
  email_verified: boolean;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  onboarding_completed: boolean;
  created_at: string;
  last_login_at?: string | null;
  login_methods?: Array<{ id: string; type: string; created_at: string }>;
}

interface UserDashboardProps {
  user: User;
  apiUrl: string;
  onLogout: () => void;
  onRefresh: () => void;
}

export default function UserDashboard({ user, apiUrl, onLogout, onRefresh }: UserDashboardProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      onLogout();
    } catch {
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendStatus(null);
    try {
      const res = await fetch(`${apiUrl}/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to resend verification link');
      }
      setResendStatus('Verification link sent! Check the dev mailbox below.');
      onRefresh();
    } catch (e) {
      setResendStatus(`Error: ${(e as Error).message}`);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Welcome, {user.name || user.email.split('@')[0]}!</h2>
          <p className="dashboard-subtitle">Authenticated via secure session cookie</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </div>

      {!user.email_verified && (
        <div className="alert alert-warning" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span>✉️</span>
            <div>
              <strong>Verify your email address</strong>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem' }}>
                Your account is unverified. Click the link in your email or use the dev mailbox below.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? 'Sending...' : 'Resend verification link'}
            </button>
            {resendStatus && (
              <span style={{ fontSize: '0.8rem', color: resendStatus.startsWith('Error') ? '#ef4444' : '#16a34a' }}>
                {resendStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {!user.onboarding_completed && (
        <div className="alert alert-info" style={{ marginTop: '12px' }}>
          <span>🚀</span>
          <div>
            <strong>Finish onboarding</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem' }}>
              Set your public display name &amp; claim your unique <code>@username</code> in <strong>Step 6</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="profile-details-card">
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-h)' }}>Account Profile</h3>

        <div className="detail-row">
          <span className="detail-label">User ID:</span>
          <code className="detail-value">{user.id}</code>
        </div>

        <div className="detail-row">
          <span className="detail-label">Email:</span>
          <span className="detail-value">
            {user.email}{' '}
            <span className={`badge ${user.email_verified ? 'badge-success' : 'badge-warning'}`}>
              {user.email_verified ? 'Verified' : 'Unverified'}
            </span>
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Username:</span>
          <span className="detail-value">{user.username || 'Not set yet (Onboarding Step 6)'}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Connected Login Methods:</span>
          <span className="detail-value">
            <span className="badge badge-success">● Email + Password</span>
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Member Since:</span>
          <span className="detail-value">{new Date(user.created_at).toLocaleDateString()}</span>
        </div>

        {user.last_login_at && (
          <div className="detail-row">
            <span className="detail-label">Last Login:</span>
            <span className="detail-value">{new Date(user.last_login_at).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
