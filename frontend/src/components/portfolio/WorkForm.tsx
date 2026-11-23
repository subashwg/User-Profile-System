import React, { useEffect, useState } from 'react';
import { type PortfolioKind } from '../ui/Badge.js';
import Button from '../ui/Button.js';
import PortfolioCard from './PortfolioCard.js';
import { type PortfolioItem } from './WorkList.js';

export interface RoleOption {
  id: string;
  title: string;
}

export interface WorkFormProps {
  initialItem?: PortfolioItem | null;
  roles: RoleOption[];
  preselectedRoleId?: string;
  apiUrl: string;
  onSave: (payload: {
    itemData: {
      role_id: string;
      kind: PortfolioKind;
      title: string;
      description?: string | null;
      url: string;
      cover_url?: string | null;
      cover_source: 'none' | 'link' | 'upload';
      source_site?: string | null;
      published_on?: string | null;
      is_featured?: boolean;
      is_hidden?: boolean;
    };
    coverFile?: File | null;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function WorkForm({
  initialItem,
  roles,
  preselectedRoleId,
  apiUrl,
  onSave,
  onCancel,
}: WorkFormProps) {
  const isEditing = !!initialItem;

  // Form Fields
  const [url, setUrl] = useState(initialItem?.url || '');
  const [roleId, setRoleId] = useState<string>(
    initialItem?.role_id || preselectedRoleId || (roles.length === 1 ? roles[0].id : ''),
  );
  const [kind, setKind] = useState<PortfolioKind>(initialItem?.kind || 'project');
  const [title, setTitle] = useState(initialItem?.title || '');
  const [description, setDescription] = useState(initialItem?.description || '');
  const [coverUrl, setCoverUrl] = useState<string | null>(initialItem?.cover_url || null);
  const [coverSource, setCoverSource] = useState<'none' | 'link' | 'upload'>(
    initialItem?.cover_source || 'none',
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [sourceSite, setSourceSite] = useState<string | null>(initialItem?.source_site || null);
  const [publishedOn, setPublishedOn] = useState<string>(
    initialItem?.published_on ? initialItem.published_on.slice(0, 10) : '',
  );
  const [isFeatured, setIsFeatured] = useState<boolean>(initialItem?.is_featured || false);
  const [isHidden, setIsHidden] = useState<boolean>(initialItem?.is_hidden || false);

  // UI state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobilePreviewExpanded, setMobilePreviewExpanded] = useState(false);

  // Found preview cover saved for "From link" choice
  const [foundCoverUrl, setFoundCoverUrl] = useState<string | null>(
    initialItem?.cover_source === 'link' ? initialItem.cover_url || null : null,
  );

  // Selected role title
  const currentRole = roles.find((r) => r.id === roleId);
  const roleTitle = currentRole?.title || 'Selected Role';

  // Handle preview fetch from URL
  const fetchLinkPreview = async (targetUrl: string) => {
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return;
    }

    setPreviewLoading(true);
    setPreviewNotice(null);

    try {
      const res = await fetch(`${apiUrl}/items/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: targetUrl.trim() }),
      });

      if (!res.ok) {
        throw new Error("We couldn't read this link. Fill in the details yourself.");
      }

      const data = await res.json();

      // Auto-fill suggested details if not already modified
      if (data.title && !title) {
        setTitle(data.title);
      }
      if (data.description && !description) {
        setDescription(data.description);
      }
      if (data.kind) {
        setKind(data.kind);
      }
      if (data.source_site) {
        setSourceSite(data.source_site);
      }
      if (data.cover_url) {
        setFoundCoverUrl(data.cover_url);
        // Default to found link cover
        setCoverUrl(data.cover_url);
        setCoverSource('link');
      }
    } catch {
      setPreviewNotice("We couldn't read this link. Fill in the details yourself.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle local file selection for cover
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Cover image size must not exceed 5MB.');
      return;
    }

    setCoverFile(file);
    setCoverSource('upload');
    const localPreview = URL.createObjectURL(file);
    setCoverPreviewUrl(localPreview);
  };

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!url.trim()) {
      setFormError('Link URL is required.');
      return;
    }

    if (!roleId) {
      setFormError('Please select a role for this item.');
      return;
    }

    if (!title.trim()) {
      setFormError('Title is required.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        itemData: {
          role_id: roleId,
          kind,
          title: title.trim(),
          description: description.trim() || null,
          url: url.trim(),
          cover_url: coverSource === 'upload' ? null : coverUrl,
          cover_source: coverSource,
          source_site: sourceSite,
          published_on: publishedOn ? publishedOn : null,
          is_featured: isFeatured,
          is_hidden: isHidden,
        },
        coverFile: coverSource === 'upload' ? coverFile : null,
      });
    } catch (err) {
      setFormError((err as Error).message || 'Failed to save work item.');
      setSaving(false);
    }
  };

  // Determine what image to show in live card preview
  const previewEffectiveCoverUrl =
    coverSource === 'upload'
      ? coverPreviewUrl || (initialItem?.cover_source === 'upload' ? initialItem.cover_url : null)
      : coverSource === 'link'
      ? coverUrl
      : null;

  return (
    <div className="work-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="type-heading" style={{ margin: 0 }}>
            {isEditing ? 'Edit Work Item' : 'Add Work Item'}
          </h2>
          <p className="type-body-muted" style={{ margin: '4px 0 0 0' }}>
            Paste a link to your work. We'll automatically suggest details and format the card.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          ← Back to List
        </Button>
      </div>

      {formError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(180, 35, 24, 0.1)',
            color: 'var(--color-danger)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-input)',
            fontSize: '14px',
          }}
        >
          {formError}
        </div>
      )}

      {/* Main Grid: Form on Left, Live Card Preview on Right */}
      <div
        className="work-form-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 1fr)',
          gap: '32px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Form Fields */}
        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxSizing: 'border-box',
          }}
        >
          {/* 1. Link Field */}
          <div>
            <label
              htmlFor="item-url-input"
              className="type-card-title"
              style={{ fontSize: '14px', display: 'block', marginBottom: '6px' }}
            >
              Link to your work <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="item-url-input"
                type="url"
                required
                placeholder="https://youtube.com/watch?v=..., https://github.com/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => {
                  if (url.trim() && !title) {
                    fetchLinkPreview(url);
                  }
                }}
                className="focus-ring"
                style={{
                  flexGrow: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--color-border-strong)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fetchLinkPreview(url)}
                disabled={previewLoading || !url.trim()}
              >
                {previewLoading ? 'Reading...' : 'Fetch Details'}
              </Button>
            </div>
            <p className="type-caption" style={{ margin: '4px 0 0 0' }}>
              We'll look up the link to fill in title, description, cover image, and type.
            </p>
          </div>

          {/* Link Lookup Notice / Failure Warning */}
          {previewNotice && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(255, 168, 0, 0.12)',
                color: 'var(--color-text)',
                border: '1px solid rgba(255, 168, 0, 0.4)',
                borderRadius: 'var(--radius-input)',
                fontSize: '13px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <span>⚠️</span>
              <span>{previewNotice}</span>
            </div>
          )}

          {/* Mobile Collapsible Live Preview Toggle */}
          <div className="work-form-mobile-preview-toggle" style={{ display: 'none' }}>
            <button
              type="button"
              onClick={() => setMobilePreviewExpanded(!mobilePreviewExpanded)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-input)',
                color: 'var(--color-accent)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {mobilePreviewExpanded ? '▲ Hide Live Preview' : '▼ Show Live Preview'}
            </button>
            {mobilePreviewExpanded && (
              <div style={{ marginTop: '12px' }}>
                <PortfolioCard
                  kind={kind}
                  title={title || 'Your Work Title Will Appear Here'}
                  description={description || 'A concise description highlighting your contribution.'}
                  url={url || '#'}
                  cover_url={previewEffectiveCoverUrl}
                  source_site={sourceSite || 'Website'}
                  published_on={publishedOn || null}
                  roleTitle={roleTitle}
                  is_featured={isFeatured}
                  is_hidden={isHidden}
                  interactive={false}
                />
              </div>
            )}
          </div>

          {/* 2. Role Selector */}
          <div>
            <label
              htmlFor="item-role-select"
              className="type-card-title"
              style={{ fontSize: '14px', display: 'block', marginBottom: '6px' }}
            >
              Role <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select
              id="item-role-select"
              required
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="focus-ring"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--color-border-strong)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              <option value="" disabled>
                Select a role
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Kind Preset Selector */}
          <div>
            <label
              htmlFor="item-kind-select"
              className="type-card-title"
              style={{ fontSize: '14px', display: 'block', marginBottom: '6px' }}
            >
              Kind / Type <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select
              id="item-kind-select"
              required
              value={kind}
              onChange={(e) => setKind(e.target.value as PortfolioKind)}
              className="focus-ring"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--color-border-strong)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              <option value="video">▶ Video (YouTube, Vimeo, Talk)</option>
              <option value="article">📄 Article (Medium, Substack, Blog)</option>
              <option value="course">🎓 Course (Educational curriculum)</option>
              <option value="project">🚀 Project (GitHub, Open Source, App)</option>
              <option value="product">📦 Product (SaaS, Launch, Store)</option>
              <option value="other">🔗 Other (General link or resource)</option>
            </select>
          </div>

          {/* 4. Title Input (Max 100) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="item-title-input" className="type-card-title" style={{ fontSize: '14px' }}>
                Title <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <span className="type-caption" style={{ color: title.length > 95 ? 'var(--color-danger)' : undefined }}>
                {title.length}/100
              </span>
            </div>
            <input
              id="item-title-input"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Mastering Playwright Automation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="focus-ring"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--color-border-strong)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 5. Description Input (Max 300) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="item-desc-input" className="type-card-title" style={{ fontSize: '14px' }}>
                Description (Optional)
              </label>
              <span
                className="type-caption"
                style={{ color: description.length > 290 ? 'var(--color-danger)' : undefined }}
              >
                {description.length}/300
              </span>
            </div>
            <textarea
              id="item-desc-input"
              rows={3}
              maxLength={300}
              placeholder="A brief overview of the project, video, or article..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="focus-ring"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--color-border-strong)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 6. Cover Image Options */}
          <div>
            <span className="type-card-title" style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
              Cover Image (16:9)
            </span>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {foundCoverUrl && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <input
                    type="radio"
                    name="cover-source"
                    checked={coverSource === 'link'}
                    onChange={() => {
                      setCoverSource('link');
                      setCoverUrl(foundCoverUrl);
                    }}
                  />
                  <span>Use cover from link</span>
                </label>
              )}

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="cover-source"
                  checked={coverSource === 'upload'}
                  onChange={() => setCoverSource('upload')}
                />
                <span>Upload image (JPEG, PNG, WebP)</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="cover-source"
                  checked={coverSource === 'none'}
                  onChange={() => {
                    setCoverSource('none');
                    setCoverUrl(null);
                    setCoverFile(null);
                  }}
                />
                <span>No cover (Use kind tint fallback)</span>
              </label>
            </div>

            {coverSource === 'upload' && (
              <div
                style={{
                  padding: '16px',
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: 'var(--radius-input)',
                  backgroundColor: 'var(--color-background)',
                }}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{ fontSize: '13px' }}
                />
                <p className="type-caption" style={{ margin: '6px 0 0 0' }}>
                  Image will be cropped to 16:9 and resized to 1280×720 &amp; 640×360. Max 5 MB.
                </p>
              </div>
            )}
          </div>

          {/* 7. Published Date & Status Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label
                htmlFor="item-published-input"
                className="type-card-title"
                style={{ fontSize: '14px', display: 'block', marginBottom: '6px' }}
              >
                Date Created / Published
              </label>
              <input
                id="item-published-input"
                type="date"
                value={publishedOn}
                onChange={(e) => setPublishedOn(e.target.value)}
                className="focus-ring"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--color-border-strong)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="item-source-input"
                className="type-card-title"
                style={{ fontSize: '14px', display: 'block', marginBottom: '6px' }}
              >
                Source Site Name
              </label>
              <input
                id="item-source-input"
                type="text"
                placeholder="e.g. YouTube, GitHub, Medium"
                value={sourceSite || ''}
                onChange={(e) => setSourceSite(e.target.value)}
                className="focus-ring"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--color-border-strong)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Status Checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <div>
                <strong style={{ fontSize: '14px' }}>★ Feature this item</strong>
                <p className="type-caption" style={{ margin: '2px 0 0 0' }}>
                  Featured items are showcased in the prominent top row of your public portfolio (max 5 per user).
                </p>
              </div>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isHidden}
                onChange={(e) => setIsHidden(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <div>
                <strong style={{ fontSize: '14px' }}>👁 Hide from public profile</strong>
                <p className="type-caption" style={{ margin: '2px 0 0 0' }}>
                  Hidden items remain in your editor but won't be visible to public visitors.
                </p>
              </div>
            </label>
          </div>

          {/* Form Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              paddingTop: '16px',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <Button type="button" variant="subtle" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Work Item'}
            </Button>
          </div>
        </form>

        {/* Right Column: Live Card Preview (Desktop Sticky) */}
        <aside
          className="work-form-desktop-preview"
          style={{
            position: 'sticky',
            top: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="type-caption" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live Card Preview
            </span>
            <span className="type-caption">Desktop &amp; Mobile</span>
          </div>

          <PortfolioCard
            kind={kind}
            title={title || 'Your Work Title Will Appear Here'}
            description={description || 'A concise description highlighting your contribution and key achievements.'}
            url={url || '#'}
            cover_url={previewEffectiveCoverUrl}
            source_site={sourceSite || 'Website'}
            published_on={publishedOn || null}
            roleTitle={roleTitle}
            is_featured={isFeatured}
            is_hidden={isHidden}
            interactive={false}
          />

          <p className="type-caption" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            This preview updates live as you type or change options.
          </p>
        </aside>
      </div>
    </div>
  );
}
