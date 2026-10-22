'use client';

import React from 'react';
import { Book, ReadingProgress } from '@/types/reader';
import { BookOpen, FileText, Trash2 } from 'lucide-react';

interface BookCardProps {
  book: Book;
  progress?: ReadingProgress;
  onSelect: (book: Book) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export default function BookCard({ book, progress, onSelect, onDelete }: BookCardProps) {
  const percentage = progress?.percentage || 0;

  return (
    <div
      onClick={() => onSelect(book)}
      className="group relative flex flex-col bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer shadow-xs hover:shadow-xl hover:-translate-y-1"
    >
      {/* Cover Aspect Ratio 3:4 */}
      <div className="relative aspect-3/4 w-full bg-zinc-800/50 flex items-center justify-center overflow-hidden">
        {book.coverDataUrl ? (
          <img
            src={book.coverDataUrl}
            alt={book.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-zinc-800 to-zinc-900 border-b border-zinc-800">
            {book.format === 'pdf' ? (
              <FileText className="w-12 h-12 text-rose-400/80 mb-3" />
            ) : (
              <BookOpen className="w-12 h-12 text-blue-400/80 mb-3" />
            )}
            <h4 className="text-sm font-semibold text-zinc-200 line-clamp-3 leading-snug">
              {book.title}
            </h4>
            <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{book.author}</p>
          </div>
        )}

        {/* Format Badge (PDF or EPUB) */}
        <span
          className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase backdrop-blur-md shadow-xs ${
            book.format === 'pdf'
              ? 'bg-rose-500/80 text-white'
              : 'bg-blue-600/80 text-white'
          }`}
        >
          {book.format}
        </span>

        {/* Delete Button */}
        <button
          onClick={(e) => onDelete(book.id, e)}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-zinc-300 hover:text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-xs cursor-pointer"
          title="Delete Book"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Progress Bar overlay on cover bottom */}
        {percentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Book Metadata Footer */}
      <div className="p-3.5 flex flex-col justify-between flex-1">
        <div>
          <h3 className="text-sm font-medium text-zinc-100 line-clamp-1 group-hover:text-blue-400 transition-colors">
            {book.title}
          </h3>
          <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{book.author}</p>
        </div>

        <div className="flex items-center justify-between mt-3 text-[11px] text-zinc-500">
          <span>{progress?.pageDisplay || (percentage > 0 ? `${percentage}%` : 'Unread')}</span>
          {percentage > 0 && (
            <span className="font-semibold text-blue-400">{percentage}%</span>
          )}
        </div>
      </div>
    </div>
  );
}
