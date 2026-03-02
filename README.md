# Neon Asteroids

Neon Asteroids is a mobile-first, portrait-only arcade space shooter built with Phaser 3, JavaScript, and Vite. The game has been optimized from the ground up for touchscreen devices with smooth, dynamic gameplay and progression features.

## Play Live
🚀 **[Play Neon Asteroids on Firebase](https://neon-92cfd.web.app)**

## Features

- **Mobile First**: Played explicitly in portrait orientation (450x800 resolution mapping) with a landscape-rotation CSS locker.
- **Ergonomic Controls**: 4-button, 2-thumb layout with expanded hitboxes specifically designed to feel seamless when tapping glass without haptic feedback.
- **Gear System & Progression**: Earn and equip Engines, Weapons, Shields, and Hulls that persist across game sessions using `localStorage` logic. 
- **Weapon Drops**: Destroying asteroids during gameplay has a chance to drop unique weapons like Spread Shot, Rapid Lasers, or Missiles that provide immediate firepower upgrades.
- **Dynamic Waves**: Manual wave progression ensuring you can take breaks before engaging the next wave of increasingly dense asteroids.
- **Save Games**: High scores, total scores, and gear collections are stored seamlessly so you never lose your progress.

## Tech Stack
- **Game Engine**: [Phaser 3](https://phaser.io/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Hosting**: Firebase Hosting

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the dev server:**
   ```bash
   npm run dev
   ```
   Open the localhost link in your web browser and emulate a mobile device in Developer Tools (Portrait orientation, e.g. iPhone SE sizing) for the intended experience.

3. **Build for production:**
   ```bash
   npm run build
   ```
   The static files will be generated in the `/dist` directory.

## Known Issues/Recent Fixes
- **Phaser 3 WebGL Support:** Mid-game crashes caused by `tg.save()`, `tg.translate()`, and `tg.rotate()` were resolved. When rolling custom geometry graphics in Phaser 3, absolute Cartesian math (`Math.sin` and `Math.cos`) was leveraged via Canvas paths (`moveTo`, `lineTo`) instead of unsupported WebGL translation calls to maintain performance.
- **Input Race Conditions:** Expanded mobile touch bounds on text zones previously caused a race condition where Phaser would attempt to load two scenes simultaneously. Events have been scrubbed to properly invoke `ptr.event.stopPropagation()`.