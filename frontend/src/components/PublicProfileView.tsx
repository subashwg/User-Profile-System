import { useCallback, useEffect, useState } from 'react';
import Avatar from './Avatar.js';
import PortfolioCard from './portfolio/PortfolioCard.js';
import PortfolioCardSkeleton from './portfolio/PortfolioCardSkeleton.js';
import Button from './ui/Button.js';
import Chip from './ui/Chip.js';
import EmptyStateCard from './ui/EmptyStateCard.js';
import { type PortfolioKind } from './ui/Badge.js';

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
  item_count?: number;
}

export interface PublicPortfolioItem {
  id: string;
  kind: PortfolioKind;
  title: string;
  description?: string | null;
  url: string;
  cover_url?: string | null;
  cover_source: 'none' | 'link' | 'upload';
  source_site?: string | null;
  published_on?: string | null;
  is_featured: boolean;
  role_id: string;
  role?: {
    id: string;
    title: string;
  };
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
  featured_items?: PublicPortfolioItem[];
}

interface PublicProfileViewProps {
  username: string;
  apiUrl: string;
  onNavigateHome?: () => void;
  onEditProfile?: () => void;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

  // Role filter slug from URL (?role=slug)
  const getInitialRoleSlug = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('role') || 'all';
  };

  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string>(getInitialRoleSlug());
  const [items, setItems] = useState<PublicPortfolioItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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

  // Fetch items for role filter
  const fetchItems = useCallback(
    async (roleSlug: string, offset = 0, isAppend = false) => {
      if (!profile) return;

      if (isAppend) {
        setLoadingMore(true);
      } else {
        setItemsLoading(true);
      }

      try {
        let roleParam = '';
        if (roleSlug !== 'all') {
          const matchedRole = profile.roles.find(
            (r) => slugify(r.title) === roleSlug || r.id === roleSlug,
          );
          if (matchedRole) {
            roleParam = `&role=${encodeURIComponent(matchedRole.id)}`;
          } else {
            setItems([]);
            setItemsTotal(0);
            setHasMore(false);
            return;
          }
        }

        const res = await fetch(
          `${apiUrl}/public/${encodeURIComponent(username)}/items?limit=12&offset=${offset}${roleParam}`,
          { credentials: 'include' },
        );

        if (res.ok) {
          const data = await res.json();
          setItems((prev) => (isAppend ? [...prev, ...data.items] : data.items));
          setItemsTotal(data.total);
          setHasMore(data.has_more);
        }
      } catch (err) {
        console.error('Failed to load portfolio items', err);
      } finally {
        setItemsLoading(false);
        setLoadingMore(false);
      }
    },
    [apiUrl, username, profile],
  );

  // Fetch items when profile is loaded or role filter changes
  useEffect(() => {
    if (profile) {
      fetchItems(selectedRoleSlug, 0, false);
    }
  }, [profile, selectedRoleSlug, fetchItems]);

  // Sync with browser history popstate
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedRoleSlug(params.get('role') || 'all');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleSelectRole = (slug: string) => {
    setSelectedRoleSlug(slug);
    const newUrl = new URL(window.location.href);
    if (slug === 'all') {
      newUrl.searchParams.delete('role');
    } else {
      newUrl.searchParams.set('role', slug);
    }
    window.history.pushState({}, '', newUrl.toString());
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchItems(selectedRoleSlug, items.length, true);
    }
  };

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
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 16px 60px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
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

      {/* 1. Main Profile Header Card */}
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

      {/* 2. Roles & Skills Section (Compact) */}
      <section style={{ marginBottom: '32px' }}>
        <h2
          className="type-heading"
          style={{
            fontSize: '1.2rem',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>💼</span>
          <span>Roles &amp; Expertise</span>
        </h2>

        {profile.roles.length === 0 ? (
          <div
            className="status-card"
            style={{ textAlign: 'center', padding: '24px', color: 'var(--text)' }}
          >
            {profile.is_owner
              ? 'No roles added yet. Go to your dashboard to add your roles and skills.'
              : 'No roles listed.'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                profile.roles.length > 1 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
              gap: '12px',
            }}
          >
            {profile.roles.map((role) => (
              <div
                key={role.id}
                style={{
                  background: 'var(--color-surface)',
                  border: role.is_primary
                    ? '1.5px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '14px 18px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: role.description ? '6px' : '8px',
                  }}
                >
                  <h3 className="type-card-title" style={{ margin: 0, fontSize: '15px' }}>
                    {role.title}
                  </h3>
                  {role.is_primary && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        backgroundColor: 'var(--color-accent-soft)',
                        color: 'var(--color-accent-strong)',
                      }}
                    >
                      Primary
                    </span>
                  )}
                </div>

                {role.description && (
                  <p
                    className="type-body-muted"
                    style={{
                      margin: '0 0 10px 0',
                      fontSize: '13px',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
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
                      gap: '6px',
                    }}
                  >
                    {role.skills.map((skill) => (
                      <span
                        key={skill.id}
                        style={{
                          backgroundColor: 'var(--color-background)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-pill)',
                          padding: '2px 10px',
                          fontSize: '12px',
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
      </section>

      {/* 3. Featured Row */}
      {profile.featured_items && profile.featured_items.length > 0 && (
        <section style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>⭐</span>
            <h2 className="type-heading" style={{ margin: 0, fontSize: '1.35rem' }}>
              Featured Work
            </h2>
            <span className="type-caption" style={{ color: 'var(--color-text-muted)' }}>
              ({profile.featured_items.length})
            </span>
          </div>

          <div className="public-featured-row">
            {profile.featured_items.map((item) => (
              <div key={item.id} className="public-featured-item">
                <PortfolioCard
                  kind={item.kind}
                  title={item.title}
                  description={item.description}
                  url={item.url}
                  cover_url={item.cover_url}
                  source_site={item.source_site}
                  published_on={item.published_on}
                  roleTitle={item.role?.title}
                  is_featured={true}
                  interactive={true}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4 & 5. Work Section with Filter Chips & Grid */}
      {(() => {
        const featuredIds = new Set(profile.featured_items?.map((f) => f.id) || []);
        // Items to display in the grid (excluding those shown in the featured row)
        const gridItems = items.filter((i) => !featuredIds.has(i.id));

        // Roles that have at least one visible item
        const rolesWithItems = profile.roles.filter((r) => (r.item_count || 0) > 0);
        const totalVisibleItems = profile.roles.reduce(
          (acc, r) => acc + (r.item_count || 0),
          0,
        );

        // If no visible items anywhere:
        if (totalVisibleItems === 0) {
          // Visitor: completely hidden
          if (!profile.is_owner) {
            return null;
          }
          // Owner: dashed empty state
          return (
            <section style={{ marginBottom: '40px' }}>
              <EmptyStateCard
                icon="🎨"
                title="Add your first work item"
                description="Showcase your best projects, articles, videos, or products directly on your public portfolio."
                actionLabel="+ Add Work Item"
                onAction={onEditProfile}
              />
            </section>
          );
        }

        return (
          <section style={{ marginBottom: '40px' }}>
            {/* Work Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '1.2rem' }}>🎨</span>
              <h2 className="type-heading" style={{ margin: 0, fontSize: '1.35rem' }}>
                Work &amp; Portfolio
              </h2>
              {itemsTotal > 0 && (
                <span className="type-caption" style={{ color: 'var(--color-text-muted)' }}>
                  ({itemsTotal})
                </span>
              )}
            </div>

            {/* Filter Chips */}
            {rolesWithItems.length > 0 && (
              <div className="public-chips-row" role="region" aria-label="Filter work items by role">
                <Chip
                  label="All"
                  count={totalVisibleItems}
                  selected={selectedRoleSlug === 'all'}
                  onClick={() => handleSelectRole('all')}
                  aria-pressed={selectedRoleSlug === 'all'}
                />
                {rolesWithItems.map((r) => {
                  const slug = slugify(r.title);
                  const isSelected = selectedRoleSlug === slug;
                  return (
                    <Chip
                      key={r.id}
                      label={r.title}
                      count={r.item_count}
                      selected={isSelected}
                      onClick={() => handleSelectRole(slug)}
                      aria-pressed={isSelected}
                    />
                  );
                })}
              </div>
            )}

            {/* Items Loading Skeletons */}
            {itemsLoading ? (
              <div className="public-work-grid">
                <PortfolioCardSkeleton />
                <PortfolioCardSkeleton />
                <PortfolioCardSkeleton />
              </div>
            ) : gridItems.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <p className="type-body" style={{ margin: 0 }}>
                  {profile.featured_items && profile.featured_items.length > 0
                    ? 'All items for this selection are featured in the row above.'
                    : 'No work items found under this role.'}
                </p>
              </div>
            ) : (
              <div className="public-work-grid">
                {gridItems.map((item) => (
                  <PortfolioCard
                    key={item.id}
                    kind={item.kind}
                    title={item.title}
                    description={item.description}
                    url={item.url}
                    cover_url={item.cover_url}
                    source_site={item.source_site}
                    published_on={item.published_on}
                    roleTitle={item.role?.title}
                    is_featured={false}
                    interactive={true}
                  />
                ))}
              </div>
            )}

            {/* Show More Pagination Button */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '32px' }}>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading more...' : 'Show more work'}
                </Button>
              </div>
            )}
          </section>
        );
      })()}

      {/* 6. Quiet Footer */}
      <footer className="public-footer">
        <p style={{ margin: 0 }}>Made with UserProfile</p>
      </footer>
    </div>
  );
}
