import { CrawledPage, Competitor } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const DEFAULT_MODEL = 'openai/gpt-4o-mini';

// Curated fallback list shown in the UI if the live /models fetch fails.
export const FALLBACK_MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'google/gemini-flash-1.5',
  'meta-llama/llama-3.1-70b-instruct',
  'mistralai/mixtral-8x7b-instruct'
];

interface AiCompanyAnalysis {
  summary: string;
  productsServices: string[];
  painPoints: string[];
  phone: string | null;
  address: string | null;
  industryHint: string;
}

async function callOpenRouter(
  messages: { role: string; content: string }[],
  model: string,
  jsonMode = true
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set. Add it to your environment variables.');
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'AI Company Research Assistant'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    // Strip markdown code fences if the model added them despite instructions
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/** Analyze crawled website content (+ optional public search context) into structured company data. */
export async function analyzeCompany(
  companyNameOrUrl: string,
  pages: CrawledPage[],
  publicContext: string,
  model: string
): Promise<AiCompanyAnalysis> {
  const corpus = pages
    .map((p) => `### ${p.title} (${p.category}) — ${p.url}\n${p.text}`)
    .join('\n\n')
    .slice(0, 18000); // keep within a safe context budget

  const system = `You are a meticulous B2B company research analyst. You only state facts that are supported by the provided website content or search context. If something is unknown, use null (for scalar fields) or an empty array. Respond ONLY with a single valid JSON object matching the schema — no prose, no markdown fences.`;

  const user = `Research target: ${companyNameOrUrl}

WEBSITE CONTENT (crawled pages):
${corpus}

PUBLIC SEARCH CONTEXT (may include contact info, news, directory listings):
${publicContext.slice(0, 4000)}

Return a JSON object with this exact schema:
{
  "summary": "2-4 sentence company summary",
  "productsServices": ["short bullet phrases of core products/services offered"],
  "painPoints": ["AI-inferred customer or market pain points this company's offering addresses or that the company itself likely faces, 3-6 items"],
  "phone": "phone number string or null",
  "address": "postal/HQ address string or null",
  "industryHint": "a short phrase describing the company's industry/category, used later for competitor search"
}`;

  const raw = await callOpenRouter(
    [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    model
  );

  return safeJsonParse<AiCompanyAnalysis>(raw, {
    summary: 'Unable to generate a summary from the available data.',
    productsServices: [],
    painPoints: [],
    phone: null,
    address: null,
    industryHint: ''
  });
}

/** Use AI to distill raw search snippets about competitors into a clean structured list. */
export async function extractCompetitors(
  companyName: string,
  domain: string,
  searchSnippets: string,
  model: string
): Promise<Competitor[]> {
  const system = `You extract structured competitor lists from noisy search-engine snippets. Respond ONLY with a valid JSON object — no prose, no markdown fences.`;

  const user = `Target company: ${companyName} (${domain})

Raw search snippets about competitors/alternatives:
${searchSnippets.slice(0, 6000)}

Identify 3-6 real, distinct companies that are genuine competitors (same country/industry or clearly comparable products/services). Exclude the target company itself, exclude generic listicle sites, exclude social media platforms.

Return JSON:
{
  "competitors": [
    { "name": "Competitor Name", "website": "https://example.com", "reason": "one short phrase why they compete" }
  ]
}`;

  const raw = await callOpenRouter(
    [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    model
  );

  const parsed = safeJsonParse<{ competitors: Competitor[] }>(raw, { competitors: [] });
  return (parsed.competitors || []).filter((c) => c.name && c.website);
}

/** Fetch the list of available models from OpenRouter for the model-selection dropdown. */
export async function listOpenRouterModels(): Promise<string[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    const ids: string[] = (data.data || []).map((m: any) => m.id).filter(Boolean);
    return ids.length ? ids : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}
