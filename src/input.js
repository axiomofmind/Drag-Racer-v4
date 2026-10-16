// Keyboard + on-screen touch buttons. `held` is level state, `edges` are one-shot presses.
export function createInput() {
  const held = { gas: false, nitro: false };
  const edges = { up: false, down: false, start: false, left: false, right: false, back: false, retry: false };

  const KEYS = {
    Space: ['hold', 'gas'], KeyN: ['hold', 'nitro'],
    ArrowUp: ['edge', 'up'], ArrowDown: ['edge', 'down'],
    ArrowLeft: ['edge', 'left'], ArrowRight: ['edge', 'right'],
    Enter: ['edge', 'start'], Escape: ['edge', 'back'],
    KeyR: ['edge', 'retry'],
  };
  const press = (code, down) => {
    const [kind, name] = KEYS[code];
    if (kind === 'hold') held[name] = down;
    else if (down) edges[name] = true;
    if (down && code === 'Space') edges.start = true; // Space also advances menus
  };

  addEventListener('keydown', (e) => {
    if (!KEYS[e.code]) return;
    const interactive = e.target.closest?.('input, select, textarea, button, summary');
    if (interactive && !(['Escape', 'KeyR'].includes(e.code) && document.getElementById('hub').hidden && !e.target.closest?.('input, select, textarea'))) return;
    if (!document.getElementById('hub').hidden && e.code !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) press(e.code, true);
  });
  addEventListener('keyup', (e) => {
    if (!KEYS[e.code]) return;
    // Space activates native buttons on keyup; do not swallow that action.
    if (!e.target.closest?.('input, select, textarea, button, summary')) e.preventDefault();
    press(e.code, false);
  });
  addEventListener('blur', () => { held.gas = false; held.nitro = false; });

  // touch / mouse buttons: <button data-key="Space"> etc.
  document.querySelectorAll('[data-key]').forEach((el) => {
    const code = el.dataset.key;
    const on = (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('on'); press(code, true); };
    const off = (e) => { e.preventDefault(); el.classList.remove('on'); press(code, false); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('lostpointercapture', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) { el.classList.add('on'); press(code, true); }
    });
    el.addEventListener('keyup', (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      off(e);
    });
  });

  return {
    held, edges,
    reset(keepHeld = false) { if (!keepHeld) held.gas = held.nitro = false; for (const k in edges) edges[k] = false; document.querySelectorAll('[data-key]').forEach(el => el.classList.toggle('on', (el.dataset.key === 'Space' && held.gas) || (el.dataset.key === 'KeyN' && held.nitro))); },
    clearEdges() { for (const k in edges) edges[k] = false; },
    // tap on the canvas acts as "start" for menus
    bindTap(el) { el.addEventListener('pointerdown', () => { edges.start = true; }); },
  };
}
