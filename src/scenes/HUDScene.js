export default class HUDScene extends Phaser.Scene {
    constructor() { super('HUDScene'); }

    create() {
        this._scoreText = this.add.text(16, 14, 'SCORE: 0', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ffffff'
        });
        this._waveText = this.add.text(this.scale.width / 2, 14, 'WAVE 1', {
            fontFamily: 'monospace', fontSize: '16px', color: '#00ffff'
        }).setOrigin(0.5, 0);
        this._livesLabel = this.add.text(this.scale.width - 16, 14, '', {
            fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
        }).setOrigin(1, 0);
        this._shieldText = this.add.text(this.scale.width - 16, 34, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#4488ff'
        }).setOrigin(1, 0);
    }

    updateScore(score) { this._scoreText?.setText(`SCORE: ${score}`); }
    updateWave(wave) { this._waveText?.setText(`WAVE ${wave}`); }
    updateLives(lives) {
        this._livesLabel?.setText('♦ '.repeat(Math.max(0, lives)).trim());
    }
    updateShield(active) {
        this._shieldText?.setText(active ? '[ SHIELD ]' : '');
    }
}
