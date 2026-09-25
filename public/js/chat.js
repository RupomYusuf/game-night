/* Chat: persistent, session-only. Works as a desktop side pane and a mobile
   bottom sheet — the same DOM tree is re-parented between the two. */
import { G, emit, on } from './state.js';
import { send, sendLarge } from './net.js';
import { h, qs, modal, toast, fmtTime } from './ui.js';
import { sfx, haptic, buzz } from './sound.js';

const QUICK = ['❤️', '😂', '🥰', '🔥', '😍', '😳', '🥂', '🌙'];
const root = h('div', { class: 'chat-pane' });
let listEl, footEl, fab = null, sheetOpen = false, mode = 'sheet';
let typingTimer = null, typingSent = false;
let nearBottom = true, newPill = null;

export function chatRoot() { return root; }

export function buildChat() {
  root.innerHTML = '';
  listEl = h('div', { class: 'chat-scroll' },
    h('div', { class: 'chat-day', id: 'chat-empty-note' }, 'Say hi — everything here vanishes when the night ends 🌙'));
  footEl = h('div', { class: 'chat-foot' });
  root.append(chatHeader(), listEl, footEl);

  // composer
  const input = h('textarea', { class: 'field', rows: 1, placeholder: 'Whisper something…', 'data-k': 'chat-input' });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(110, input.scrollHeight) + 'px';
    onTyping();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(input); }
  });

  const sendBtn = h('button', { class: 'icon-btn send-btn', title: 'Send', onclick: () => sendText(input) }, h('span', { html: icon('send') }));
  const attachBtn = h('button', { class: 'icon-btn', title: 'Photo / video', onclick: (e) => openAttachMenu(e.currentTarget) }, h('span', { html: icon('camera') }));

  footEl.append(
    h('div', { class: 'quick-row' }, QUICK.map((e) => h('button', { onclick: () => { sendText(null, e); sfx.tap(); haptic(buzz.tap); } }, e))),
    h('div', { class: 'composer' }, attachBtn, input, sendBtn),
  );

  // render any existing (rejoined) history
  for (const m of G.chat) appendBubble(m, { scroll: false });
  requestAnimationFrame(() => scrollBottom(false));
  bindScroll();
  return root;
}

function icon(n) {
  const P = {
    send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5 21 3l-8.5 18-2.2-7.3L3 11.5z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.6"/></svg>',
  };
  return P[n];
}

function chatHeader() {
  const peerName = () => G.peer.name || 'Your partner';
  const head = h('div', { class: 'chat-head' },
    h('h3', {}, `💬 ${peerName()}`),
    h('span', { class: 'typing-note', id: 'typing-note' }),
  );
  on('peer-typing', () => {
    const note = qs('#typing-note', root);
    if (note) note.textContent = G.peerTyping ? `${peerName()} is typing…` : '';
  });
  return head;
}

/* ---------------- sending ---------------- */

function sendText(input, textOverride) {
  const text = (textOverride ?? input?.value ?? '').trim();
  if (!text) return;
  if (input) { input.value = ''; input.style.height = 'auto'; }
  typingOff();
  const msg = { id: crypto.randomUUID(), kind: 'text', text, ts: Date.now() };
  pushLocal(msg);
  send('chat', { ...msg });
  sfx.send(); haptic(buzz.tap);
}

function pushLocal(msg) {
  const entry = { ...msg, from: G.me.role, mine: true, status: 'sent', reactions: {} };
  G.chat.push(entry);
  appendBubble(entry);
  scrollBottom();
}

/* ---------------- incoming ---------------- */

export function onIncomingChat(m) {
  const entry = {
    id: m.id, from: m.from, mine: false, kind: m.kind, text: m.text,
    dataURL: m.data || null, expired: !!m.expired, mime: m.mime, ts: m.ts,
    status: 'seen', reactions: m.reactions || {},
  };
  G.chat.push(entry);
  removeTypingBubble();
  appendBubble(entry);
  const visible = mode === 'desk' || sheetOpen;
  if (visible && nearBottom && document.visibilityState === 'visible') {
    scrollBottom();
    send('seen', { ts: entry.ts });
  } else {
    G.unread++;
    emit('unread', G.unread);
    if (nearBottom === false && visible) showNewPill();
    sfx.recv(); haptic(buzz.recv);
  }
}

export function onPeerSeen({ ts }) {
  if (!ts) return;
  let changed = false;
  for (const m of G.chat) {
    if (m.mine && m.status !== 'seen' && m.ts <= ts) { m.status = 'seen'; changed = true; }
  }
  if (changed) qsa('[data-ticks]', root).forEach((el) => {
    const m = G.chat.find((x) => x.id === el.dataset.ticks);
    if (m && m.mine) { el.textContent = m.status === 'seen' ? '✓✓' : '✓'; el.classList.toggle('seen', m.status === 'seen'); }
  });
}

