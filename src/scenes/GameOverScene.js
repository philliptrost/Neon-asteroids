export default class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }

    init(data) {
        this._score = data.score || 0;
        this._wave = data.wave || 1;
    }

    create() {
        const { width, height } = this.scale;

        // Bloom PostFX
        this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1.2, 1.1);

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);

        this.add.text(width / 2, height * 0.22, 'GAME OVER', {
            fontFamily: 'monospace', fontSize: '50px', color: '#ff0044',
            stroke: '#ff0044', strokeThickness: 2,
            shadow: { offsetX: 0, offsetY: 0, color: '#ff0044', blur: 28, fill: true }
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.42, `SCORE: ${this._score}`, {
            fontFamily: 'monospace', fontSize: '26px', color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.54, `WAVE REACHED: ${this._wave}`, {
            fontFamily: 'monospace', fontSize: '18px', color: '#aaaaaa'
        }).setOrigin(0.5);

        // Mobile-first buttons
        const retryBtn = this.add.text(width / 2, height * 0.70, '[ PLAY AGAIN ]', {
            fontFamily: 'monospace', fontSize: '22px', color: '#00ffff'
        }).setOrigin(0.5);
        retryBtn.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-40, -30, retryBtn.width + 80, retryBtn.height + 60), hitAreaCallback: Phaser.Geom.Rectangle.Contains });

        const menuBtn = this.add.text(width / 2, height * 0.84, '[ MAIN MENU ]', {
            fontFamily: 'monospace', fontSize: '17px', color: '#888888'
        }).setOrigin(0.5);
        menuBtn.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-40, -30, menuBtn.width + 80, menuBtn.height + 60), hitAreaCallback: Phaser.Geom.Rectangle.Contains });

        this.tweens.add({ targets: retryBtn, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

        this.input.keyboard?.addKey('ENTER').once('down', () => this._restart());
        retryBtn.on('pointerdown', () => this._restart());
        menuBtn.on('pointerdown', () => {
            this.scene.stop('GameScene');
            this.scene.stop('HUDScene');
            this.scene.stop('GameOverScene');
            this.scene.start('MainMenuScene');
        });
    }

    _restart() {
        this.scene.stop('GameOverScene');
        this.scene.stop('GameScene');
        this.scene.start('GameScene');
    }
}
