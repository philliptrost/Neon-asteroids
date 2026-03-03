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

## Architecture
- Asteroids: 3-tier size chain — 60 (giant) → 40 (large) → 20 (medium, no split); split via `childSize = a.size >= 50 ? 40 : 20`
- UFO: inline plain-object on `this._ufo` (no separate class); `_ufoBullets[]` for enemy projectiles; scheduled once per wave via `time.delayedCall`; removed on wave clear/game over
- Weapon tiers: `WEAPON_TIERS` map (0=basic, 1=uncommon, 2=rare); pickups only equip if `newTier >= curTier`; current weapon ID tracked as `this._currentWeaponId`
- Ambient asteroids: `this._ambientAsteroids[]` separate from wave `this._asteroids[]`; wave-clear only checks `_asteroids`
- Draw layers: `_bgGfx` (parallax BG) → `_gfx` (game world) → `_topGfx` (bullets/effects/UI on top) → `_minimapGfx`

## Gotchas
- Firebase has two hosting products: "Hosting" (static, free) vs "App Hosting" (server-side, billing required). This project uses static Hosting only.
- `Dockerfile` and `nginx.conf` were Cloud Run artifacts from Google AI Studio — removed. Do not recreate them.
- Game files in `src/` should not be modified unless explicitly requested.
- UFO `laserTimer` prevents instant laser kills — decrements ~16ms/frame, damages every 400ms.
- Phaser `fillEllipse` / `strokeEllipse` take `(x, y, width, height)` — width/height are full diameter, not radius.
