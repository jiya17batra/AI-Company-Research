# AI Company Research Assistant

An AI-powered app that researches any company — by name or website URL — by crawling
its site, searching the public web via **Serper.dev**, analyzing everything with an
**OpenRouter**-hosted AI model, identifying competitors, and generating a downloadable,
professional **PDF report**. Built as a single Next.js 14 (App Router) project with a
ChatGPT-style interface, ready to deploy to Vercel/Netlify/Cloudflare.

> Built with AI as a co-pilot per the assignment brief — architecture, data flow, and
> the crawler/PDF logic below were designed and debugged (see "Testing notes")
> iteratively rather than accepted blindly.

---

## 1. Feature checklist (maps to the assignment spec)

| Requirement | Where it lives |
|---|---|
| Company name **or** URL input | `app/api/research/route.ts` → `isUrl()` |
| Resolve official website from a name | `lib/serper.ts` → `resolveOfficialWebsite()` |
| Website crawler (About/Products/Services/Contact/Pricing) | `lib/crawler.ts` |
| Ignore duplicates / login pages / irrelevant pages | `lib/crawler.ts` (`IGNORE_PATTERNS`, `normalizeUrl`, `visited` set) |
| Serper.dev search integration | `lib/serper.ts` |
| OpenRouter AI integration + model selection | `lib/openrouter.ts`, model `<select>` in `ChatInterface.tsx`, `app/api/models/route.ts` |
| Company summary, products/services, pain points | `analyzeCompany()` in `lib/openrouter.ts` |
| Competitor analysis (name + website) | `extractCompetitors()` in `lib/openrouter.ts` |
| ChatGPT-style interactive interface | `components/ChatInterface.tsx` |
| Downloadable PDF report | `lib/pdf.ts` + `app/api/pdf/route.ts` |
| Discord integration (bonus) | `components/DiscordSettings.tsx` + `app/api/discord/route.ts` |
| No auth / no DB | Confirmed — all state is in-memory/React state per session |

---

## 2. Architecture & data flow

```
User types "YouTube" or a URL
        │
        ▼
POST /api/research  ────────────────────────────────────────────┐
   │                                                             │
   ├─ 1. If input is a name → Serper.dev "official website"     │
   │      search → pick best-matching non-aggregator domain     │
   │                                                             │
   ├─ 2. Crawl the resolved site (lib/crawler.ts)                │
   │      • fetch homepage, discover on-site links                │
   │      • classify by keyword: about/products/services/         │
   │        solutions/contact/pricing                             │
   │      • normalize + de-dupe URLs, skip login/legal/binary      │
   │      • strip <script>/<style>/<nav>/<footer>, extract text   │
   │                                                             │
   ├─ 3. Serper.dev "public info" search (contact/context)        │
   │                                                             │
   ├─ 4. OpenRouter AI call #1 (analyzeCompany):                  │
   │      crawled text + public snippets → JSON:                  │
   │      { summary, productsServices[], painPoints[],            │
   │        phone, address, industryHint }                        │
   │                                                             │
   ├─ 5. Serper.dev "competitors" search using industryHint        │
   │                                                             │
   ├─ 6. OpenRouter AI call #2 (extractCompetitors):               │
   │      noisy search snippets → clean [{name, website, reason}] │
   │                                                             │
   └─ 7. Return ResearchResult JSON ─────────────────────────────┘
        │
        ▼
Chat UI renders a ResearchReport card
        │
        ├─ "Download PDF" → POST /api/pdf (lib/pdf.ts, pdf-lib) → file download
        │
        └─ if Discord configured → POST /api/discord
              (posts summary + PDF attachment to the channel via Bot API)
```

Nothing is persisted server-side — the full `ResearchResult` JSON is round-tripped from
the browser to `/api/pdf` and `/api/discord` when needed, so there's no database and no
report history, per the assignment's constraints.

---

## 3. Walkthrough example: researching "YouTube"

This traces exactly what happens when you type **"YouTube"** into the chat box (or
`https://youtube.com` — both are supported).

1. **Input detection** — `"YouTube"` isn't a URL, so the app treats it as a company name.
2. **Resolve website** — Serper.dev is queried for `"YouTube official website"`. The
   resolver filters out aggregators (Wikipedia, LinkedIn, Crunchbase, etc.) and scores
   remaining results by domain-name similarity, landing on `https://www.youtube.com`.
3. **Crawl** — the crawler fetches the homepage, discovers on-site links, and (based on
   keyword matching) prioritizes pages like `/about`, `/creators`, `/ads`, `/premium`,
   and any pricing/contact pages the site exposes — while skipping login, legal, and
   duplicate URLs. Each page's visible text is extracted and capped for token budget.
4. **Public search context** — a second Serper.dev call looks for contact details and a
   general company overview to backfill anything the crawl missed.
