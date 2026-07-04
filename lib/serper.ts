/**
 * Serper.dev integration
 * Docs: https://serper.dev/
 *
 * Used for:
 *  - Resolving a company name -> official website
 *  - Gathering public supporting info (news, directories, socials)
 *  - Finding competitors
 */

const SERPER_URL = 'https://google.serper.dev/search';

export interface SerperResult {
  title: string;
  link: string;
  snippet?: string;
}

async function serperSearch(query: string, num = 8): Promise<SerperResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'SERPER_API_KEY is not set. Add it to your environment variables.'
    );
  }

  const res = await fetch(SERPER_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query, num })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Serper.dev request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const organic = (data.organic || []) as any[];
  return organic.map((r) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet
  }));
}

/** Resolve a company name to its most likely official website. */
export async function resolveOfficialWebsite(
  companyName: string
): Promise<{ url: string; results: SerperResult[] }> {
  const results = await serperSearch(`${companyName} official website`, 8);

  // Heuristic: prefer results whose domain closely matches the company name,
  // skip well-known aggregators / social platforms / marketplaces.
  const blocked = [
    'wikipedia.org',
    'linkedin.com',
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'youtube.com/results',
    'crunchbase.com',
    'glassdoor.com',
    'indeed.com',
    'bloomberg.com',
    'reddit.com'
  ];

  const normalizedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const candidates = results.filter((r) => {
    try {
      const host = new URL(r.link).hostname.replace('www.', '');
      return !blocked.some((b) => host.includes(b));
    } catch {
      return false;
    }
  });

  // Score candidates by how closely the hostname matches the company name
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    try {
      const host = new URL(c.link).hostname.replace('www.', '').split('.')[0];
      const score = host.includes(normalizedName) || normalizedName.includes(host) ? 2 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    } catch {
      // ignore
    }
  }

  if (!best) {
    throw new Error(`Could not resolve an official website for "${companyName}".`);
  }

  return { url: best.link, results };
}

/** Gather general public info snippets about a company (used to backfill phone/address/context). */
export async function searchCompanyPublicInfo(
  companyName: string,
  domain: string
): Promise<SerperResult[]> {
  const [contact, general] = await Promise.all([
    serperSearch(`${companyName} contact phone address site:${domain} OR "${companyName}" contact`, 6),
    serperSearch(`"${companyName}" company overview products services`, 6)
  ]);
  const seen = new Set<string>();
  return [...contact, ...general].filter((r) => {
    if (seen.has(r.link)) return false;
    seen.add(r.link);
    return true;
  });
}

/** Search for likely competitors given industry/product context. */
export async function searchCompetitors(
  companyName: string,
  industryHint: string
): Promise<SerperResult[]> {
  const results = await serperSearch(
    `top competitors and alternatives to ${companyName} ${industryHint}`.trim(),
    10
  );
  return results;
}
