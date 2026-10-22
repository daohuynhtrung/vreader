import { ReaderTheme, ReaderFontFamily, ReaderSettings } from '@/types/reader';

export interface ThemeColors {
  bg: string;
  fg: string;
  cardBg: string;
  border: string;
  secondaryFg: string;
  pdfFilter: string;
}

export const THEME_CONFIG: Record<ReaderTheme, ThemeColors> = {
  light: {
    bg: '#ffffff',
    fg: '#18181b',
    cardBg: '#f4f4f5',
    border: '#e4e4e7',
    secondaryFg: '#71717a',
    pdfFilter: 'none',
  },
  sepia: {
    bg: '#fbf0d9',
    fg: '#3c2f1f',
    cardBg: '#eedfbe',
    border: '#dec9a3',
    secondaryFg: '#7a6850',
    pdfFilter: 'sepia(0.4) contrast(0.96) brightness(0.97)',
  },
  dark: {
    bg: '#18181b',
    fg: '#f4f4f5',
    cardBg: '#27272a',
    border: '#3f3f46',
    secondaryFg: '#a1a1aa',
    pdfFilter: 'invert(0.9) hue-rotate(180deg) brightness(0.92) contrast(1.05)',
  },
  oled: {
    bg: '#000000',
    fg: '#e4e4e7',
    cardBg: '#121212',
    border: '#27272a',
    secondaryFg: '#888888',
    pdfFilter: 'invert(1) hue-rotate(180deg) contrast(1.15)',
  },
};

export const FONT_CONFIG: Record<ReaderFontFamily, { name: string; cssFamily: string }> = {
  sans: {
    name: 'Clean Sans',
    cssFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  serif: {
    name: 'Classic Serif',
    cssFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },
  merriweather: {
    name: 'Merriweather',
    cssFamily: '"Merriweather", Georgia, serif',
  },
  literata: {
    name: 'Literata',
    cssFamily: '"Literata", Georgia, serif',
  },
  mono: {
    name: 'Monospace',
    cssFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'sepia',
  fontFamily: 'serif',
  fontSize: 105,
  lineHeight: 1.6,
  margin: 24,
};
