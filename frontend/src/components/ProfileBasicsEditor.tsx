import { useEffect, useState } from 'react';

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

export default function ProfileBasicsEditor({
  user,
  apiUrl,
  onProfileUpdated,
}: ProfileBasicsEditorProps) {
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      setStatus(data.status || 'draft');
      setNotice({ type: 'success', message: 'Profile details saved successfully!' });
      onProfileUpdated?.(data);
    } catch (err) {
      setNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

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
            Profile Basics
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)' }}>
            Tell visitors who you are with your headline, bio, and location.
          </p>
        </div>
        <span className={`badge ${status === 'published' ? 'badge-success' : 'badge-warning'}`}>
          {status === 'published' ? '● Published' : '○ Draft'}
        </span>
      </div>

      {/* Identity Summary header */}
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
