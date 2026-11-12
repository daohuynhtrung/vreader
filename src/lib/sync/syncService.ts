import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReadingProgress, Book, ReaderSettings } from '@/types/reader';
import {
  saveLocalProgress,
  saveBook,
  getAllBooks,
  getAllLocalProgress,
  getBookBlob,
  saveUserSettings as saveLocalSettings,
  getUserSettings as getLocalSettings,
} from '@/lib/storage/db';

const STORAGE_SYNC_KEY = 'vreader_cloud_sync_config';
const BOOK_FILES_BUCKET = 'book-files';

export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userEmail?: string;
  deviceId?: string;
}

let supabaseClient: SupabaseClient | null = null;

// ─── Cloud Config Management ────────────────────────────────────────────────

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

// ─── Reading Progress Sync ──────────────────────────────────────────────────

/**
 * Sync reading progress to Supabase
 */
export async function syncProgressToCloud(progress: ReadingProgress): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
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

// ─── Book Metadata Sync ─────────────────────────────────────────────────────

/**
 * Upsert book metadata to Supabase `books` table
 */
export async function syncBookMetadataToCloud(book: Omit<Book, 'fileBlob'>): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('books').upsert({
      id: book.id,
      title: book.title,
      author: book.author,
      format: book.format,
      cover_data_url: book.coverDataUrl || null,
      file_key: book.fileKey || null,
      file_size: book.fileSize,
      total_pages: book.totalPages || null,
      created_at: new Date(book.createdAt).toISOString(),
      updated_at: new Date(book.updatedAt).toISOString(),
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Cloud sync error for book metadata:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception during cloud book metadata sync:', err);
    return false;
  }
}

/**
 * Delete book metadata and file from Supabase
 */
export async function deleteBookFromCloud(bookId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    // 1. Fetch the book to get file_key for storage cleanup
    const { data: bookData } = await supabase
      .from('books')
      .select('file_key')
      .eq('id', bookId)
      .maybeSingle();

    // 2. Delete the file from storage if it exists
    if (bookData?.file_key) {
      await supabase.storage.from(BOOK_FILES_BUCKET).remove([bookData.file_key]);
    }

    // 3. Delete book metadata (cascade deletes reading_progress)
    const { error } = await supabase.from('books').delete().eq('id', bookId);
    if (error) {
      console.warn('Cloud delete error for book:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Exception during cloud book delete:', err);
    return false;
  }
}

// ─── Book File Storage ──────────────────────────────────────────────────────

/**
 * Upload a book file blob to Supabase Storage bucket
 * Returns the storage file key on success, null on failure
 */
export async function uploadBookFileToCloud(bookId: string, blob: Blob, format: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const ext = format === 'pdf' ? 'pdf' : 'epub';
    const mimeType = format === 'pdf' ? 'application/pdf' : 'application/epub+zip';
    const fileKey = `${bookId}.${ext}`;

    const { error } = await supabase.storage
      .from(BOOK_FILES_BUCKET)
      .upload(fileKey, blob, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn('Cloud upload error for book file:', error.message);
      return null;
    }

    return fileKey;
  } catch (err) {
    console.warn('Exception during cloud book file upload:', err);
    return null;
  }
}

/**
 * Download a book file blob from Supabase Storage
 */
export async function downloadBookFileFromCloud(fileKey: string): Promise<Blob | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.storage
      .from(BOOK_FILES_BUCKET)
      .download(fileKey);

    if (error || !data) {
      console.warn('Cloud download error for book file:', error?.message);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('Exception during cloud book file download:', err);
    return null;
  }
}

// ─── User Settings Sync ─────────────────────────────────────────────────────

/**
 * Sync reader settings to Supabase
 */
export async function syncSettingsToCloud(settings: ReaderSettings): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('user_settings').upsert({
      key: 'reader_settings',
      theme: settings.theme,
      font_family: settings.fontFamily,
      font_size: settings.fontSize,
      line_height: settings.lineHeight,
      margin: settings.margin,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    if (error) {
      console.warn('Cloud sync error for settings:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception during cloud settings sync:', err);
    return false;
  }
}

/**
 * Fetch reader settings from cloud and merge with local settings
 */
export async function fetchCloudSettings(localSettings: ReaderSettings | null): Promise<ReaderSettings | null> {
  const supabase = getSupabase();
  if (!supabase) return localSettings;

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('key', 'reader_settings')
      .maybeSingle();

    if (error || !data) {
      return localSettings;
    }

    // Cloud settings exist — use them (cloud is source of truth for settings)
    const cloudSettings: ReaderSettings = {
      theme: data.theme,
      fontFamily: data.font_family,
      fontSize: data.font_size,
      lineHeight: data.line_height,
      margin: data.margin,
    };

    // Save cloud settings to local
    await saveLocalSettings(cloudSettings);
    return cloudSettings;
  } catch (err) {
    console.warn('Failed to fetch cloud settings:', err);
    return localSettings;
  }
}

