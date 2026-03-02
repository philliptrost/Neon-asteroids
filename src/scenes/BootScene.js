export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Future: load spritesheets, sounds, etc.
    }

    create() {
        this.scene.start('MainMenuScene');
    }
}
