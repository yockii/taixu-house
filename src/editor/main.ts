// 编辑器入口：加载背景图，启动 EditorScene（画路点/连线/标房间）。
import Phaser from 'phaser';
import EditorScene from './EditorScene';
import { CANVAS } from '../rooms';

new Phaser.Game({
  type: Phaser.AUTO,
  width: CANVAS.w,
  height: CANVAS.h,
  parent: 'app',
  backgroundColor: '#14141a',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [EditorScene],
});
