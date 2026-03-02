import { SaveManager } from '../SaveManager.js';
import { GearData, RARITY_COLORS, SLOT_LABELS } from '../data/GearData.js';

const SLOT_ORDER = ['engines', 'weapons', 'shields', 'hulls'];
const NONE_OPTION = { id: null, name: 'NONE', desc: 'No upgrade equipped.', rarity: 'common' };
const SLOT_KEY = { engines: 'engine', weapons: 'weapon', shields: 'shield', hulls: 'hull' };

// Layout constants for portrait 450x800
const ROW_START = 220;
const ROW_GAP = 120;

export default class HangarScene extends Phaser.Scene {
    constructor() { super('HangarScene'); }

    create() {
        const { width, height } = this.scale;
        this._save = SaveManager.load();
        this._pending = { ...this._save.loadout };
        this._buttons = [];

        // Background
        this.add.rectangle(width / 2, height / 2, width, height, 0x000011);
        for (let i = 0; i < 60; i++) {
            this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 1.2 + 0.3, 0xffffff, Math.random() * 0.4 + 0.1);
        }

        // ── Header & Profile Stats ───────────────────────────────────────────
        this.add.text(width / 2, 28, 'HANGAR & LOADOUT', {
            fontFamily: 'monospace', fontSize: '26px', color: '#00ffff',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffff', blur: 12, fill: true }
        }).setOrigin(0.5);

        // Profile details at the very top under title
        this.add.text(width / 2, 54, `BEST SCORE: ${this._save.profile.highScore}  |  SESSIONS: ${this._save.profile.sessionsPlayed}`, {
            fontFamily: 'monospace', fontSize: '11px', color: '#556677'
        }).setOrigin(0.5);

        // ── Stats Box (Top half) ─────────────────────────────────────────────
        this.add.rectangle(width / 2, 130, width - 30, 110, 0x050520, 0.95).setStrokeStyle(1, 0x1a3050, 1);
        this._statsSlot = this.add.text(width / 2, 90, '', { fontFamily: 'monospace', fontSize: '11px', color: '#445566' }).setOrigin(0.5);
        this._statsTitle = this.add.text(width / 2, 108, '', { fontFamily: 'monospace', fontSize: '16px', color: '#00ffff' }).setOrigin(0.5);
        this._statsDesc = this.add.text(width / 2, 126, '', { fontFamily: 'monospace', fontSize: '12px', color: '#aaaaaa', wordWrap: { width: width - 50 }, align: 'center' }).setOrigin(0.5, 0);
        this._statsRarity = this.add.text(width / 2, 174, '', { fontFamily: 'monospace', fontSize: '12px' }).setOrigin(0.5);

        // ── Gear Slots (Bottom half) ─────────────────────────────────────────
        SLOT_ORDER.forEach((slot, si) => {
            const rowY = ROW_START + si * ROW_GAP;

            // Section title
            this.add.text(15, rowY, SLOT_LABELS[slot] || slot.toUpperCase(), {
                fontFamily: 'monospace', fontSize: '12px', color: '#445566'
            });

            const items = this._getSlotItems(slot);
            const gw = (width - 30) / Math.max(items.length, 3); // Fit max items or at least 3
            const btnW = Math.min(100, gw - 10);
            const btnH = 60;

            items.forEach((item, i) => {
                // Center the buttons horizontally if fewer than 4 items
                const totalW = items.length * (btnW + 10) - 10;
                const startX = (width - totalW) / 2;
                const bx = startX + i * (btnW + 10);
                const by = rowY + 20;
                this._makeBtn(slot, item, bx, by, btnW, btnH);
            });
        });

        // ── Confirm Button ───────────────────────────────────────────────────
        const confirmBtn = this.add.text(width / 2, height - 35, '[ CONFIRM & LAUNCH ]', {
            fontFamily: 'monospace', fontSize: '20px', color: '#00ffff',
            backgroundColor: '#002244', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        confirmBtn.on('pointerdown', () => this._confirm());
        confirmBtn.on('pointerover', () => confirmBtn.setColor('#ffffff'));
        confirmBtn.on('pointerout', () => confirmBtn.setColor('#00ffff'));

        this.input.keyboard?.addKey('ESCAPE').once('down', () => this._confirm());

        this._refreshButtons();
    }

    _getSlotItems(slot) {
        const owned = this._save.gear[slot] || [];
        const items = owned.map(id => ({ ...GearData[slot][id], id }));
        if (['shields', 'hulls'].includes(slot)) items.unshift(NONE_OPTION);
        return items;
    }

    _makeBtn(slot, item, x, y, bw, bh) {
        const cx = x + bw / 2, cy = y + bh / 2;

        const bg = this.add.rectangle(cx, cy, bw, bh, 0x0a0a22, 1).setStrokeStyle(1, 0x224466, 1);
        const label = this.add.text(cx, cy - 8, item.name, {
            fontFamily: 'monospace', fontSize: '10px', color: '#cccccc',
            align: 'center', wordWrap: { width: bw - 4 }
        }).setOrigin(0.5);

        // Rarity dot
        const rarityColor = RARITY_COLORS[item.rarity] || '#aaaaaa';
        const dot = this.add.circle(cx, cy + 18, 3, parseInt(rarityColor.replace('#', '0x')), 0.7);

        // Invisible large hit zone for easier tapping
        const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
            this._pending[SLOT_KEY[slot]] = item.id;
            this._showStats(slot, item);
            this._refreshButtons();
        });
        zone.on('pointerover', () => { this._showStats(slot, item); if (!this._isSelected(slot, item.id)) bg.setFillColor(0x0d1530); });
        zone.on('pointerout', () => this._refreshButtons());

        this._buttons.push({ slot, id: item.id, bg, label, dot });
    }

    _isSelected(slot, id) {
        return this._pending[SLOT_KEY[slot]] === id;
    }

    _refreshButtons() {
        this._buttons.forEach(({ slot, id, bg, label }) => {
            const sel = this._isSelected(slot, id);
            bg.setFillColor(sel ? 0x002244 : 0x0a0a22);
            bg.setStrokeStyle(sel ? 2 : 1, sel ? 0x00ffff : 0x224466, 1);
            label.setColor(sel ? '#00ffff' : '#bbbbbb');
        });
    }

    _showStats(slot, item) {
        this._statsSlot.setText(`[ ${SLOT_LABELS[slot] || ''} ]`);
        this._statsTitle.setText(item.name || 'NONE');
        this._statsDesc.setText(item.desc || '');
        const rc = RARITY_COLORS[item.rarity] || '#aaaaaa';
        this._statsRarity.setColor(rc).setText((item.rarity || 'common').toUpperCase());
    }

    _confirm() {
        SaveManager.setLoadout(this._pending);
        this.scene.start('MainMenuScene');
    }
}
