import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.js';

interface User {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

interface ProfileData {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  effective_avatar_url?: string | null;
  status: 'draft' | 'published';
  published_at?: string | null;
}

interface ProfileBasicsEditorProps {
  user: User;
  apiUrl: string;
  onProfileUpdated?: (profile: ProfileData) => void;
}

const MAX_HEADLINE = 120;
const MAX_BIO = 500;
const MAX_LOCATION = 80;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export default function ProfileBasicsEditor({
  user,
  apiUrl,
  onProfileUpdated,
}: ProfileBasicsEditorProps) {
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Avatar upload states
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Publishing states
  const [publishing, setPublishing] = useState(false);
  const [publishNotice, setPublishNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handlePublish = async () => {
    setPublishing(true);
    setPublishNotice(null);
    try {
      const res = await fetch(`${apiUrl}/profile/me/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to publish profile');
      }
      setStatus('published');
      setPublishNotice({
        type: 'success',
        message: 'Profile is now published and publicly visible!',
      });
    } catch (e) {
      setPublishNotice({ type: 'error', message: (e as Error).message });
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    setPublishNotice(null);
    try {
      const res = await fetch(`${apiUrl}/profile/me/unpublish`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to unpublish profile');
      }
      setStatus('draft');
      setPublishNotice({
        type: 'success',
        message: 'Profile has been unpublished and reverted to draft.',
      });
    } catch (e) {
      setPublishNotice({ type: 'error', message: (e as Error).message });
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${apiUrl}/profile/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data: ProfileData = await res.json();
          if (isMounted) {
            setHeadline(data.headline || '');
            setBio(data.bio || '');
            setLocation(data.location || '');
            setAvatarUrl(data.avatar_url || null);
            setStatus(data.status || 'draft');
          }
        }
      } catch (err) {
        console.error('Failed to load profile basics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarNotice(null);

    // Client-side validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setAvatarNotice({
        type: 'error',
        message: 'File size exceeds the 2MB limit. Please choose a smaller photo.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatarNotice({
        type: 'error',
        message: 'Only JPEG, PNG, and WebP images are supported.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setAvatarUploading(true);
    try {
      const res = await fetch(`${apiUrl}/profile/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to upload avatar');
      }

      setAvatarUrl(data.avatar_url);
      setAvatarNotice({
        type: 'success',
        message: 'Avatar photo uploaded and cropped to 512×512 square!',
      });
      onProfileUpdated?.(data);
    } catch (err) {
      setAvatarNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarNotice(null);
    setAvatarRemoving(true);

    try {
      const res = await fetch(`${apiUrl}/profile/avatar`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to remove avatar');
      }

      setAvatarUrl(null);
      setAvatarNotice({
        type: 'success',
        message: user.avatar_url
          ? 'Custom photo removed. Reverted to your Google profile photo.'
          : 'Custom photo removed. Reverted to initials fallback.',
      });
      onProfileUpdated?.(data);
    } catch (err) {
      setAvatarNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setAvatarRemoving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setSaving(true);

    try {
      const res = await fetch(`${apiUrl}/profile/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          headline,
          bio,
          location,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      setHeadline(data.headline || '');
      setBio(data.bio || '');
      setLocation(data.location || '');
      setAvatarUrl(data.avatar_url || null);
      setStatus(data.status || 'draft');
      setNotice({ type: 'success', message: 'Profile details saved successfully!' });
      onProfileUpdated?.(data);
    } catch (err) {
      setNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  // Resolve absolute avatar URL if custom avatar path is relative
  const customAbsoluteUrl = avatarUrl ? `${apiUrl}${avatarUrl}` : null;

  if (loading) {
    return (
      <div className="profile-details-card" style={{ marginTop: '20px', textAlign: 'center', padding: '24px' }}>
        <p style={{ color: 'var(--text)', margin: 0 }}>Loading profile information...</p>
      </div>
    );
  }

  return (
    <div className="profile-details-card" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: 'var(--text-h)' }}>
            Profile & Avatar
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)' }}>
            Customize your public presence, profile photo, headline, and bio.
          </p>
        </div>
        <span className={`badge ${status === 'published' ? 'badge-success' : 'badge-warning'}`}>
          {status === 'published' ? '● Published' : '○ Draft'}
        </span>
      </div>

      {/* Identity Summary banner */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.03)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.88rem',
        }}
      >
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{user.name || 'Unnamed'}</span>{' '}
          {user.username && (
            <code style={{ color: 'var(--accent)', marginLeft: '6px' }}>@{user.username}</code>
          )}
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>
          Name & username managed in Account Settings
        </span>
      </div>

      {/* Publishing Status & Action Card */}
      <div
        style={{
          border: status === 'published' ? '1px solid #10b981' : '1px solid var(--border)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '24px',
          background: status === 'published' ? 'rgba(16, 185, 129, 0.05)' : 'var(--code-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>{status === 'published' ? '🌐' : '🔒'}</span>
            <strong style={{ color: 'var(--text-h)', fontSize: '0.95rem' }}>
              {status === 'published' ? 'Profile is Public' : 'Profile is Draft'}
            </strong>
            <span className={`badge ${status === 'published' ? 'badge-success' : 'badge-warning'}`}>
              {status.toUpperCase()}
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text)' }}>
            {status === 'published'
              ? `Live at /@${user.username || 'username'}. Visitors can view your roles, skills, and portfolio.`
              : 'Drafts are hidden from search engines and visitors. Requires a headline and at least 1 role to publish.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {user.username && (
            <a
              href={`/@${user.username}`}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '6px 14px', textDecoration: 'none' }}
            >
              👁 View Profile
            </a>
          )}
          {status === 'draft' ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              disabled={publishing}
              onClick={handlePublish}
            >
              {publishing ? 'Publishing...' : '🚀 Publish Profile'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '6px 14px', color: '#ef4444' }}
              disabled={publishing}
              onClick={handleUnpublish}
            >
              {publishing ? 'Updating...' : 'Unpublish'}
            </button>
          )}
        </div>
      </div>

      {publishNotice && (
        <div
          className={`alert ${publishNotice.type === 'success' ? 'alert-info' : 'alert-error'}`}
          style={{ marginBottom: '16px' }}
        >
          <span>{publishNotice.type === 'success' ? '✅' : '⚠️'}</span>
          <div>{publishNotice.message}</div>
        </div>
      )}

      {/* Avatar Management Card */}
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '24px',
          background: 'var(--code-bg)',
        }}
      >
        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <Avatar
            customAvatarUrl={customAbsoluteUrl}
            providerAvatarUrl={user.avatar_url}
            name={user.name}
            username={user.username}
            email={user.email}
            size={76}
          />

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-h)' }}>
                Profile Photo
              </span>
              {avatarUrl ? (
                <span className="badge badge-success">Custom Upload</span>
              ) : user.avatar_url ? (
                <span className="badge badge-success">Google Photo</span>
              ) : (
                <span className="badge badge-warning">Initials Circle</span>
              )}
            </div>

            <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--text)' }}>
              Square crop, 512×512 WebP. JPEG, PNG or WebP up to 2MB.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarFileSelect}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                disabled={avatarUploading || avatarRemoving}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUploading ? 'Uploading & Cropping...' : 'Upload Photo'}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.82rem',
                    padding: '6px 14px',
                    borderColor: '#fca5a5',
                    color: '#dc2626',
                  }}
                  disabled={avatarUploading || avatarRemoving}
                  onClick={handleRemoveAvatar}
                >
                  {avatarRemoving ? 'Removing...' : 'Remove Photo'}
                </button>
              )}
            </div>
          </div>
        </div>

        {avatarNotice && (
          <div
            className={`alert ${avatarNotice.type === 'success' ? 'alert-info' : 'alert-error'}`}
            style={{ marginTop: '12px', marginBottom: 0 }}
          >
            <span>{avatarNotice.type === 'success' ? '✅' : '⚠️'}</span>
            <div>{avatarNotice.message}</div>
          </div>
        )}
      </div>

      {notice && (
        <div
          className={`alert ${notice.type === 'success' ? 'alert-info' : 'alert-error'}`}
          style={{ marginBottom: '16px' }}
        >
          <span>{notice.type === 'success' ? '✅' : '⚠️'}</span>
          <div>{notice.message}</div>
        </div>
      )}

      <form onSubmit={handleSave} className="auth-form">
        {/* Headline */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label htmlFor="profile-headline" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Headline
            </label>
            <span
              style={{
                fontSize: '0.8rem',
                color: headline.length >= MAX_HEADLINE ? '#ef4444' : 'var(--text)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {headline.length} / {MAX_HEADLINE}
            </span>
          </div>
          <input
            id="profile-headline"
            type="text"
            className="form-input"
            placeholder="e.g. Senior QA Engineer & Tech Content Creator"
            value={headline}
            maxLength={MAX_HEADLINE}
            onChange={(e) => setHeadline(e.target.value)}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text)', marginTop: '4px' }}>
            One line under your name summarizing what you do.
          </span>
        </div>

        {/* Short Bio */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label htmlFor="profile-bio" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Short Bio
            </label>
            <span
              style={{
                fontSize: '0.8rem',
                color: bio.length >= MAX_BIO ? '#ef4444' : 'var(--text)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {bio.length} / {MAX_BIO}
            </span>
          </div>
          <textarea
            id="profile-bio"
            rows={4}
            className="form-input"
            placeholder="Tell your story, your background, and what you're working on..."
            value={bio}
            maxLength={MAX_BIO}
            onChange={(e) => setBio(e.target.value)}
            style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text)', marginTop: '4px' }}>
            Plain text only. HTML or script tags are stripped automatically.
          </span>
        </div>

        {/* Location */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label htmlFor="profile-location" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Location
            </label>
            <span
              style={{
                fontSize: '0.8rem',
                color: location.length >= MAX_LOCATION ? '#ef4444' : 'var(--text)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {location.length} / {MAX_LOCATION}
            </span>
          </div>
          <input
            id="profile-location"
            type="text"
            className="form-input"
            placeholder="e.g. Kathmandu, Nepal or Remote / UTC+5:45"
            value={location}
            maxLength={MAX_LOCATION}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {/* Explicit Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ minWidth: '130px' }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
