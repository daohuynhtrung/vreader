'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ReaderSettings } from '@/types/reader';
import { THEME_CONFIG } from '@/lib/reader/themeConfig';

interface PdfReaderProps {
  blob: Blob;
  initialPage?: number;
  settings: ReaderSettings;
  onLocationChange: (locator: string, percentage: number, display: string) => void;
  onToggleControls: () => void;
  onTotalPagesDetected?: (pages: number) => void;
}

export default function PdfReader({
  blob,
  initialPage = 1,
  settings,
  onLocationChange,
  onToggleControls,
  onTotalPagesDetected,
}: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const renderTaskRef = useRef<any>(null);

  // Touch tracking for mobile swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // 1. Load PDF Document from Blob
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setIsLoading(true);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }

        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;

        if (isCancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        if (onTotalPagesDetected) {
          onTotalPagesDetected(doc.numPages);
        }

        const targetPage = Math.min(Math.max(1, initialPage), doc.numPages);
        setCurrentPage(targetPage);
      } catch (err) {
        console.error('Error loading PDF document:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [blob, initialPage, onTotalPagesDetected]);

  // 2. Render Current Page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      // Cancel ongoing render task if any
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const page = await pdfDoc.getPage(pageNum);
      const containerWidth = containerRef.current.clientWidth - (settings.margin * 2);
      const containerHeight = containerRef.current.clientHeight - 40;

      // Base unscaled viewport
      const unscaledViewport = page.getViewport({ scale: 1 });
      
      // Calculate scale to fit container width, with optional user zoom setting
      const widthScale = (containerWidth / unscaledViewport.width);
      const heightScale = (containerHeight / unscaledViewport.height);
      // Fit page comfortably
      const fitScale = Math.min(widthScale, heightScale > 0.5 ? heightScale : widthScale);
      const userScaleMultiplier = settings.fontSize / 100;
      const baseScale = (fitScale > 0 ? fitScale : 1) * userScaleMultiplier * zoomScale;

      // Sharp high-DPI retina rendering
      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: baseScale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: context,
        canvas: canvas,
        viewport: viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('PDF Page Render Error:', err);
      }
    }
  }, [pdfDoc, settings.margin, settings.fontSize, zoomScale]);

  // Re-render when page, doc or settings change
  useEffect(() => {
    renderPage(currentPage);
  }, [renderPage, currentPage]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      renderPage(currentPage);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderPage, currentPage]);

  // Navigate to next / previous page
  const goToPage = useCallback((pageNum: number) => {
    if (!pdfDoc) return;
    const bounded = Math.min(Math.max(1, pageNum), totalPages);
    setCurrentPage(bounded);

    const percentage = Math.round((bounded / totalPages) * 100);
    const display = `Page ${bounded} of ${totalPages}`;
    onLocationChange(bounded.toString(), percentage, display);
  }, [pdfDoc, totalPages, onLocationChange]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  // Keyboard navigation (desktop & tablet external keyboards)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage]);

  // Touch handlers for mobile swipe and tap navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const screenWidth = window.innerWidth;
    const touchX = e.changedTouches[0].clientX;

    // Detect horizontal swipe
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100) {
      if (deltaX < 0) {
        nextPage();
      } else {
        prevPage();
      }
    } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
      // Tap detected:
      // Left 25% -> prev page
      // Right 25% -> next page
      // Center 50% -> toggle controls
      if (touchX < screenWidth * 0.25) {
        prevPage();
      } else if (touchX > screenWidth * 0.75) {
        nextPage();
      } else {
        onToggleControls();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const themeColors = THEME_CONFIG[settings.theme];

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full flex flex-col items-center justify-center overflow-auto select-none transition-colors duration-200"
      style={{ backgroundColor: themeColors.bg }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {isLoading && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-current border-t-transparent rounded-full animate-spin" style={{ color: themeColors.fg }} />
          <p className="text-sm font-medium opacity-80" style={{ color: themeColors.fg }}>Opening PDF...</p>
        </div>
      )}

      {/* PDF Canvas with applied Theme Filter */}
      <div
        className="relative flex items-center justify-center shadow-lg transition-transform"
        style={{
          filter: themeColors.pdfFilter,
          margin: `${settings.margin}px auto`,
        }}
        onClick={(e) => {
          // If clicked on desktop
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const width = rect.width;

          if (clickX < width * 0.2) {
            prevPage();
          } else if (clickX > width * 0.8) {
            nextPage();
          } else {
            onToggleControls();
          }
        }}
      >
        <canvas ref={canvasRef} className="block max-w-full rounded-sm" />
      </div>

      {/* Floating touch hotspot cues (invisible except accessible for screen readers) */}
      <button
        aria-label="Previous Page"
        className="absolute left-0 top-0 bottom-0 w-[15%] opacity-0 cursor-pointer hidden md:block"
        onClick={(e) => { e.stopPropagation(); prevPage(); }}
      />
      <button
        aria-label="Next Page"
        className="absolute right-0 top-0 bottom-0 w-[15%] opacity-0 cursor-pointer hidden md:block"
        onClick={(e) => { e.stopPropagation(); nextPage(); }}
      />
    </div>
  );
}
