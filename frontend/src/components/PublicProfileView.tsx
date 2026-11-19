import { useEffect, useState } from 'react';
import Avatar from './Avatar.js';

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

interface PublicProfile {
  name: string | null;
  username: string;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  status: 'draft' | 'published';
  published_at?: string | null;
  is_owner: boolean;
  roles: Role[];
}

interface PublicProfileViewProps {
  username: string;
  apiUrl: string;
  onNavigateHome?: () => void;
  onEditProfile?: () => void;
}

export default function PublicProfileView({
  username,
  apiUrl,
  onNavigateHome,
  onEditProfile,
}: PublicProfileViewProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    setNotFound(false);
    setErrorMessage(null);
    try {
      const res = await fetch(`${apiUrl}/public/${encodeURIComponent(username)}`, {
        credentials: 'include',
      });

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load profile (${res.status})`);
      }

      const data: PublicProfile = await res.json();
      setProfile(data);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username, apiUrl]);

  // Page title and SEO / sharing meta tags
  useEffect(() => {
    if (!profile) return;

    const originalTitle = document.title;
    const displayName = profile.name || `@${profile.username}`;
    const pageTitle = profile.headline
      ? `${displayName} | ${profile.headline}`
      : `${displayName} | Profile`;
    document.title = pageTitle;

    // Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    const descriptionContent = profile.bio
      ? profile.bio.slice(0, 160)
      : profile.headline || `${displayName}'s portfolio profile`;
    metaDesc.setAttribute('content', descriptionContent);

    // Robots noindex for draft profiles
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (profile.status === 'draft') {
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.setAttribute('name', 'robots');
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.setAttribute('content', 'noindex, nofollow');
    } else if (robotsMeta) {
      robotsMeta.setAttribute('content', 'index, follow');
    }

    return () => {
      document.title = originalTitle;
      if (robotsMeta && profile.status === 'draft') {
        robotsMeta.setAttribute('content', 'index, follow');
      }
    };
  }, [profile]);

  // Publish profile from owner preview banner
  const handlePublish = async () => {
    setActionLoading(true);
    setBannerNotice(null);
    try {
      const res = await fetch(`${apiUrl}/profile/me/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to publish profile');
      }
      setBannerNotice({
        type: 'success',
        message: 'Profile is now published and publicly visible!',
      });
      await fetchProfile();
    } catch (e) {
      setBannerNotice({ type: 'error', message: (e as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  // Unpublish profile from owner preview banner
  const handleUnpublish = async () => {
    setActionLoading(true);
    setBannerNotice(null);
    try {
      const res = await fetch(`${apiUrl}/profile/me/unpublish`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to unpublish profile');
      }
      setBannerNotice({
        type: 'success',
        message: 'Profile has been unpublished and reverted to draft.',
      });
      await fetchProfile();
    } catch (e) {
      setBannerNotice({ type: 'error', message: (e as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/@${username}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="status-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: 'var(--text)', fontSize: '1.05rem' }}>Loading portfolio profile...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="auth-card-container"
        style={{ maxWidth: '580px', margin: '40px auto', textAlign: 'center' }}
      >
        <div className="auth-card-body" style={{ padding: '40px 30px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
          <h2 style={{ fontSize: '1.6rem', color: 'var(--text-h)', marginBottom: '8px' }}>
            Profile Not Found
          </h2>
          <p style={{ color: 'var(--text)', marginBottom: '24px', lineHeight: 1.5 }}>
            The profile for <strong>@{username}</strong> does not exist, or it is currently a
            private draft visible only to its owner.
          </p>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="btn btn-primary"
              style={{ minWidth: '160px' }}
            >
              ← Back to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  if (errorMessage || !profile) {
    return (
      <div className="status-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: '#ef4444', marginBottom: '16px' }}>
          Error: {errorMessage || 'Unable to display profile.'}
        </p>
        {onNavigateHome && (
          <button onClick={onNavigateHome} className="btn btn-secondary">
            ← Back to Home
          </button>
        )}
      </div>
    );
  }

  const primaryRole = profile.roles.find((r) => r.is_primary);

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '0 16px 60px' }}>
      {/* Top Navigation Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        {onNavigateHome ? (
          <button
            onClick={onNavigateHome}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 14px' }}
          >
            ← Back
          </button>
        ) : (
          <a
            href="/"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            ← Portfolio Profile Home
          </a>
        )}

        {profile.is_owner && onEditProfile && (
          <button
            onClick={onEditProfile}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 14px' }}
          >
            ✏️ Edit Profile
          </button>
        )}
      </div>

      {/* Owner Preview Banner */}
      {profile.is_owner && (
        <div
          style={{
            marginBottom: '24px',
            padding: '16px 20px',
            borderRadius: '10px',
            background:
              profile.status === 'draft' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            border: `1.5px solid ${profile.status === 'draft' ? '#eab308' : '#10b981'}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>
                  {profile.status === 'draft' ? '🔒' : '🌐'}
                </span>
                <strong
                  style={{
                    color: profile.status === 'draft' ? '#ca8a04' : '#059669',
                    fontSize: '1rem',
                  }}
                >
                  {profile.status === 'draft'
                    ? 'Private Draft Preview'
                    : 'Your Profile is Live & Public'}
                </strong>
                <span
                  className={`badge ${profile.status === 'draft' ? 'badge-warning' : 'badge-success'}`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {profile.status.toUpperCase()}
                </span>
              </div>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '0.86rem',
                  color: 'var(--text)',
                }}
              >
                {profile.status === 'draft'
                  ? 'Only you can see this preview. Strangers will receive a 404 until you publish.'
                  : `Publicly accessible at /@${profile.username}`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {profile.status === 'draft' ? (
                <button
                  onClick={handlePublish}
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                >
                  {actionLoading ? 'Publishing...' : '🚀 Publish Now'}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCopyLink}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '8px 14px' }}
                  >
                    {copiedLink ? '✓ Copied Link!' : '🔗 Copy Link'}
                  </button>
                  <button
                    onClick={handleUnpublish}
                    disabled={actionLoading}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '8px 14px', color: '#ef4444' }}
                  >
                    {actionLoading ? 'Unpublishing...' : 'Unpublish'}
                  </button>
                </>
              )}
            </div>
          </div>

          {bannerNotice && (
            <div
              style={{
                marginTop: '12px',
                fontSize: '0.85rem',
                color: bannerNotice.type === 'success' ? '#059669' : '#dc2626',
                fontWeight: 600,
              }}
            >
              {bannerNotice.message}
            </div>
          )}
        </div>
      )}

      {/* Main Profile Header Card */}
      <div
        className="profile-details-card"
        style={{
          padding: '32px',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          {/* Avatar */}
          <Avatar
            customAvatarUrl={profile.avatar_url}
            name={profile.name}
            username={profile.username}
            size={110}
            style={{
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              border: '3px solid var(--accent)',
            }}
          />

          {/* Name & Primary Role */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.9rem',
                  fontWeight: 700,
                  color: 'var(--text-h)',
                }}
              >
                {profile.name || `@${profile.username}`}
              </h1>
              {primaryRole && (
                <span
                  style={{
                    backgroundColor: 'rgba(170, 59, 255, 0.15)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    borderRadius: '20px',
                    padding: '3px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                >
                  ★ {primaryRole.title}
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text)', fontSize: '0.9rem', marginTop: '4px' }}>
              <code>@{profile.username}</code>
            </div>
          </div>

          {/* Headline */}
          {profile.headline && (
            <p
              style={{
                fontSize: '1.15rem',
                color: 'var(--text-h)',
                fontWeight: 500,
                margin: '4px 0 0',
                maxWidth: '650px',
                lineHeight: 1.45,
              }}
            >
              {profile.headline}
            </p>
          )}

          {/* Location */}
          {profile.location && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text)',
                fontSize: '0.9rem',
              }}
            >
              <span>📍</span>
              <span>{profile.location}</span>
            </div>
          )}

          {/* Short Bio */}
          {profile.bio ? (
            <div
              style={{
                maxWidth: '680px',
                margin: '12px auto 0',
                fontSize: '0.96rem',
                lineHeight: 1.6,
                color: 'var(--text)',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                padding: '16px 20px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {profile.bio}
            </div>
          ) : profile.is_owner ? (
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text)',
                fontStyle: 'italic',
                marginTop: '8px',
              }}
            >
              No bio added yet. Add a short bio in your profile editor.
            </div>
          ) : null}
        </div>
      </div>

      {/* Roles & Skills Section */}
      <div style={{ marginBottom: '28px' }}>
        <h2
          style={{
            fontSize: '1.3rem',
            color: 'var(--text-h)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>💼</span>
          <span>Roles &amp; Skills</span>
        </h2>

        {profile.roles.length === 0 ? (
          <div
            className="status-card"
            style={{ textAlign: 'center', padding: '30px', color: 'var(--text)' }}
          >
            {profile.is_owner
              ? 'No roles added yet. Go to your dashboard to add your roles and skills.'
              : 'No roles listed.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {profile.roles.map((role) => (
              <div
                key={role.id}
                style={{
                  background: 'var(--card-bg, #1e1e24)',
                  border: role.is_primary
                    ? '1.5px solid var(--accent)'
                    : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.15rem',
                        fontWeight: 600,
                        color: 'var(--text-h)',
                      }}
                    >
                      {role.title}
                    </h3>
                    {role.is_primary && (
                      <span
                        className="badge badge-accent"
                        style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}
                      >
                        Primary Role
                      </span>
                    )}
                  </div>
                </div>

                {role.description && (
                  <p
                    style={{
                      margin: '4px 0 12px 0',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      color: 'var(--text)',
                    }}
                  >
                    {role.description}
                  </p>
                )}

                {/* Skills tag pills */}
                {role.skills && role.skills.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginTop: role.description ? '12px' : '4px',
                    }}
                  >
                    {role.skills.map((skill) => (
                      <span
                        key={skill.id}
                        style={{
                          backgroundColor: 'rgba(170, 59, 255, 0.1)',
                          color: 'var(--accent)',
                          border: '1px solid rgba(170, 59, 255, 0.35)',
                          borderRadius: '16px',
                          padding: '4px 12px',
                          fontSize: '0.82rem',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Portfolio Projects Section (Placeholder per Dev Brief) */}
      <div
        style={{
          background: 'var(--card-bg, #1e1e24)',
          border: '1px dashed var(--border)',
          borderRadius: '12px',
          padding: '28px 24px',
          textAlign: 'center',
          marginTop: '20px',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎨</div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--text-h)' }}>
          Portfolio Projects
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.88rem',
            color: 'var(--text)',
            maxWidth: '460px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Portfolio coming soon. Featured case studies, work samples, and projects will appear here.
        </p>
      </div>
    </div>
  );
}
