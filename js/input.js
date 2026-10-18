'use strict';

/* ------------------------------------------------------------------
 *  Keyboard input with edge-triggered "pressed" set.
 * ------------------------------------------------------------------ */

const Input = {
  down: Object.create(null),
  pressedSet: new Set(),
  _blockKeys: new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
  ]),

  init(onFirstInput) {
    window.addEventListener('keydown', (e) => {
      if (this._blockKeys.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down[e.code] = true;
      this.pressedSet.add(e.code);
      if (onFirstInput) onFirstInput(e);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.down[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.down = Object.create(null);
      this.pressedSet.clear();
    });
  },

  isDown(...codes) { return codes.some((c) => !!this.down[c]); },
  pressed(...codes) { return codes.some((c) => this.pressedSet.has(c)); },

  left() { return this.isDown('ArrowLeft', 'KeyA'); },
  right() { return this.isDown('ArrowRight', 'KeyD'); },
  up() { return this.isDown('ArrowUp', 'KeyW'); },
  downKey() { return this.isDown('ArrowDown', 'KeyS'); },
  focus() { return this.isDown('ShiftLeft', 'ShiftRight'); },
  shoot() { return this.isDown('KeyZ'); },
  bombPressed() { return this.pressed('KeyX'); },
  pausePressed() { return this.pressed('Escape', 'KeyP'); },
  confirmPressed() { return this.pressed('KeyZ', 'Enter'); },

  anyPressed() { return this.pressedSet.size > 0; },

  endFrame() { this.pressedSet.clear(); },
};
