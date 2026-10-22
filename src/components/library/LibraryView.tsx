'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Book, ReadingProgress } from '@/types/reader';
import { getAllBooks, saveBook, deleteBook, getAllLocalProgress } from '@/lib/storage/db';
import { extractBookMeta } from '@/lib/parsers/bookParser';
import { isCloudSyncEnabled, performFullCloudSync } from '@/lib/sync/syncService';
import { createSamplePdfBook } from '@/lib/demo/sampleBook';
import BookCard from './BookCard';
import CloudSyncModal from './CloudSyncModal';
import {
  BookOpen,
  Plus,
  Upload,
  Cloud,
  CloudOff,
  Search,
  BookMarked,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface LibraryViewProps {
  onOpenBook: (book: Book) => void;
}

export default function LibraryView({ onOpenBook }: LibraryViewProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'pdf' | 'epub'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isCloudActive, setIsCloudActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load books & progress
  const loadLibrary = useCallback(async () => {
    try {
      const storedBooks = await getAllBooks();
      setBooks(storedBooks as Book[]);

      const progresses = await getAllLocalProgress();
      setProgressMap(progresses);

      setIsCloudActive(isCloudSyncEnabled());
    } catch (err) {
      console.error('Failed to load library:', err);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Handle file uploads (PDF & EPUB)
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf' && ext !== 'epub') {
        alert(`File ${file.name} is not a supported format (PDF or EPUB only).`);
        continue;
      }

      setUploadStatus(`Parsing ${file.name}...`);
      try {
        const meta = await extractBookMeta(file);
        const bookId = `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const newBook: Book = {
          id: bookId,
          title: meta.title,
          author: meta.author,
          format: meta.format,
          fileBlob: file,
          coverDataUrl: meta.coverDataUrl,
          fileSize: file.size,
          totalPages: meta.totalPages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await saveBook(newBook, file);
      } catch (err) {
        console.error('Failed to process book file:', err);
      }
    }

    setIsUploading(false);
    setUploadStatus('');
    await loadLibrary();
  };

  // Delete book handler
  const handleDeleteBook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this book from your library?')) {
      await deleteBook(id);
      await loadLibrary();
    }
  };

  // Load demo sample guide
  const handleLoadSample = async () => {
    setIsUploading(true);
    setUploadStatus('Generating sample book guide...');
    try {
      const sample = await createSamplePdfBook();
      await loadLibrary();
      onOpenBook(sample);
    } catch (err) {
      console.error('Error generating sample:', err);
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  // Filter books
  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFormat = selectedFormat === 'all' || b.format === selectedFormat;
    return matchesSearch && matchesFormat;
  });

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              vreader
            </h1>
            <p className="text-[11px] text-zinc-400 leading-none">Responsive Web Reader</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Sync Status Button */}
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              isCloudActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
            title="Configure Cross-Device Sync"
          >
            {isCloudActive ? (
              <>
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Sync Active</span>
              </>
            ) : (
              <>
                <CloudOff className="w-4 h-4" />
                <span className="hidden sm:inline">Connect Cloud Sync</span>
              </>
            )}
          </button>

          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub,application/pdf,application/epub+zip"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-97 text-white text-xs sm:text-sm font-medium transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Book</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search books or authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900/80 border border-zinc-800/80 rounded-xl text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800">
            {(['all', 'pdf', 'epub'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setSelectedFormat(fmt)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                  selectedFormat === fmt
                    ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {fmt === 'all' ? 'All Books' : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Upload in Progress Banner */}
        {isUploading && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
            <span className="text-sm text-blue-300 font-medium">
              {uploadStatus || 'Processing uploaded book...'}
            </span>
          </div>
        )}

        {/* Drag and drop overlay indicator */}
        {isDragging && (
          <div className="fixed inset-0 z-50 bg-blue-900/40 border-4 border-dashed border-blue-400 flex flex-col items-center justify-center pointer-events-none backdrop-blur-xs">
            <Upload className="w-16 h-16 text-blue-300 mb-2 animate-bounce" />
            <p className="text-xl font-bold text-white">Drop your PDF or EPUB files here</p>
          </div>
        )}

        {/* Books Grid */}
        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                progress={progressMap[book.id]}
                onSelect={onOpenBook}
                onDelete={handleDeleteBook}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 mb-4 shadow-xl">
              <BookMarked className="w-10 h-10 text-zinc-500" />
            </div>
            <h3 className="text-base font-semibold text-zinc-200 mb-1">
              {searchQuery ? 'No matching books found' : 'Your library is empty'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mb-6">
              Upload your favorite EPUB or PDF books to read them with custom fonts, themes, and
              synced reading progress.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition cursor-pointer shadow-lg shadow-blue-500/20"
              >
                <Upload className="w-4 h-4" />
                Upload PDF or EPUB
              </button>

              <button
                onClick={handleLoadSample}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-sm font-medium transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                Add Quickstart Guide
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Cloud Sync Configuration Modal */}
      <CloudSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={loadLibrary}
      />
    </div>
  );
}
