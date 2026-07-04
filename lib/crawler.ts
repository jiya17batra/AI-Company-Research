import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { CrawledPage, CrawlResult } from './types';

const PAGE_KEYWORDS: Record<string, string[]> = {
  about: ['about', 'about-us', 'company', 'who-we-are', 'our-story'],
  products: ['product', 'products', 'platform', 'features'],
  services: ['service', 'services', 'what-we-do'],
  solutions: ['solution', 'solutions', 'use-case', 'industries'],
  contact: ['contact', 'contact-us', 'support', 'get-in-touch'],
  pricing: ['pricing', 'plans', 'price']
};

const IGNORE_PATTERNS = [
  'login',
  'signin',
  'sign-in',
  'signup',
  'sign-up',
  'register',
  'account',
  'cart',
  'checkout',
  'wp-admin',
  'privacy',
  'terms',
  'cookie',
  '.pdf',
  '.jpg',
  '.png',
  '.svg',
  '.zip',
  'mailto:',
  'tel:',
  'javascript:'
];

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    // Strip trailing slash for de-duplication
    let path = u.pathname.replace(/\/$/, '');
    return `${u.origin}${path}`;
  } catch {
    return url;
  }
}

function shouldIgnore(url: string): boolean {
  const lower = url.toLowerCase();
  return IGNORE_PATTERNS.some((p) => lower.includes(p));
}

function categorize(url: string, title: string): string {
  const lower = (url + ' ' + title).toLowerCase();
  for (const [category, keywords] of Object.entries(PAGE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return 'other';
}

function extractText($: cheerio.CheerioAPI): string {
  $('script, style, noscript, nav, footer, svg, iframe').remove();
  const text = $('body').text();
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000); // cap per-page content for token budget
}

async function fetchPage(url: string, timeoutMs = 8000): Promise<{ html: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CompanyResearchBot/1.0; +https://example.com/bot)'
      }
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    const html = await res.text();
    return { html };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Crawl a company website: fetch the homepage, discover internal links that
 * look like About/Products/Services/Contact/Pricing pages, dedupe them,
 * skip login/irrelevant pages, and extract cleaned text content.
 */
export async function crawlWebsite(
  baseUrl: string,
  maxPages = 8
): Promise<CrawlResult> {
  const origin = new URL(baseUrl).origin;
  const visited = new Set<string>();
  const skipped: string[] = [];
  const pages: CrawledPage[] = [];

  const home = await fetchPage(baseUrl);
  if (!home) {
    throw new Error(`Unable to fetch the website: ${baseUrl}`);
  }

  const $home = cheerio.load(home.html);
  const homeTitle = $home('title').first().text().trim() || 'Home';
  const homeNorm = normalizeUrl(baseUrl);
  visited.add(homeNorm);

  // Discover candidate internal links FIRST — extractText() below mutates the
  // DOM (it strips <nav>/<footer>), so link discovery must happen before that.
  const linkSet = new Map<string, string>(); // normalizedUrl -> anchorText
  $home('a[href]').each((_, el) => {
    const href = $home(el).attr('href');
    if (!href) return;
    try {
      const absolute = new URL(href, baseUrl).toString();
      if (new URL(absolute).origin !== origin) return; // stay on-site
      if (shouldIgnore(absolute)) {
        skipped.push(absolute);
        return;
      }
      const norm = normalizeUrl(absolute);
      if (!linkSet.has(norm)) {
        linkSet.set(norm, $home(el).text().trim());
      }
    } catch {
      // ignore malformed URLs
    }
  });

  pages.push({
    url: baseUrl,
    title: homeTitle,
    category: 'home',
    text: extractText($home)
  });

  // Rank candidate links: prioritize ones matching our keyword categories
  const ranked = Array.from(linkSet.entries())
    .filter(([norm]) => !visited.has(norm))
    .map(([norm, anchor]) => ({
      norm,
      anchor,
      category: categorize(norm, anchor)
    }))
    .sort((a, b) => (a.category === 'other' ? 1 : 0) - (b.category === 'other' ? 1 : 0))
    .slice(0, Math.max(0, maxPages - 1));

  const limit = pLimit(4);
  const fetched = await Promise.all(
    ranked.map((candidate) =>
      limit(async () => {
        if (visited.has(candidate.norm)) return null;
        visited.add(candidate.norm);
        const page = await fetchPage(candidate.norm);
        if (!page) {
          skipped.push(candidate.norm);
          return null;
        }
        const $ = cheerio.load(page.html);
        const title = $('title').first().text().trim() || candidate.anchor || candidate.norm;
        return {
          url: candidate.norm,
          title,
          category: categorize(candidate.norm, title),
          text: extractText($)
        } as CrawledPage;
      })
    )
  );

  for (const p of fetched) {
    if (p && p.text.length > 40) {
      pages.push(p);
    } else if (p) {
      skipped.push(p.url);
    }
  }

  return { baseUrl, pages, skipped };
}
