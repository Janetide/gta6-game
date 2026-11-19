// Solmar Heat — bootstrap. Sizes the canvas, starts the game loop,
// and keeps the loop at a fixed step so play feels the same everywhere.

import { VIEW_W, VIEW_H } from './config.js';
import { createGame } from './game.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const game = createGame(canvas);

// Debug handle for headless testing (self-test probes, screenshots).
window.__solmar = game;

let last = performance.now();
function frame(now) {
  // Clamp the step so a slow frame never teleports the city.
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  try {
    game.update(dt);
  } catch (err) {
    console.error('Solmar Heat update error:', err);
  }
  try {
    game.render();
  } catch (err) {
    console.error('Solmar Heat render error:', err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
