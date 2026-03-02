import Player from '../objects/Player.js';
import Asteroid from '../objects/Asteroid.js';
import { SaveManager } from '../SaveManager.js';
import { GearData, rollLootDrop } from '../data/GearData.js';

const WAVE_BASE = 5;

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
// ─────────────────────────────────────────────────────────────────────────────

export default class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init() {
        this._score = 0; this._lives = 3; this._wave = 1;
        this._invincible = false; this._gameOver = false; this._waveClearPending = false;
        this._bullets = []; this._asteroids = []; this._particles = []; this._pickups = [];
        this._thrustParticles = [];
        this._shootCooldown = 0; this._shield = null; this._weaponsDroppedThisWave = 0;
        this._mobileState = { rotLeft: false, rotRight: false, thrust: false, shoot: false };
        this._mobileButtons = [];
    }

    create() {
        const { width, height } = this.scale;

        // Load loadout & build stats
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
        this._shieldDef = shd;
        this._lives = this._playerStats.lives;

        if (shd) this._shield = { active: true, regenTimer: 0 };

        // Keyboard input
        this._keys = this.input.keyboard.addKeys({
            thrust: 'UP', rotLeft: 'LEFT', rotRight: 'RIGHT', shoot: 'SPACE',
            thrustW: 'W', rotLeftA: 'A', rotRightD: 'D',
        });

        // Graphics layers — thrust particles underneath player
        this._gfx = this.add.graphics().setDepth(0);
        this._topGfx = this.add.graphics().setDepth(5); // shield ring, bullets

        // Player
        this._player = new Player(this, width / 2, height / 2, this._playerStats);

        this._spawnWave(this._wave);

        // HUD
        if (!this.scene.isActive('HUDScene')) this.scene.launch('HUDScene');
        this._hud = this.scene.get('HUDScene');
        this._syncHUD();

        this.events.on('nextWave', this._onNextWave, this);

        // Mobile controls
        this._createMobileControls();
    }

    // ── Syncs ────────────────────────────────────────────────────────────────
    _syncHUD() {
        if (!this._hud) return;
        this._hud.updateScore(this._score);
        this._hud.updateWave(this._wave);
        this._hud.updateLives(this._lives);
        this._hud.updateShield(!!this._shield?.active);
    }

    // ── Update loop ──────────────────────────────────────────────────────────
    update(_, delta) {
        delta = Math.min(delta, 50); // cap: prevent physics spiral on slow/backgrounded devices
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

        this._shootCooldown -= delta;
        if (shooting && this._shootCooldown <= 0 && !this._invincible) {
            this._fire();
            this._shootCooldown = this._weaponStats.cooldown;
        }

        this._player.update(delta, width, height);

        // Emit thrust particles this frame (uses _wasThrusting set in player.update)
        if (this._player._wasThrusting) this._emitThrustParticles();

        // Update bullet positions
        this._bullets = this._bullets.filter(b => {
            b.x += b.vx; b.y += b.vy; b.life -= delta;
            return b.x >= 0 && b.x <= width && b.y >= 0 && b.y <= height && b.life > 0;
        });

        // Update asteroids
        this._asteroids.forEach(a => a.update(width, height));

        // Updates logic: Collsions
        this._bulletAsteroidCollisions();
        if (!this._invincible) this._playerAsteroidCollisions();
        this._updatePickups(delta);

        // Shield regen
        if (this._shield && !this._shield.active && this._shieldDef?.regenTime) {
            this._shield.regenTimer -= delta;
            if (this._shield.regenTimer <= 0) { this._shield.active = true; this._syncHUD(); }
        }

        // Update explosion particles
        const dt = delta / 16.67;
        this._particles = this._particles.filter(p => {
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt; return p.life > 0;
        });

        // Update thrust particles (slow drag)
        this._thrustParticles = this._thrustParticles.filter(p => {
            p.vx *= 0.96; p.vy *= 0.96;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.life -= p.decay * dt; return p.life > 0;
        });

        if (this._hud) this._hud.updateScore(this._score);

        if (this._asteroids.length === 0) this._waveClear();

        this._draw();
    }

    _updatePickups(delta) {
        this._pickups = this._pickups.filter(p => {
            p.life -= delta;
            p.rotation = (p.rotation || 0) + 0.05;

            // Player collision
            if (!this._gameOver && !this._invincible && this._player._visible) {
                if (Math.hypot(this._player.x - p.x, this._player.y - p.y) < this._playerStats.radius + 15) {
                    this._weaponStats = { ...GearData.weapons[p.id] };
                    this._shootCooldown = 0;
                    // Play a quick confirmation particle blast using the weapon's color
                    this._explode(p.x, p.y, this._weaponStats.bulletColor || 0xffffff);
                    return false; // Remove collected pickup
                }
            }
            return p.life > 0;
        });
    }

    // ── Firing ───────────────────────────────────────────────────────────────
    _fire() {
        const p = this._player, ws = this._weaponStats;
        for (let i = 0; i < ws.bulletCount; i++) {
            const spread = ws.bulletCount > 1 ? (i - (ws.bulletCount - 1) / 2) * ws.spread : 0;
            const a = p.rotation + spread;
            this._bullets.push({
                x: p.x + Math.cos(p.rotation) * 22,
                y: p.y + Math.sin(p.rotation) * 22,
                vx: Math.cos(a) * ws.bulletSpeed + p.vx * 0.3,
                vy: Math.sin(a) * ws.bulletSpeed + p.vy * 0.3,
                life: 2000, color: ws.bulletColor || 0xffffff,
            });
        }
    }

    // ── Thrust particles ─────────────────────────────────────────────────────
    _emitThrustParticles() {
        const p = this._player;
        const cos = Math.cos(p.rotation);
        const sin = Math.sin(p.rotation);
        // Exhaust nozzle — back of ship
        const ox = p.x - cos * 12;
        const oy = p.y - sin * 12;

        if (this._thrustParticles.length >= 250) return; // performance cap
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

    // ── Wave spawning ────────────────────────────────────────────────────────
    _spawnWave(wave) {
        const { width, height } = this.scale;
        const count = WAVE_BASE + (wave - 1) * 2;
        const speedMult = 1 + (wave - 1) * 0.12;
        for (let i = 0; i < count; i++) {
            let x, y;
            do { x = Math.random() * width; y = Math.random() * height; }
            while (Math.hypot(x - width / 2, y - height / 2) < 120);
            this._asteroids.push(new Asteroid(this, x, y, 40, null, speedMult));
        }
    }

    // ── Collisions ───────────────────────────────────────────────────────────
    _bulletAsteroidCollisions() {
        const deadB = new Set(), deadA = new Set(), newRocks = [];
        this._bullets.forEach((b, bi) => {
            this._asteroids.forEach((a, ai) => {
                if (deadA.has(ai)) return;
                if (Math.hypot(b.x - a.x, b.y - a.y) < a.size) { deadB.add(bi); deadA.add(ai); }
            });
        });
        this._asteroids.forEach((a, ai) => {
            if (deadA.has(ai)) {
                this._explode(a.x, a.y, a.colorHex);
                this._score += a.size > 25 ? 10 : a.size > 14 ? 30 : 50;
                if (a.size > 18) {
                    newRocks.push(new Asteroid(this, a.x, a.y, a.size / 2, a.colorHex, a.speedMult));
                    newRocks.push(new Asteroid(this, a.x, a.y, a.size / 2, a.colorHex, a.speedMult));
                }

                if (this._weaponsDroppedThisWave < 2 && Math.random() < 0.06) {
                    const wkeys = Object.keys(GearData.weapons);
                    const randomWepId = wkeys[Math.floor(Math.random() * wkeys.length)];
                    this._pickups.push({ x: a.x, y: a.y, id: randomWepId, life: 12000, rotation: 0 });
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
        const { width, height } = this.scale;
        Object.assign(this._player, { x: width / 2, y: height / 2, vx: 0, vy: 0, rotation: -Math.PI / 2, rotVel: 0, _visible: true });
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

    // ── Wave clear ───────────────────────────────────────────────────────────
    _waveClear() {
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
        this._spawnWave(this._wave);
        this._waveClearPending = false;
        this._weaponsDroppedThisWave = 0;
        this._syncHUD();
    }

    // ── Game over ────────────────────────────────────────────────────────────
    _endGame() {
        this._gameOver = true;
        const save = SaveManager.load();
        if (this._score > save.profile.highScore) SaveManager.updateProfile({ highScore: this._score });
        SaveManager.updateProfile({ totalScore: save.profile.totalScore + this._score, sessionsPlayed: save.profile.sessionsPlayed + 1 });
        this.scene.stop('HUDScene');
        this.scene.launch('GameOverScene', { score: this._score, wave: this._wave });
    }

    // ── Explosion particles ───────────────────────────────────────────────────
    _explode(x, y, colorHex) {
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
            const spd = Math.random() * 2.5 + 0.5;
            this._particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, decay: Math.random() * 0.025 + 0.015, size: Math.random() * 2.5 + 0.8, color: colorHex });
        }
    }

    // ── Draw ─────────────────────────────────────────────────────────────────
    _draw() {
        const g = this._gfx;
        const tg = this._topGfx;
        g.clear();
        tg.clear();

        // 1. Explosion particles
        this._particles.forEach(p => {
            const alpha = Phaser.Math.Clamp(p.life, 0, 1);
            const r = (p.color >> 16) & 0xff, gv = (p.color >> 8) & 0xff, b = p.color & 0xff;
            g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), alpha);
            g.fillCircle(p.x, p.y, p.size);
        });

        // 2. Thrust particles — heat gradient (white→yellow→orange→red)
        this._thrustParticles.forEach(tp => {
            const age = 1 - tp.life; // 0=fresh, 1=dying
            let r, gv, b;
            if (age < 0.25) {
                const t = age / 0.25;
                r = 255; gv = 255; b = Math.round(220 * (1 - t));
            } else if (age < 0.55) {
                const t = (age - 0.25) / 0.30;
                r = 255; gv = Math.round(255 - 155 * t); b = 0;
            } else {
                const t = (age - 0.55) / 0.45;
                r = 255; gv = Math.round(100 * (1 - t)); b = 0;
            }
            g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), tp.life * 0.85);
            g.fillCircle(tp.x, tp.y, tp.size);
        });

        // 3. Player ship
        if (this._player._visible) this._player.draw(g);

        // 4. Asteroids
        this._asteroids.forEach(a => a.draw(g));

        // 5. Bullets (top layer)
        this._bullets.forEach(b => {
            const alpha = Phaser.Math.Clamp(b.life / 1400, 0, 1);
            const r = (b.color >> 16) & 0xff, gv = (b.color >> 8) & 0xff, bv = b.color & 0xff;
            tg.fillStyle(Phaser.Display.Color.GetColor(r, gv, bv), alpha);
            tg.fillCircle(b.x, b.y, 3);
        });

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

            // Draw a distinct inner shape
            tg.fillStyle(color, alpha);
            tg.fillCircle(p.x, p.y, 5);
        });
    }

    // ── Mobile controls ───────────────────────────────────────────────────────
    _createMobileControls() {
        const { width, height } = this.scale;

        this._mobileButtons = BTNS(width, height);
        this._btnGfx = this.add.graphics().setDepth(20);
        this._btnLabels = this._mobileButtons.map(btn =>
            this.add.text(btn.x, btn.y, btn.label, {
                fontFamily: 'monospace', fontSize: '22px', color: '#ffffff'
            }).setOrigin(0.5).setAlpha(0.35).setDepth(21)
        );

        this._renderButtons();

        // Enable 4 simultaneous touches
        this.input.addPointer(3);

        this.input.on('pointerdown', this._refreshMobileState, this);
        this.input.on('pointermove', this._refreshMobileState, this);
        this.input.on('pointerup', this._refreshMobileState, this);
        this.input.on('pointerupoutside', this._refreshMobileState, this);
    }

    _refreshMobileState() {
        // Reset then check all active pointers
        Object.keys(this._mobileState).forEach(k => this._mobileState[k] = false);
        [this.input.pointer1, this.input.pointer2, this.input.pointer3, this.input.pointer4]
            .filter(p => p?.isDown)
            .forEach(ptr => {
                // Expand hit area invisibly by 1.6x for more forgiving touches on mobile
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
            if (this._btnLabels?.[i]) {
                this._btnLabels[i].setAlpha(pressed ? 0.95 : 0.32);
            }
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
