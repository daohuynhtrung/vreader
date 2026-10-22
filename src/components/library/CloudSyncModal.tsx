'use client';

import React, { useState, useEffect } from 'react';
import { getStoredCloudConfig, saveStoredCloudConfig, clearStoredCloudConfig, performFullCloudSync } from '@/lib/sync/syncService';
import { Cloud, X, CheckCircle2, AlertCircle, Copy, ExternalLink } from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export default function CloudSyncModal({ isOpen, onClose, onSyncComplete }: CloudSyncModalProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getStoredCloudConfig();
      if (config) {
        setSupabaseUrl(config.supabaseUrl || '');
        setSupabaseAnonKey(config.supabaseAnonKey || '');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter both Supabase URL and Anon Key.' });
      return;
    }

    saveStoredCloudConfig({
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
    });

    setIsTesting(true);
    setStatusMessage({ type: 'info', text: 'Connecting and syncing...' });

    const result = await performFullCloudSync();
    setIsTesting(false);

    if (result.synced) {
      setStatusMessage({ type: 'success', text: 'Connection successful! Cross-device sync is now active.' });
      if (onSyncComplete) onSyncComplete();
    } else {
      setStatusMessage({ type: 'error', text: result.message });
    }
  };

  const handleDisconnect = () => {
    clearStoredCloudConfig();
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    setStatusMessage({ type: 'info', text: 'Cloud sync disconnected. Operating in local offline mode.' });
    if (onSyncComplete) onSyncComplete();
  };

  const copySqlToClipboard = () => {
    const sql = `-- Supabase schema for vreader
create table if not exists public.books (
  id text primary key,
  title text not null,
  author text default 'Unknown',
  format text not null check (format in ('epub', 'pdf')),
  cover_data_url text,
  file_size bigint default 0,
  total_pages integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.reading_progress (
  book_id text primary key references public.books(id) on delete cascade,
  locator text not null,
  percentage double precision default 0,
  page_display text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.books enable row level security;
alter table public.reading_progress enable row level security;

create policy "Allow all operations for anon on books" on public.books for all using (true) with check (true);
create policy "Allow all operations for anon on reading_progress" on public.reading_progress for all using (true) with check (true);
`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Cross-Device Cloud Sync</h3>
              <p className="text-xs text-zinc-400">100% Free Supabase Backend</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveAndTest} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-800/80 border border-zinc-700/60 rounded-xl focus:outline-hidden focus:border-blue-500 text-zinc-100 placeholder-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Supabase Anon Public API Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-800/80 border border-zinc-700/60 rounded-xl focus:outline-hidden focus:border-blue-500 text-zinc-100 placeholder-zinc-500 font-mono"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isTesting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition-all cursor-pointer shadow-lg shadow-blue-500/20"
            >
              {isTesting ? 'Testing Connection...' : 'Save & Sync Now'}
            </button>
            {supabaseUrl && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="py-2.5 px-3 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-medium transition cursor-pointer"
              >
                Disconnect
              </button>
            )}
          </div>
        </form>

        {/* Free Setup Guide */}
        <div className="mt-6 pt-5 border-t border-zinc-800 text-xs text-zinc-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-300">How to setup in 1 minute (Free):</span>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 hover:underline"
            >
              supabase.com <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <ol className="list-decimal list-inside space-y-1 pl-1 text-zinc-400">
            <li>Create a free Supabase project.</li>
            <li>Go to <strong>Project Settings $\rightarrow$ API</strong> to get Project URL and Anon Key.</li>
            <li>Go to <strong>SQL Editor</strong> and execute the table schema.</li>
          </ol>

          <button
            type="button"
            onClick={() => setShowSql(!showSql)}
            className="mt-2 text-blue-400 hover:text-blue-300 font-medium underline block cursor-pointer"
          >
            {showSql ? 'Hide SQL Schema' : 'View / Copy SQL Schema'}
          </button>

          {showSql && (
            <div className="relative mt-2 p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px] font-mono overflow-x-auto text-zinc-300">
              <button
                type="button"
                onClick={copySqlToClipboard}
                className="absolute top-2 right-2 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1 text-[10px]"
              >
                <Copy className="w-3 h-3" />
                {copiedSql ? 'Copied!' : 'Copy SQL'}
              </button>
              <pre className="pr-16">{`create table public.books (
  id text primary key,
  title text not null,
  author text default 'Unknown',
  format text not null,
  cover_data_url text,
  file_size bigint default 0,
  total_pages integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.reading_progress (
  book_id text primary key references public.books(id) on delete cascade,
  locator text not null,
  percentage double precision default 0,
  page_display text,
  updated_at timestamptz default now()
);`}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
