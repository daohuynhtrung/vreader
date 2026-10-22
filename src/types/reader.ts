export type BookFormat = 'epub' | 'pdf';

export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'oled';

export type ReaderFontFamily = 'sans' | 'serif' | 'merriweather' | 'literata' | 'mono';

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  fileBlob?: Blob;
  fileKey?: string; // remote storage key
  coverDataUrl?: string;
  fileSize: number;
  totalPages?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingProgress {
  bookId: string;
  locator: string; // EPUB CFI string or PDF page number (e.g. "5")
  percentage: number; // 0.0 - 100.0
  pageDisplay?: string; // e.g. "Page 15 of 240" or "Chapter 3 - 34%"
  updatedAt: number;
}

export interface ReaderSettings {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: number; // percentage (80 - 200, default 100)
  lineHeight: number; // multiplier (1.2 - 2.2, default 1.6)
  margin: number; // px horizontal padding (8 - 48, default 20)
}

export interface CloudSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userId?: string;
  enabled: boolean;
}
