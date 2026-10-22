import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Book, ReadingProgress, ReaderSettings } from '@/types/reader';

interface VReaderDB extends DBSchema {
  books: {
    key: string;
    value: Omit<Book, 'fileBlob'>;
    indexes: { 'by-date': number };
  };
  bookFiles: {
    key: string;
    value: { id: string; blob: Blob; mimeType: string };
  };
  progress: {
    key: string;
    value: ReadingProgress;
    indexes: { 'by-updated': number };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'vreader-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VReaderDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<VReaderDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only accessible in the browser'));
  }

  if (!dbPromise) {
    dbPromise = openDB<VReaderDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          const bookStore = db.createObjectStore('books', { keyPath: 'id' });
          bookStore.createIndex('by-date', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('bookFiles')) {
          db.createObjectStore('bookFiles', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('progress')) {
          const progressStore = db.createObjectStore('progress', { keyPath: 'bookId' });
          progressStore.createIndex('by-updated', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }

  return dbPromise;
}

// Save book and its binary blob into IndexedDB
export async function saveBook(book: Book, blob?: Blob): Promise<void> {
  const db = await getDB();
  const { fileBlob, ...meta } = book;

  const tx = db.transaction(['books', 'bookFiles'], 'readwrite');
  await tx.objectStore('books').put(meta);

  if (blob || fileBlob) {
    const fileData = blob || fileBlob!;
    await tx.objectStore('bookFiles').put({
      id: book.id,
      blob: fileData,
      mimeType: fileData.type || (book.format === 'pdf' ? 'application/pdf' : 'application/epub+zip'),
    });
  }

  await tx.done;
}

// Get all books metadata
export async function getAllBooks(): Promise<Omit<Book, 'fileBlob'>[]> {
  const db = await getDB();
  const books = await db.getAllFromIndex('books', 'by-date');
  return books.reverse(); // newest first
}

// Get a single book
export async function getBook(id: string): Promise<Omit<Book, 'fileBlob'> | undefined> {
  const db = await getDB();
  return db.get('books', id);
}

// Get book file Blob
export async function getBookBlob(id: string): Promise<Blob | null> {
  const db = await getDB();
  const record = await db.get('bookFiles', id);
  return record ? record.blob : null;
}

// Delete book and its file & progress
export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['books', 'bookFiles', 'progress'], 'readwrite');
  await tx.objectStore('books').delete(id);
  await tx.objectStore('bookFiles').delete(id);
  await tx.objectStore('progress').delete(id);
  await tx.done;
}

// Save Reading Progress
export async function saveLocalProgress(progress: ReadingProgress): Promise<void> {
  const db = await getDB();
  await db.put('progress', progress);
}

// Get Reading Progress for a book
export async function getLocalProgress(bookId: string): Promise<ReadingProgress | undefined> {
  const db = await getDB();
  return db.get('progress', bookId);
}

// Get all reading progress
export async function getAllLocalProgress(): Promise<Record<string, ReadingProgress>> {
  const db = await getDB();
  const all = await db.getAll('progress');
  const map: Record<string, ReadingProgress> = {};
  for (const p of all) {
    map[p.bookId] = p;
  }
  return map;
}

// User settings
export async function saveUserSettings(settings: ReaderSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings, 'reader_settings');
}

export async function getUserSettings(): Promise<ReaderSettings | null> {
  const db = await getDB();
  const settings = await db.get('settings', 'reader_settings');
  return settings || null;
}
