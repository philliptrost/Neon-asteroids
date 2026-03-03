# Neon Asteroids — Claude Code Context

## Stack
- Game engine: Phaser 3
- Build tool: Vite (outputs to `dist/`)
- Hosting: Firebase Hosting (static) — NOT App Hosting
- Analytics: Firebase Analytics (production only, not localhost)

## Key Commands
- `npm run dev` — local dev server with network access
- `npm run build` — Vite production build → `dist/`
- `npm run deploy` — build + deploy to Firebase (`npm run build && firebase deploy`)

## Firebase
- Project ID: `neon-92cfd`
- Live URL: https://neon-92cfd.web.app
- Static hosting config: `firebase.json` (public: `dist/`)
- Firebase only initializes in production — see `src/firebaseInit.js`

## Gotchas
- Firebase has two hosting products: "Hosting" (static, free) vs "App Hosting" (server-side, billing required). This project uses static Hosting only.
- `Dockerfile` and `nginx.conf` were Cloud Run artifacts from Google AI Studio — removed. Do not recreate them.
- Game files in `src/` should not be modified unless explicitly requested.
