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
  file_key text,             -- storage path for the book file in 'book-files' bucket
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

-- 3. Create User Settings Table (singleton row keyed by 'reader_settings')
create table if not exists public.user_settings (
  key text primary key default 'reader_settings',
  theme text default 'dark',
  font_family text default 'sans',
  font_size integer default 100,
  line_height double precision default 1.6,
  margin integer default 20,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable Row Level Security (RLS)
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;
alter table public.user_settings enable row level security;

-- 5. Allow anonymous access for personal single-user setup (or authenticated if you enable auth)
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

create policy "Allow all operations for anon on user_settings"
  on public.user_settings
  for all
  using (true)
  with check (true);

-- 6. Realtime Publication (optional: enables instant push sync across active devices)
alter publication supabase_realtime add table public.reading_progress;

-- 7. Create Storage Bucket for Book Files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-files',
  'book-files',
  false,
  52428800,  -- 50MB max per file
  array['application/pdf', 'application/epub+zip', 'application/octet-stream']
)
on conflict (id) do nothing;

-- 8. Storage Bucket RLS Policies (allow anon access for personal single-user setup)
create policy "Allow anon upload to book-files"
  on storage.objects
  for insert
  with check (bucket_id = 'book-files');

create policy "Allow anon read from book-files"
  on storage.objects
  for select
  using (bucket_id = 'book-files');

create policy "Allow anon update in book-files"
  on storage.objects
  for update
  using (bucket_id = 'book-files');

create policy "Allow anon delete from book-files"
  on storage.objects
  for delete
  using (bucket_id = 'book-files');
