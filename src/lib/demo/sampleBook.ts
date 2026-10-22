import { Book } from '@/types/reader';
import { saveBook } from '@/lib/storage/db';

/**
 * Creates a minimal valid multi-page PDF blob with text and diagrams
 * for instant testing without needing external files.
 */
export async function createSamplePdfBook(): Promise<Book> {
  // A clean, valid minimal PDF 1.4 document with 3 pages and vector graphics
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
6 0 obj
<< /Length 285 >>
stream
BT
/F1 28 Tf
50 720 Td
(Welcome to vreader) Tj
/F1 16 Tf
0 -40 Td
(A Responsive Web Reader for PDF & EPUB) Tj
/F1 12 Tf
0 -40 Td
(This is Page 1 of your sample book.) Tj
0 -25 Td
(Key features include:) Tj
0 -20 Td
(- Cross-device page sync across mobile, tablet, and desktop) Tj
0 -20 Td
(- Sepia, Dark, OLED, and Light themes) Tj
0 -20 Td
(- Dynamic font switching and responsive layout) Tj
0 -40 Td
(Swipe left or tap the right edge to turn to Page 2 ->) Tj
ET
0.2 0.4 0.8 rg
50 400 512 80 re f
endstream
endobj
7 0 obj
<< /Length 320 >>
stream
BT
/F1 24 Tf
50 720 Td
(Chapter 1: The Reading Experience) Tj
/F1 13 Tf
0 -40 Td
(This is Page 2.) Tj
0 -25 Td
(Tap the center of your screen to reveal the header and footer bars.) Tj
0 -20 Td
(From the header, you can tap the Settings icon to:) Tj
0 -20 Td
(1. Change reader themes: Sepia, Dark, OLED Black, or Light.) Tj
0 -20 Td
(2. Adjust font size and line spacing.) Tj
0 -20 Td
(3. Toggle full-screen mode on mobile or tablet.) Tj
0 -40 Td
(Next: Turn to Page 3 for vector diagrams and sync demo ->) Tj
ET
0.8 0.3 0.2 rg
100 350 150 150 re f
0.1 0.7 0.4 rg
300 350 150 150 re f
endstream
endobj
8 0 obj
<< /Length 260 >>
stream
BT
/F1 24 Tf
50 720 Td
(Chapter 2: Cross-Device Sync) Tj
/F1 13 Tf
0 -40 Td
(This is Page 3.) Tj
0 -25 Td
(Your reading progress is automatically saved to your browser.) Tj
0 -20 Td
(Connect Supabase in the Cloud Sync menu to sync across devices!) Tj
0 -20 Td
(Leave this page open, close the tab, and reopen it.) Tj
0 -20 Td
(vreader will remember you were here on Page 3.) Tj
ET
endstream
endobj
9 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 10
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000133 00000 n 
0000000257 00000 n 
0000000381 00000 n 
0000000505 00000 n 
0000000845 00000 n 
0000001220 00000 n 
0000001535 00000 n 
trailer
<< /Size 10 /Root 1 0 R >>
startxref
1606
%%EOF`;

  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  const sampleBook: Book = {
    id: 'sample-welcome-guide',
    title: 'vreader Quickstart Guide',
    author: 'vreader Team',
    format: 'pdf',
    fileBlob: blob,
    fileSize: blob.size,
    totalPages: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveBook(sampleBook, blob);
  return sampleBook;
}
