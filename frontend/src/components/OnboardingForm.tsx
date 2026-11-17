import { useEffect, useState } from 'react';

interface OnboardingFormProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
  };
  apiUrl: string;
  onSuccess: (user: any) => void;
  onLogout: () => void;
}

export default function OnboardingForm({
  user,
  apiUrl,
  onSuccess,
  onLogout,
}: OnboardingFormProps) {
  const [name, setName] = useState(user.name || '');
  const [username, setUsername] = useState(user.username || '');
  const [availability, setAvailability] = useState<{
    status: 'idle' | 'checking' | 'available' | 'unavailable';
    reason?: string;
  }>({ status: 'idle' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced username availability check
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();

    if (!trimmed) {
      setAvailability({ status: 'idle' });
      return;
    }

    if (trimmed.length < 3) {
      setAvailability({
        status: 'unavailable',
        reason: 'Must be at least 3 characters',
      });
      return;
    }

    if (trimmed.length > 30) {
      setAvailability({
        status: 'unavailable',
        reason: 'Must be at most 30 characters',
      });
      return;
    }

    const validRegex = /^[a-z0-9_]+$/;
    if (!validRegex.test(trimmed)) {
      setAvailability({
        status: 'unavailable',
        reason: 'Only lowercase letters, numbers, and underscores allowed',
      });
      return;
    }

    setAvailability({ status: 'checking' });

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${apiUrl}/users/username-available?username=${encodeURIComponent(trimmed)}`,
          { credentials: 'include' },
        );
        const data = await res.json();
        if (data.available) {
          setAvailability({ status: 'available' });
        } else {
          setAvailability({
            status: 'unavailable',
            reason: data.reason || 'Username is not available',
          });
        }
      } catch {
        setAvailability({
          status: 'unavailable',
          reason: 'Error checking availability',
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, apiUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (availability.status !== 'available') return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to complete onboarding');
      }

      onSuccess(data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    name.trim().length >= 1 &&
    availability.status === 'available' &&
    !loading;

  return (
    <div className="auth-card-container">
      <div className="auth-card-body">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '2.5rem' }}>🚀</span>
          </div>
          <h2 className="form-title" style={{ textAlign: 'center' }}>
            Set Up Your Profile
          </h2>
          <p className="form-subtitle" style={{ textAlign: 'center' }}>
            Choose how you will be recognized and claim your public portfolio link
          </p>

          {error && (
            <div className="alert alert-error">
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="onboard-name">Your Full Name</label>
            <input
              id="onboard-name"
              type="text"
              className="form-input"
              placeholder="e.g. Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="onboard-username">Choose a Username</label>
            <div style={{ position: 'relative' }}>
              <input
                id="onboard-username"
                type="text"
                className="form-input"
                placeholder="e.g. alexrivera"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                required
                minLength={3}
                maxLength={30}
                style={{
                  borderColor:
                    availability.status === 'available'
                      ? 'var(--success)'
                      : availability.status === 'unavailable'
                        ? 'var(--error)'
                        : undefined,
                }}
              />
            </div>

            {/* Live handle preview & status */}
            <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
              {availability.status === 'checking' && (
                <span style={{ color: 'var(--text)' }}>⏳ Checking handle availability...</span>
              )}

              {availability.status === 'available' && (
                <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>✓</span>
                  <strong>@{username.trim().toLowerCase()} is available!</strong>
                  <span style={{ color: 'var(--text)', marginLeft: '4px' }}>
                    (Link: <code>/@{username.trim().toLowerCase()}</code>)
                  </span>
                </div>
              )}

              {availability.status === 'unavailable' && (
                <div style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>✗</span>
                  <span>{availability.reason}</span>
                </div>
              )}

              {availability.status === 'idle' && (
                <span style={{ color: 'var(--text)' }}>
                  3–30 chars, lowercase letters, numbers &amp; underscores only
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isFormValid}
            style={{ marginTop: '12px' }}
          >
            {loading ? 'Creating Profile...' : 'Complete Setup & Enter Dashboard'}
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
              Signed in as <strong>{user.email}</strong>
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={onLogout}
              style={{ display: 'block', margin: '8px auto 0', fontSize: '0.85rem' }}
            >
              Log out and exit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
