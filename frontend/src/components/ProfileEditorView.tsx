import { useState } from 'react';
import ProfileBasicsEditor from './ProfileBasicsEditor.js';
import RolesManager from './RolesManager.js';
import WorkManager from './portfolio/WorkManager.js';

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
}

interface ProfileEditorViewProps {
  user: User;
  apiUrl: string;
  connectedMethods: Array<{ id: string; type: string; created_at: string }>;
  initialTab?: 'basics' | 'roles' | 'work' | 'security';
  onBackToOverview: () => void;
  onViewPublicProfile?: (username: string) => void;
  onProfileUpdated?: () => void;
}

export default function ProfileEditorView({
  user,
  apiUrl,
  connectedMethods,
  initialTab = 'basics',
  onBackToOverview,
  onViewPublicProfile,
  onProfileUpdated,
}: ProfileEditorViewProps) {
  const [activeTab, setActiveTab] = useState<'basics' | 'roles' | 'work' | 'security'>(initialTab);

  // Security tab states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwNotice, setPwNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const hasEmail = connectedMethods.some((m) => m.type === 'email');
  const hasGoogle = connectedMethods.some((m) => m.type === 'google');
  const hasApple = connectedMethods.some((m) => m.type === 'apple');

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

  return (
    <div className="editor-container">
      {/* Editor Top Navigation Bar */}
      <header className="editor-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onBackToOverview}
          >
            ← Back to Overview
          </button>
          <div>
            <h2 className="editor-title">Edit Profile</h2>
            <p className="editor-subtitle">
              Modify your profile details, photo, roles, skills, and publishing options.
            </p>
          </div>
        </div>

        <div className="editor-header-actions">
          {user.username && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (onViewPublicProfile) {
                  onViewPublicProfile(user.username!);
                } else {
                  window.location.href = `/@${user.username}`;
                }
              }}
            >
              👁 View Public Profile
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onBackToOverview}
          >
            ✓ Done Editing
          </button>
        </div>
      </header>

      {/* Editor Tab Navigation */}
      <nav className="editor-tabs-nav">
        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'basics' ? 'active' : ''}`}
          onClick={() => setActiveTab('basics')}
        >
          <span>🎨</span> Profile Basics &amp; Photo
        </button>
        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          <span>💼</span> Roles &amp; Skills
        </button>
        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'work' ? 'active' : ''}`}
          onClick={() => setActiveTab('work')}
        >
          <span>📁</span> Work &amp; Portfolio
        </button>
        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <span>🔐</span> Security &amp; Accounts
        </button>
      </nav>

      {/* Tab Panels */}
      <div className="editor-panel-content">
        {activeTab === 'basics' && (
          <div className="editor-tab-pane">
            <ProfileBasicsEditor
              user={user}
              apiUrl={apiUrl}
              onProfileUpdated={() => {
                if (onProfileUpdated) onProfileUpdated();
              }}
            />
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="editor-tab-pane">
            <RolesManager apiUrl={apiUrl} />
          </div>
        )}

        {activeTab === 'work' && (
          <div className="editor-tab-pane">
            <WorkManager
              apiUrl={apiUrl}
              user={user}
              onItemsChanged={() => {
                if (onProfileUpdated) onProfileUpdated();
              }}
            />
          </div>
        )}

        {activeTab === 'security' && (
          <div className="editor-tab-pane">
            <div className="profile-details-card" style={{ marginTop: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', color: 'var(--text-h)' }}>
                Connected Login Accounts
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
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
                  <span className="detail-label">Google Account:</span>
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
                  <span className="detail-label">Apple ID:</span>
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

              {hasEmail ? (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '16px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: 'var(--text-h)' }}>
                    Change Password
                  </h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text)' }}>
                    Enter your current password and choose a new secure password (minimum 8 characters).
                  </p>

                  {pwNotice && (
                    <div
                      className={`alert ${pwNotice.type === 'success' ? 'alert-info' : 'alert-error'}`}
                      style={{ marginBottom: '14px' }}
                    >
                      <span>{pwNotice.type === 'success' ? '✅' : '⚠️'}</span>
                      <div>{pwNotice.message}</div>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} style={{ maxWidth: '440px' }}>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label htmlFor="edit-current-pw">Current Password</label>
                      <input
                        id="edit-current-pw"
                        type="password"
                        className="form-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label htmlFor="edit-new-pw">New Password (min 8 chars)</label>
                      <input
                        id="edit-new-pw"
                        type="password"
                        className="form-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={8}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '18px' }}>
                      <label htmlFor="edit-confirm-pw">Confirm New Password</label>
                      <input
                        id="edit-confirm-pw"
                        type="password"
                        className="form-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={8}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={pwLoading}
                      style={{ minWidth: '150px' }}
                    >
                      {pwLoading ? 'Updating Password...' : 'Save New Password'}
                    </button>
                  </form>
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                  Password change is only available when an email and password login method is connected.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor Footer / Return bar */}
      <footer className="editor-footer-bar">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBackToOverview}
        >
          ← Return to Profile Overview
        </button>

        {user.username && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (onViewPublicProfile) {
                onViewPublicProfile(user.username!);
              } else {
                window.location.href = `/@${user.username}`;
              }
            }}
          >
            🌐 View Public Profile
          </button>
        )}
      </footer>
    </div>
  );
}
