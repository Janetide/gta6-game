// Keyboard and mouse input. Tracks held keys, edge-triggered presses,
// and the mouse position in canvas coordinates.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseX = 640;
    this.mouseY = 400;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      // Space and arrows scroll the page; the game owns them.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        // A click without a prior mousemove must still use the click's
        // own position: update the mouse coordinates here too.
        const r = canvas.getBoundingClientRect();
        this.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
        this.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down.
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  // WASD or arrows as a -1..1 movement axis pair.
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return { x, y };
  }

  // Consume edge-triggered state at the end of each frame.
  endFrame() {
    this.pressedKeys.clear();
    this.mouseClicked = false;
  }
}
