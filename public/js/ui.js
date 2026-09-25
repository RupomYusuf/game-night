/* DOM helpers, toasts, modals, confetti, small render utilities. */

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  }
  for (const kid of kids.flat(9)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTray = null;
export function toast(msg, ms = 2400) {
  if (!toastTray) { toastTray = h('div', { class: 'toast-tray' }); document.body.append(toastTray); }
  const t = h('div', { class: 'toast' }, msg);
  toastTray.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
}

/** Center modal. Returns the modal element; caller wires buttons. close() removes it. */
export function modal(build) {
  const root = qs('#overlays');
  const box = h('div', { class: 'modal glass' });
  const ov = h('div', { class: 'overlay' }, box);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  function close() { ov.remove(); }
  build(box, close);
  root.append(ov);
  return { box, close };
}

export function confirmModal({ title, body, okLabel = 'Yes', cancelLabel = 'Cancel', hot = false }) {
  return new Promise((resolve) => {
    modal((box, close) => {
      box.append(
        h('h3', {}, title),
        body ? h('p', {}, body) : null,
        h('div', { class: 'g-row', style: 'margin-top:6px' },
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { close(); resolve(false); } }, cancelLabel),
          h('button', { class: `btn btn-sm ${hot ? 'btn-hot' : 'btn-primary'}`, onclick: () => { close(); resolve(true); } }, okLabel),
        )
      );
    });
  });
}

/* ---------- confetti ---------- */
const fxCanvas = document.getElementById('fx');
const fx = fxCanvas.getContext('2d');
let parts = [];
function sizeFx() { fxCanvas.width = innerWidth * devicePixelRatio; fxCanvas.height = innerHeight * devicePixelRatio; fx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
addEventListener('resize', sizeFx); sizeFx();

const COLORS = ['#ff5fa2', '#ff9950', '#b06bff', '#ffd08a', '#7ce7ff', '#ffffff'];
function fxLoop() {
  if (!parts.length) { fx.clearRect(0, 0, innerWidth, innerHeight); requestAnimationFrame(fxLoop); return; }
  fx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= .99; p.rot += p.vr; p.life--;
    fx.save(); fx.translate(p.x, p.y); fx.rotate(p.rot);
    fx.globalAlpha = Math.min(1, p.life / 30);
    fx.fillStyle = p.c;
    fx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    fx.restore();
  }
  requestAnimationFrame(fxLoop);
}
requestAnimationFrame(fxLoop);

export function confetti(x = innerWidth / 2, y = innerHeight / 2, n = 90) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 8;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, g: .16, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, s: 7 + Math.random() * 7, c: COLORS[i % COLORS.length], life: 70 + Math.random() * 50 });
  }
}
export function confettiBurst() {
  confetti(innerWidth * .5, innerHeight * .4, 70);
  setTimeout(() => confetti(innerWidth * .3, innerHeight * .45, 50), 180);
  setTimeout(() => confetti(innerWidth * .7, innerHeight * .45, 50), 320);
}

/* ---------- render helper: re-render without clobbering focused inputs ---------- */
export function preserveFocus(root, renderFn) {
  const active = document.activeElement;
  const key = active && active.dataset && active.dataset.k;
  const selStart = active && active.selectionStart, selEnd = active && active.selectionEnd;
  renderFn();
  if (key) {
    const el = qs(`[data-k="${CSS.escape(key)}"]`, root);
    if (el) { el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selEnd); } catch { /* */ } }
  }
}

export function svg(name) {
  const P = {
    send: '<path d="M3 11.5 21 3l-8.5 18-2.2-7.3L3 11.5z"/>',
    camera: '<path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.6"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5 21 7.5v9l-5.5-3z"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
    buzz: '<path d="M9 3.5a3 3 0 0 1 6 0V13a3 3 0 0 1-6 0V3.5z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    leave: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9"/>',
    heart: '<path d="M12 20.3 4.8 13a4.7 4.7 0 0 1 6.6-6.6l.6.6.6-.6A4.7 4.7 0 0 1 19.2 13L12 20.3z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M5.5 15.5h-1a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
