/**
 * Utility functions for URL handling in Portfolio Items
 */

/**
 * Remove HTML tags from user-provided text to ensure plain-text storage
 */
export function sanitizePlainText(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>?/gm, '').trim();
}

/**
 * Normalize and canonicalize a URL to prevent duplicates:
 * - Lowercases protocol and hostname
 * - Removes common tracking query parameters (utm_*, fbclid, gclid)
 * - Removes trailing slash from path (except root /)
 * - Sorts remaining query parameters
 * - Strips empty hash
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const trimmed = rawUrl.trim();
    const parsed = new URL(trimmed);

    // Normalize protocol and host
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove tracking parameters
    const trackingParams = new Set([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'igshid',
      'mc_cid',
      'mc_eid',
    ]);

    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (trackingParams.has(key.toLowerCase())) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    // Sort query parameters
    parsed.searchParams.sort();

    // Strip trailing slash if pathname is not just '/'
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Strip hash if empty
    if (parsed.hash === '#' || parsed.hash === '') {
      parsed.hash = '';
    }

    return parsed.toString();
  } catch {
    return rawUrl.trim().replace(/\/+$/, '');
  }
}

/**
 * Known domains and their human-readable site names
 */
const KNOWN_SITES: Record<string, string> = {
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'github.com': 'GitHub',
  'medium.com': 'Medium',
  'twitter.com': 'X (Twitter)',
  'x.com': 'X (Twitter)',
  'linkedin.com': 'LinkedIn',
  'dev.to': 'DEV Community',
  'substack.com': 'Substack',
  'dribbble.com': 'Dribbble',
  'behance.net': 'Behance',
  'figma.com': 'Figma',
  'gitlab.com': 'GitLab',
  'vimeo.com': 'Vimeo',
  'spotify.com': 'Spotify',
  'codepen.io': 'CodePen',
  'hashnode.dev': 'Hashnode',
  'hashnode.com': 'Hashnode',
  'npmjs.com': 'npm',
  'stackoverflow.com': 'Stack Overflow',
};

/**
 * Derive a friendly source site name from a URL
 */
export function deriveSourceSite(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    let host = parsed.hostname.toLowerCase();

    // Check direct known host
    for (const [knownDomain, name] of Object.entries(KNOWN_SITES)) {
      if (host === knownDomain || host.endsWith('.' + knownDomain)) {
        return name;
      }
    }

    // Strip www. and subdomains if applicable
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }

    // Capitalize first letter of domain
    const parts = host.split('.');
    if (parts.length >= 2) {
      const mainName = parts[0];
      return mainName.charAt(0).toUpperCase() + mainName.slice(1);
    }

    return host;
  } catch {
    return 'Website';
  }
}
