'use client';

import React from 'react';
import { ReaderSettings, ReaderTheme, ReaderFontFamily } from '@/types/reader';
import { THEME_CONFIG, FONT_CONFIG } from '@/lib/reader/themeConfig';
import { X, Type, Sun, Moon, Sparkles, BookOpen } from 'lucide-react';

interface ReaderSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
}

export default function ReaderSettingsDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: ReaderSettingsDrawerProps) {
  if (!isOpen) return null;

  const currentTheme = THEME_CONFIG[settings.theme];

  const themes: { id: ReaderTheme; label: string; icon: React.ReactNode; bg: string; fg: string; border: string }[] = [
    { id: 'light', label: 'Light', icon: <Sun className="w-4 h-4" />, bg: '#ffffff', fg: '#18181b', border: '#e4e4e7' },
    { id: 'sepia', label: 'Sepia', icon: <BookOpen className="w-4 h-4" />, bg: '#fbf0d9', fg: '#3c2f1f', border: '#dec9a3' },
    { id: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" />, bg: '#18181b', fg: '#f4f4f5', border: '#3f3f46' },
    { id: 'oled', label: 'OLED', icon: <Sparkles className="w-4 h-4" />, bg: '#000000', fg: '#ffffff', border: '#27272a' },
  ];

  const fonts: { id: ReaderFontFamily; label: string }[] = [
    { id: 'serif', label: 'Serif' },
    { id: 'sans', label: 'Sans-Serif' },
    { id: 'merriweather', label: 'Merriweather' },
    { id: 'literata', label: 'Literata' },
    { id: 'mono', label: 'Monospace' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer content card */}
      <div
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border transition-all z-10 max-h-[85vh] overflow-y-auto"
        style={{
          backgroundColor: currentTheme.cardBg,
          borderColor: currentTheme.border,
          color: currentTheme.fg,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5 opacity-70" />
            <h3 className="font-semibold text-base">Reading Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        <div className="space-y-5 pt-4">
          {/* 1. Theme Selection */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider opacity-70 block mb-2">
              Color Theme
            </label>
            <div className="grid grid-cols-4 gap-2">
              {themes.map((t) => {
                const isSelected = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onUpdateSettings({ theme: t.id })}
                    className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-xs font-medium border-2 transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-blue-500 scale-102 font-bold' : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: t.bg,
                      color: t.fg,
                      borderColor: t.border,
                    }}
                  >
                    <span className="mb-1">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Font Size */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider opacity-70">
                Font Size
              </label>
              <span className="text-xs font-mono font-bold opacity-80">{settings.fontSize}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateSettings({ fontSize: Math.max(80, settings.fontSize - 10) })}
                className="flex-1 py-2 rounded-lg border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 active:scale-98 transition font-medium text-sm"
              >
                A -
              </button>
              <input
                type="range"
                min="80"
                max="200"
                step="5"
                value={settings.fontSize}
                onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                className="flex-3 accent-blue-600 cursor-pointer"
              />
              <button
                onClick={() => onUpdateSettings({ fontSize: Math.min(220, settings.fontSize + 10) })}
                className="flex-1 py-2 rounded-lg border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 active:scale-98 transition font-medium text-base font-bold"
              >
                A +
              </button>
            </div>
          </div>

          {/* 3. Font Family */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider opacity-70 block mb-2">
              Typography Font
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {fonts.map((f) => {
                const isSelected = settings.fontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => onUpdateSettings({ fontFamily: f.id })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                        : 'border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    style={{
                      fontFamily: FONT_CONFIG[f.id].cssFamily,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Line Spacing & Margins */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider opacity-70 block mb-1.5">
                Line Spacing
              </label>
              <div className="flex rounded-lg border border-black/15 dark:border-white/15 overflow-hidden">
                {[1.4, 1.6, 1.9].map((lh) => (
                  <button
                    key={lh}
                    onClick={() => onUpdateSettings({ lineHeight: lh })}
                    className={`flex-1 py-1.5 text-xs font-medium transition cursor-pointer ${
                      settings.lineHeight === lh
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {lh}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider opacity-70 block mb-1.5">
                Page Margins
              </label>
              <div className="flex rounded-lg border border-black/15 dark:border-white/15 overflow-hidden">
                {[12, 24, 40].map((m) => (
                  <button
                    key={m}
                    onClick={() => onUpdateSettings({ margin: m })}
                    className={`flex-1 py-1.5 text-xs font-medium transition cursor-pointer ${
                      settings.margin === m
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {m === 12 ? 'Narrow' : m === 24 ? 'Normal' : 'Wide'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