5. **AI analysis (OpenRouter)** — the crawled text + search context is sent to your
   selected model (default `openai/gpt-4o-mini`) with a strict JSON schema prompt,
   returning a summary, products/services list, AI-inferred pain points, and an
   `industryHint` (e.g. "online video hosting and streaming").
6. **Competitor search + extraction** — Serper.dev is queried for
   `"top competitors and alternatives to YouTube online video hosting and streaming"`,
   and a second AI call distills the noisy snippets into a clean list — typically
   platforms like Vimeo, TikTok, Twitch, or Dailymotion, depending on what the live
   search returns that day.
7. **Report card** renders in the chat with all fields, plus a **Download PDF Report**
   button that calls `/api/pdf` to generate a formatted, multi-section PDF on the fly.

> Note: steps 2–6 require live `SERPER_API_KEY` / `OPENROUTER_API_KEY` credentials to
> actually hit the network — see Setup below. The crawler and PDF generator were unit
> tested locally against a mock site during development (see "Testing notes").

---

## 4. Setup

### Prerequisites
- Node.js ≥ 18.17
- A [Serper.dev](https://serper.dev) API key
- An [OpenRouter](https://openrouter.ai/keys) API key

### Install & run locally

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste in your SERPER_API_KEY and OPENROUTER_API_KEY
npm run dev
# open http://localhost:3000
```

### Build for production

```bash
npm run build
npm start
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `SERPER_API_KEY` | Yes | Search API key from serper.dev, used for website resolution, public info, and competitor search |
| `OPENROUTER_API_KEY` | Yes | AI API key from openrouter.ai, used for all analysis/extraction calls |
| `NEXT_PUBLIC_APP_URL` | No | Sent as `HTTP-Referer` to OpenRouter; set to your deployed URL in production |

Discord Bot Token and Channel ID are **not** environment variables — per the assignment,
they're entered by the evaluator at runtime in the in-app "Discord Settings" panel, kept
only in browser session state, and sent straight to Discord's API when a report is
generated.

### Deploying (Vercel example)

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add `SERPER_API_KEY` and `OPENROUTER_API_KEY` as Environment Variables in the Vercel
   project settings.
4. Deploy. The app is a single unified Next.js project — API routes and frontend ship
   together, no separate backend needed.

(Netlify/Cloudflare Pages work the same way — set the two env vars and deploy; API
routes run as serverless/edge functions on all three platforms.)

---

## 5. Project structure

```
company-research-assistant/
├── app/
│   ├── page.tsx                  # renders the chat UI
│   ├── layout.tsx, globals.css
│   └── api/
│       ├── research/route.ts     # main orchestration endpoint
│       ├── models/route.ts       # lists OpenRouter models for the dropdown
│       ├── pdf/route.ts          # generates & streams the PDF report
│       └── discord/route.ts      # bonus: posts report + PDF to Discord
├── components/
│   ├── ChatInterface.tsx         # chat state, input, progress indicator, model picker
│   ├── ResearchReport.tsx        # renders a completed report card
│   └── DiscordSettings.tsx       # bonus: bot token / channel ID / applicant info modal
├── lib/
│   ├── types.ts                  # shared TypeScript interfaces
│   ├── serper.ts                 # Serper.dev search integration
│   ├── crawler.ts                # website crawler (cheerio-based)
│   ├── openrouter.ts             # OpenRouter AI calls + model listing
│   └── pdf.ts                    # PDF report generation (pdf-lib)
├── .env.example
└── README.md
```

---

## 6. Testing notes

During development the crawler was unit-tested against a local mock company site (5
sub-pages + a login page + a duplicate link) before wiring it to live APIs. That test
caught a real bug: `extractText()` strips `<nav>`/`<footer>` from the parsed DOM as a
side effect, and it was originally being called *before* link discovery — so navigation
links were vanishing before the crawler could find them. Link discovery now runs first;
after the fix, the crawler correctly found all 5 relevant sub-pages, de-duplicated a
repeated link, and skipped the login and legal pages. The `npm run build` production
build also compiles cleanly with zero type errors.

Live end-to-end runs (actually hitting youtube.com, Serper.dev, and OpenRouter) require
the two API keys above, since this sandboxed dev environment has restricted outbound
network access.

---

## 7. Notes on design choices

- **PDF generation** uses `pdf-lib` (not a headless browser) so it works in serverless
  environments without needing Chromium — this keeps deploys on Vercel/Netlify simple
  and fast.
- **Model selection** fetches the live model list from OpenRouter's `/models` endpoint
  on page load, falling back to a curated list if that call fails, so the dropdown never
  breaks even without connectivity.
- **Crawler ranking** prioritizes keyword-matched pages (about/products/services/
  contact/pricing) over generic "other" pages when trimming to `maxPages`, since those
  are the pages the assignment explicitly asks for.
- **No database, no auth** — by design, matching the assignment's constraints. All
  research state lives in React state for the duration of the session; PDF/Discord
  requests simply re-send the already-computed JSON result.