export function onPeerReact({ id, e }) {
  const m = G.chat.find((x) => x.id === id);
  if (!m) return;
  const role = G.me.role;
  m.reactions[e] = m.reactions[e] || [];
  const i = m.reactions[e].indexOf(role);
  if (i >= 0) m.reactions[e].splice(i, 1); else m.reactions[e].push(role);
  if (!m.reactions[e].length) delete m.reactions[e];
  patchReactions(m);
}

export function setPeerTyping(onOff) {
  G.peerTyping = onOff;
  emit('peer-typing', onOff);
  if (onOff) showTypingBubble(); else removeTypingBubble();
}

function showTypingBubble() {
  if (qs('.typing-bubble', listEl)) return;
  listEl.append(h('div', { class: 'bubble-wrap', id: 'peer-typing-row' },
    h('div', { class: 'typing-bubble' }, h('i'), h('i'), h('i'))));
  scrollBottom();
}
function removeTypingBubble() { qs('#peer-typing-row', listEl)?.remove(); }

/* ---------------- typing (mine) ---------------- */

function onTyping() {
  if (!typingSent) { typingSent = true; send('typing', { on: true }); }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(typingOff, 2500);
}
function typingOff() {
  clearTimeout(typingTimer);
  if (typingSent) { typingSent = false; send('typing', { on: false }); }
}

/* ---------------- bubbles ---------------- */

function bubbleEl(m) {
  const wrap = h('div', { class: 'bubble-wrap' + (m.mine ? ' mine' : '') });
  const bubble = h('div', { class: 'bubble' });
  if (m.kind === 'media') {
    if (m.expired || !m.dataURL) {
      bubble.append(h('div', { class: 'muted', style: 'font-size:13px' }, m.mine ? '📷 Media you sent (no longer in memory)' : '📷 Media was shared while you were away'));
    } else if ((m.mime || '').startsWith('video/')) {
      bubble.append(h('video', { src: m.dataURL, controls: true, playsinline: true, preload: 'metadata' }));
    } else {
      const img = h('img', { src: m.dataURL, alt: 'photo', loading: 'lazy' });
      img.addEventListener('click', () => lightbox(m.dataURL, m.mime));
      bubble.append(img);
    }
    if (m.mine && m.sending) bubble.append(h('span', { class: 'sending', 'data-sending': m.id }, 'sending… '));
  } else {
    bubble.textContent = m.text;
  }

  const meta = h('div', { class: 'meta' },
    h('span', {}, fmtTime(m.ts)),
    m.mine ? h('span', { class: 'ticks' + (m.status === 'seen' ? ' seen' : ''), 'data-ticks': m.id }, m.status === 'seen' ? '✓✓' : '✓') : null,
  );
  wrap.append(bubble, meta);
  patchReactions(m, wrap);

  // double-tap / double-click to react ❤️
  let lastTap = 0;
  bubble.addEventListener('pointerdown', (ev) => {
    const t = Date.now();
    if (t - lastTap < 320 && !ev.target.closest('video')) { heartReact(m, bubble); lastTap = 0; }
    else lastTap = t;
  });
  return wrap;
}

function heartReact(m, bubble) {
  send('react', { id: m.id, e: '❤️' });
  onPeerReact({ id: m.id, e: '❤️' }); // apply locally too
  const b = h('span', { class: 'burst', style: `left:${bubble.offsetWidth / 2 - 10}px; top: -6px` }, '❤️');
  bubble.append(b);
  setTimeout(() => b.remove(), 850);
  sfx.pop(); haptic(buzz.tap);
}

function patchReactions(m, wrapEl) {
  const wrap = wrapEl || [...listEl.children].find((c) => c.querySelector(`[data-ticks="${m.id}"], [data-msg-id="${m.id}"]`));
  if (!wrap) return;
  const bubble = wrap.querySelector('.bubble');
  if (!bubble) return;
  bubble.dataset.msgId = m.id;
  bubble.querySelector('.react-chip')?.remove();
  const emojis = Object.keys(m.reactions || {});
  if (emojis.length) bubble.append(h('span', { class: 'react-chip' }, emojis.map((e) => `${e}${m.reactions[e].length > 1 ? m.reactions[e].length : ''}`).join(' ')));
}

function appendBubble(m) {
  const note = qs('#chat-empty-note', listEl);
  if (note) note.remove();
  listEl.append(bubbleEl(m));
}

