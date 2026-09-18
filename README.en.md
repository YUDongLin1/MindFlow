<div align="center">
  <img src="./public/icon.png" alt="MindFlow Icon" width="120" />
</div>

# MindFlow - Local-First AI Journal & Growth Hub

<div align="center">

[简体中文](./README.md) | English

</div>

> Record, reflect, accumulate — all in one place.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue)
![Version](https://img.shields.io/badge/version-1.0.1-green)
![Electron](https://img.shields.io/badge/Electron-33-blue?logo=electron)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js)

**MindFlow** is a **local-first, AI-powered personal growth journal** built with **Vue 3** + **Vite** + **Electron**, developed on top of the open-source project [MoodsNote](https://github.com/PStarH/MoodNotes) (AGPL-3.0). It unifies diary, work log, and study notes in one place, with AI-assisted reflection and an auto-generated Markdown knowledge base. All data stays 100% on your device — never uploaded, never used for training.

## Features

- **Three-module journaling**: diary / work log / study notes, each with guided templates; rich text editor (Tiptap) with plain-text toggle; voice input (Web Speech API, Chinese); smart tag suggestions (TF-IDF); auto metadata (time / location / weather); custom record modules
- **AI reflection**: three modes — local mirror (zero network) / bring-your-own-key (OpenAI-compatible + Ollama) / cloud; four-section structured review with a 12s timeout; provenance validation against hallucinations; outputs always marked "draft · needs your confirmation" (accept / discard / restore) with a full audit log; AI connection test (settings / privacy page, models-endpoint probe, 15s timeout)
- **Tracking & views**: mood / energy / stress tracking with ECharts; daily todos synced to the Growth and Calendar views; calendar month view; daily summary cards
- **Knowledge base**: every entry becomes Markdown with frontmatter and `[[wiki-links]]`; force-directed link graph; spaced repetition (SM-2); full-text search and AI Q&A
- **Data & privacy**: local storage (IndexedDB via LocalForage), fully offline, configurable storage location; export JSON backup / CSV / Markdown; import 5 formats (JSON/TXT/CSV/Markdown/HTML, auto-detected by content) with conflict preview; desktop pet companion

## Tech Stack

- Frontend: Vue 3, TypeScript, Vite, TailwindCSS, Vue Router, Vue I18n
- State: Pinia (primary) + Vuex compatibility layer
- Rich text: Tiptap (ProseMirror)
- Charts: ECharts + vue-echarts
- Data: LocalForage (IndexedDB)
- Desktop: Electron 33 (context isolation, secure preload bridge), packaged with electron-builder
- Tests: Vitest (happy-dom)

## Quick Start

Requirements: Node.js 18+; Windows / macOS / Linux.

```bash
# Install dependencies
npm install

# Dev mode (Vite + Electron with hot reload)
npm run dev
```

Build & package:

```bash
# Production build (frontend + Electron TypeScript compile)
npm run build

# Package for Windows (output in dist-electron/)
npm run package:win

# Type check
npm run type-check
```

Windows artifacts: `MindFlow Setup 1.0.0.exe` (NSIS installer) and `MindFlow 1.0.0.exe` (portable).

## Keyboard Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Ctrl + N` | New entry (go to Today) | Global |
| `Ctrl + F` | Search (jump to Knowledge base) | Global |
| `Ctrl + ,` | Open Settings | Global |
| `Ctrl + S` | Save current entry | Today page |
| `Ctrl + E` | Toggle rich / plain text | Today page |
| `Ctrl + D` | Insert current date | Today page (plain text) |
| `Ctrl + L` | Insert wiki-link `[[]]` | Today page (plain text) |
| `Ctrl + Shift + A` | Trigger AI reflection | Today page |

## Project Structure

```
.
├── electron/          # Electron main process (main.ts) and preload (preload.ts)
├── src/
│   ├── views/         # 6 route views: Today / Growth / Knowledge / Calendar / Privacy / Settings
│   ├── components/    # 43 components
│   ├── services/      # 13 service modules (AI client, import/export, weekly report, ...)
│   ├── stores/        # 6 Pinia stores (journal/todo/settings/habits/summaries/pet)
│   ├── composables/   # 15 composables (shortcuts, search, theme, ...)
│   ├── store/         # Vuex compatibility layer (legacy components)
│   ├── i18n/          # Localization (zh / en)
│   ├── router/        # Routes
│   └── utils/         # Utilities (dates, word count, app meta)
├── vite.config.ts
├── vitest.config.ts
└── package.json
```

## Testing

```bash
# Run unit tests (Vitest + happy-dom)
npx vitest run
```

## License

Released under AGPL-3.0. See [LICENSE](./LICENSE).

MindFlow is developed on top of the open-source project [MoodsNote](https://github.com/PStarH/MoodNotes) by [@PStarH](https://github.com/PStarH) (AGPL-3.0). All modifications and additions in this repository are released under the same AGPL-3.0 license.
