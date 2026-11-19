import { useEffect, useState } from 'react';
import Avatar from './Avatar.js';

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

interface Skill {
  id: string;
  name: string;
  position: number;
}

interface Role {
  id: string;
  title: string;
  description: string | null;
  position: number;
  is_primary: boolean;
  skills: Skill[];
}

interface ProfileBasics {
  headline: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  status: 'draft' | 'published';
  published_at?: string | null;
}

interface ProfileOverviewProps {
  user: User;
  apiUrl: string;
  connectedMethods: Array<{ id: string; type: string; created_at: string }>;
  onEditProfile: () => void;
  onViewPublicProfile?: (username: string) => void;
  onLogout: () => void;
  onRefresh: () => void;
}

export default function ProfileOverview({
  user,
  apiUrl,
  connectedMethods,
  onEditProfile,
  onViewPublicProfile,
  onLogout,
  onRefresh,
}: ProfileOverviewProps) {
  const [profile, setProfile] = useState<ProfileBasics | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const [profileRes, rolesRes] = await Promise.all([
        fetch(`${apiUrl}/profile/me`, { credentials: 'include' }),
        fetch(`${apiUrl}/roles`, { credentials: 'include' }),
      ]);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setProfile(pData);
      }
      if (rolesRes.ok) {
        const rData = await rolesRes.json();
        if (Array.isArray(rData.roles)) {
          setRoles(rData.roles);
        }
      }
    } catch (e) {
      console.error('Failed to load profile overview data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [apiUrl]);

  const handleCopyPublicLink = () => {
    if (!user.username) return;
    const url = `${window.location.origin}/@${user.username}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

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

  const handleResendVerification = async () => {
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

  const primaryRole = roles.find((r) => r.is_primary);
  const customAvatarAbsolute = profile?.avatar_url
    ? profile.avatar_url.startsWith('http')
      ? profile.avatar_url
      : `${apiUrl}${profile.avatar_url}`
    : null;

  const hasEmail = connectedMethods.some((m) => m.type === 'email');
  const hasGoogle = connectedMethods.some((m) => m.type === 'google');
  const hasApple = connectedMethods.some((m) => m.type === 'apple');

  return (
    <div className="overview-container">
      {/* Top Header / App Bar */}
      <header className="overview-header-bar">
        <div className="overview-brand">
          <span className="overview-logo-icon">💼</span>
          <div>
            <h2 className="overview-app-title">Profile Dashboard</h2>
            <p className="overview-app-subtitle">View Mode — Your Portfolio Profile Overview</p>
          </div>
        </div>

        <div className="overview-header-actions">
          <button
            type="button"
            className="btn btn-primary overview-edit-btn"
            onClick={onEditProfile}
          >
            ✏️ Edit Profile
          </button>

          {user.username && (
            <button
              type="button"
              className="btn btn-secondary"
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

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </header>

      {/* Unverified Email Warning Banner */}
      {!user.email_verified && (
        <div className="alert alert-warning overview-alert">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.2rem' }}>✉️</span>
            <div>
              <strong>Verify your email address</strong>
              <p style={{ margin: '2px 0 6px 0', fontSize: '0.85rem' }}>
                Your account is unverified. Check your email or use the Dev Mailbox below.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '5px 12px' }}
                  onClick={handleResendVerification}
                  disabled={resending}
                >
                  {resending ? 'Sending...' : 'Resend verification link'}
                </button>
                {resendStatus && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: resendStatus.startsWith('Error') ? '#ef4444' : '#10b981',
                      fontWeight: 500,
                    }}
                  >
                    {resendStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Profile Showcase Card (Read-Only) */}
      <section className="overview-hero-card">
        <div className="overview-hero-content">
          <div className="overview-avatar-wrapper">
            <Avatar
              customAvatarUrl={customAvatarAbsolute}
              providerAvatarUrl={user.avatar_url}
              name={user.name}
              username={user.username}
              email={user.email}
              size={96}
              className="overview-avatar"
            />
          </div>

          <div className="overview-identity">
            <div className="overview-name-row">
              <h1 className="overview-display-name">
                {user.name || `@${user.username || 'unnamed'}`}
              </h1>
              {primaryRole && (
                <span className="overview-primary-badge">★ {primaryRole.title}</span>
              )}
              {profile?.status && (
                <span
                  className={`badge ${
                    profile.status === 'published' ? 'badge-success' : 'badge-warning'
                  }`}
                  style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}
                >
                  {profile.status === 'published' ? '● Published' : '○ Draft'}
                </span>
              )}
            </div>

            <div className="overview-handle">
              <code>@{user.username || 'username'}</code>
              {profile?.location && (
                <span className="overview-location">
                  <span>📍</span> {profile.location}
                </span>
              )}
            </div>

            {profile?.headline ? (
              <p className="overview-headline">{profile.headline}</p>
            ) : (
              <p className="overview-placeholder-text">
                No headline set yet.{' '}
                <button type="button" className="link-btn" onClick={onEditProfile}>
                  Add a headline in Edit Mode
                </button>
              </p>
            )}

            {profile?.bio ? (
              <div className="overview-bio-box">{profile.bio}</div>
            ) : (
              <p className="overview-placeholder-text" style={{ marginTop: '8px' }}>
                No short bio added yet.{' '}
                <button type="button" className="link-btn" onClick={onEditProfile}>
                  Add a bio in Edit Mode
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="overview-hero-footer">
          <span className="overview-mode-pill">
            <span className="dot dot-green"></span> View Mode Active
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onEditProfile}
          >
            ✏️ Modify Profile Details
          </button>
        </div>
      </section>

      {/* Main 2-Column Responsive Dashboard Grid (up to 1440px) */}
      <div className="overview-grid">
        {/* Left / Main Column: Roles & Skills Showcase + Portfolio */}
        <div className="overview-main-col">
          {/* Roles & Skills Showcase */}
          <section className="overview-card">
            <div className="overview-card-header">
              <div>
                <h3 className="overview-card-title">
                  <span>💼</span> Roles &amp; Skills Showcase
                </h3>
                <p className="overview-card-subtitle">
                  {roles.length} of 5 roles configured · Displayed on your public portfolio
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onEditProfile}
              >
                ✏️ Manage Roles
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text)' }}>
                Loading roles and skills...
              </div>
            ) : roles.length === 0 ? (
              <div className="overview-empty-box">
                <p style={{ margin: '0 0 12px 0', color: 'var(--text)' }}>
                  You have not added any roles yet.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onEditProfile}
                >
                  + Add Your First Role
                </button>
              </div>
            ) : (
              <div className="overview-roles-list">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className={`overview-role-item ${role.is_primary ? 'is-primary' : ''}`}
                  >
                    <div className="overview-role-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 className="overview-role-title">{role.title}</h4>
                        {role.is_primary && (
                          <span className="badge badge-accent">Primary Role</span>
                        )}
                      </div>
                    </div>

                    {role.description && (
                      <p className="overview-role-desc">{role.description}</p>
                    )}

                    {role.skills && role.skills.length > 0 ? (
                      <div className="overview-skills-wrap">
                        {role.skills.map((skill) => (
                          <span key={skill.id} className="overview-skill-pill">
                            {skill.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="overview-no-skills-hint">
                        No skills listed for this role yet.
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Portfolio Projects Showcase Placeholder */}
          <section className="overview-card overview-portfolio-card">
            <div className="overview-portfolio-inner">
              <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🎨</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: 'var(--text-h)' }}>
                Featured Portfolio Projects
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.88rem',
                  color: 'var(--text)',
                  maxWidth: '520px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  lineHeight: 1.5,
                }}
              >
                Portfolio coming soon in Step 3. Showcase case studies, screenshots, live demo links,
                and source repositories directly on your public page.
              </p>
            </div>
          </section>
        </div>

        {/* Right / Sidebar Column: Publishing, Account & Security */}
        <aside className="overview-sidebar-col">
          {/* Public Status Card */}
          <div className="overview-card">
            <h3 className="overview-card-title">
              <span>🌐</span> Public Profile Link
            </h3>

            <div style={{ margin: '14px 0' }}>
              <div className="overview-status-indicator">
                <span style={{ fontSize: '1.2rem' }}>
                  {profile?.status === 'published' ? '🟢' : '🟡'}
                </span>
                <div>
                  <strong style={{ color: 'var(--text-h)', fontSize: '0.95rem' }}>
                    {profile?.status === 'published' ? 'Profile is Published' : 'Profile is Draft'}
                  </strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text)' }}>
                    {profile?.status === 'published'
                      ? 'Visible to visitors and search engines.'
                      : 'Hidden from public visitors (returns 404).'}
                  </p>
                </div>
              </div>

              {user.username && (
                <div className="overview-url-box">
                  <code>/@{user.username}</code>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyPublicLink}
                  >
                    {copiedLink ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {user.username && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                  onClick={() => {
                    if (onViewPublicProfile) {
                      onViewPublicProfile(user.username!);
                    } else {
                      window.location.href = `/@${user.username}`;
                    }
                  }}
                >
                  👁 Preview Public Page
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.85rem' }}
                onClick={onEditProfile}
              >
                ⚙️ Publishing Settings in Editor
              </button>
            </div>
          </div>

          {/* Account Details Card */}
          <div className="overview-card">
            <h3 className="overview-card-title">
              <span>👤</span> Account Details
            </h3>

            <div className="overview-detail-list">
              <div className="detail-row">
                <span className="detail-label">Display Name:</span>
                <span className="detail-value">{user.name || 'Not set'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Username:</span>
                <code className="detail-value">@{user.username || 'not set'}</code>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{user.email}</span>
                  <span className={`badge ${user.email_verified ? 'badge-success' : 'badge-warning'}`}>
                    {user.email_verified ? 'Verified' : 'Unverified'}
                  </span>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Member Since:</span>
                <span className="detail-value">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
              {user.last_login_at && (
                <div className="detail-row">
                  <span className="detail-label">Last Login:</span>
                  <span className="detail-value">
                    {new Date(user.last_login_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Connected Login Methods */}
          <div className="overview-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="overview-card-title" style={{ margin: 0 }}>
                <span>🔐</span> Security &amp; Logins
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onEditProfile}
              >
                Change
              </button>
            </div>

            <div className="overview-detail-list">
              <div className="detail-row">
                <span className="detail-label">Password Login:</span>
                <span className="detail-value">
                  {hasEmail ? (
                    <span className="badge badge-success">● Connected</span>
                  ) : (
                    <span className="badge badge-warning">Not Set</span>
                  )}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Google OAuth:</span>
                <span className="detail-value">
                  {hasGoogle ? (
                    <span className="badge badge-success">● Connected</span>
                  ) : (
                    <span className="badge badge-warning">Not Connected</span>
                  )}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Apple OAuth:</span>
                <span className="detail-value">
                  {hasApple ? (
                    <span className="badge badge-success">● Connected</span>
                  ) : (
                    <span className="badge badge-warning">Not Connected</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