/* ---------------- scrolling / unread ---------------- */

function bindScroll() {
  listEl.addEventListener('scroll', () => {
    const gap = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
    nearBottom = gap < 130;
    if (nearBottom) {
      hideNewPill();
      if ((mode === 'desk' || sheetOpen) && G.chat.length && document.visibilityState === 'visible') {
        send('seen', { ts: G.chat[G.chat.length - 1].ts });
      }
    }
  });
}

function scrollBottom(smooth = true) {
  if (!smooth) listEl.style.scrollBehavior = 'auto';
  requestAnimationFrame(() => { listEl.scrollTop = listEl.scrollHeight; listEl.style.scrollBehavior = ''; });
  nearBottom = true; hideNewPill();
}

function showNewPill() {
  if (newPill) return;
  newPill = h('button', { class: 'new-pill', onclick: () => scrollBottom() }, '↓ New messages');
  root.style.position = 'relative';
  root.append(newPill);
}
function hideNewPill() { if (newPill) { newPill.remove(); newPill = null; } }

export function chatShown() {
  if (G.chat.length && nearBottom) send('seen', { ts: G.chat[G.chat.length - 1].ts });
  if (mode === 'desk' || sheetOpen) { G.unread = 0; emit('unread', 0); }
}

/* ---------------- layout: desk pane vs mobile sheet ---------------- */

export function setChatMode(m) {
  mode = m;
  syncChrome();
}

/* Keep the chat chrome (desktop pane / mobile FAB) matching reality. */
export function syncChrome() {
  const desk = matchMedia('(min-width: 920px)').matches;
  if (desk) {
    if (!root.isConnected || !root.classList.contains('desk')) {
      const pane = document.querySelector('.hub-body');
      if (pane) { root.classList.add('desk'); pane.append(root); }
    }
    removeFab();
  } else {
    root.classList.remove('desk');
    if (root.closest('.hub-body')) root.remove();
    ensureFab();
  }
}

export function openSheet() {
  if (mode === 'desk') return;
  sheetOpen = true;
  const app = document.getElementById('app');
  const backdrop = h('div', { class: 'sheet-backdrop', id: 'sheet-backdrop', onclick: closeSheet });
  const sheet = h('div', { class: 'chat-sheet', id: 'chat-sheet' },
    h('div', { class: 'sheet-grip' }));
  sheet.append(root);
  app.append(backdrop, sheet);
  chatShown();
}
export function closeSheet(silent) {
  sheetOpen = false;
  qs('#sheet-backdrop')?.remove();
  qs('#chat-sheet')?.remove();
  if (!silent) chatShown();
}
export function isSheetOpen() { return sheetOpen; }

export function ensureFab() {
  if (matchMedia('(min-width: 920px)').matches) { removeFab(); return; }
  if (fab) {
    if (!fab.isConnected) document.getElementById('app').append(fab); // re-attach after screen swaps
    return;
  }
  fab = h('button', { class: 'chat-fab', id: 'chat-fab', title: 'Chat', onclick: () => { sfx.whoosh(); openSheet(); } },
    '💬', h('span', { class: 'fab-badge hidden', id: 'fab-badge' }, '0'));
  document.getElementById('app').append(fab);
}
export function removeFab() { fab?.remove(); fab = null; }

export function setUnread(n) {
  const b = qs('#fab-badge');
  if (!b) return;
  b.textContent = n > 99 ? '99+' : n;
  b.classList.toggle('hidden', n <= 0);
}

/* ---------------- attachments ---------------- */

function openAttachMenu(anchor) {
  const existing = qs('.attach-menu');
  if (existing) { existing.remove(); return; }
  const menu = h('div', { class: 'attach-menu glass' },
    h('button', { onclick: () => { menu.remove(); pickPhoto(); } }, '📷  Photo — take or upload'),
    h('button', { onclick: () => { menu.remove(); recordVideo(); } }, '🎥  Video — record up to 60s'),
    h('button', { onclick: () => { menu.remove(); uploadVideo(); } }, '📁  Video — upload a clip'),
  );
  anchor.closest('.chat-foot').append(menu);
  setTimeout(() => document.addEventListener('pointerdown', function off(e) {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', off); }
  }), 10);
}

function fileInput(attrs, onPick) {
  const inp = h('input', { type: 'file', style: 'display:none', ...attrs });
  inp.addEventListener('change', () => { if (inp.files[0]) onPick(inp.files[0]); inp.remove(); });
  document.body.append(inp);
  inp.click();
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('That image could not be read.');
  const max = 1500;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  let q = .82, url = c.toDataURL('image/jpeg', q);
  while (url.length > 2_600_000 && q > .4) { q -= .15; url = c.toDataURL('image/jpeg', q); }
  return url;
}

