import Player from '../objects/Player.js';
import Asteroid from '../objects/Asteroid.js';
import { SaveManager } from '../SaveManager.js';
import { GearData, rollLootDrop, WEAPON_DROP_POOL } from '../data/GearData.js';

const WAVE_BASE = 5;
const WORLD_W = 6000;
const WORLD_H = 6000;

const UFO_RADIUS = 27;
const UFO_HP     = 2;
const UFO_SCORE  = 200;

const WEAPON_TIERS = {
    weapon_basic:   0,
    weapon_rapid:   1,
    weapon_triple:  1,
    weapon_laser:   2,
    weapon_bomb:    2,
    weapon_360:     2,
    weapon_missile: 2,
};

// ── Mobile button layout ──────────────────────────────────────────────────────
const BTNS = (w, h) => {
    const R = 45;
    return [
        { key: 'rotLeft', x: 55, y: h - 65, label: '◄', color: 0x00ffff, r: R },
        { key: 'rotRight', x: 155, y: h - 65, label: '►', color: 0x00ffff, r: R },
        { key: 'shoot', x: w - 155, y: h - 65, label: '●', color: 0xff4466, r: R },
        { key: 'thrust', x: w - 55, y: h - 65, label: '▲', color: 0xff9900, r: R },
    ];
};

