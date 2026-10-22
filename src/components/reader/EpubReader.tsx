'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ReaderSettings } from '@/types/reader';
import { THEME_CONFIG, FONT_CONFIG } from '@/lib/reader/themeConfig';

interface EpubReaderProps {
  blob: Blob;
  initialCfi?: string;
  settings: ReaderSettings;
  onLocationChange: (locator: string, percentage: number, display: string) => void;
  onToggleControls: () => void;
}

export default function EpubReader({
  blob,
  initialCfi,
  settings,
  onLocationChange,
  onToggleControls,
}: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and render EPUB
  useEffect(() => {
    let isCancelled = false;

    async function initEpub() {
      if (!viewerRef.current) return;
      setIsLoading(true);

      try {
        const ePub = (await import('epubjs')).default;
        const arrayBuffer = await blob.arrayBuffer();

        const book = ePub(arrayBuffer);
        bookRef.current = book;

        await book.ready;
        if (isCancelled) return;

        // Generate locations for accurate percentage calculations
        book.locations.generate(1024).catch(() => {});

        // Render to container
        const rendition = book.renderTo(viewerRef.current!, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
        });
        renditionRef.current = rendition;

        // Handle location change / CFI tracking
        rendition.on('relocated', (location: any) => {
          if (!location || !location.start) return;
          const cfi = location.start.cfi;
          let percentage = 0;
          try {
            if (book.locations && book.locations.length() > 0) {
              percentage = Math.round(book.locations.percentageFromCfi(cfi) * 100);
            }
          } catch {
            percentage = Math.round((location.start.percentage || 0) * 100);
          }

          const pageDisplay = `${percentage}% completed`;
          onLocationChange(cfi, percentage, pageDisplay);
        });

        // Register themes and styling
        applyStyles(rendition, settings);

        // Capture tap / swipe events inside the EPUB iframe
        rendition.on('rendered', (_section: any, iframeView: any) => {
          const doc = iframeView?.document;
          if (!doc) return;

          let startX = 0;
          let startY = 0;

          doc.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
              startX = e.touches[0].clientX;
              startY = e.touches[0].clientY;
            }
          }, { passive: true });

          doc.addEventListener('touchend', (e: TouchEvent) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const width = doc.documentElement.clientWidth || window.innerWidth;

            if (Math.abs(deltaX) > 40 && Math.abs(deltaY) < 80) {
              // Swipe
              if (deltaX < 0) rendition.next();
              else rendition.prev();
            } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
              // Tap: left 25%, right 25%, center 50%
              if (endX < width * 0.25) {
                rendition.prev();
              } else if (endX > width * 0.75) {
                rendition.next();
              } else {
                onToggleControls();
              }
            }
          }, { passive: true });

          doc.addEventListener('click', (e: MouseEvent) => {
            const width = doc.documentElement.clientWidth || window.innerWidth;
            if (e.clientX < width * 0.25) {
              rendition.prev();
            } else if (e.clientX > width * 0.75) {
              rendition.next();
            } else {
              onToggleControls();
            }
          });
        });

        // Display at initial location or start of book
        if (initialCfi) {
          await rendition.display(initialCfi);
        } else {
          await rendition.display();
        }

        if (!isCancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error rendering EPUB:', err);
        if (!isCancelled) setIsLoading(false);
      }
    }

    initEpub();

    return () => {
      isCancelled = true;
      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, [blob]);

  // Apply theme & font settings dynamically
  const applyStyles = useCallback((rendition: any, currentSettings: ReaderSettings) => {
    if (!rendition) return;

    const colors = THEME_CONFIG[currentSettings.theme];
    const font = FONT_CONFIG[currentSettings.fontFamily];

    rendition.themes.default({
      'html, body': {
        'background-color': `${colors.bg} !important`,
        'color': `${colors.fg} !important`,
        'font-family': `${font.cssFamily} !important`,
        'font-size': `${currentSettings.fontSize}% !important`,
        'line-height': `${currentSettings.lineHeight} !important`,
        'padding': `0 ${currentSettings.margin}px !important`,
        'box-sizing': 'border-box !important',
      },
      'p': {
        'margin-bottom': '1em !important',
        'line-height': `${currentSettings.lineHeight} !important`,
      },
      'img, svg, image': {
        'max-width': '100% !important',
        'height': 'auto !important',
        'object-fit': 'contain !important',
        'margin': '1em auto !important',
        'display': 'block !important',
      },
      'a': {
        'color': 'inherit !important',
        'text-decoration': 'underline !important',
      },
    });
  }, []);

  // Update styles when settings change
  useEffect(() => {
    if (renditionRef.current) {
      applyStyles(renditionRef.current, settings);
    }
  }, [settings, applyStyles]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!renditionRef.current) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        renditionRef.current.next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        renditionRef.current.prev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const themeColors = THEME_CONFIG[settings.theme];

  return (
    <div
      className="relative flex-1 w-full h-full flex flex-col items-center justify-center overflow-hidden select-none transition-colors duration-200"
      style={{ backgroundColor: themeColors.bg }}
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-inherit">
          <div
            className="w-8 h-8 border-3 border-current border-t-transparent rounded-full animate-spin"
            style={{ color: themeColors.fg }}
          />
          <p className="text-sm font-medium opacity-80" style={{ color: themeColors.fg }}>Opening EPUB...</p>
        </div>
      )}

      {/* EPUB Render Viewport Container */}
      <div
        ref={viewerRef}
        className="w-full h-full max-w-4xl mx-auto flex-1"
        style={{
          padding: `8px ${settings.margin}px`,
        }}
      />
    </div>
  );
}
