import Phaser from 'phaser';
import HouseScene from './scenes/HouseScene';
import { VIEW } from './config';

new Phaser.Game({
  type: Phaser.AUTO,
  width: VIEW.width,
  height: VIEW.height,
  parent: 'app',
  backgroundColor: '#14141a',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [HouseScene],
});
