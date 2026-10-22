# vreader

> A lightweight, responsive web reader for **PDF** and **EPUB** built with Next.js, Tailwind CSS, and 100% free-tier cloud infrastructure.

![vreader preview](public/favicon.ico)

---

## ✨ Features

- 📱 **Mobile & Tablet Optimized**: Responsive layout with swipe navigation, touch hotspots, and full-screen reading mode.
- 📖 **EPUB & PDF Support**:
  - **EPUB**: Reflowable text engine powered by `epubjs`, supporting custom typography and CFI-based precise sentence/chapter tracking.
  - **PDF**: Vector and high-DPI canvas rendering powered by `pdfjs-dist`, rendering embedded images and diagrams crisply.
- 🎨 **Reader Theming & Typography**:
  - Themes: **Sepia** (warm paper), **Dark** (slate), **OLED Black** (pure black for battery savings), and **Light**.
  - Fonts: Classic Serif, Clean Sans, Merriweather, Literata, and Monospace.
  - Custom font size scaling, line spacing, and margin padding.
- 🔄 **Cross-Device Sync**:
  - Automatically saves your reading position as you read.
  - Open the same book from another device (phone, tablet, computer) and pick up right where you left off.
  - Powered by **Supabase Free Tier** (PostgreSQL) with zero-cost hosting on Vercel or Cloudflare Pages.
- 💾 **Local Offline Storage**:
  - Uses browser **IndexedDB** so uploaded books and reading positions work seamlessly even offline.
- 📲 **PWA Ready**:
  - Add to Home Screen on iOS / iPadOS / Android for a native app feel without browser navigation chrome.

---

## 🛠️ Tech Stack & Free Infrastructure

| Component | Technology | Cost |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, Turbopack, React 19) | Free |
| **Styling** | Tailwind CSS v4, Lucide Icons | Free |
| **Reading Engines** | `epubjs` (EPUB) & `pdfjs-dist` (PDF) | Open Source |
| **Local Storage** | Browser IndexedDB (`idb`) | Free |
| **Database & Sync** | Supabase (PostgreSQL) | Free tier (50,000 MAU, 500MB DB) |
| **Hosting** | Vercel or Cloudflare Pages | Free tier |

---

## 🚀 Getting Started

### 1. Clone & Install

\`\`\`bash
git clone git@github-personal:daohuynhtrung/vreader.git
cd vreader
npm install
\`\`\`

### 2. Start Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Cross-Device Sync Setup (Free Supabase)

1. Create a free account at [supabase.com](https://supabase.com).
2. Create a new project.
3. Open the **SQL Editor** in Supabase and run the schema found in [`supabase/schema.sql`](supabase/schema.sql).
4. Get your **Project URL** and **Anon Key** from **Project Settings $\rightarrow$ API**.
5. Connect in either of two ways:
   - **Inside the Web UI**: Tap the cloud icon in the top header and paste your credentials.
   - **Via Environment Variables**: Copy `.env.example` to `.env.local` and fill in:
     \`\`\`env
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     \`\`\`
