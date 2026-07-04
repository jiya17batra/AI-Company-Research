'use client';

import { useState } from 'react';
import { DiscordConfig } from '@/lib/types';

export default function DiscordSettings({
  config,
  onSave,
  onClose
}: {
  config: DiscordConfig;
  onSave: (config: DiscordConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DiscordConfig>(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Discord Integration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          After a report is generated, it will be automatically posted — with the PDF attached — to
          this Discord channel.
        </p>

        <div className="space-y-3">
          <Field
            label="Discord Bot Token"
            type="password"
            value={form.botToken}
            onChange={(v) => setForm({ ...form, botToken: v })}
            placeholder="Bot token provided by evaluator"
          />
          <Field
            label="Discord Channel ID"
            value={form.channelId}
            onChange={(v) => setForm({ ...form, channelId: v })}
            placeholder="e.g. 1234567890123456"
          />
          <Field
            label="Applicant Name"
            value={form.applicantName}
            onChange={(v) => setForm({ ...form, applicantName: v })}
            placeholder="Your full name"
          />
          <Field
            label="Applicant Email"
            value={form.applicantEmail}
            onChange={(v) => setForm({ ...form, applicantEmail: v })}
            placeholder="you@example.com"
          />
        </div>

        <button
          onClick={() => onSave(form)}
          className="mt-5 w-full rounded-full bg-brand-600 py-2.5 text-white font-medium hover:bg-brand-700 transition-colors"
        >
          Save Configuration
        </button>
        <p className="mt-2 text-[11px] text-gray-400 text-center">
          Stored only in this browser session — never sent anywhere except Discord's API.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text'
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </div>
  );
}
