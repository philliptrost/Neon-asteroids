import { GearData, RARITY_COLORS, SLOT_LABELS } from '../data/GearData.js';

export default class WaveCompleteScene extends Phaser.Scene {
    constructor() { super('WaveCompleteScene'); }

    init(data) {
        this._wave = data.wave || 1;
        this._score = data.score || 0;
        this._gearDrop = data.gearDrop || null;
        this._advanced = false;
    }

    create() {
        const { width, height } = this.scale;

        // Bloom PostFX
        this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1.2, 1.1);

        this.add.rectangle(width / 2, height / 2, width, height, 0x000011, 0.88);

        this.add.text(width / 2, height * 0.14, `WAVE ${this._wave} CLEARED`, {
            fontFamily: 'monospace', fontSize: '36px', color: '#00ffff',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffff', blur: 20, fill: true }
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.28, `SCORE: ${this._score}`, {
            fontFamily: 'monospace', fontSize: '20px', color: '#ffffff'
        }).setOrigin(0.5);

        if (this._gearDrop) {
            const gear = GearData[this._gearDrop.slot]?.[this._gearDrop.id];
            const slotLabel = SLOT_LABELS[this._gearDrop.slot] || this._gearDrop.slot;
            const rarityColor = RARITY_COLORS[gear?.rarity] || '#aaaaaa';
            const boxY = height * 0.52;

            this.add.rectangle(width / 2, boxY, 420, 130, 0x001133, 0.95);
            const border = this.add.rectangle(width / 2, boxY, 420, 130, 0, 0).setStrokeStyle(2, 0x00ffff, 0.9);
            this.tweens.add({ targets: border, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

            this.add.text(width / 2, boxY - 46, '✦ GEAR UNLOCKED ✦', {
                fontFamily: 'monospace', fontSize: '13px', color: '#ffff00'
            }).setOrigin(0.5);
            this.add.text(width / 2, boxY - 22, `[ ${slotLabel} ]  ${gear?.name || this._gearDrop.id}`, {
                fontFamily: 'monospace', fontSize: '20px', color: '#00ffff'
            }).setOrigin(0.5);
            this.add.text(width / 2, boxY + 6, gear?.desc || '', {
                fontFamily: 'monospace', fontSize: '13px', color: '#aaaaaa'
            }).setOrigin(0.5);
            this.add.text(width / 2, boxY + 34, (gear?.rarity || 'common').toUpperCase(), {
                fontFamily: 'monospace', fontSize: '12px', color: rarityColor
            }).setOrigin(0.5);
        } else {
            this.add.text(width / 2, height * 0.50, 'No gear drop this wave.', {
                fontFamily: 'monospace', fontSize: '15px', color: '#444466'
            }).setOrigin(0.5);
        }

        // Mobile-first prompt
        const btn = this.add.text(width / 2, height * 0.78, '[ TAP TO CONTINUE ]', {
            fontFamily: 'monospace', fontSize: '20px', color: '#ffffff'
        }).setOrigin(0.5);
        this.tweens.add({ targets: btn, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

        this.input.keyboard?.addKey('SPACE').once('down', () => this._advance());
        this.input.keyboard?.addKey('ENTER').once('down', () => this._advance());
        this.input.once('pointerdown', () => this._advance());
    }

    // Removed timer update logic; advance is strictly manual now.
    update(_, delta) { }

    _advance() {
        if (this._advanced) return;
        this._advanced = true;
        const gs = this.scene.get('GameScene');
        if (gs) gs.events.emit('nextWave');
        this.scene.resume('GameScene');
        this.scene.stop('WaveCompleteScene');
    }
}
