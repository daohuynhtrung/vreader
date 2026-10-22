-- ========================================================
-- vreader: Supabase Database Schema for Free Tier
-- ========================================================
-- Run this script in your Supabase Project -> SQL Editor

-- 1. Create Books Metadata Table
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

-- 2. Create Reading Progress Sync Table (Unique per book)
create table if not exists public.reading_progress (
  book_id text primary key references public.books(id) on delete cascade,
  locator text not null,                -- EPUB CFI string or PDF page number (e.g. "42")
  percentage double precision default 0, -- 0.0 - 100.0
  page_display text,                    -- human-readable "Page 42 of 200" or chapter label
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security (RLS)
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;

-- 4. Allow anonymous access for personal single-user setup (or authenticated if you enable auth)
create policy "Allow all operations for anon on books"
  on public.books
  for all
  using (true)
  with check (true);

create policy "Allow all operations for anon on reading_progress"
  on public.reading_progress
  for all
  using (true)
  with check (true);

-- 5. Realtime Publication (optional: enables instant push sync across active devices)
alter publication supabase_realtime add table public.reading_progress;
