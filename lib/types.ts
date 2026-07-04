export interface CrawledPage {
  url: string;
  title: string;
  category: string; // home | about | products | services | contact | pricing | other
  text: string;
}

export interface CrawlResult {
  baseUrl: string;
  pages: CrawledPage[];
  skipped: string[]; // urls ignored (duplicates / login / irrelevant)
}

export interface Competitor {
  name: string;
  website: string;
  reason?: string;
}

export interface CompanyInfo {
  companyName: string;
  website: string;
  phone: string | null;
  address: string | null;
  productsServices: string[];
  painPoints: string[];
  summary: string;
}

export interface ResearchResult {
  input: string;
  companyInfo: CompanyInfo;
  competitors: Competitor[];
  crawledPageCount: number;
  sources: string[];
  model: string;
  generatedAt: string;
}

export interface DiscordConfig {
  botToken: string;
  channelId: string;
  applicantName: string;
  applicantEmail: string;
}
