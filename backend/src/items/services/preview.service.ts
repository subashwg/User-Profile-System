import dns from 'node:dns/promises';
import net from 'node:net';
import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PortfolioItemKind } from '@prisma/client';
import { RateLimiterService } from '../../common/services/rate-limiter.service.js';
import { deriveSourceSite, sanitizePlainText } from '../utils/url.util.js';

export interface PreviewResult {
  title: string | null;
  description: string | null;
  cover_url: string | null;
  kind: PortfolioItemKind;
  source_site: string;
}

/**
 * Checks whether an IPv4 address belongs to a private, loopback, or reserved range.
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed, treat as unsafe
  }

  const [a, b, c] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (a === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private network)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.88.99.0/24 (6to4 Relay Anycast)
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 (Private network)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Network benchmark tests)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;
  // 255.255.255.255/32 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && parts[3] === 255) return true;

  return false;
}

/**
 * Checks whether an IPv6 address belongs to a private, loopback, or reserved range.
 */
export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7);
    if (net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
    return true;
  }

  // Loopback (::1) and Unspecified (::)
  if (normalized === '::1' || normalized === '::') return true;

  // Unique Local (fc00::/7) - starts with fc or fd
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local (fe80::/10) - starts with fe8, fe9, fea, feb
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) return true;

  return false;
}

