'use client';

import React, { useState } from 'react';
import { Book } from '@/types/reader';
import LibraryView from '@/components/library/LibraryView';
import ReaderShell from '@/components/reader/ReaderShell';

export default function Home() {
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  if (activeBook) {
    return <ReaderShell book={activeBook} onBack={() => setActiveBook(null)} />;
  }

  return <LibraryView onOpenBook={(book) => setActiveBook(book)} />;
}
