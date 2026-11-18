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

interface OnboardingRoleItem {
  title: string;
  description?: string;
  is_primary: boolean;
}

const ROLE_PRESETS = [
  'Content Creator',
  'Teacher',
  'Entrepreneur',
  'Developer',
  'QA Engineer',
  'Designer',
  'Writer',
  'Consultant',
  'Coach',
  'Other',
];

const MAX_ROLES = 5;
const MAX_TITLE = 60;
const MAX_DESC = 200;

export default function OnboardingForm({
  user,
  apiUrl,
  onSuccess,
  onLogout,
}: OnboardingFormProps) {
  // Step 1: Identity, Step 2: "What do you do?" (Roles)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1 state
  const [name, setName] = useState(user.name || '');
  const [username, setUsername] = useState(user.username || '');
  const [availability, setAvailability] = useState<{
    status: 'idle' | 'checking' | 'available' | 'unavailable';
    reason?: string;
  }>({ status: 'idle' });

  // Step 2 state: Selected roles
  const [selectedRoles, setSelectedRoles] = useState<OnboardingRoleItem[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced username availability check for Step 1
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

  // Handle Step 1 submission -> advance to Step 2
  const handleStep1Submit = async (e: React.FormEvent) => {
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
        throw new Error(data.message || 'Failed to complete profile info');
      }

      // Advance to Step 2: "What do you do?"
      setCurrentStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to add preset or custom role in Step 2
  const handleAddRoleTitle = (roleTitle: string, desc?: string) => {
    setError(null);
    const clean = roleTitle.trim();
    if (!clean) return;

    if (selectedRoles.length >= MAX_ROLES) {
      setError(`You can select at most ${MAX_ROLES} roles.`);
      return;
    }

    if (selectedRoles.some((r) => r.title.toLowerCase() === clean.toLowerCase())) {
      setError(`Role "${clean}" is already in your list.`);
      return;
    }

    const isFirst = selectedRoles.length === 0;
    setSelectedRoles([
      ...selectedRoles,
      {
        title: clean,
        description: desc?.trim() || undefined,
        is_primary: isFirst,
      },
    ]);
    setCustomTitle('');
    setCustomDesc('');
  };

  const handleRemoveRole = (index: number) => {
    const wasPrimary = selectedRoles[index].is_primary;
    const updated = selectedRoles.filter((_, i) => i !== index);
    if (wasPrimary && updated.length > 0) {
      updated[0].is_primary = true;
    }
    setSelectedRoles(updated);
  };

  const handleSetPrimaryRole = (index: number) => {
    const updated = selectedRoles.map((r, i) => ({
      ...r,
      is_primary: i === index,
    }));
    setSelectedRoles(updated);
  };

  // Finish Onboarding with selected roles
  const handleFinishRoles = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/onboarding/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roles: selectedRoles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save roles');
      }

      onSuccess(data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Skip roles step (creates empty profile, marks onboarding complete)
  const handleSkipRoles = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/onboarding/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roles: [],
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

  const isStep1Valid =
    name.trim().length >= 1 &&
    availability.status === 'available' &&
    !loading;

  return (
    <div className="auth-card-container">
      <div className="auth-card-body">
        {currentStep === 1 ? (
          /* STEP 1: Name and Username */
          <form className="auth-form" onSubmit={handleStep1Submit}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '2.5rem' }}>🚀</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className="badge badge-success">Step 1 of 2: Identity</span>
            </div>
            <h2 className="form-title" style={{ textAlign: 'center' }}>
              Set Up Your Profile
            </h2>
            <p className="form-subtitle" style={{ textAlign: 'center' }}>
              Choose your display name and claim your public handle
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
                placeholder="e.g. Subash Poudel"
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
                  placeholder="e.g. subash"
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
              disabled={!isStep1Valid}
              style={{ marginTop: '12px' }}
            >
              {loading ? 'Saving...' : 'Continue to Roles →'}
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
        ) : (
          /* STEP 2: "What do you do?" */
          <div className="auth-form">
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '2.5rem' }}>💼</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className="badge badge-success">Step 2 of 2: What do you do?</span>
            </div>
            <h2 className="form-title" style={{ textAlign: 'center' }}>
              What Do You Do?
            </h2>
            <p className="form-subtitle" style={{ textAlign: 'center' }}>
              Pick 1 to 5 roles that describe what you do. Mark your primary discipline with ★.
            </p>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                <span>⚠️</span>
                <div>{error}</div>
              </div>
            )}

            {/* Quick preset selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)', display: 'block', marginBottom: '8px' }}>
                Tap to pick preset roles ({selectedRoles.length} / {MAX_ROLES})
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ROLE_PRESETS.map((preset) => {
                  const isSelected = selectedRoles.some(
                    (r) => r.title.toLowerCase() === preset.toLowerCase(),
                  );
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.8rem', padding: '5px 12px', borderRadius: '16px' }}
                      disabled={isSelected || selectedRoles.length >= MAX_ROLES}
                      onClick={() => handleAddRoleTitle(preset)}
                    >
                      {isSelected ? `✓ ${preset}` : `+ ${preset}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom role input */}
            {selectedRoles.length < MAX_ROLES && (
              <div style={{ marginBottom: '16px', background: 'var(--code-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)', display: 'block', marginBottom: '6px' }}>
                  Or type a custom role title
                </span>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. AI Researcher, Lead Architect"
                    maxLength={MAX_TITLE}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                    disabled={!customTitle.trim()}
                    onClick={() => handleAddRoleTitle(customTitle, customDesc)}
                  >
                    + Add
                  </button>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional short description (max 200 chars)"
                  maxLength={MAX_DESC}
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                />
              </div>
            )}

            {/* Selected Roles List */}
            {selectedRoles.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)', display: 'block', marginBottom: '8px' }}>
                  Your Selected Roles ({selectedRoles.length})
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedRoles.map((role, idx) => (
                    <div
                      key={role.title}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'var(--bg)',
                        border: role.is_primary ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--text-h)' }}>
                            {role.title}
                          </strong>
                          {role.is_primary ? (
                            <span className="badge badge-success">★ Primary</span>
                          ) : (
                            <button
                              type="button"
                              className="link-btn"
                              style={{ fontSize: '0.78rem' }}
                              onClick={() => handleSetPrimaryRole(idx)}
                            >
                              Make Primary
                            </button>
                          )}
                        </div>
                        {role.description && (
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text)' }}>
                            {role.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        className="link-btn"
                        style={{ color: '#ef4444', fontSize: '1.1rem', padding: '4px' }}
                        onClick={() => handleRemoveRole(idx)}
                        title="Remove role"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions: Finish or Skip */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={handleFinishRoles}
              >
                {loading
                  ? 'Completing Setup...'
                  : selectedRoles.length > 0
                    ? `Save Roles (${selectedRoles.length}) & Enter Dashboard`
                    : 'Complete Setup & Enter Dashboard'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading}
                onClick={handleSkipRoles}
              >
                Skip for now (I will add roles later)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
