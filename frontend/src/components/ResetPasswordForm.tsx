import React, { useState } from 'react';

interface ResetPasswordFormProps {
  token: string;
  apiUrl: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ResetPasswordForm({ token, apiUrl, onSuccess, onCancel }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2 className="form-title">Set new password</h2>
      <p className="form-subtitle">Choose a secure password (minimum 8 characters)</p>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="new-password">New password</label>
        <div className="password-input-wrapper">
          <input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
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

      <div className="form-group">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          type={showPassword ? 'text' : 'password'}
          className="form-input"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Updating password...' : 'Update password & log in'}
      </button>

      <p className="switch-auth-text">
        <button type="button" className="link-btn" onClick={onCancel}>
          Cancel
        </button>
      </p>
    </form>
  );
}
