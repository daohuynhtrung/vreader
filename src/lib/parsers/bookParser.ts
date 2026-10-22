import { BookFormat } from '@/types/reader';

export interface ExtractedBookMeta {
  title: string;
  author: string;
  totalPages?: number;
  coverDataUrl?: string;
  format: BookFormat;
}

/**
 * Extract metadata and cover thumbnail from PDF or EPUB file
 */
export async function extractBookMeta(file: File): Promise<ExtractedBookMeta> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const format: BookFormat = extension === 'epub' ? 'epub' : 'pdf';
  const defaultTitle = file.name.replace(/\.[^/.]+$/, "");

  if (format === 'pdf') {
    return extractPdfMeta(file, defaultTitle);
  } else {
    return extractEpubMeta(file, defaultTitle);
  }
}

async function extractPdfMeta(file: File, defaultTitle: string): Promise<ExtractedBookMeta> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let title = defaultTitle;
    let author = 'Unknown';

    try {
      const metadata = await pdf.getMetadata();
      const info = metadata?.info as any;
      if (info?.Title && typeof info.Title === 'string' && info.Title.trim().length > 0) {
        title = info.Title.trim();
      }
      if (info?.Author && typeof info.Author === 'string' && info.Author.trim().length > 0) {
        author = info.Author.trim();
      }
    } catch {
      // metadata extraction failed, use defaults
    }

    // Generate cover thumbnail from first page
    let coverDataUrl: string | undefined;
    try {
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await firstPage.render({ canvasContext: ctx, canvas, viewport }).promise;
        coverDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      }
    } catch (coverErr) {
      console.warn('Could not generate PDF cover thumbnail:', coverErr);
    }

    return {
      title,
      author,
      totalPages: pdf.numPages,
      coverDataUrl,
      format: 'pdf',
    };
  } catch (err) {
    console.error('Failed to parse PDF metadata:', err);
    return {
      title: defaultTitle,
      author: 'Unknown',
      format: 'pdf',
    };
  }
}

async function extractEpubMeta(file: File, defaultTitle: string): Promise<ExtractedBookMeta> {
  try {
    const ePub = (await import('epubjs')).default;
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);

    await book.ready;
    const metadata = await book.loaded.metadata;

    const title = metadata.title || defaultTitle;
    const author = metadata.creator || 'Unknown';

    let coverDataUrl: string | undefined;
    try {
      const coverUrl = await book.coverUrl();
      if (coverUrl) {
        // Fetch blob from blob: URL and convert to DataURL for persistence
        const response = await fetch(coverUrl);
        const blob = await response.blob();
        coverDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (cErr) {
      console.warn('Could not extract EPUB cover:', cErr);
    }

    return {
      title,
      author,
      coverDataUrl,
      format: 'epub',
    };
  } catch (err) {
    console.error('Failed to parse EPUB metadata:', err);
    return {
      title: defaultTitle,
      author: 'Unknown',
      format: 'epub',
    };
  }
}
