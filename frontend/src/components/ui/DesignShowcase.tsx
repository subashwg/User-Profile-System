import { useState } from 'react';
import Button from './Button.js';
import Chip from './Chip.js';
import { KindBadge, StatusBadge, type PortfolioKind } from './Badge.js';
import CardShell from './CardShell.js';
import SkeletonCard from './Skeleton.js';
import EmptyStateCard from './EmptyStateCard.js';
import PortfolioCard from '../portfolio/PortfolioCard.js';
import PortfolioCardSkeleton from '../portfolio/PortfolioCardSkeleton.js';

export default function DesignShowcase({ onBack }: { onBack?: () => void }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [selectedChip, setSelectedChip] = useState('all');

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const kinds: PortfolioKind[] = ['video', 'article', 'course', 'project', 'product', 'other'];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        padding: '32px 24px',
        boxSizing: 'border-box',
        textAlign: 'left',
      }}
    >
      <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-border)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '8px',
                  padding: 0,
                }}
              >
                ← Back to App
              </button>
            )}
            <h1 className="type-display" style={{ margin: 0 }}>
              Design Foundation Showcase
            </h1>
            <p className="type-body-muted" style={{ margin: '4px 0 0 0' }}>
              Step 3 Design Tokens, Type Scale, Spacing &amp; Shared UI Components
            </p>
          </div>

          <Button variant="secondary" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
          </Button>
        </div>

        {/* Section 1: Colour Tokens */}
        <section style={{ marginBottom: '48px' }}>
          <h2 className="type-heading" style={{ marginBottom: '16px' }}>
            1. Colour Tokens &amp; Contrast
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            {[
              { name: 'background', var: 'var(--color-background)', border: true },
              { name: 'surface', var: 'var(--color-surface)', border: true },
              { name: 'text', var: 'var(--color-text)', textColor: '#FFF' },
              { name: 'text-muted', var: 'var(--color-text-muted)', textColor: '#FFF' },
              { name: 'border', var: 'var(--color-border)', border: true },
              { name: 'border-strong', var: 'var(--color-border-strong)', textColor: '#FFF' },
              { name: 'accent', var: 'var(--color-accent)', textColor: '#FFF' },
              { name: 'accent-soft', var: 'var(--color-accent-soft)', border: true },
              { name: 'accent-strong', var: 'var(--color-accent-strong)', textColor: '#FFF' },
              { name: 'danger', var: 'var(--color-danger)', textColor: '#FFF' },
            ].map((token) => (
              <div
                key={token.name}
                style={{
                  backgroundColor: token.var,
                  color: token.textColor || 'var(--color-text)',
                  border: token.border ? '1px solid var(--color-border)' : 'none',
                  borderRadius: 'var(--radius-interactive)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-card-rest)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{token.name}</div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>{token.var}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Kind Tints & Badges */}
        <section style={{ marginBottom: '48px' }}>
          <h2 className="type-heading" style={{ marginBottom: '16px' }}>
            2. Kind Tints &amp; Badges (Video, Article, Course, Project, Product, Other)
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {kinds.map((kind) => (
              <KindBadge key={kind} kind={kind} />
            ))}
            <StatusBadge status="featured" />
            <StatusBadge status="hidden" />
          </div>
        </section>

        {/* Section 3: Type Scale */}
        <section style={{ marginBottom: '48px' }}>
          <h2 className="type-heading" style={{ marginBottom: '16px' }}>
            3. Type Scale (Inter / System)
          </h2>
          <CardShell style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span className="type-caption">DISPLAY · 32/40 (28/36 on phones) weight 650</span>
              <div className="type-display">Subash Poudel | QA Engineer &amp; Creator</div>
            </div>
            <div>
              <span className="type-caption">HEADING · 22/30 weight 650</span>
              <div className="type-heading">Featured Portfolio Projects</div>
            </div>
            <div>
              <span className="type-caption">CARD TITLE · 17/24 weight 600 (max 2 lines)</span>
              <div className="type-card-title">
                Building an End-to-End Test Automation Framework with Playwright and NestJS
              </div>
            </div>
            <div>
              <span className="type-caption">BODY · 15/24 weight 400</span>
              <p className="type-body">
                Step 3 lets users show their work with beautiful cards, grouped by their chosen roles.
                The visitor sees a featured row, a filter by role, and a responsive grid.
              </p>
            </div>
            <div>
              <span className="type-caption">SMALL · 13/20 weight 500</span>
              <div className="type-small" style={{ color: 'var(--color-text-muted)' }}>
                Filter chips, buttons, labels and auxiliary tags.
              </div>
            </div>
            <div>
              <span className="type-caption">CAPTION · 12/16 weight 500</span>
              <div className="type-caption">YouTube · Nov 2026 · 12 mins</div>
            </div>
          </CardShell>
        </section>

        {/* Section 4: Buttons & Touch Targets */}
        <section style={{ marginBottom: '48px' }}>
          <h2 className="type-heading" style={{ marginBottom: '16px' }}>
            4. Buttons (Accessible Touch Targets ≥ 44px)
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="danger">Delete Item</Button>
            <Button variant="subtle">Subtle Action</Button>
            <Button variant="primary" size="sm">Small (36px)</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </section>

        {/* Section 5: Filter Chips */}
        <section style={{ marginBottom: '48px' }}>
          <h2 className="type-heading" style={{ marginBottom: '16px' }}>
            5. Filter Chips (Accessible Buttons with aria-pressed)
          </h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Chip
              label="All"
              count={18}
              selected={selectedChip === 'all'}
              onClick={() => setSelectedChip('all')}
            />
            <Chip
              label="QA Engineer"
              count={7}
              selected={selectedChip === 'qa'}
              onClick={() => setSelectedChip('qa')}
            />
            <Chip
              label="Content Creator"
              count={6}
              selected={selectedChip === 'creator'}
              onClick={() => setSelectedChip('creator')}
            />
            <Chip
              label="Developer"
              count={5}
              selected={selectedChip === 'dev'}
              onClick={() => setSelectedChip('dev')}
            />
          </div>
        </section>

        {/* Section 6: Cards, Skeletons & Empty State */}
        <section style={{ marginBottom: '48px' }}>
          <h2 className="type-heading" style={{ marginBottom: '16px' }}>
            6. Cards, Skeletons &amp; Empty State
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
              marginBottom: '24px',
            }}
          >
            {/* Real Interactive Card Shell */}
            <CardShell style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <KindBadge kind="video" />
                <StatusBadge status="featured" />
              </div>
              <div className="type-caption" style={{ marginBottom: '6px' }}>
                YouTube · Nov 2026
              </div>
              <h3 className="type-card-title" style={{ margin: '0 0 8px 0' }}>
                Automated Testing at Scale: Full Course Preview
              </h3>
              <p className="type-body-muted" style={{ margin: '0 0 16px 0' }}>
                Comprehensive guide covering CI/CD pipelines, parallel test runs, and reporting.
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '12px',
                }}
              >
                <span className="type-caption">QA Engineer</span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '14px' }}>
                  Watch →
                </span>
              </div>
            </CardShell>

            {/* Skeleton Loading Card with Shimmer */}
            <SkeletonCard />
          </div>

          {/* Empty State Card */}
          <EmptyStateCard
            icon="💼"
            title="Add your first work item"
            description="Paste a link to a video, project, article, course, or product. We'll automatically suggest titles, descriptions, and cover images."
            actionLabel="+ Add Work Item"
            onAction={() => alert('Add work clicked!')}
          />
        </section>

        {/* Section 6: Item 4 - Portfolio Card Component & States */}
        <section style={{ marginBottom: '64px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 className="type-heading" style={{ margin: '0 0 6px 0' }}>
              6. Portfolio Card Component &amp; States (Build-Order Item 4)
            </h2>
            <p className="type-body-muted" style={{ margin: 0 }}>
              Production component with 16:9 covers, kind badges, 2-line title/description clamp,
              tint fallbacks, broken cover resilience, status badges, and responsive grid layout.
            </p>
          </div>

          {/* Subheader: All 6 Kinds with Covers */}
          <h3 className="type-card-title" style={{ marginBottom: '16px', color: 'var(--color-accent)' }}>
            A. All 6 Kinds with Covers &amp; CTAs
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: '24px',
              marginBottom: '40px',
            }}
          >
            <PortfolioCard
              kind="video"
              title="Building High-Performance Web Applications in 2026"
              description="A practical guide to bundle optimization, streaming SSR, and edge computing patterns."
              url="https://youtube.com/watch?v=sample1"
              cover_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
              source_site="YouTube"
              published_on="2026-03-10"
              roleTitle="Content Creator"
              is_featured={true}
            />

            <PortfolioCard
              kind="article"
              title="State of Distributed Systems: Lessons from 5 Years of Production"
              description="How we scaled message queues, handled partitions, and eliminated single points of failure."
              url="https://medium.com/@author/distributed-systems"
              cover_url="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80"
              source_site="Medium"
              published_on="2026-02-18"
              roleTitle="Lead Architect"
            />

            <PortfolioCard
              kind="course"
              title="Full-Stack TypeScript Masterclass: Zero to Production"
              description="Comprehensive 40-hour hands-on curriculum covering NestJS, React, and PostgreSQL."
              url="https://example.com/course/typescript"
              cover_url="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80"
              source_site="Educative"
              published_on="2026-01-05"
              roleTitle="Instructor"
            />

            <PortfolioCard
              kind="project"
              title="HyperFast CLI: Blazing fast developer tooling in Rust"
              description="Cross-platform command line utility for continuous performance benchmarking and profiling."
              url="https://github.com/developer/hyperfast"
              cover_url="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80"
              source_site="GitHub"
              published_on="2025-11-20"
              roleTitle="Systems Engineer"
            />

            <PortfolioCard
              kind="product"
              title="DevMetrics Pro: Observability platform for indie founders"
              description="All-in-one real-time analytics, uptime checks, and automated error tracking in one lightweight script."
              url="https://devmetricspro.com"
              cover_url="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80"
              source_site="ProductHunt"
              published_on="2025-09-15"
              roleTitle="Founder"
            />

            <PortfolioCard
              kind="other"
              title="Open Source Community & Architecture Guidelines"
              description="Standard operating procedures, governance guidelines, and design documentation."
              url="https://notion.so/guidelines"
              cover_url="https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80"
              source_site="Notion"
              published_on="2025-08-01"
              roleTitle="Community Lead"
            />
          </div>

          {/* Subheader: Tint Fallback when No Cover is Provided */}
          <h3 className="type-card-title" style={{ marginBottom: '16px', color: 'var(--color-accent)' }}>
            B. Kind Tint Fallback (No Cover Provided)
          </h3>
          <p className="type-caption" style={{ marginBottom: '16px' }}>
            When an item has no cover image, it displays a colored tint block matching the kind with its centered icon.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: '24px',
              marginBottom: '40px',
            }}
          >
            {kinds.map((k) => (
              <PortfolioCard
                key={`tint-${k}`}
                kind={k}
                title={`${k.charAt(0).toUpperCase() + k.slice(1)} without cover image`}
                description="Demonstrating clean zero-hole kind tint fallback with centered icon and proper contrast."
                url="https://example.com"
                cover_url={null}
                source_site="Web"
                published_on="2026-03-01"
                roleTitle="Creator"
              />
            ))}
          </div>

          {/* Subheader: Broken Image Fallback, Hidden Item & Loading Skeleton */}
          <h3 className="type-card-title" style={{ marginBottom: '16px', color: 'var(--color-accent)' }}>
            C. Card States: Broken Cover, Hidden Item &amp; Skeleton Loading
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Broken Cover Fallback Simulation */}
            <PortfolioCard
              kind="video"
              title="Broken Cover Image Simulation"
              description="When image fails to load (HTTP 404 or invalid format), it gracefully reverts to the kind tint fallback."
              url="https://example.com/broken"
              cover_url="https://invalid-non-existent-domain-12345.com/broken.jpg"
              source_site="Simulated Site"
              published_on="2026-03-01"
              roleTitle="Error Resilience"
            />

            {/* Hidden Item State (Editor only: 50% opacity & Hidden badge) */}
            <PortfolioCard
              kind="article"
              title="Draft Article (Hidden from Public Page)"
              description="Hidden items are displayed at 50% opacity with an eye-off icon and the word 'Hidden' in the editor."
              url="https://example.com/draft"
              cover_url="https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80"
              source_site="Medium"
              published_on="2026-03-01"
              roleTitle="Technical Writer"
              is_hidden={true}
            />

            {/* Skeleton Loading Card */}
            <PortfolioCardSkeleton />
          </div>
        </section>
      </div>
    </div>
  );
}