function pickPhoto() {
  fileInput({ accept: 'image/*', capture: undefined }, async (file) => {
    try {
      const dataURL = await compressImage(file);
      sendMedia(dataURL, 'image/jpeg');
    } catch (e) { toast(e.message || 'Could not read that image.'); }
  });
}

function sendMedia(dataURL, mime) {
  const msg = { id: crypto.randomUUID(), kind: 'media', mime, dataURL, ts: Date.now() };
  pushLocal(msg);
  sfx.send(); haptic(buzz.tap);
  const mark = qs(`[data-sending="${msg.id}"]`);
  sendLarge('chat', { ...msg, id: msg.id }, (p) => {
    if (mark) mark.textContent = p < 1 ? `sending ${Math.round(p * 100)}%…` : 'delivering…';
  }).then(() => { if (mark) mark.remove(); })
    .catch(() => { if (mark) { mark.textContent = 'failed to send ✕'; mark.style.color = '#ff8aa0'; } });
}

/* ---- video recording (60s cap) ---- */

function recordVideo() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Camera needs HTTPS or localhost — try uploading a clip instead.');
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 } }, audio: true })
    .then((stream) => recordingModal(stream))
    .catch(() => toast('Camera unavailable — you can still upload a clip.'));
}

function recordingModal(stream) {
  modal((box, close) => {
    let recorder = null, chunks = [], t0 = 0, timerInt = null, closed = false;
    const video = h('video', { class: 'preview-video', autoplay: true, muted: true, playsinline: true, srcObject: stream });
    const status = h('div', { class: 'g-sub' }, 'Ready when you are 💞');
    const recBtn = h('button', { class: 'btn btn-hot', onclick: startRec }, '● Record');
    const sendWrap = h('div', { class: 'g-row' }, h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => { cleanup(); close(); }
    }, 'Cancel'));

    function cleanup() {
      closed = true; clearInterval(timerInt);
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* */ }
    }
    function tickTimer() {
      const s = Math.floor((Date.now() - t0) / 1000);
      status.innerHTML = `<span class="rec-dot" style="display:inline-block;vertical-align:middle;margin-right:7px"></span><span class="rec-timer">${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}</span> / 01:00`;
      if (s >= 60) stopRec();
    }
    function startRec() {
      chunks = [];
      const mime = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 1_400_000 } : undefined);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = finishRec;
      recorder.start(250);
      t0 = Date.now();
      recBtn.textContent = '■ Stop'; recBtn.onclick = stopRec;
      timerInt = setInterval(tickTimer, 250);
    }
    function stopRec() {
      clearInterval(timerInt);
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    }
    async function finishRec() {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
      if (closed) return;
      video.srcObject = null; video.muted = false;
      video.src = URL.createObjectURL(blob);
      video.controls = true;
      recBtn.classList.add('hidden');
      status.textContent = 'Look good? Send it 💫';
      const sizeMB = blob.size / 1048576;
      sendWrap.append(
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { cleanup(); close(); } }, 'Discard'),
        h('button', {
          class: 'btn btn-primary btn-sm', onclick: async () => {
            if (blob.size > 20 * 1048576) { toast('Clip too large (over 20 MB) — try a shorter one.'); return; }
            const dataURL = await blobToDataURL(blob);
            cleanup(); close();
            sendMedia(dataURL, blob.type || 'video/webm');
          }
        }, `Send 💞 (${sizeMB.toFixed(1)} MB)`),
      );
    }

    box.append(h('h3', {}, '🎥 Record a moment'), video, status, sendWrap);
  });
}

function uploadVideo() {
  fileInput({ accept: 'video/*' }, (file) => {
    if (file.size > 20 * 1048576) { toast('Clips are capped at 20 MB — keep it short and sweet.'); return; }
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const dur = probe.duration;
      if (isFinite(dur) && dur > 62) { toast('That clip is over 60 seconds — trim it and try again.'); return; }
      blobToDataURL(file).then((dataURL) => sendMedia(dataURL, file.type || 'video/mp4'));
    };
    probe.onerror = () => toast('Could not read that video.');
    probe.src = URL.createObjectURL(file);
  });
}

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function lightbox(src, mime) {
  const ov = h('div', { class: 'lightbox' }, (mime || '').startsWith('video/') ? h('video', { src, controls: true, autoplay: true }) : h('img', { src }));
  ov.addEventListener('click', () => ov.remove());
  document.body.append(ov);
}