/**
 * Checks whether an IP (v4 or v6) is private or reserved.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // Not a valid IP
}

/**
 * Decode common HTML entities into plain text
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

@Injectable()
export class PreviewService {
  private readonly USER_AGENT = 'PortfolioBot/1.0 (+https://userprofile.dev)';
  private readonly MAX_BYTES = 1024 * 1024; // 1 MB
  private readonly TIMEOUT_MS = 5000; // 5 seconds
  private readonly MAX_REDIRECTS = 3;

  constructor(private readonly rateLimiter: RateLimiterService) {}

  /**
   * Main entry point for link preview with rate limiting and SSRF protection
   */
  async getPreview(userId: string, rawUrl: string): Promise<PreviewResult> {
    // Rate limit: 20 requests per minute per user
    const rateCheck = this.rateLimiter.checkLimit(`preview:${userId}`, 20, 60000);
    if (rateCheck.limited) {
      throw new HttpException(
        'Too many preview requests. Please wait a minute before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 1. Initial URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestException("We couldn't read this link.");
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new BadRequestException("We couldn't read this link.");
    }

    // 2. YouTube shortcut
    const youtubeVideoId = this.extractYouTubeId(parsedUrl);
    if (youtubeVideoId) {
      return this.fetchYouTubePreview(youtubeVideoId, parsedUrl.toString());
    }

    // 3. Safe HTTP fetch with SSRF guards
    return this.fetchSafeWebpagePreview(parsedUrl.toString());
  }

  /**
   * Extract video ID from YouTube URLs
   */
  extractYouTubeId(url: URL): string | null {
    const host = url.hostname.toLowerCase();
    const isYouTube =
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be';

    if (!isYouTube) return null;

    if (host === 'youtu.be') {
      const pathId = url.pathname.slice(1);
      return /^[a-zA-Z0-9_-]{11}$/.test(pathId) ? pathId : null;
    }

    if (url.pathname.startsWith('/shorts/')) {
      const shortsId = url.pathname.split('/')[2];
      return shortsId && /^[a-zA-Z0-9_-]{11}$/.test(shortsId) ? shortsId : null;
    }

    if (url.pathname.startsWith('/embed/')) {
      const embedId = url.pathname.split('/')[2];
      return embedId && /^[a-zA-Z0-9_-]{11}$/.test(embedId) ? embedId : null;
    }

    const vParam = url.searchParams.get('v');
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }

    return null;
  }

  /**
   * Quick, reliable preview for YouTube videos using official oEmbed
   */
  private async fetchYouTubePreview(
    videoId: string,
    originalUrl: string,
  ): Promise<PreviewResult> {
    const coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    let title: string | null = null;
    let description: string | null = null;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
        headers: { 'User-Agent': this.USER_AGENT },
      });

      if (res.ok) {
        const data = (await res.json()) as { title?: string; author_name?: string };
        if (data.title) {
          title = decodeHtmlEntities(sanitizePlainText(data.title)).slice(0, 100);
        }
        if (data.author_name) {
          description = `Video by ${decodeHtmlEntities(sanitizePlainText(data.author_name))} on YouTube`.slice(0, 300);
        }
      }
    } catch {
      // Fallback if oEmbed fails or times out
    }

    return {
      title: title || 'YouTube Video',
      description: description || null,
      cover_url: coverUrl,
      kind: PortfolioItemKind.video,
      source_site: 'YouTube',
    };
  }

  /**
   * Verify that hostname resolves only to safe public IP addresses
   */
  async validateHostSafety(hostname: string): Promise<void> {
    const lower = hostname.toLowerCase();
    if (
      lower === 'localhost' ||
      lower.endsWith('.localhost') ||
      lower.endsWith('.local') ||
      lower.endsWith('.internal')
    ) {
      throw new BadRequestException("We couldn't read this link.");
    }

    // Direct IP address in URL check
    if (net.isIP(hostname)) {
      if (isPrivateOrReservedIp(hostname)) {
        throw new BadRequestException("We couldn't read this link.");
      }
      return;
    }

    // DNS lookup
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) {
        throw new BadRequestException("We couldn't read this link.");
      }

      for (const record of addresses) {
        if (isPrivateOrReservedIp(record.address)) {
          throw new BadRequestException("We couldn't read this link.");
        }
      }
    } catch {
      throw new BadRequestException("We couldn't read this link.");
    }
  }

  /**
   * Fetch webpage HTML safely with SSRF validation, redirects, 1MB limit & 5s timeout
   */
  private async fetchSafeWebpagePreview(targetUrl: string): Promise<PreviewResult> {
    let currentUrl = targetUrl;
    let redirectCount = 0;
    let finalHtml = '';
    const sourceSite = deriveSourceSite(targetUrl);

    try {
      while (redirectCount <= this.MAX_REDIRECTS) {
        const parsed = new URL(currentUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new BadRequestException("We couldn't read this link.");
        }

        // SSRF check on hostname
        await this.validateHostSafety(parsed.hostname);

        const response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual', // handle redirects manually to check destination safety
          signal: AbortSignal.timeout(this.TIMEOUT_MS),
          headers: {
            'User-Agent': this.USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        // Handle redirect
        if (
          [301, 302, 303, 307, 308].includes(response.status) &&
          response.headers.get('location')
        ) {
          redirectCount++;
          if (redirectCount > this.MAX_REDIRECTS) {
            throw new BadRequestException("We couldn't read this link.");
          }

          const locationHeader = response.headers.get('location')!;
          currentUrl = new URL(locationHeader, currentUrl).toString();
          continue;
        }

        if (!response.ok) {
          throw new BadRequestException("We couldn't read this link.");
        }

        // Read stream up to MAX_BYTES (1 MB) or until </head> is found
        if (!response.body) {
          throw new BadRequestException("We couldn't read this link.");
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        const decoder = new TextDecoder('utf-8');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            chunks.push(value);
            totalBytes += value.length;
            const textChunk = decoder.decode(value, { stream: true });
            finalHtml += textChunk;

            // Stop reading if we already passed the head or hit 1MB
            if (finalHtml.includes('</head>') || finalHtml.includes('<body') || totalBytes >= this.MAX_BYTES) {
              await reader.cancel();
              break;
            }
          }
        }

        break;
      }
    } catch {
      throw new BadRequestException("We couldn't read this link.");
    }

    if (!finalHtml) {
      throw new BadRequestException("We couldn't read this link.");
    }

    return this.parseHtmlMetadata(finalHtml, currentUrl, sourceSite);
  }

  /**
   * Parse OpenGraph, Twitter card, and standard metadata from HTML
   */
  private parseHtmlMetadata(
    html: string,
    pageUrl: string,
    sourceSite: string,
  ): PreviewResult {
    // 1. Title
    const ogTitleMatch = html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i,
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i,
    );
    const twitterTitleMatch = html.match(
      /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i,
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:title["']/i,
    );
    const standardTitleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    const rawTitle =
      ogTitleMatch?.[1] || twitterTitleMatch?.[1] || standardTitleMatch?.[1] || null;
    const cleanTitle = rawTitle
      ? decodeHtmlEntities(sanitizePlainText(rawTitle)).slice(0, 100)
      : null;

    // 2. Description
    const ogDescMatch = html.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i,
    );
    const twitterDescMatch = html.match(
      /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i,
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:description["']/i,
    );
    const metaDescMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i,
    );

    const rawDesc =
      ogDescMatch?.[1] || twitterDescMatch?.[1] || metaDescMatch?.[1] || null;
    const cleanDesc = rawDesc
      ? decodeHtmlEntities(sanitizePlainText(rawDesc)).slice(0, 300)
      : null;

    // 3. Cover URL
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']*)["']/i,
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    );
    const twitterImageMatch = html.match(
      /<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']*)["']/i,
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:image(?::src)?["']/i,
    );

    let cleanCoverUrl: string | null = null;
    const rawCover = ogImageMatch?.[1] || twitterImageMatch?.[1] || null;
    if (rawCover) {
      try {
        const resolved = new URL(rawCover.trim(), pageUrl).toString();
        if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
          cleanCoverUrl = resolved.slice(0, 2000);
        }
      } catch {
        cleanCoverUrl = null;
      }
    }

    // 4. Kind Inference
    const ogTypeMatch = html.match(
      /<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']*)["']/i,
    );
    const ogType = ogTypeMatch?.[1]?.toLowerCase();
    const kind = this.inferKind(pageUrl, ogType);

    return {
      title: cleanTitle,
      description: cleanDesc,
      cover_url: cleanCoverUrl,
      kind,
      source_site: sourceSite,
    };
  }

  /**
   * Infer portfolio kind from URL domain heuristics and og:type
   */
  private inferKind(urlStr: string, ogType?: string): PortfolioItemKind {
    if (ogType) {
      if (ogType.startsWith('video')) return PortfolioItemKind.video;
      if (ogType === 'article') return PortfolioItemKind.article;
      if (ogType === 'book') return PortfolioItemKind.course;
      if (ogType === 'product') return PortfolioItemKind.product;
    }

    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname.toLowerCase();

      if (
        host === 'youtube.com' ||
        host.endsWith('.youtube.com') ||
        host === 'youtu.be' ||
        host === 'vimeo.com' ||
        host.endsWith('.vimeo.com') ||
        host === 'twitch.tv' ||
        host.endsWith('.twitch.tv')
      ) {
        return PortfolioItemKind.video;
      }

      if (
        host === 'medium.com' ||
        host.endsWith('.medium.com') ||
        host === 'dev.to' ||
        host === 'substack.com' ||
        host.endsWith('.substack.com') ||
        host === 'hashnode.dev' ||
        host === 'hashnode.com'
      ) {
        return PortfolioItemKind.article;
      }

      if (
        host === 'github.com' ||
        host.endsWith('.github.com') ||
        host === 'gitlab.com' ||
        host.endsWith('.gitlab.com') ||
        host === 'codepen.io' ||
        host === 'npmjs.com'
      ) {
        return PortfolioItemKind.project;
      }

      if (
        host === 'producthunt.com' ||
        host.endsWith('.producthunt.com') ||
        host === 'gumroad.com' ||
        host.endsWith('.gumroad.com') ||
        host === 'appsumo.com'
      ) {
        return PortfolioItemKind.product;
      }

      if (
        host === 'coursera.org' ||
        host.endsWith('.coursera.org') ||
        host === 'udemy.com' ||
        host.endsWith('.udemy.com') ||
        host === 'edx.org' ||
        host === 'educative.io'
      ) {
        return PortfolioItemKind.course;
      }
    } catch {
      // fallback to other
    }

    return PortfolioItemKind.other;
  }
}