export default class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init() {
        this._score = 0; this._lives = 3; this._wave = 1;
        this._invincible = false; this._gameOver = false; this._waveClearPending = false;
        this._bullets = []; this._asteroids = []; this._particles = []; this._pickups = [];
        this._thrustParticles = [];
        this._ufo = null; this._ufoBullets = [];
        this._shootCooldown = 0; this._shield = null; this._weaponsDroppedThisWave = 0;
        this._mobileState = { rotLeft: false, rotRight: false, thrust: false, shoot: false };
        this._mobileButtons = [];
        this._laserActive = false;
        this._bgObjects = [];
        this._camX = 0; this._camY = 0;
    }

    create() {
        const { width, height } = this.scale;

        // ── Load loadout & build stats ─────────────────────────────────────────
        const save = SaveManager.load();
        const lo = save.loadout;
        const eng = GearData.engines[lo.engine] || GearData.engines.engine_ion;
        const hull = lo.hull ? GearData.hulls[lo.hull] : GearData.hulls.hull_fighter;
        const wpn = GearData.weapons[lo.weapon] || GearData.weapons.weapon_basic;
        const shd = lo.shield ? GearData.shields[lo.shield] : null;

        this._playerStats = {
            thrustPower: eng.thrustPower * (hull.speedBonus || 1),
            maxSpeed: eng.maxSpeed * (hull.speedBonus || 1),
            rotAccel: eng.rotAccel * (hull.rotPenalty || 1),
            lives: hull.lives, radius: hull.radius,
        };
        this._weaponStats = { ...wpn };
        this._currentWeaponId = lo.weapon || 'weapon_basic';
        this._shieldDef = shd;
        this._lives = this._playerStats.lives;
        if (shd) this._shield = { active: true, regenTimer: 0 };

        // ── Keyboard input ─────────────────────────────────────────────────────
        this._keys = this.input.keyboard.addKeys({
            thrust: 'UP', rotLeft: 'LEFT', rotRight: 'RIGHT', shoot: 'SPACE',
            thrustW: 'W', rotLeftA: 'A', rotRightD: 'D',
        });

        // ── Camera: follows player in large world ──────────────────────────────
        // UI elements need their own fixed camera
        this._uiCam = this.cameras.add(0, 0, width, height).setName('ui').ignore([]);
        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

        // ── Multi-layer parallax background (screen-space, no world scroll) ───
        // Drawn every frame on bgGfx using screen-space tiling parallax math
        this._bgGfx = this.add.graphics().setScrollFactor(0).setDepth(-20);

        // Star layers: array of { stars: [{ax,ay,size,alpha}], parallax }
        // ax/ay are normalized [0,1] anchor positions, parallax in [0,1]
        this._starLayers = [
            { parallax: 0.03, stars: this._genStars(35, 0.15, 0.50, 0.06, 0.18) }, // far
            { parallax: 0.08, stars: this._genStars(45, 0.40, 0.90, 0.15, 0.35) }, // mid-far
            { parallax: 0.18, stars: this._genStars(28, 0.70, 1.30, 0.28, 0.55) }, // mid-near
            { parallax: 0.32, stars: this._genStars(10, 1.20, 2.00, 0.45, 0.80) }, // foreground twinkle
        ];

        // ── Sparse deep-space background objects (world space) ─────────────────
        this._createBgObjects();

        // ── World graphics layers ──────────────────────────────────────────────
        this._gfx = this.add.graphics().setDepth(0);
        this._topGfx = this.add.graphics().setDepth(5);

        // ── Minimap (screen-space, not affected by world camera) ───────────────
        this._minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(22);
        this.cameras.main.ignore(this._minimapGfx);

        // ── Player (starts at world center) ────────────────────────────────────
        this._player = new Player(this, WORLD_W / 2, WORLD_H / 2, this._playerStats);

        // Point camera at player immediately
        this._camX = this._player.x - width / 2;
        this._camY = this._player.y - height / 2;
        this.cameras.main.scrollX = this._camX;
        this.cameras.main.scrollY = this._camY;

        this._spawnWave(this._wave);
        this._spawnAmbientAsteroids();
        this._scheduleUFO();

        // ── HUD ────────────────────────────────────────────────────────────────
        if (!this.scene.isActive('HUDScene')) this.scene.launch('HUDScene');
        this._hud = this.scene.get('HUDScene');
        this._syncHUD();

        this.events.on('nextWave', this._onNextWave, this);

        // ── Mobile controls ────────────────────────────────────────────────────
        this._createMobileControls();

        // ── Bloom ──────────────────────────────────────────────────────────────
        this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1.2, 1.1);
    }

    // ── Star layer generator ──────────────────────────────────────────────────
    _genStars(count, minSz, maxSz, minAlpha, maxAlpha) {
        return Array.from({ length: count }, () => ({
            ax: Math.random(),
            ay: Math.random(),
            size: Math.random() * (maxSz - minSz) + minSz,
            alpha: Math.random() * (maxAlpha - minAlpha) + minAlpha,
        }));
    }

    // ── Deep-space background objects ─────────────────────────────────────────
    _createBgObjects() {
        // Planets – 3-5 sparse in world
        const planetColors = [0x4466ff, 0xff8844, 0x44ff88, 0xaa44ff, 0xff4466];
        const numPlanets = 4;
        for (let i = 0; i < numPlanets; i++) {
            const x = Math.random() * WORLD_W;
            const y = Math.random() * WORLD_H;
            const r = Math.random() * 60 + 30;
            const col = planetColors[i % planetColors.length];
            const ringCol = Phaser.Display.Color.IntegerToColor(col).lighten(40).color;
            this._bgObjects.push({
                type: 'planet', x, y, r, col, ringCol,
                ringRot: Math.random() * Math.PI * 2,
                ringW: Math.random() * 25 + 10,
                hasRing: Math.random() > 0.5
            });
        }

        // Nebulae – 3 large glowing clouds
        const nebulaColors = [0x220055, 0x003322, 0x331100, 0x002244];
        for (let i = 0; i < 3; i++) {
            this._bgObjects.push({
                type: 'nebula',
                x: Math.random() * WORLD_W,
                y: Math.random() * WORLD_H,
                r: Math.random() * 250 + 150,
                col: nebulaColors[i % nebulaColors.length],
                alpha: 0.18 + Math.random() * 0.12,
            });
        }

        // Comets – 2 with trails that move slowly across the world
        for (let i = 0; i < 2; i++) {
            const angle = Math.random() * Math.PI * 2;
            this._bgObjects.push({
                type: 'comet',
                x: Math.random() * WORLD_W,
                y: Math.random() * WORLD_H,
                vx: Math.cos(angle) * 0.4,
                vy: Math.sin(angle) * 0.4,
                trail: [],
                trailMax: 60,
            });
        }
    }

    // ── Syncs ─────────────────────────────────────────────────────────────────
    _syncHUD() {
        if (!this._hud) return;
        this._hud.updateScore(this._score);
        this._hud.updateWave(this._wave);
        this._hud.updateLives(this._lives);
        this._hud.updateShield(!!this._shield?.active);
    }

    // ── Update loop ───────────────────────────────────────────────────────────
    update(_, delta) {
        delta = Math.min(delta, 50);
        if (this._gameOver || this._waveClearPending) return;
        const { width, height } = this.scale;
        const k = this._keys;
        const m = this._mobileState;

        const thrusting = k.thrust.isDown || k.thrustW.isDown || m.thrust;
        const rotatingL = k.rotLeft.isDown || k.rotLeftA.isDown || m.rotLeft;
        const rotatingR = k.rotRight.isDown || k.rotRightD.isDown || m.rotRight;
        const shooting = k.shoot.isDown || m.shoot;

        if (!this._invincible) {
            if (thrusting) this._player.applyThrust();
            if (rotatingL) this._player.rotate(-1);
            if (rotatingR) this._player.rotate(1);
        }

        // Weapon fire logic
        this._laserActive = false;
        this._shootCooldown -= delta;
        if (shooting && !this._invincible) {
            const ws = this._weaponStats;
            if (ws.type === 'laser') {
                // Continuous laser – processed in _draw directly
                this._laserActive = true;
                this._laserHitAsteroid();
            } else if (this._shootCooldown <= 0) {
                this._fire();
                this._shootCooldown = ws.cooldown;
            }
        }

        this._player.update(delta, WORLD_W, WORLD_H);

        if (this._player._wasThrusting) this._emitThrustParticles();

        // Update bullets
        this._bullets = this._bullets.filter(b => {
            if (b.isMissile && this._asteroids.length > 0) {
                // Seek nearest asteroid
                let nearest = null, nearDist = Infinity;
                for (const a of this._asteroids) {
                    const d = Math.hypot(b.x - a.x, b.y - a.y);
                    if (d < nearDist) { nearDist = d; nearest = a; }
                }
                if (nearest) {
                    const targetAngle = Math.atan2(nearest.y - b.y, nearest.x - b.x);
                    const currentAngle = Math.atan2(b.vy, b.vx);
                    const diff = Phaser.Math.Angle.Wrap(targetAngle - currentAngle);
                    const turn = Phaser.Math.Clamp(diff, -b.turnRate, b.turnRate);
                    const newAngle = currentAngle + turn;
                    const spd = Math.hypot(b.vx, b.vy);
                    b.vx = Math.cos(newAngle) * spd;
                    b.vy = Math.sin(newAngle) * spd;
                    b.angle = newAngle;
                }
            }
            b.x += b.vx; b.y += b.vy; b.life -= delta;
            return b.life > 0;
        });

        // Update asteroids (pass player position for soft homing)
        this._asteroids.forEach(a => a.update(this._player.x, this._player.y));

        // Collisions
        this._bulletAsteroidCollisions();
        if (!this._invincible) this._playerAsteroidCollisions();
        this._updatePickups(delta);

        // UFO
        if (this._ufo) this._updateUFO(delta);
        this._ufoCollisions();

        // Shield regen
        if (this._shield && !this._shield.active && this._shieldDef?.regenTime) {
            this._shield.regenTimer -= delta;
            if (this._shield.regenTimer <= 0) { this._shield.active = true; this._syncHUD(); }
        }

        // Update particles
        const dt = delta / 16.67;
        this._particles = this._particles.filter(p => {
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt; return p.life > 0;
        });
        this._thrustParticles = this._thrustParticles.filter(p => {
            p.vx *= 0.96; p.vy *= 0.96;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.life -= p.decay * dt; return p.life > 0;
        });

        // Update comet positions
        this._bgObjects.filter(o => o.type === 'comet').forEach(c => {
            c.trail.push({ x: c.x, y: c.y });
            if (c.trail.length > c.trailMax) c.trail.shift();
            c.x = ((c.x + c.vx) % WORLD_W + WORLD_W) % WORLD_W;
            c.y = ((c.y + c.vy) % WORLD_H + WORLD_H) % WORLD_H;
        });

        // Smooth camera follow player
        const targetCX = this._player.x - width / 2;
        const targetCY = this._player.y - height / 2;
        this._camX += (targetCX - this._camX) * 0.10;
        this._camY += (targetCY - this._camY) * 0.10;
        this.cameras.main.scrollX = Phaser.Math.Clamp(this._camX, 0, WORLD_W - width);
        this.cameras.main.scrollY = Phaser.Math.Clamp(this._camY, 0, WORLD_H - height);

        if (this._hud) this._hud.updateScore(this._score);
        if (this._asteroids.length === 0 || this._asteroids.every(a => a.isAmbient)) this._waveClear();

        this._drawBackground();
        this._draw();
        this._drawMinimap();
    }

    // ── Parallax background draw (screen-space tiling) ────────────────────────
    _drawBackground() {
        const { width, height } = this.scale;
        const bg = this._bgGfx;
        bg.clear();

        this._starLayers.forEach(layer => {
            layer.stars.forEach(s => {
                // Tiling parallax: star screen pos shifts by a fraction of camera scroll
                const sx = ((s.ax * width - this._camX * layer.parallax % width + width * 20) % width);
                const sy = ((s.ay * height - this._camY * layer.parallax % height + height * 20) % height);
                bg.fillStyle(0xffffff, s.alpha);
                bg.fillCircle(sx, sy, s.size);
            });
        });
    }

    // ── World draw (world-space objects, camera handles offset) ──────────────
    _draw() {
        const g = this._gfx;
        const tg = this._topGfx;
        g.clear();
        tg.clear();

        const cam = this.cameras.main;

        // 0. Deep-space background objects
        this._bgObjects.forEach(o => {
            if (o.type === 'nebula') {
                // Visible range check
                if (Math.hypot(o.x - cam.scrollX - cam.width / 2, o.y - cam.scrollY - cam.height / 2) > o.r + 500) return;
                g.fillStyle(o.col, o.alpha);
                g.fillCircle(o.x, o.y, o.r);
                g.fillStyle(o.col, o.alpha * 0.5);
                g.fillCircle(o.x + 40, o.y + 30, o.r * 0.7);
                g.fillStyle(o.col, o.alpha * 0.3);
                g.fillCircle(o.x - 50, o.y - 40, o.r * 0.5);
            } else if (o.type === 'planet') {
                if (Math.hypot(o.x - cam.scrollX - cam.width / 2, o.y - cam.scrollY - cam.height / 2) > o.r + 400) return;
                // Planet body
                g.fillStyle(o.col, 0.85);
                g.fillCircle(o.x, o.y, o.r);
                // Shading
                g.fillStyle(0x000000, 0.3);
                g.fillCircle(o.x + o.r * 0.25, o.y - o.r * 0.1, o.r * 0.8);
                // Ring
                if (o.hasRing) {
                    g.lineStyle(o.ringW, o.ringCol, 0.4);
                    g.strokeEllipse(o.x, o.y, o.r * 3.2, o.r * 0.7);
                }
                // Atmosphere glow
                g.lineStyle(6, o.col, 0.2);
                g.strokeCircle(o.x, o.y, o.r + 8);
            } else if (o.type === 'comet') {
                // Trail
                o.trail.forEach((pt, i) => {
                    const alpha = (i / o.trail.length) * 0.6;
                    const size = (i / o.trail.length) * 3;
                    g.fillStyle(0xaaddff, alpha);
                    g.fillCircle(pt.x, pt.y, size);
                });
                // Head
                g.fillStyle(0xffffff, 0.9);
                g.fillCircle(o.x, o.y, 3.5);
                g.fillStyle(0xaaddff, 0.5);
                g.fillCircle(o.x, o.y, 7);
            }
        });

        // 1. Explosion particles
        this._particles.forEach(p => {
            const alpha = Phaser.Math.Clamp(p.life, 0, 1);
            const r = (p.color >> 16) & 0xff, gv = (p.color >> 8) & 0xff, b = p.color & 0xff;
            g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), alpha);
            g.fillCircle(p.x, p.y, p.size);
        });

        // 2. Thrust particles — heat gradient
        this._thrustParticles.forEach(tp => {
            const age = 1 - tp.life;
            let r, gv, b;
            if (age < 0.25) { const t = age / 0.25; r = 255; gv = 255; b = Math.round(220 * (1 - t)); }
            else if (age < 0.55) { const t = (age - 0.25) / 0.30; r = 255; gv = Math.round(255 - 155 * t); b = 0; }
            else { const t = (age - 0.55) / 0.45; r = 255; gv = Math.round(100 * (1 - t)); b = 0; }
            g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), tp.life * 0.85);
            g.fillCircle(tp.x, tp.y, tp.size);
        });

        // 3. Player ship
        if (this._player._visible) this._player.draw(g);

        // 4. Asteroids
        this._asteroids.forEach(a => a.draw(g));

        // 4b. Weapon glow visible inside weapon-carrying asteroids
        const now = this.time.now;
        for (const a of this._asteroids) {
            if (!a.containsWeapon) continue;
            const wInfo = GearData.weapons[a.containsWeapon];
            if (!wInfo) continue;
            const color = wInfo.bulletColor || 0xffff00;
            const pulse = 0.45 + Math.sin(now * 0.004) * 0.3;
            const s = a.size * 0.32;
            const rot = now * 0.0015;
            const rc = Math.cos(rot), rs = Math.sin(rot);
            // Rotating diamond outline
            g.lineStyle(1.5, color, pulse);
            g.beginPath();
            g.moveTo(a.x + rc * s, a.y + rs * s);
            g.lineTo(a.x - rs * s, a.y + rc * s);
            g.lineTo(a.x - rc * s, a.y - rs * s);
            g.lineTo(a.x + rs * s, a.y - rc * s);
            g.closePath();
            g.strokePath();
            // Soft inner glow
            g.fillStyle(color, pulse * 0.55);
            g.fillCircle(a.x, a.y, 3.5);
        }

        // 5. Bullets
        this._bullets.forEach(b => {
            const alpha = Phaser.Math.Clamp(b.life / 1400, 0, 1);
            const r = (b.color >> 16) & 0xff;
            const gv = (b.color >> 8) & 0xff;
            const bv = b.color & 0xff;
            tg.fillStyle(Phaser.Display.Color.GetColor(r, gv, bv), alpha);
            if (b.isBomb) {
                tg.fillCircle(b.x, b.y, 7);
                tg.lineStyle(2, b.color, alpha * 0.5);
                tg.strokeCircle(b.x, b.y, b.bombRadius * (1 - b.life / 6000) * 0.4);
            } else if (b.isMissile) {
                const ang = b.angle ?? Math.atan2(b.vy, b.vx);
                const mc = Math.cos(ang), ms = Math.sin(ang);
                // Body
                tg.fillStyle(b.color, alpha);
                tg.beginPath();
                tg.moveTo(b.x + mc * 9, b.y + ms * 9);
                tg.lineTo(b.x - mc * 5 - ms * 3, b.y - ms * 5 + mc * 3);
                tg.lineTo(b.x - mc * 5 + ms * 3, b.y - ms * 5 - mc * 3);
                tg.closePath();
                tg.fillPath();
                // Exhaust flicker
                tg.fillStyle(0xffaa00, alpha * (0.5 + Math.random() * 0.5));
                tg.fillCircle(b.x - mc * 6, b.y - ms * 6, 2.5 + Math.random() * 1.5);
            } else {
                tg.fillCircle(b.x, b.y, 3);
            }
        });

        // 5b. Continuous laser beam
        if (this._laserActive && this._player._visible) {
            const p = this._player;
            const cos = Math.cos(p.rotation);
            const sin = Math.sin(p.rotation);
            const startX = p.x + cos * 20;
            const startY = p.y + sin * 20;
            const len = 900;   // beam length in world units
            const endX = startX + cos * len;
            const endY = startY + sin * len;

            // Outer glow
            tg.lineStyle(8, 0xff00ff, 0.2);
            tg.beginPath();
            tg.moveTo(startX, startY);
            tg.lineTo(endX, endY);
            tg.strokePath();
            // Core beam
            tg.lineStyle(2, 0xff00ff, 0.9);
            tg.beginPath();
            tg.moveTo(startX, startY);
            tg.lineTo(endX, endY);
            tg.strokePath();
        }

        // 6. Shield ring
        if (this._shield?.active && this._player._visible) {
            tg.lineStyle(2, 0x4488ff, 0.6);
            tg.strokeCircle(this._player.x, this._player.y, this._playerStats.radius + 14);
        }

        // 7. Pickups
        this._pickups.forEach(p => {
            const alpha = Phaser.Math.Clamp(p.life / 2000, 0, 1);
            const wInfo = GearData.weapons[p.id];
            const color = wInfo?.bulletColor || 0xffff00;
            const size = 12;
            const cos = Math.cos(p.rotation);
            const sin = Math.sin(p.rotation);

            tg.lineStyle(2, color, alpha);
            tg.fillStyle(color, alpha * 0.4);
            tg.beginPath();
            tg.moveTo(p.x + cos * size - sin * size, p.y + sin * size + cos * size);
            tg.lineTo(p.x - cos * size - sin * size, p.y - sin * size + cos * size);
            tg.lineTo(p.x - cos * size + sin * size, p.y - sin * size - cos * size);
            tg.lineTo(p.x + cos * size + sin * size, p.y + sin * size - cos * size);
            tg.closePath();
            tg.fillPath();
            tg.strokePath();
            tg.fillStyle(color, alpha);
            tg.fillCircle(p.x, p.y, 5);
        });

        // 8. UFO
        if (this._ufo) {
            const { x, y } = this._ufo;
            // Saucer body (wide flat ellipse)
            tg.fillStyle(0xcc44ff, 0.85);
            tg.fillEllipse(x, y, UFO_RADIUS * 2, UFO_RADIUS * 0.7);
            // Rim highlight
            tg.lineStyle(2, 0xff88ff, 0.9);
            tg.strokeEllipse(x, y, UFO_RADIUS * 2, UFO_RADIUS * 0.7);
            // Dome on top
            tg.fillStyle(0x88ccff, 0.75);
            tg.fillEllipse(x, y - UFO_RADIUS * 0.25, UFO_RADIUS * 1.0, UFO_RADIUS * 0.65);
            tg.lineStyle(1, 0xaaddff, 0.6);
            tg.strokeEllipse(x, y - UFO_RADIUS * 0.25, UFO_RADIUS * 1.0, UFO_RADIUS * 0.65);
            // Running lights (four colored dots around rim)
            const lightCols = [0xff0000, 0x00ff88, 0xff0000, 0x00ff88];
            for (let i = 0; i < 4; i++) {
                const la = (i / 4) * Math.PI * 2;
                tg.fillStyle(lightCols[i], 0.9);
                tg.fillCircle(x + Math.cos(la) * UFO_RADIUS * 0.85, y + Math.sin(la) * UFO_RADIUS * 0.2, 2.5);
            }
        }

        // 8b. UFO bullets
        this._ufoBullets.forEach(b => {
            const alpha = Phaser.Math.Clamp(b.life / 3000, 0, 1);
            tg.fillStyle(0xff4444, alpha);
            tg.fillCircle(b.x, b.y, 3.5);
            tg.lineStyle(1, 0xff8888, alpha * 0.6);
            tg.strokeCircle(b.x, b.y, 5.5);
        });
    }

    // ── Firing ────────────────────────────────────────────────────────────────
    _fire() {
        const p = this._player, ws = this._weaponStats;

        if (ws.type === '360') {
            // Fire 8 bullets evenly in all directions
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                this._bullets.push({
                    x: p.x + Math.cos(a) * 22,
                    y: p.y + Math.sin(a) * 22,
                    vx: Math.cos(a) * ws.bulletSpeed + p.vx,
                    vy: Math.sin(a) * ws.bulletSpeed + p.vy,
                    life: 1800, color: ws.bulletColor,
                });
            }
            return;
        }

        if (ws.type === 'bomb') {
            this._bullets.push({
                x: p.x + Math.cos(p.rotation) * 22,
                y: p.y + Math.sin(p.rotation) * 22,
                vx: Math.cos(p.rotation) * ws.bulletSpeed + p.vx,
                vy: Math.sin(p.rotation) * ws.bulletSpeed + p.vy,
                life: 6000, color: ws.bulletColor,
                isBomb: true, bombRadius: ws.bombRadius,
            });
            return;
        }

        if (ws.type === 'missile') {
            const angle = p.rotation;
            this._bullets.push({
                x: p.x + Math.cos(angle) * 22,
                y: p.y + Math.sin(angle) * 22,
                vx: Math.cos(angle) * ws.bulletSpeed + p.vx,
                vy: Math.sin(angle) * ws.bulletSpeed + p.vy,
                life: 6000, color: ws.bulletColor,
                isMissile: true, angle,
                turnRate: 0.07,
            });
            return;
        }

        // Standard: single, rapid, triple
        for (let i = 0; i < ws.bulletCount; i++) {
            const spread = ws.bulletCount > 1 ? (i - (ws.bulletCount - 1) / 2) * ws.spread : 0;
            const a = p.rotation + spread;
            this._bullets.push({
                x: p.x + Math.cos(p.rotation) * 22,
                y: p.y + Math.sin(p.rotation) * 22,
                vx: Math.cos(a) * ws.bulletSpeed + p.vx,
                vy: Math.sin(a) * ws.bulletSpeed + p.vy,
                life: 2000, color: ws.bulletColor,
            });
        }
    }

    // ── Laser hit detection (raycast) ─────────────────────────────────────────
    _laserHitAsteroid() {
        const p = this._player;
        const cos = Math.cos(p.rotation);
        const sin = Math.sin(p.rotation);
        const len = 900;

        const deadA = new Set(), newRocks = [];
        this._asteroids.forEach((a, ai) => {
            if (deadA.has(ai)) return;
            // Project asteroid center onto laser ray, check perpendicular distance
            const dx = a.x - p.x;
            const dy = a.y - p.y;
            const proj = dx * cos + dy * sin;    // distance along ray
            if (proj < 0 || proj > len) return;  // behind ship or too far
            const perp = Math.abs(dx * sin - dy * cos); // perpendicular dist
            if (perp < a.size + 5) deadA.add(ai);
        });

        this._asteroids.forEach((a, ai) => {
            if (deadA.has(ai)) {
                this._explode(a.x, a.y, a.colorHex);
                this._score += a.size > 25 ? 10 : a.size > 14 ? 30 : 50;
                if (a.size > 8) {
                    const childSize  = a.size >= 50 ? 40 : a.size >= 30 ? 20 : 10;
                    const childCount = a.size >= 50
                        ? (Math.random() < 0.5 ? 2 : 3)
                        : a.size >= 30
                            ? (Math.random() < 0.5 ? 1 : 3)
                            : (Math.random() < 0.5 ? 1 : 2);
                    for (let ci = 0; ci < childCount; ci++) {
                        const ch = new Asteroid(this, a.x, a.y, childSize, a.colorHex, a.speedMult);
                        if (a.isAmbient) ch.isAmbient = true;
                        newRocks.push(ch);
                    }
                }
                if (a.containsWeapon) {
                    this._pickups.push({ x: a.x, y: a.y, id: a.containsWeapon, life: 14000, rotation: 0 });
                }
            } else newRocks.push(a);
        });
        this._asteroids = newRocks;
    }

    // ── Thrust particles ──────────────────────────────────────────────────────
    _emitThrustParticles() {
        const p = this._player;
        const cos = Math.cos(p.rotation);
        const sin = Math.sin(p.rotation);
        const ox = p.x - cos * 12;
        const oy = p.y - sin * 12;

        if (this._thrustParticles.length >= 250) return;
        for (let i = 0; i < 5; i++) {
            const spread = (Math.random() - 0.5) * 0.65;
            const spd = Math.random() * 3.2 + 1.4;
            const angle = p.rotation + Math.PI + spread;
            this._thrustParticles.push({
                x: ox + (Math.random() - 0.5) * 5,
                y: oy + (Math.random() - 0.5) * 5,
                vx: Math.cos(angle) * spd + p.vx * 0.25,
                vy: Math.sin(angle) * spd + p.vy * 0.25,
                life: 1.0,
                decay: Math.random() * 0.038 + 0.022,
                size: Math.random() * 2.8 + 1.0,
            });
        }
    }

    // ── Wave spawning ─────────────────────────────────────────────────────────
    _spawnWave(wave) {
        const count = WAVE_BASE + (wave - 1) * 2;
        const speedMult = 1 + (wave - 1) * 0.12;
        const px = this._player.x, py = this._player.y;
        for (let i = 0; i < count; i++) {
            let x, y;
            do {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 400 + 200;
                x = px + Math.cos(angle) * dist;
                y = py + Math.sin(angle) * dist;
            } while (Math.hypot(x - px, y - py) < 150);
            // 35% chance of giant (size 60) — gives more visual variety
            const size = Math.random() < 0.35 ? 60 : 40;
            const rock = new Asteroid(this, x, y, size, null, speedMult);
            if (Math.random() < 0.12) rock.containsWeapon = WEAPON_DROP_POOL[Math.floor(Math.random() * WEAPON_DROP_POOL.length)];
            this._asteroids.push(rock);
        }
    }

    // ── Ambient asteroid field (persistent world debris) ──────────────────────
    _spawnAmbientAsteroids() {
        const cx = WORLD_W / 2, cy = WORLD_H / 2;
        let count = 0;
        while (count < 40) {
            const x = Math.random() * WORLD_W;
            const y = Math.random() * WORLD_H;
            if (Math.hypot(x - cx, y - cy) < 600) continue;
            // Mostly giants and large — small ones only appear as split debris
            const size = Math.random() < 0.50 ? 60 : 40;
            const rock = new Asteroid(this, x, y, size, null, 0.6);
            rock.isAmbient = true;
            if (Math.random() < 0.12) rock.containsWeapon = WEAPON_DROP_POOL[Math.floor(Math.random() * WEAPON_DROP_POOL.length)];
            this._asteroids.push(rock);
            count++;
        }
    }

    // ── Pickups ───────────────────────────────────────────────────────────────
    _updatePickups(delta) {
        this._pickups = this._pickups.filter(p => {
            p.life -= delta;
            p.rotation = (p.rotation || 0) + 0.05;
            if (!this._gameOver && !this._invincible && this._player._visible) {
                if (Math.hypot(this._player.x - p.x, this._player.y - p.y) < this._playerStats.radius + 15) {
                    const curTier = WEAPON_TIERS[this._currentWeaponId] ?? 0;
                    const newTier = WEAPON_TIERS[p.id] ?? 0;
                    if (newTier >= curTier) {
                        this._currentWeaponId = p.id;
                        this._weaponStats = { ...GearData.weapons[p.id] };
                        this._shootCooldown = 0;
                    }
                    this._explode(p.x, p.y, GearData.weapons[p.id]?.bulletColor || 0xffffff);
                    return false;
                }
            }
            return p.life > 0;
        });
    }

    // ── Collisions ────────────────────────────────────────────────────────────
    _bulletAsteroidCollisions() {
        const deadB = new Set(), deadA = new Set(), newRocks = [];
        this._bullets.forEach((b, bi) => {
            this._asteroids.forEach((a, ai) => {
                if (deadA.has(ai)) return;
                const hit = b.isBomb
                    ? Math.hypot(b.x - a.x, b.y - a.y) < b.bombRadius // bomb: large radius, always kills even big
                    : Math.hypot(b.x - a.x, b.y - a.y) < a.size;
                if (hit) { deadB.add(bi); deadA.add(ai); }
            });
        });

        this._asteroids.forEach((a, ai) => {
            if (deadA.has(ai)) {
                this._explode(a.x, a.y, a.colorHex);
                this._score += a.size > 25 ? 10 : a.size > 14 ? 30 : 50;

                // Bomb destroys without splitting; otherwise variable fragment count by tier
                const killedByBomb = [...deadB].some(bi => this._bullets[bi]?.isBomb);
                if (a.size > 8 && !killedByBomb) {
                    // 60→2-3 large(40)   40→1-3 medium(20)   20→1-2 small(10)
                    const childSize  = a.size >= 50 ? 40 : a.size >= 30 ? 20 : 10;
                    const childCount = a.size >= 50
                        ? (Math.random() < 0.5 ? 2 : 3)
                        : a.size >= 30
                            ? (Math.random() < 0.5 ? 1 : 3)
                            : (Math.random() < 0.5 ? 1 : 2);
                    for (let ci = 0; ci < childCount; ci++) {
                        const ch = new Asteroid(this, a.x, a.y, childSize, a.colorHex, a.speedMult);
                        if (a.isAmbient) ch.isAmbient = true;
                        newRocks.push(ch);
                    }
                }

                // Pre-assigned weapon always drops; rare random surprise otherwise
                if (a.containsWeapon) {
                    this._pickups.push({ x: a.x, y: a.y, id: a.containsWeapon, life: 14000, rotation: 0 });
                } else if (this._weaponsDroppedThisWave < 2 && Math.random() < 0.07) {
                    const wepId = WEAPON_DROP_POOL[Math.floor(Math.random() * WEAPON_DROP_POOL.length)];
                    this._pickups.push({ x: a.x, y: a.y, id: wepId, life: 14000, rotation: 0 });
                    this._weaponsDroppedThisWave++;
                }
            } else newRocks.push(a);
        });
        this._asteroids = newRocks;
        this._bullets = this._bullets.filter((_, bi) => !deadB.has(bi));
    }

    _playerAsteroidCollisions() {
        const r = this._playerStats.radius;
        for (const a of this._asteroids) {
            if (Math.hypot(this._player.x - a.x, this._player.y - a.y) < a.size + r) {
                if (this._shield?.active) {
                    this._shield.active = false;
                    this._explode(this._player.x, this._player.y, 0x4488ff);
                    if (this._shieldDef.regenTime) this._shield.regenTimer = this._shieldDef.regenTime;
                    this._syncHUD();
                } else {
                    this._loseLife();
                }
                break;
            }
        }
    }

    _loseLife() {
        this._lives--;
        this._syncHUD();
        this._explode(this._player.x, this._player.y, 0xffffff);
        if (this._lives <= 0) { this._endGame(); return; }
        // Respawn in place (no screen center reset)
        Object.assign(this._player, { vx: 0, vy: 0, rotation: -Math.PI / 2, rotVel: 0, _visible: true });
        if (this._shield) { this._shield.active = true; this._shield.regenTimer = 0; }
        this._invincible = true;
        let n = 0;
        const t = this.time.addEvent({
            delay: 150, loop: true, callback: () => {
                this._player._visible = !this._player._visible;
                if (++n >= 20) { this._player._visible = true; this._invincible = false; t.remove(); }
            }
        });
    }

    // ── Wave clear ────────────────────────────────────────────────────────────
    _waveClear() {
        this._ufo = null; this._ufoBullets = [];
        this._waveClearPending = true;
        const save = SaveManager.load();
        const dropChance = this._wave <= 3 ? 1.0 : Math.max(0.3, 0.8 - this._wave * 0.05);
        let gearDrop = null;
        if (Math.random() < dropChance) {
            gearDrop = rollLootDrop(save.gear);
            if (gearDrop) SaveManager.addGear(gearDrop.slot, gearDrop.id);
        }
        this.scene.pause('GameScene');
        this.scene.launch('WaveCompleteScene', { wave: this._wave, score: this._score, gearDrop });
    }

    _onNextWave() {
        this._wave++;
        this._ufo = null; this._ufoBullets = [];
        this._spawnWave(this._wave);
        this._waveClearPending = false;
        this._weaponsDroppedThisWave = 0;
        this._syncHUD();
        this._scheduleUFO();
    }

    // ── Game over ─────────────────────────────────────────────────────────────
    _endGame() {
        this._gameOver = true;
        const save = SaveManager.load();
        if (this._score > save.profile.highScore) SaveManager.updateProfile({ highScore: this._score });
        SaveManager.updateProfile({ totalScore: save.profile.totalScore + this._score, sessionsPlayed: save.profile.sessionsPlayed + 1 });
        this.scene.stop('HUDScene');
        this.scene.launch('GameOverScene', { score: this._score, wave: this._wave });
    }

    // ── Explosion ─────────────────────────────────────────────────────────────
    _explode(x, y, colorHex) {
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
            const spd = Math.random() * 2.5 + 0.5;
            this._particles.push({
                x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                life: 1, decay: Math.random() * 0.025 + 0.015, size: Math.random() * 2.5 + 0.8, color: colorHex
            });
        }
    }

    // ── UFO ───────────────────────────────────────────────────────────────────
    _scheduleUFO() {
        // Spawn 7–12 seconds into the wave, once per wave
        const delay = 7000 + Math.random() * 5000;
        this.time.delayedCall(delay, () => {
            if (!this._gameOver && !this._waveClearPending && !this._ufo) this._spawnUFO();
        });
    }

    _spawnUFO() {
        const cam = this.cameras.main;
        const { width, height } = this.scale;
        // Spawn off-screen relative to current viewport
        const angle = Math.random() * Math.PI * 2;
        const dist = 450 + Math.random() * 200;
        const cx = cam.scrollX + width / 2;
        const cy = cam.scrollY + height / 2;
        this._ufo = {
            x: Phaser.Math.Clamp(cx + Math.cos(angle) * dist, 50, WORLD_W - 50),
            y: Phaser.Math.Clamp(cy + Math.sin(angle) * dist, 50, WORLD_H - 50),
            vx: 0, vy: 0,
            hp: UFO_HP,
            shootTimer: 1800,
            sineT: 0,
            laserTimer: 0,
        };
    }

    _updateUFO(delta) {
        const ufo = this._ufo;
        const px = this._player.x, py = this._player.y;

        // Gradually steer toward player with sinusoidal wobble
        const desiredAngle = Math.atan2(py - ufo.y, px - ufo.x);
        const curAngle = Math.atan2(ufo.vy, ufo.vx) || desiredAngle;
        const diff = Phaser.Math.Angle.Wrap(desiredAngle - curAngle);
        const newAngle = curAngle + Phaser.Math.Clamp(diff, -0.03, 0.03);

        ufo.sineT += delta * 0.002;
        const perp = newAngle + Math.PI / 2;
        const wobble = Math.sin(ufo.sineT) * 0.8;
        const BASE = 1.4;

        ufo.vx = Math.cos(newAngle) * BASE + Math.cos(perp) * wobble;
        ufo.vy = Math.sin(newAngle) * BASE + Math.sin(perp) * wobble;
        ufo.x = ((ufo.x + ufo.vx + WORLD_W) % WORLD_W);
        ufo.y = ((ufo.y + ufo.vy + WORLD_H) % WORLD_H);

        // Fire at player
        ufo.shootTimer -= delta;
        if (ufo.shootTimer <= 0) {
            ufo.shootTimer = 2000 + Math.random() * 1500;
            const a = Math.atan2(py - ufo.y, px - ufo.x);
            this._ufoBullets.push({ x: ufo.x, y: ufo.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 3000 });
        }

        // Advance UFO bullets
        this._ufoBullets = this._ufoBullets.filter(b => {
            b.x += b.vx; b.y += b.vy; b.life -= delta;
            return b.life > 0;
        });
    }

    _damageUFO(amount) {
        if (!this._ufo) return;
        this._ufo.hp -= amount;
        this._explode(this._ufo.x, this._ufo.y, 0xaaddff);
        if (this._ufo.hp <= 0) {
            this._score += UFO_SCORE;
            this._explode(this._ufo.x, this._ufo.y, 0xffffff);
            this._explode(this._ufo.x, this._ufo.y, 0x00ffff);
            // Guaranteed weapon drop on UFO kill
            const wepId = WEAPON_DROP_POOL[Math.floor(Math.random() * WEAPON_DROP_POOL.length)];
            this._pickups.push({ x: this._ufo.x, y: this._ufo.y, id: wepId, life: 14000, rotation: 0 });
            this._ufo = null;
            this._ufoBullets = [];
        }
    }

    _ufoCollisions() {
        if (!this._ufo) return;
        const ufo = this._ufo;

        // Laser continuously damages UFO
        if (this._laserActive && this._player._visible) {
            const p = this._player;
            const cos = Math.cos(p.rotation), sin = Math.sin(p.rotation);
            const dx = ufo.x - p.x, dy = ufo.y - p.y;
            const proj = dx * cos + dy * sin;
            if (proj > 0 && proj < 900 && Math.abs(dx * sin - dy * cos) < UFO_RADIUS) {
                ufo.laserTimer -= 16; // approx one frame at 60fps
                if (ufo.laserTimer <= 0) {
                    ufo.laserTimer = 400; // 1 damage per 400ms
                    this._damageUFO(1);
                    if (!this._ufo) return;
                }
            }
        }

        // Player bullets → UFO
        const deadB = new Set();
        this._bullets.forEach((b, bi) => {
            if (!this._ufo) return;
            const dist = Math.hypot(b.x - ufo.x, b.y - ufo.y);
            const hit = b.isBomb ? dist < b.bombRadius : dist < UFO_RADIUS;
            if (hit) { deadB.add(bi); this._damageUFO(1); }
        });
        this._bullets = this._bullets.filter((_, bi) => !deadB.has(bi));
        if (!this._ufo) return;

        // UFO bullets → player
        if (!this._invincible && this._player._visible) {
            for (let i = 0; i < this._ufoBullets.length; i++) {
                const b = this._ufoBullets[i];
                if (Math.hypot(b.x - this._player.x, b.y - this._player.y) < this._playerStats.radius + 5) {
                    this._ufoBullets.splice(i, 1);
                    if (this._shield?.active) {
                        this._shield.active = false;
                        this._explode(this._player.x, this._player.y, 0x4488ff);
                        if (this._shieldDef?.regenTime) this._shield.regenTimer = this._shieldDef.regenTime;
                        this._syncHUD();
                    } else { this._loseLife(); }
                    break;
                }
            }
        }
        if (!this._ufo) return;

        // UFO body rams player
        if (!this._invincible && this._player._visible) {
            if (Math.hypot(this._player.x - ufo.x, this._player.y - ufo.y) < UFO_RADIUS + this._playerStats.radius) {
                if (this._shield?.active) {
                    this._shield.active = false;
                    this._explode(this._player.x, this._player.y, 0x4488ff);
                    if (this._shieldDef?.regenTime) this._shield.regenTimer = this._shieldDef.regenTime;
                    this._syncHUD();
                } else { this._loseLife(); }
            }
        }
    }

    // ── Minimap ───────────────────────────────────────────────────────────────
    _drawMinimap() {
        const { width } = this.scale;
        const SIZE = 100;
        const MX = width - SIZE - 8, MY = 8;
        const SC = SIZE / WORLD_W;
        const mg = this._minimapGfx;
        mg.clear();

        // Background
        mg.fillStyle(0x000011, 0.50);
        mg.fillRect(MX, MY, SIZE, SIZE);
        mg.lineStyle(1, 0x334466, 0.8);
        mg.strokeRect(MX, MY, SIZE, SIZE);

        // Asteroids
        for (const a of this._asteroids) {
            const mx = MX + a.x * SC;
            const my = MY + a.y * SC;
            if (mx < MX || mx > MX + SIZE || my < MY || my > MY + SIZE) continue;
            if (a.isAmbient) {
                mg.fillStyle(0x445566, 0.55);
                mg.fillCircle(mx, my, 1.5);
            } else {
                mg.fillStyle(0xaaddff, 0.9);
                mg.fillCircle(mx, my, a.size > 25 ? 2.5 : 1.8);
            }
        }

        // Pickups
        for (const p of this._pickups) {
            const mx = MX + p.x * SC;
            const my = MY + p.y * SC;
            if (mx < MX || mx > MX + SIZE || my < MY || my > MY + SIZE) continue;
            mg.fillStyle(0xffff00, 0.9);
            mg.fillCircle(mx, my, 2);
        }

        // UFO
        if (this._ufo) {
            const ux = MX + this._ufo.x * SC;
            const uy = MY + this._ufo.y * SC;
            mg.fillStyle(0xff44ff, 1);
            mg.fillCircle(ux, uy, 3);
        }

        // Player — dot + facing line
        const px = MX + this._player.x * SC;
        const py = MY + this._player.y * SC;
        const cos = Math.cos(this._player.rotation);
        const sin = Math.sin(this._player.rotation);
        mg.lineStyle(1, 0x00ffff, 0.85);
        mg.beginPath();
        mg.moveTo(px, py);
        mg.lineTo(px + cos * 5, py + sin * 5);
        mg.strokePath();
        mg.fillStyle(0x00ffff, 1);
        mg.fillCircle(px, py, 2.5);
    }

    // ── Mobile controls ───────────────────────────────────────────────────────
    _createMobileControls() {
        const { width, height } = this.scale;
        this._mobileButtons = BTNS(width, height);
        this._btnGfx = this.add.graphics().setScrollFactor(0).setDepth(20);
        this._btnLabels = this._mobileButtons.map(btn =>
            this.add.text(btn.x, btn.y, btn.label, {
                fontFamily: 'monospace', fontSize: '22px', color: '#ffffff'
            }).setOrigin(0.5).setAlpha(0.35).setScrollFactor(0).setDepth(21)
        );
        this._renderButtons();
        this.input.addPointer(3);
        this.input.on('pointerdown', this._refreshMobileState, this);
        this.input.on('pointermove', this._refreshMobileState, this);
        this.input.on('pointerup', this._refreshMobileState, this);
        this.input.on('pointerupoutside', this._refreshMobileState, this);
    }

    _refreshMobileState() {
        Object.keys(this._mobileState).forEach(k => this._mobileState[k] = false);
        [this.input.pointer1, this.input.pointer2, this.input.pointer3, this.input.pointer4]
            .filter(p => p?.isDown)
            .forEach(ptr => {
                const hit = this._mobileButtons.find(btn => Math.hypot(ptr.x - btn.x, ptr.y - btn.y) <= (btn.r * 1.6));
                if (hit) this._mobileState[hit.key] = true;
            });
        this._renderButtons();
    }

    _renderButtons() {
        const gfx = this._btnGfx;
        if (!gfx) return;
        gfx.clear();
        this._mobileButtons.forEach((btn, i) => {
            const pressed = this._mobileState[btn.key];
            gfx.fillStyle(btn.color, pressed ? 0.22 : 0.07);
            gfx.fillCircle(btn.x, btn.y, btn.r);
            gfx.lineStyle(1.5, btn.color, pressed ? 0.85 : 0.22);
            gfx.strokeCircle(btn.x, btn.y, btn.r);
            if (this._btnLabels?.[i]) this._btnLabels[i].setAlpha(pressed ? 0.95 : 0.32);
        });
    }

    shutdown() {
        this.events.off('nextWave', this._onNextWave, this);
        this.input.off('pointerdown', this._refreshMobileState, this);
        this.input.off('pointermove', this._refreshMobileState, this);
        this.input.off('pointerup', this._refreshMobileState, this);
        this.input.off('pointerupoutside', this._refreshMobileState, this);
    }
}
