import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReadingProgress, Book } from '@/types/reader';
import { saveLocalProgress, saveBook, getAllBooks, getAllLocalProgress } from '@/lib/storage/db';

const STORAGE_SYNC_KEY = 'vreader_cloud_sync_config';

export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userEmail?: string;
  deviceId?: string;
}

let supabaseClient: SupabaseClient | null = null;

export function getStoredCloudConfig(): CloudConfig | null {
  if (typeof window === 'undefined') return null;

  // 1. Try env vars first
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return {
      supabaseUrl: envUrl,
      supabaseAnonKey: envKey,
    };
  }

  // 2. Try localStorage custom config
  try {
    const raw = localStorage.getItem(STORAGE_SYNC_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse cloud sync config', err);
  }

  return null;
}

export function saveStoredCloudConfig(config: CloudConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(config));
  supabaseClient = null; // reset cached client
}

export function clearStoredCloudConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_SYNC_KEY);
  supabaseClient = null;
}

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const config = getStoredCloudConfig();
  if (config?.supabaseUrl && config?.supabaseAnonKey) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
      return supabaseClient;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
    }
  }
  return null;
}

export function isCloudSyncEnabled(): boolean {
  return !!getSupabase();
}

/**
 * Sync reading progress to Supabase
 * Debounced sync or direct call
 */
export async function syncProgressToCloud(progress: ReadingProgress): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    // Upsert reading progress by bookId
    const { error } = await supabase.from('reading_progress').upsert({
      book_id: progress.bookId,
      locator: progress.locator,
      percentage: progress.percentage,
      page_display: progress.pageDisplay,
      updated_at: new Date(progress.updatedAt).toISOString(),
    }, { onConflict: 'book_id' });

    if (error) {
      console.warn('Cloud sync error for progress:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception during cloud progress sync:', err);
    return false;
  }
}

/**
 * Fetch latest progress from cloud and merge with local progress
 * Returns the latest progress (whichever was updated more recently)
 */
export async function fetchCloudProgress(bookId: string, localProgress?: ReadingProgress): Promise<ReadingProgress | null> {
  const supabase = getSupabase();
  if (!supabase) return localProgress || null;

  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('*')
      .eq('book_id', bookId)
      .maybeSingle();

    if (error || !data) {
      return localProgress || null;
    }

    const cloudUpdated = new Date(data.updated_at).getTime();
    if (!localProgress || cloudUpdated > localProgress.updatedAt) {
      const merged: ReadingProgress = {
        bookId: data.book_id,
        locator: data.locator,
        percentage: Number(data.percentage) || 0,
        pageDisplay: data.page_display,
        updatedAt: cloudUpdated,
      };
      await saveLocalProgress(merged);
      return merged;
    }

    return localProgress;
  } catch (err) {
    console.warn('Failed to fetch cloud progress:', err);
    return localProgress || null;
  }
}

/**
 * Sync all books and progress on app open
 */
export async function performFullCloudSync(): Promise<{ synced: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { synced: false, message: 'Cloud sync is not configured yet (operating in offline/local mode).' };
  }

  try {
    // 1. Fetch remote progress
    const { data: remoteProgress, error: pError } = await supabase.from('reading_progress').select('*');
    if (!pError && remoteProgress) {
      const localProgressMap = await getAllLocalProgress();

      for (const row of remoteProgress) {
        const cloudUpdated = new Date(row.updated_at).getTime();
        const local = localProgressMap[row.book_id];

        if (!local || cloudUpdated > local.updatedAt) {
          await saveLocalProgress({
            bookId: row.book_id,
            locator: row.locator,
            percentage: Number(row.percentage) || 0,
            pageDisplay: row.page_display,
            updatedAt: cloudUpdated,
          });
        }
      }
    }

    return { synced: true, message: 'Successfully synced with cloud!' };
  } catch (err: any) {
    return { synced: false, message: err?.message || 'Sync failed.' };
  }
}
