'use client';

import { useEffect, useRef, useState } from 'react';
import { ResearchResult, DiscordConfig } from '@/lib/types';
import { DEFAULT_MODEL, FALLBACK_MODELS } from '@/lib/openrouter';
import ResearchReport from './ResearchReport';
import DiscordSettings from './DiscordSettings';

type Message =
  | { role: 'user'; content: string; id: string }
  | { role: 'assistant-text'; content: string; id: string }
  | { role: 'assistant-report'; result: ResearchResult; id: string }
  | { role: 'error'; content: string; id: string };

const PROGRESS_STEPS = [
  'Searching Serper.dev for the official website…',
  'Crawling key pages (About, Products, Services, Contact)…',
  'Gathering public context and contact details…',
  'Analyzing content with OpenRouter AI…',
  'Identifying competitors…',
  'Finalizing report…'
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant-text',
      id: uid(),
      content:
        "Hi! I'm your AI Company Research Assistant. Give me a company name (e.g. \"YouTube\") or a website URL (e.g. \"https://youtube.com\") and I'll crawl their site, research them online, find competitors, and generate a downloadable PDF report."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null);
  const [showDiscordSettings, setShowDiscordSettings] = useState(false);
  const [discordConfig, setDiscordConfig] = useState<DiscordConfig>({
    botToken: '',
    channelId: '',
    applicantName: '',
    applicantEmail: ''
  });
  const [discordSending, setDiscordSending] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => d.models?.length && setModels(d.models))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) return;
    setProgressStep(0);
    const interval = setInterval(() => {
      setProgressStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((m) => [...m, { role: 'user', id: uid(), content: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed, model })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Research failed.');
      }

      setMessages((m) => [
        ...m,
        {
          role: 'assistant-text',
          id: uid(),
          content: `Here's what I found for ${data.result.companyInfo.companyName}:`
        },
        { role: 'assistant-report', id: uid(), result: data.result }
      ]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: 'error', id: uid(), content: err?.message || 'Something went wrong.' }
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPdf(result: ResearchResult, msgId: string) {
    setDownloadingFor(msgId);
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
      if (!res.ok) throw new Error('PDF generation failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.companyInfo.companyName.replace(/[^a-z0-9]/gi, '_')}_Research_Report.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Bonus: auto-send to Discord if configured
      if (discordConfig.botToken && discordConfig.channelId) {
        setDiscordSending(msgId);
        await fetch('/api/discord', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...discordConfig, result })
        }).catch(() => {});
        setDiscordSending(null);
      }
    } catch (err: any) {
      setMessages((m) => [...m, { role: 'error', id: uid(), content: err?.message }]);
    } finally {
      setDownloadingFor(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            AI
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Company Research Assistant</h1>
            <p className="text-[11px] text-gray-400">Serper.dev · OpenRouter · PDF · Discord</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="hidden sm:block rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-300 max-w-[180px]"
            title="Select AI model (OpenRouter)"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowDiscordSettings(true)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Discord Settings
          </button>
        </div>
      </header>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              onDownloadPdf={handleDownloadPdf}
              downloading={downloadingFor === msg.id}
              discordSending={discordSending === msg.id}
            />
          ))}

          {loading && (
            <div className="animate-fade-in flex items-center gap-3 rounded-2xl bg-white border border-gray-200 px-4 py-3 max-w-md">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500 animate-pulse-slow" />
              <span className="text-sm text-gray-600">{PROGRESS_STEPS[progressStep]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "YouTube" or "https://youtube.com"'
            disabled={loading}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            Research
          </button>
        </div>
      </form>

      {showDiscordSettings && (
        <DiscordSettings
          config={discordConfig}
          onClose={() => setShowDiscordSettings(false)}
          onSave={(cfg) => {
            setDiscordConfig(cfg);
            setShowDiscordSettings(false);
          }}
        />
      )}
    </div>
  );
}

function MessageRow({
  msg,
  onDownloadPdf,
  downloading,
  discordSending
}: {
  msg: Message;
  onDownloadPdf: (result: ResearchResult, id: string) => void;
  downloading: boolean;
  discordSending: boolean;
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-lg rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === 'assistant-text') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="max-w-lg rounded-2xl rounded-bl-sm bg-white border border-gray-200 px-4 py-2.5 text-sm text-gray-700">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === 'error') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="max-w-lg rounded-2xl rounded-bl-sm bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
          ⚠️ {msg.content}
        </div>
      </div>
    );
  }

  // assistant-report
  return (
    <div className="flex flex-col gap-1 justify-start animate-fade-in">
      <ResearchReport
        result={msg.result}
        onDownloadPdf={() => onDownloadPdf(msg.result, msg.id)}
        downloading={downloading}
      />
      {discordSending && (
        <p className="text-xs text-gray-400 pl-1">Sending report to Discord…</p>
      )}
    </div>
  );
}
