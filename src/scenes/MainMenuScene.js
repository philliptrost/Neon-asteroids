import { SaveManager } from '../SaveManager.js';

const ROCK_COLORS = [0x00ffff, 0xff00ff, 0x00ff88, 0xffff00, 0xff6600];

export default class MainMenuScene extends Phaser.Scene {
    constructor() { super('MainMenuScene'); }

    create() {
        const { width, height } = this.scale;

        // Bloom PostFX
        this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1.2, 1.1);

        // Starfield
        this._stars = [];
        for (let i = 0; i < 100; i++) {
            const star = this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 1.5 + 0.3, 0xffffff, Math.random() * 0.7 + 0.3);
            this._stars.push({ obj: star, speed: Math.random() * 0.15 + 0.05 });
        }

        // Menu asteroids — decorative drifting rocks behind the UI
        this._menuGfx = this.add.graphics().setDepth(-5);
        this._menuRocks = [];
        for (let i = 0; i < 8; i++) {
            const sides = Math.floor(Math.random() * 3) + 5;
            const verts = Array.from({ length: sides }, (_, j) => ({
                a: (j / sides) * Math.PI * 2,
                r: 0.65 + Math.random() * 0.35,
            }));
            this._menuRocks.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: Math.random() * 0.35 + 0.1,
                size: Math.random() * 18 + 10,
                angle: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.012,
                color: ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)],
                verts,
            });
        }

        // Title
        this.add.text(width / 2, height * 0.20, 'NEON', {
            fontFamily: 'monospace', fontSize: '64px', color: '#00ffff',
            stroke: '#00ffff', strokeThickness: 2,
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffff', blur: 30, fill: true }
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.42, 'ASTEROIDS', {
            fontFamily: 'monospace', fontSize: '38px', color: '#ff00ff',
            stroke: '#ff00ff', strokeThickness: 2,
            shadow: { offsetX: 0, offsetY: 0, color: '#ff00ff', blur: 24, fill: true }
        }).setOrigin(0.5);

        // High score
        const save = SaveManager.load();
        if (save.profile.highScore > 0) {
            this.add.text(width / 2, height * 0.57, `BEST: ${save.profile.highScore}`, {
                fontFamily: 'monospace', fontSize: '16px', color: '#ffff66'
            }).setOrigin(0.5);
        }

        // Start button — mobile-first label
        const startBtn = this.add.text(width / 2, height * 0.68, '[ TAP TO LAUNCH ]', {
            fontFamily: 'monospace', fontSize: '22px', color: '#ffffff'
        }).setOrigin(0.5);
        // Expand hit area vertically and horizontally
        startBtn.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-40, -30, startBtn.width + 80, startBtn.height + 60), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
        this.tweens.add({ targets: startBtn, alpha: 0.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Input — keyboard still works for desktop testing
        this.input.keyboard?.addKey('ENTER').once('down', () => this.scene.start('GameScene'));

        // Let the 'start button' be clickable. Alternatively, tapping ANYWHERE ELSE starts the game via a fullscreen zone behind everything
        const bgZone = this.add.zone(width / 2, height / 2, width, height).setInteractive({ useHandCursor: true }).setDepth(-10);
        bgZone.on('pointerdown', () => this.scene.start('GameScene'));
        startBtn.on('pointerdown', (ptr) => {
            ptr.event.stopPropagation();
            this.scene.start('GameScene');
        });
    }

    update() {
        const { width, height } = this.scale;
        this._stars?.forEach(s => { s.obj.y += s.speed; if (s.obj.y > height + 4) s.obj.y = -4; });

        // Draw drifting menu asteroids
        const g = this._menuGfx;
        if (!g) return;
        g.clear();
        this._menuRocks?.forEach(r => {
            r.x = ((r.x + r.vx) % width + width) % width;
            r.y = ((r.y + r.vy) % height + height) % height;
            r.angle += r.rotSpeed;
            g.lineStyle(1.5, r.color, 0.45);
            g.fillStyle(r.color, 0.07);
            g.beginPath();
            r.verts.forEach((v, i) => {
                const a = v.a + r.angle;
                const px = r.x + Math.cos(a) * r.size * v.r;
                const py = r.y + Math.sin(a) * r.size * v.r;
                if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
            });
            g.closePath();
            g.fillPath();
            g.strokePath();
        });
    }
}
