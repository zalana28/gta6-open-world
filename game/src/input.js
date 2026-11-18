// SOLARA HEAT — keyboard + mouse. WASD/arrows to move and drive, mouse to
// aim, click to shoot, E to enter/exit a car or use a place, Shift to
// sprint, Space for the handbrake, P or Escape to pause, M to mute, R to
// reload. The game also reads touch-free: everything here is keyboard and
// mouse, as the bounty asks.
'use strict';

const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  confirm: ['Enter', 'Space'],
};

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set(); // edge-triggered: consumed by takePressed()
  const mouse = { x: 0, y: 0, down: false, pressed: false };

  function onKey(e, isDown) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (isDown) {
      if (!down.has(e.code)) pressed.add(e.code);
      down.add(e.code);
    } else {
      down.delete(e.code);
    }
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => { down.clear(); mouse.down = false; });

  function updateMouse(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  }
  canvas.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('mousedown', (e) => {
    updateMouse(e);
    if (!mouse.down) mouse.pressed = true;
    mouse.down = true;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  function has(action) {
    return KEYS[action].some((code) => down.has(code));
  }
  function wasPressed(action) {
    return KEYS[action].some((code) => pressed.has(code));
  }

  return {
    mouse,
    // Held state, for movement and driving.
    axis() {
      let x = 0, y = 0;
      if (has('left')) x -= 1;
      if (has('right')) x += 1;
      if (has('up')) y -= 1;
      if (has('down')) y += 1;
      return { x, y };
    },
    sprint: () => has('sprint'),
    handbrake: () => has('handbrake'),
    shooting: () => mouse.down,
    shotPressed: () => mouse.pressed,
    interactPressed: () => wasPressed('interact'),
    interactHeld: () => has('interact'),
    reloadPressed: () => wasPressed('reload'),
    pausePressed: () => wasPressed('pause'),
    mutePressed: () => wasPressed('mute'),
    confirmPressed: () => wasPressed('confirm') || mouse.pressed,
    // Call once per frame, after the game has read the edge triggers.
    endFrame() {
      pressed.clear();
      mouse.pressed = false;
    },
  };
}
