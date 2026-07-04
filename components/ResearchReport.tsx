'use client';

import { ResearchResult } from '@/lib/types';

export default function ResearchReport({
  result,
  onDownloadPdf,
  downloading
}: {
  result: ResearchResult;
  onDownloadPdf: () => void;
  downloading: boolean;
}) {
  const { companyInfo, competitors } = result;

  return (
    <div className="animate-fade-in rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden max-w-2xl">
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-4">
        <h3 className="text-white font-semibold text-lg">{companyInfo.companyName}</h3>
        <a
          href={companyInfo.website}
          target="_blank"
          rel="noreferrer"
          className="text-brand-100 text-sm hover:underline"
        >
          {companyInfo.website}
        </a>
      </div>

      <div className="p-5 space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <InfoField label="Phone" value={companyInfo.phone} />
          <InfoField label="Address" value={companyInfo.address} />
        </div>

        <div>
          <h4 className="font-semibold text-gray-700 mb-1">Summary</h4>
          <p className="text-gray-600 leading-relaxed">{companyInfo.summary}</p>
        </div>

        <Section title="Products / Services" items={companyInfo.productsServices} />
        <Section title="AI-Generated Pain Points" items={companyInfo.painPoints} />

        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Competitors</h4>
          {competitors.length === 0 ? (
            <p className="text-gray-400 italic">No competitors identified.</p>
          ) : (
            <ul className="space-y-2">
              {competitors.map((c, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <div>
                    <p className="font-medium text-gray-800">{c.name}</p>
                    {c.reason && <p className="text-xs text-gray-500">{c.reason}</p>}
                  </div>
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 text-xs font-medium hover:underline whitespace-nowrap ml-3"
                  >
                    Visit ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {result.crawledPageCount} pages crawled · model: {result.model}
          </span>
          <button
            onClick={onDownloadPdf}
            disabled={downloading}
            className="rounded-full bg-brand-600 px-4 py-2 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? 'Preparing PDF…' : 'Download PDF Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-gray-700">{value || 'Not available'}</p>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-700 mb-1">{title}</h4>
      {items.length === 0 ? (
        <p className="text-gray-400 italic">Not available.</p>
      ) : (
        <ul className="list-disc list-inside space-y-0.5 text-gray-600">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
