'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Book, ReadingProgress, ReaderSettings } from '@/types/reader';
import { DEFAULT_SETTINGS, THEME_CONFIG } from '@/lib/reader/themeConfig';
import { getBookBlob, saveLocalProgress, getLocalProgress, getUserSettings, saveUserSettings } from '@/lib/storage/db';
import { syncProgressToCloud, fetchCloudProgress, isCloudSyncEnabled } from '@/lib/sync/syncService';
import PdfReader from './PdfReader';
import EpubReader from './EpubReader';
import ReaderSettingsDrawer from './ReaderSettingsDrawer';
import { ArrowLeft, SlidersHorizontal, Maximize, Minimize, Cloud, CloudOff, RefreshCw } from 'lucide-react';

interface ReaderShellProps {
  book: Book;
  onBack: () => void;
}

export default function ReaderShell({ book, onBack }: ReaderShellProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestProgressRef = useRef<ReadingProgress | null>(null);

  // 1. Load book blob, progress & settings
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);
      try {
        // Load user settings
        const storedSettings = await getUserSettings();
        if (storedSettings && !isCancelled) {
          setSettings(storedSettings);
        }

        // Load Book Blob from IndexedDB
        const loadedBlob = book.fileBlob || await getBookBlob(book.id);
        if (!isCancelled) {
          setBlob(loadedBlob);
        }

        // Load Local Progress first
        const localProg = await getLocalProgress(book.id);
        if (!isCancelled && localProg) {
          setProgress(localProg);
          latestProgressRef.current = localProg;
        }

        // Try to fetch latest cloud progress (if configured)
        if (isCloudSyncEnabled()) {
          setSyncStatus('syncing');
          const merged = await fetchCloudProgress(book.id, localProg);
          if (!isCancelled && merged) {
            setProgress(merged);
            latestProgressRef.current = merged;
            setSyncStatus('synced');
          }
        } else {
          setSyncStatus('offline');
        }
      } catch (err) {
        console.error('Failed to load book data:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [book.id, book.fileBlob]);

  // 2. Debounced Progress Sync (Local + Cloud)
  const handleLocationChange = useCallback((locator: string, percentage: number, display: string) => {
    const updated: ReadingProgress = {
      bookId: book.id,
      locator,
      percentage,
      pageDisplay: display,
      updatedAt: Date.now(),
    };

    setProgress(updated);
    latestProgressRef.current = updated;

    // Save locally immediately
    saveLocalProgress(updated).catch(console.error);

    // Debounce cloud sync by 1.5s
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (isCloudSyncEnabled()) {
      setSyncStatus('syncing');
      debounceTimerRef.current = setTimeout(async () => {
        const ok = await syncProgressToCloud(updated);
        setSyncStatus(ok ? 'synced' : 'offline');
      }, 1500);
    }
  }, [book.id]);

  // Flush on unmount or before unload
  useEffect(() => {
    const flushSync = () => {
      if (latestProgressRef.current && isCloudSyncEnabled()) {
        syncProgressToCloud(latestProgressRef.current);
      }
    };

    window.addEventListener('beforeunload', flushSync);
    return () => {
      window.removeEventListener('beforeunload', flushSync);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      flushSync();
    };
  }, []);

  // Update Settings
  const handleUpdateSettings = (newPartial: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      saveUserSettings(updated).catch(console.error);
      return updated;
    });
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const themeColors = THEME_CONFIG[settings.theme];

  return (
    <div
      className="relative w-screen h-[100dvh] flex flex-col overflow-hidden select-none transition-colors duration-200"
      style={{ backgroundColor: themeColors.bg, color: themeColors.fg }}
    >
      {/* Top Navigation Bar */}
      <header
        className={`absolute top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out border-b backdrop-blur-md px-4 py-2.5 flex items-center justify-between ${
          showControls ? 'translate-y-0' : '-translate-y-full pointer-events-none'
        }`}
        style={{
          backgroundColor: `${themeColors.cardBg}eb`,
          borderColor: themeColors.border,
          color: themeColors.fg,
        }}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="Back to Library"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="overflow-hidden">
            <h1 className="text-sm sm:text-base font-semibold truncate leading-tight">
              {book.title}
            </h1>
            <p className="text-xs opacity-70 truncate">{book.author}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Cloud Sync Status */}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border"
            style={{ borderColor: themeColors.border }}
            title={
              syncStatus === 'synced'
                ? 'Synced with cloud'
                : syncStatus === 'syncing'
                ? 'Syncing to cloud...'
                : 'Local / Offline mode'
            }
          >
            {syncStatus === 'synced' ? (
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            ) : syncStatus === 'syncing' ? (
              <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 opacity-50" />
            )}
            <span className="hidden sm:inline capitalize opacity-80">{syncStatus}</span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer hidden sm:block"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          {/* Reading Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer"
            title="Reader Display Settings"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Reader (PDF or EPUB) */}
      <main className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 border-3 border-current border-t-transparent rounded-full animate-spin"
              style={{ color: themeColors.fg }}
            />
            <p className="text-sm font-medium opacity-70">Loading book...</p>
          </div>
        ) : !blob ? (
          <div className="text-center p-6 max-w-sm">
            <p className="text-base font-semibold text-rose-500 mb-2">Book file not found in storage</p>
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium"
            >
              Return to Library
            </button>
          </div>
        ) : book.format === 'pdf' ? (
          <PdfReader
            blob={blob}
            initialPage={progress?.locator ? parseInt(progress.locator, 10) || 1 : 1}
            settings={settings}
            onLocationChange={handleLocationChange}
            onToggleControls={() => setShowControls((prev) => !prev)}
          />
        ) : (
          <EpubReader
            blob={blob}
            initialCfi={progress?.locator}
            settings={settings}
            onLocationChange={handleLocationChange}
            onToggleControls={() => setShowControls((prev) => !prev)}
          />
        )}
      </main>

      {/* Bottom Collapsible Bar (Reading Progress & Locator) */}
      <footer
        className={`absolute bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out border-t backdrop-blur-md px-5 py-3 flex items-center justify-between gap-4 ${
          showControls ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
        style={{
          backgroundColor: `${themeColors.cardBg}eb`,
          borderColor: themeColors.border,
          color: themeColors.fg,
        }}
      >
        <span className="text-xs font-mono font-medium opacity-80 whitespace-nowrap">
          {progress?.pageDisplay || (book.format === 'pdf' ? 'Page 1' : 'Beginning')}
        </span>

        {/* Minimal Progress Bar */}
        <div className="flex-1 max-w-md h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress?.percentage || 0))}%` }}
          />
        </div>

        <span className="text-xs font-mono font-semibold opacity-90 whitespace-nowrap">
          {progress?.percentage ?? 0}%
        </span>
      </footer>

      {/* Settings Modal / Drawer */}
      <ReaderSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />
    </div>
  );
}
