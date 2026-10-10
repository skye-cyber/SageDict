<!-- Project badges — Tauri 2 build -->
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://opensource.org/licenses/GPL-3.0)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB.svg?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.77%2B-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-bundled-003B57.svg?logo=sqlite)](https://sqlite.org/)
[![Build Status](https://img.shields.io/github/actions/workflow/status/skye-cyber/desktop-dictionary/release.yml?branch=main)](https://github.com/skye-cyber/desktop-dictionary/actions)

![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS-informational)

# SageDict

A modern, lightweight cross-platform dictionary application built on
Tauri 2, backed by WordNet 2025, and shipped as a self-contained
desktop and mobile app.

## Features

- **Full WordNet semantic graph**: hypernyms, hyponyms, meronyms,
  holonyms, entailments, causes, related forms, domain tags
- **Fast prefix search** with debouncing and keyboard navigation
- **Full-text definition search** via SQLite FTS5
- **Bookmarks** persisted in a per-user SQLite database
- **Vim-inspired dark theme** with rich dark grays and blues
- **Toggleable dark/light mode** with smooth transitions
- **Global shortcut**: `Cmd/Ctrl + Shift + D` to show/hide
- **Cross-platform**: Windows, macOS, Linux, Android, iOS
- **Small bundle**: WordNet DB ships as a compressed 7z archive,
  extracted on first run
- **Modern UI** with React Icons and Framer Motion animations

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Tauri 2 |
| Backend | Rust 1.77+, rusqlite (bundled), tauri-plugin-fs |
| Frontend | React 19 + TypeScript + Tailwind CSS |
| Animations | Framer Motion |
| Icons | React Icons (Feather) |
| Storage | SQLite (bundled WordNet + user DB) |
| Build | Vite + Rolldown, cargo, 7z |

## Requirements

- **Rust 1.77+** with the target toolchains you plan to build for
- **Node.js 22+** and npm
- **7z** on PATH (used by the packaging script)
- Platform prerequisites for Tauri, per
  https://v2.tauri.app/start/prerequisites/
  - Linux: `webkit2gtk`, `libssl`, `libayatana-appindicator`
  - macOS: Xcode command line tools
  - Windows: MSVC build tools + WebView2
  - Android: Android Studio, NDK 27.x, `aarch64-linux-android` target

## Project Structure

```text
SageDict/
├── public/                        # Static assets
├── scripts/
│   ├── pack-wordnet.mjs           # Compress wordnet.sqlite -> wordnet.7z
│   └── data/                      # WordNet JSON source + loader
├── src/                           # React frontend
│   ├── assets/                    # Bundled resources
│   │   ├── wordnet.sqlite         # Raw DB (dev)
│   │   ├── wordnet.7z             # Packed DB (release)
│   │   ├── user.sqlite            # Bookmark seed
│   │   └── sagedict.png           # App icon
│   ├── core/
│   │   ├── Globals/
│   │   └── hooks/
│   ├── types/                     # Shared TS types
│   └── ui/
│       ├── components/
│       │   ├── Panels/            # Relation graph panels
│       │   └── Themes/            # Theme definitions
│       ├── pages/
│       ├── services/              # Tauri command wrappers
│       └── styles/
└── src-tauri/
    ├── capabilities/
    ├── gen/android/               # Generated Android project
    ├── src/
    │   └── services/
    │       ├── dictionaryDB.rs     # WordNet queries
    │       └── bookmarks.rs        # User bookmarks
    ├── Cargo.toml
    ├── tauri.conf.json
    └── .taurignore
```

## Quick Start

```bash
# Install frontend dependencies
npm install

# Ensure wordnet.sqlite exists in src/assets/.
# If you need to rebuild it from the WordNet JSON:
python3 scripts/data/build_wordnet_db.py

# Run in development (desktop)
npm run tauri dev

# Run in development (Android)
npm run tauri android dev

# Build for production (desktop)
npm run tauri build

# Build for production (Android)
npm run tauri android build
```

## Data Storage

The app uses **two SQLite databases** with different lifecycles.

### `wordnet.sqlite` — read-only reference data

- Built once from the WordNet 2025 plus-json export
- Ships compressed as `wordnet.7z` inside the bundle
- Extracted on first run to the platform app data directory
- Opened read-only; SQLite never creates `-wal` or `-shm` sidecars
- Queried through prepared statements that are cached per command

Schema highlights:

| Table | Purpose |
|---|---|
| `entries` | One row per (lemma, pos) |
| `senses` | One row per meaning of a lemma |
| `synsets` | One row per concept |
| `synset_members` | Synonyms of a synset |
| `synset_examples` | Usage examples |
| `relations` | Every WordNet relation as (src, rel, dst) |
| `synset_fts` | FTS5 index over definitions |

### `user.sqlite` — read-write user data

- Seeded from `src/assets/user.sqlite` on first run
- Lives in the platform app data directory
- Holds bookmarks and metadata (created_at, update_at)
- Opened read-write; WAL mode is enabled for atomic writes

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Shift + D` | Show/hide app |
| `Cmd/Ctrl + K` | Focus search |
| `Escape` | Clear search |

## Development Notes

### The dev watch loop

Tauri's dev watcher restarts the app on any file change under
`src-tauri/`. SQLite sidecars (`-wal`, `-shm`) and the packed archive
are excluded via `.taurignore`, and the read-only open means no
sidecars are created in the source tree.

### Android resources

On Android, `resource_dir()` returns `asset://localhost/`, not a
filesystem path. `std::fs` cannot read it. The archive is fetched
through `tauri-plugin-fs` and decompressed from an in-memory buffer.

### `debug_assertions` and mobile

`cfg!(debug_assertions)` means *dev-vs-packaged*, not
*desktop-vs-mobile*. Any code branching on it must also check the
platform when the dev branch depends on host-relative paths. On
Android dev builds, use the same data source as packaged builds.

## Theme Customization

The Vim-inspired dark theme is defined in
`src/ui/components/Themes/` and exposed as CSS variables:

```css
:root {
  --vim-bg-50: #2d2d2d;
  --vim-bg-100: #262626;
  --vim-bg-200: #1e1e1e;
  --vim-bg-300: #1a1a1a;
  --vim-bg-400: #151515;
  --vim-bg-500: #121212;   /* default dark */
  --vim-bg-600: #0f0f0f;
  --vim-bg-700: #0a0a0a;
  --vim-bg-800: #050505;
  --vim-bg-900: #000000;
}
```

## Building for Distribution

### Desktop

```bash
npm run tauri build
```

Outputs go to `src-tauri/target/release/bundle/`. The
`beforeBuildCommand` packs `wordnet.7z` if it is missing; pass
`--force` to the pack script when the DB has changed:

```bash
node scripts/pack-wordnet.mjs --force
npm run tauri build
```

### Android

```bash
npm run tauri android build
```

Requires a signing config at
`src-tauri/gen/android/keystore.properties` (gitignored) with
`storeFile`, `storePassword`, `keyAlias`, and `keyPassword`.

**Back up the keystore and its passwords offline.** If the key is
lost and Play App Signing is not enabled, the app can never be
updated under the same package name. Enroll in Play App Signing.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `no such table: entries` | `Connection::open` created an empty DB at a wrong path | Open read-only; verify schema on startup |
| Endless dev rebuilds | SQLite sidecars under the watched tree | Add `.taurignore` entries; open read-only |
| `cannot find crate rusqlite` on Android | Dep gated behind a target-specific section | Declare `rusqlite` in `[dependencies]` |
| `-lsqlite3` link error | Non-bundled SQLite on Android | Enable `features = ["bundled"]` |
| Android crash in `on_window_close` | Failed setup hook cascading into teardown | Check the FIRST panic line in logcat |
| `asset://localhost/...` missing | Resources live inside the APK on mobile | Read via `tauri-plugin-fs` |
| Wrong parameter count | Mismatch between SQL placeholders and `params!` | One argument per placeholder |
| Vite Safari 13 destructuring errors | esbuild 0.28.x regression | Pin via `overrides` |

## License

GPL-3.0 © [Skye]
