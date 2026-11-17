import React, { useState } from 'react';

interface LoginFormProps {
  apiUrl: string;
  onSuccess: (user: any) => void;
  onSwitchToRegister: () => void;
}

export default function LoginForm({ apiUrl, onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      onSuccess(data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2 className="form-title">Welcome back</h2>
      <p className="form-subtitle">Log in to manage your portfolio</p>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          className="form-input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="login-password">Password</label>
          <span style={{ fontSize: '0.8rem', color: 'var(--text)', cursor: 'default' }} title="Coming in Step 5">
            Forgot password?
          </span>
        </div>
        <div className="password-input-wrapper">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Logging in...' : 'Log in'}
      </button>

      <div className="form-divider">
        <span>or</span>
      </div>

      <div className="social-buttons">
        <button type="button" className="btn btn-social" disabled title="Coming in Step 7">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.24 10.285V13.4h6.887C18.2 16.037 15.64 18 12.24 18c-3.315 0-6-2.685-6-6s2.685-6 6-6c1.47 0 2.812.532 3.86 1.412l2.357-2.357C17.06 3.65 14.79 3 12.24 3 7.27 3 3.24 7.03 3.24 12s4.03 9 9 9c5.21 0 8.67-3.66 8.67-8.835 0-.61-.06-1.2-.17-1.765h-8.5z"/>
          </svg>
          Continue with Google <span className="tag-soon">Soon</span>
        </button>
        <button type="button" className="btn btn-social" disabled title="Coming in Step 8">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.07 1.72-.94 2.74 1 .08 2.02-.49 2.64-1.24z"/>
          </svg>
          Continue with Apple <span className="tag-soon">Soon</span>
        </button>
      </div>

      <p className="switch-auth-text">
        Don&apos;t have an account?{' '}
        <button type="button" className="link-btn" onClick={onSwitchToRegister}>
          Sign up
        </button>
      </p>
    </form>
  );
}
