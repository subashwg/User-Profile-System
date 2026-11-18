import { useEffect, useState } from 'react';
import Avatar from './Avatar.js';
import ProfileBasicsEditor from './ProfileBasicsEditor.js';

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

  // Connected Login Methods
  const [connectedMethods, setConnectedMethods] = useState<
    Array<{ id: string; type: string; created_at: string }>
  >(user.login_methods || []);

  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwNotice, setPwNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const fetchLoginMethods = async () => {
    try {
      const res = await fetch(`${apiUrl}/account/login-methods`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.login_methods)) {
          setConnectedMethods(data.login_methods);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchLoginMethods();
  }, [apiUrl]);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwNotice(null);

    if (newPassword.length < 8) {
      setPwNotice({ type: 'error', message: 'New password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwNotice({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    setPwLoading(true);

    try {
      const res = await fetch(`${apiUrl}/account/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      setPwNotice({
        type: 'success',
        message: 'Password changed successfully! Other active sessions were ended.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setPwLoading(false);
    }
  };

  const hasEmail = connectedMethods.some((m) => m.type === 'email');
  const hasGoogle = connectedMethods.some((m) => m.type === 'google');
  const hasApple = connectedMethods.some((m) => m.type === 'apple');

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Avatar
            providerAvatarUrl={user.avatar_url}
            name={user.name}
            username={user.username}
            email={user.email}
            size={48}
          />
          <div>
            <h2 className="dashboard-title" style={{ margin: 0 }}>Welcome, {user.name || user.email.split('@')[0]}!</h2>
            <p className="dashboard-subtitle" style={{ margin: '2px 0 0 0' }}>Authenticated via secure session cookie</p>
          </div>
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
        <div
          className="alert alert-warning"
          style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
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
              <span
                style={{
                  fontSize: '0.8rem',
                  color: resendStatus.startsWith('Error') ? '#ef4444' : '#16a34a',
                }}
              >
                {resendStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Profile Basics Editor (Step 2) */}
      <ProfileBasicsEditor user={user} apiUrl={apiUrl} />

      {/* Account Profile Card */}
      <div className="profile-details-card" style={{ marginTop: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-h)' }}>
          Public Portfolio Profile
        </h3>

        <div className="detail-row">
          <span className="detail-label">Display Name:</span>
          <span className="detail-value" style={{ fontWeight: 600 }}>
            {user.name || 'Not set'}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Username / Public Link:</span>
          <span className="detail-value">
            {user.username ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ color: 'var(--accent)', fontWeight: 600 }}>@{user.username}</code>
                <span className="badge badge-success">Live (/@{user.username})</span>
              </span>
            ) : (
              'Not set yet'
            )}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Onboarding:</span>
          <span className="detail-value">
            {user.onboarding_completed ? (
              <span className="badge badge-success">✓ Completed</span>
            ) : (
              <span className="badge badge-warning">Pending</span>
            )}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Account Email:</span>
          <span className="detail-value">
            {user.email}{' '}
            <span className={`badge ${user.email_verified ? 'badge-success' : 'badge-warning'}`}>
              {user.email_verified ? 'Verified' : 'Unverified'}
            </span>
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">User ID:</span>
          <code className="detail-value">{user.id}</code>
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

      {/* Connected Login Methods & Account Settings Card */}
      <div className="profile-details-card" style={{ marginTop: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-h)' }}>
          Connected Login Methods
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <div className="detail-row">
            <span className="detail-label">Email + Password:</span>
            <span className="detail-value">
              {hasEmail ? (
                <span className="badge badge-success">● Connected</span>
              ) : (
                <span className="badge badge-warning">Not Connected</span>
              )}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Google:</span>
            <span className="detail-value">
              {hasGoogle ? (
                <span className="badge badge-success">● Connected</span>
              ) : (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => (window.location.href = `${apiUrl}/auth/google`)}
                >
                  + Link Google Account
                </button>
              )}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Apple:</span>
            <span className="detail-value">
              {hasApple ? (
                <span className="badge badge-success">● Connected</span>
              ) : (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => (window.location.href = `${apiUrl}/auth/apple`)}
                >
                  + Link Apple Account
                </button>
              )}
            </span>
          </div>
        </div>

        {/* Change Password Toggle & Form */}
        {hasEmail && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Security: Password Settings</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text)' }}>
                  Update your password and terminate old sessions
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                onClick={() => {
                  setShowChangePassword(!showChangePassword);
                  setPwNotice(null);
                }}
              >
                {showChangePassword ? 'Cancel' : 'Change Password'}
              </button>
            </div>

            {showChangePassword && (
              <form onSubmit={handleChangePassword} style={{ marginTop: '16px' }}>
                {pwNotice && (
                  <div
                    className={`alert ${pwNotice.type === 'success' ? 'alert-info' : 'alert-error'}`}
                    style={{ marginBottom: '12px' }}
                  >
                    <span>{pwNotice.type === 'success' ? '✅' : '⚠️'}</span>
                    <div>{pwNotice.message}</div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="current-pw">Current Password</label>
                  <input
                    id="current-pw"
                    type="password"
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new-pw">New Password (min 8 chars)</label>
                  <input
                    id="new-pw"
                    type="password"
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-pw">Confirm New Password</label>
                  <input
                    id="confirm-pw"
                    type="password"
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
                  style={{ marginTop: '8px' }}
                >
                  {pwLoading ? 'Updating Password...' : 'Save New Password'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
