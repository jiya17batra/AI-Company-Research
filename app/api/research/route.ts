import { NextRequest, NextResponse } from 'next/server';
import { resolveOfficialWebsite, searchCompanyPublicInfo, searchCompetitors } from '@/lib/serper';
import { crawlWebsite } from '@/lib/crawler';
import { analyzeCompany, extractCompetitors, DEFAULT_MODEL } from '@/lib/openrouter';
import { ResearchResult } from '@/lib/types';

export const maxDuration = 60; // allow long-running crawl + AI calls on Vercel

function isUrl(input: string): boolean {
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`);
    return !!u.hostname.includes('.');
  } catch {
    return false;
  }
}

function guessCompanyNameFromDomain(url: string): string {
  const host = new URL(url).hostname.replace('www.', '');
  const name = host.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = (body.input || '').trim();
    const model: string = body.model || DEFAULT_MODEL;

    if (!input) {
      return NextResponse.json({ error: 'Please provide a company name or website URL.' }, { status: 400 });
    }

    const sources: string[] = [];
    let websiteUrl: string;
    let companyName: string;

    if (isUrl(input)) {
      websiteUrl = input.startsWith('http') ? input : `https://${input}`;
      companyName = guessCompanyNameFromDomain(websiteUrl);
    } else {
      companyName = input;
      const resolved = await resolveOfficialWebsite(input);
      websiteUrl = resolved.url;
      sources.push(...resolved.results.slice(0, 5).map((r) => r.link));
    }

    // 1. Crawl the website
    const crawl = await crawlWebsite(websiteUrl, 8);
    sources.push(...crawl.pages.map((p) => p.url));

    // Try to get a cleaner company name from the homepage title if we started from a URL
    if (isUrl(input) && crawl.pages[0]?.title) {
      const homeTitle = crawl.pages[0].title.split(/[-|·]/)[0].trim();
      if (homeTitle.length > 1 && homeTitle.length < 60) companyName = homeTitle;
    }

    const domain = new URL(websiteUrl).hostname.replace('www.', '');

    // 2. Public search context (contact info, general overview)
    const publicResults = await searchCompanyPublicInfo(companyName, domain).catch(() => []);
    sources.push(...publicResults.map((r) => r.link));
    const publicContext = publicResults.map((r) => `${r.title}: ${r.snippet || ''}`).join('\n');

    // 3. AI analysis of crawled content + public context
    const analysis = await analyzeCompany(companyName, crawl.pages, publicContext, model);

    // 4. Competitor search + AI extraction
    const competitorSearch = await searchCompetitors(companyName, analysis.industryHint || '').catch(
      () => []
    );
    sources.push(...competitorSearch.map((r) => r.link));
    const competitorSnippets = competitorSearch
      .map((r) => `${r.title}: ${r.snippet || ''} (${r.link})`)
      .join('\n');
    const competitors = await extractCompetitors(companyName, domain, competitorSnippets, model).catch(
      () => []
    );

    const result: ResearchResult = {
      input,
      companyInfo: {
        companyName,
        website: websiteUrl,
        phone: analysis.phone,
        address: analysis.address,
        productsServices: analysis.productsServices || [],
        painPoints: analysis.painPoints || [],
        summary: analysis.summary || ''
      },
      competitors,
      crawledPageCount: crawl.pages.length,
      sources: Array.from(new Set(sources)).slice(0, 15),
      model,
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json({ result, skippedPages: crawl.skipped.slice(0, 10) });
  } catch (err: any) {
    console.error('Research error:', err);
    return NextResponse.json(
      { error: err?.message || 'Something went wrong while researching this company.' },
      { status: 500 }
    );
  }
}
