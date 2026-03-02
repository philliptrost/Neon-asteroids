import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import HangarScene from './scenes/HangarScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';
import WaveCompleteScene from './scenes/WaveCompleteScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import './firebaseInit.js'; // Initialize Firebase Analytics

const config = {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    backgroundColor: '#000000',
    parent: document.body,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 450,
        height: 800,
    },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [BootScene, MainMenuScene, HangarScene, GameScene, HUDScene, WaveCompleteScene, GameOverScene]
};

new Phaser.Game(config);
