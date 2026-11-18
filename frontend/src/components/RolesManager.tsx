import { useEffect, useState } from 'react';

export interface Skill {
  id: string;
  role_id: string;
  name: string;
  position: number;
}

export interface Role {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  position: number;
  is_primary: boolean;
  skills: Skill[];
}

interface RolesManagerProps {
  apiUrl: string;
  onRolesUpdated?: (roles: Role[]) => void;
}

const FALLBACK_PRESETS = [
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
const MAX_DESCRIPTION = 200;

export default function RolesManager({ apiUrl, onRolesUpdated }: RolesManagerProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [presets, setPresets] = useState<string[]>(FALLBACK_PRESETS);
  const [loading, setLoading] = useState(true);

  // Add role form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit role modal/form state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation state
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reordering in progress
  const [reordering, setReordering] = useState(false);

  const fetchRolesAndPresets = async () => {
    try {
      const [rolesRes, presetsRes] = await Promise.all([
        fetch(`${apiUrl}/roles`, { credentials: 'include' }),
        fetch(`${apiUrl}/roles/presets`),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
        onRolesUpdated?.(rolesData);
      }

      if (presetsRes.ok) {
        const presetsData = await presetsRes.json();
        if (Array.isArray(presetsData.presets)) {
          setPresets(presetsData.presets);
        }
      }
    } catch (err) {
      console.error('Failed to load roles or presets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesAndPresets();
  }, [apiUrl]);

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    if (preset && preset !== 'Other') {
      setTitle(preset);
    } else if (preset === 'Other') {
      setTitle('');
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionNotice(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setActionNotice({ type: 'error', message: 'Role title is required.' });
      return;
    }

    if (roles.length >= MAX_ROLES) {
      setActionNotice({ type: 'error', message: 'You have reached the maximum of 5 roles.' });
      return;
    }

    setAddingRole(true);
    try {
      const res = await fetch(`${apiUrl}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: cleanTitle,
          description: description.trim() || undefined,
          is_primary: roles.length === 0 ? true : isPrimary,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add role');
      }

      // Reset form
      setTitle('');
      setDescription('');
      setSelectedPreset('');
      setIsPrimary(false);
      setShowAddForm(false);
      setActionNotice({ type: 'success', message: `Role "${cleanTitle}" added successfully!` });
      await fetchRolesAndPresets();
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setAddingRole(false);
    }
  };

  const handleSetPrimary = async (roleId: string) => {
    setActionNotice(null);
    try {
      const res = await fetch(`${apiUrl}/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_primary: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to set primary role');
      }

      await fetchRolesAndPresets();
      setActionNotice({ type: 'success', message: 'Primary role updated.' });
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message });
    }
  };

  const handleStartEdit = (role: Role) => {
    setEditingRoleId(role.id);
    setEditTitle(role.title);
    setEditDescription(role.description || '');
  };

  const handleSaveEdit = async (roleId: string) => {
    setActionNotice(null);
    setSavingEdit(true);

    try {
      const res = await fetch(`${apiUrl}/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update role');
      }

      setEditingRoleId(null);
      await fetchRolesAndPresets();
      setActionNotice({ type: 'success', message: 'Role updated successfully.' });
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setActionNotice(null);
    setDeleting(true);

    try {
      const res = await fetch(`${apiUrl}/roles/${roleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete role');
      }

      setDeletingRoleId(null);
      await fetchRolesAndPresets();
      setActionNotice({ type: 'success', message: 'Role deleted.' });
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (reordering) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= roles.length) return;

    const newRoles = [...roles];
    const temp = newRoles[index];
    newRoles[index] = newRoles[targetIndex];
    newRoles[targetIndex] = temp;

    setRoles(newRoles);
    setReordering(true);
    setActionNotice(null);

    try {
      const res = await fetch(`${apiUrl}/roles/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role_ids: newRoles.map((r) => r.id),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to reorder roles');
      }

      const updatedData = await res.json();
      setRoles(updatedData);
      onRolesUpdated?.(updatedData);
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message });
      await fetchRolesAndPresets();
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-details-card" style={{ marginTop: '20px', textAlign: 'center', padding: '24px' }}>
        <p style={{ color: 'var(--text)', margin: 0 }}>Loading roles...</p>
      </div>
    );
  }

  return (
    <div className="profile-details-card" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: 'var(--text-h)' }}>
            Roles ({roles.length} / {MAX_ROLES})
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)' }}>
            Highlight your different disciplines. One role is marked primary and shows next to your name.
          </p>
        </div>

        {roles.length < MAX_ROLES && !showAddForm && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            onClick={() => {
              setShowAddForm(true);
              setActionNotice(null);
            }}
          >
            + Add Role
          </button>
        )}
      </div>

      {actionNotice && (
        <div
          className={`alert ${actionNotice.type === 'success' ? 'alert-info' : 'alert-error'}`}
          style={{ marginBottom: '16px' }}
        >
          <span>{actionNotice.type === 'success' ? '✅' : '⚠️'}</span>
          <div>{actionNotice.message}</div>
        </div>
      )}

      {/* Add Role Form Card */}
      {showAddForm && (
        <div
          style={{
            border: '1px solid var(--accent)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            background: 'var(--code-bg)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-h)', fontSize: '0.95rem' }}>Add New Role</strong>
            <button
              type="button"
              className="link-btn"
              style={{ fontSize: '0.8rem', color: 'var(--text)' }}
              onClick={() => setShowAddForm(false)}
            >
              ✕ Cancel
            </button>
          </div>

          <form onSubmit={handleAddRole}>
            {/* Preset Selector */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                Quick Preset (Optional)
              </label>
              <select
                className="form-input"
                value={selectedPreset}
                onChange={(e) => handlePresetSelect(e.target.value)}
                style={{ fontSize: '0.88rem' }}
              >
                <option value="">Select a preset role or type below...</option>
                {presets.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom / Selected Title */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label htmlFor="role-title-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Role Title *
                </label>
                <span style={{ fontSize: '0.78rem', color: title.length >= MAX_TITLE ? '#ef4444' : 'var(--text)' }}>
                  {title.length} / {MAX_TITLE}
                </span>
              </div>
              <input
                id="role-title-input"
                type="text"
                className="form-input"
                placeholder="e.g. Content Creator, QA Engineer, Mentor"
                value={title}
                maxLength={MAX_TITLE}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label htmlFor="role-desc-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Description (Optional)
                </label>
                <span style={{ fontSize: '0.78rem', color: description.length >= MAX_DESCRIPTION ? '#ef4444' : 'var(--text)' }}>
                  {description.length} / {MAX_DESCRIPTION}
                </span>
              </div>
              <input
                id="role-desc-input"
                type="text"
                className="form-input"
                placeholder="e.g. Producing weekly deep-dive tech tutorials and guides"
                value={description}
                maxLength={MAX_DESCRIPTION}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Primary Checkbox */}
            {roles.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input
                  id="primary-checkbox"
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
                <label htmlFor="primary-checkbox" style={{ fontSize: '0.85rem', color: 'var(--text-h)', cursor: 'pointer' }}>
                  Mark as primary role (shows first and next to your name)
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                disabled={addingRole || !title.trim()}
              >
                {addingRole ? 'Adding...' : 'Save Role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roles List */}
      {roles.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '28px 16px',
            background: 'var(--code-bg)',
            border: '1px dashed var(--border)',
            borderRadius: '10px',
          }}
        >
          <p style={{ margin: '0 0 10px 0', color: 'var(--text)' }}>
            You haven't added any roles yet. Add your first role to start defining what you do!
          </p>
          {!showAddForm && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '6px 16px' }}
              onClick={() => setShowAddForm(true)}
            >
              + Add First Role
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {roles.map((role, index) => (
            <div
              key={role.id}
              style={{
                border: role.is_primary ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: '10px',
                padding: '14px 16px',
                background: 'var(--bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {editingRoleId === role.id ? (
                /* Inline Edit Mode */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.9rem' }}>Edit Role</strong>
                    <button
                      type="button"
                      className="link-btn"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => setEditingRoleId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={editTitle}
                      maxLength={MAX_TITLE}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Role title"
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={editDescription}
                      maxLength={MAX_DESCRIPTION}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      onClick={() => setEditingRoleId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      disabled={savingEdit || !editTitle.trim()}
                      onClick={() => handleSaveEdit(role.id)}
                    >
                      {savingEdit ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : deletingRoleId === role.id ? (
                /* Delete Confirmation */
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>
                    ⚠️ Delete role "{role.title}"?
                  </p>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#b91c1c' }}>
                    All {role.skills.length} skills under this role will also be permanently deleted.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      disabled={deleting}
                      onClick={() => setDeletingRoleId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.78rem',
                        padding: '4px 10px',
                        background: '#dc2626',
                        borderColor: '#dc2626',
                        color: '#ffffff',
                      }}
                      disabled={deleting}
                      onClick={() => handleDeleteRole(role.id)}
                    >
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal Display */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-h)' }}>
                        {role.title}
                      </span>
                      {role.is_primary ? (
                        <span className="badge badge-success">★ Primary Role</span>
                      ) : (
                        <button
                          type="button"
                          className="link-btn"
                          style={{ fontSize: '0.78rem' }}
                          onClick={() => handleSetPrimary(role.id)}
                        >
                          Set as Primary
                        </button>
                      )}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>
                        • {role.skills.length} skills
                      </span>
                    </div>

                    {/* Order buttons & Edit/Delete actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.75rem', lineHeight: '1' }}
                        disabled={index === 0 || reordering}
                        onClick={() => handleMove(index, 'up')}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.75rem', lineHeight: '1' }}
                        disabled={index === roles.length - 1 || reordering}
                        onClick={() => handleMove(index, 'down')}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="link-btn"
                        style={{ fontSize: '0.8rem', marginLeft: '6px' }}
                        onClick={() => handleStartEdit(role)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-btn"
                        style={{ fontSize: '0.8rem', color: '#ef4444' }}
                        onClick={() => setDeletingRoleId(role.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {role.description && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text)' }}>
                      {role.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