// ─── Sync a Single Book (metadata + file) ───────────────────────────────────

/**
 * Upload a book's metadata and file to cloud.
 * Updates the local book record with the resulting fileKey.
 */
export async function syncBookToCloud(book: Book, blob?: Blob): Promise<boolean> {
  if (!isCloudSyncEnabled()) return false;

  try {
    // 1. Upload the file if we have a blob and no existing fileKey
    let fileKey = book.fileKey || null;

    if (!fileKey) {
      const fileBlob = blob || await getBookBlob(book.id);
      if (fileBlob) {
        fileKey = await uploadBookFileToCloud(book.id, fileBlob, book.format);
      }
    }

    // 2. Update the book record with fileKey
    const bookToSync = { ...book, fileKey: fileKey || undefined };
    delete (bookToSync as any).fileBlob; // don't send blob in metadata

    // 3. Sync metadata
    const ok = await syncBookMetadataToCloud(bookToSync);

    // 4. Save fileKey locally if we got one
    if (fileKey && fileKey !== book.fileKey) {
      const updatedBook: Book = { ...book, fileKey };
      delete (updatedBook as any).fileBlob;
      await saveBook(updatedBook);
    }

    return ok;
  } catch (err) {
    console.warn('Exception syncing book to cloud:', err);
    return false;
  }
}

// ─── Full Bidirectional Sync ────────────────────────────────────────────────

/**
 * Sync all books, progress, and settings between local and cloud.
 * Called on app open or when user connects Supabase.
 */
export async function performFullCloudSync(): Promise<{ synced: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { synced: false, message: 'Cloud sync is not configured yet (operating in offline/local mode).' };
  }

  try {
    // ──────────── 1. Sync Reading Progress (bidirectional) ────────────
    const { data: remoteProgress, error: pError } = await supabase.from('reading_progress').select('*');
    if (!pError && remoteProgress) {
      const localProgressMap = await getAllLocalProgress();

      for (const row of remoteProgress) {
        const cloudUpdated = new Date(row.updated_at).getTime();
        const local = localProgressMap[row.book_id];

        if (!local || cloudUpdated > local.updatedAt) {
          // Cloud is newer → update local
          await saveLocalProgress({
            bookId: row.book_id,
            locator: row.locator,
            percentage: Number(row.percentage) || 0,
            pageDisplay: row.page_display,
            updatedAt: cloudUpdated,
          });
        } else if (local && local.updatedAt > cloudUpdated) {
          // Local is newer → push to cloud
          await syncProgressToCloud(local);
        }
      }

      // Push any local progress that doesn't exist in cloud
      const remoteBookIds = new Set(remoteProgress.map((r: any) => r.book_id));
      for (const [bookId, localProg] of Object.entries(localProgressMap)) {
        if (!remoteBookIds.has(bookId)) {
          await syncProgressToCloud(localProg);
        }
      }
    }

    // ──────────── 2. Sync Book Metadata (bidirectional) ──────────────
    const { data: remoteBooks, error: bError } = await supabase.from('books').select('*');
    const localBooks = await getAllBooks();
    const localBooksMap = new Map(localBooks.map(b => [b.id, b]));

    if (!bError && remoteBooks) {
      const remoteBooksMap = new Map(remoteBooks.map((r: any) => [r.id, r]));

      // Pull cloud-only books to local (metadata + download file)
      for (const row of remoteBooks) {
        if (!localBooksMap.has(row.id)) {
          // Book exists in cloud but not locally → pull it
          const newBook: Book = {
            id: row.id,
            title: row.title,
            author: row.author || 'Unknown',
            format: row.format,
            fileKey: row.file_key || undefined,
            coverDataUrl: row.cover_data_url || undefined,
            fileSize: Number(row.file_size) || 0,
            totalPages: row.total_pages || undefined,
            createdAt: new Date(row.created_at).getTime(),
            updatedAt: new Date(row.updated_at).getTime(),
          };

          // Download the file from storage if available
          let fileBlob: Blob | null = null;
          if (row.file_key) {
            fileBlob = await downloadBookFileFromCloud(row.file_key);
          }

          await saveBook(newBook, fileBlob || undefined);
        }
      }

      // Push local-only books to cloud
      for (const localBook of localBooks) {
        if (!remoteBooksMap.has(localBook.id)) {
          await syncBookToCloud(localBook as Book);
        }
      }
    } else if (localBooks.length > 0) {
      // Could not fetch remote books but we have local ones → push them all
      for (const localBook of localBooks) {
        await syncBookToCloud(localBook as Book);
      }
    }

    // ──────────── 3. Sync User Settings ─────────────────────────────
    const localSettings = await getLocalSettings();
    if (localSettings) {
      await syncSettingsToCloud(localSettings);
    }
    await fetchCloudSettings(localSettings);

    return { synced: true, message: 'Successfully synced with cloud!' };
  } catch (err: any) {
    return { synced: false, message: err?.message || 'Sync failed.' };
  }
}
