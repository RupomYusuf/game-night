/* App conductor: home → wait → hub (menu + chat + games) → end.
   Wires every server event onto the UI. */
import { G, settings, on, emit, loadSession, saveSession, clearSession, serverNow, saveSettings } from './state.js';
import { api, send, connect, disconnectStream } from './net.js';
import { h, qs, toast, modal, confirmModal, confettiBurst, confetti } from './ui.js';
import { sfx, haptic, buzz, toggleSound, toggleHaptics, toggleTheme } from './sound.js';
import { buildChat, chatRoot, setChatMode, openSheet, closeSheet, ensureFab, removeFab, setUnread, onIncomingChat, onPeerSeen, setPeerTyping, onPeerReact, chatShown } from './chat.js';
import { openGame, closeGame, resumeGame, onRemoteAction, onSnapshot, active as activeGame, getGame } from './games/engine.js';
import { classicMeta, adultMeta, gameMeta } from './games/registry.js';

let screen = 'home';
let reconnectOv = null;
let firstMeet = true;

const mq = matchMedia('(min-width: 920px)');
mq.addEventListener('change', () => {
  if (!G.me || screen !== 'hub') return;
  setChatMode(mq.matches ? 'desk' : 'sheet');
  ensureFab();
});

const EMOJIS = ['💖', '🌙', '🔥', '🦊', '🌸', '🐻', '🍷', '⭐', '🌺', '🐱', '🍫', '💜'];

/* ================= boot ================= */

boot();
async function boot() {
  wireEvents();
  buildChat();
  const params = new URLSearchParams(location.search);
  const joinCode = (params.get('join') || '').toUpperCase();
  if (joinCode) history.replaceState(null, '', '/');

  const sess = loadSession();
  if (sess) {
    try {
      const info = await api('/api/join', { code: sess.code, token: sess.token, name: sess.name, emoji: sess.emoji });
      enterRoom({ ...sess, ...info });
      showHub();
      return;
    } catch { clearSession(); }
  }
  showHome(joinCode);
}

function enterRoom(info) {
  G.me = { code: info.code, clientId: info.clientId, token: info.token, role: info.role, name: info.name, emoji: info.emoji };
  saveSession(G.me);
  G.peer = info.peer ? { name: info.peer.name, emoji: info.peer.emoji, connected: !!info.peer.connected, graceEndsAt: info.peer.graceEndsAt } : { name: '', emoji: '💖', connected: false, graceEndsAt: null };
  G.scores = info.scores || {};
  G.unlocked18 = !!info.unlocked;
  G.activeGame = info.activeGame || null;
  G.pendingGameState = info.gameState || null;
  G.chat = (info.chat || []).map((e) => ({
    ...e, mine: e.from === G.me.role, dataURL: e.data || null, status: 'sent', reactions: e.reactions || {},
  }));
  firstMeet = !G.peer.connected;
  buildChat();
  connect();
}

/* ================= server events ================= */

function wireEvents() {
  on('chat', (m) => onIncomingChat(m));
  on('seen', (p) => onPeerSeen(p));
  on('typing', (p) => setPeerTyping(!!p.on));
  on('react', (p) => onPeerReact(p));
  on('unread', (n) => setUnread(n));

  on('presence', (p) => {
    const wasConnected = G.peer.connected;
    G.peer.name = p.name || G.peer.name;
    G.peer.connected = !!p.connected;
    G.peer.graceEndsAt = p.graceEndsAt || null;
    if (p.connected && !wasConnected) {
      hideReconnect();
      if (firstMeet) {
        firstMeet = false;
        confetti(innerWidth / 2, innerHeight * .3, 60);
        sfx.match(); haptic(buzz.match);
        toast(`${G.peer.emoji} ${G.peer.name} is here — your night begins 💞`, 3200);
        if (screen === 'wait') showHub();
        else if (screen === 'hub') renderPresence();
      } else {
        toast(`${G.peer.emoji} ${G.peer.name} is back 🔓`, 2600);
        sfx.heartbeat();
        if (screen === 'hub') renderPresence();
      }
    } else if (!p.connected) {
      if (screen === 'hub') renderPresence();
      showReconnect();
    }
  });

  on('game-open', (p) => { resumeGame(p, null); });
  on('game-close', () => { closeGame(); if (screen === 'hub') showGamesMenu(); });
  on('game-act', (p) => onRemoteAction(p));
  on('game-state', (p) => onSnapshot(p));
  on('game-started', () => { if (screen === 'hub') showGameView(); });
  on('game-closed', () => { if (screen === 'hub') showGamesMenu(); });

  on('score', (p) => { G.scores[p.game] = p.s; if (screen === 'hub' && !activeGame()) showGamesMenu(); });
  on('scores-changed', () => { if (screen === 'hub' && !activeGame()) showGamesMenu(); });

  on('unlock', (p) => {
    G.unlocked18 = !!p.on;
    if (screen === 'hub' && !activeGame()) showGamesMenu();
    toast(p.on ? `🔞 After Dark unlocked by ${p.by || 'your partner'}` : 'After Dark is locked again 🌙');
  });

  on('offline', () => { if (G.me) toast('Connection hiccup — reconnecting…', 4000); });
  on('end', (p) => showEnd(p.reason));
  on('session-dead', () => showEnd('ended'));
  on('resynced', (info) => {
    // refreshed tab or recovered drop: restore everything, reopen the stream
    G.peer = info.peer ? { name: info.peer.name, emoji: info.peer.emoji, connected: !!info.peer.connected, graceEndsAt: info.peer.graceEndsAt } : G.peer;
    G.scores = info.scores || {};
    G.unlocked18 = !!info.unlocked;
    G.activeGame = info.activeGame || null;
    G.pendingGameState = info.gameState || null;
    G.chat = (info.chat || []).map((e) => ({ ...e, mine: e.from === G.me.role, dataURL: e.data || null, status: 'sent', reactions: e.reactions || {} }));
    buildChat();
    hideReconnect();
    if (screen === 'hub') { if (G.activeGame) resumeGame(G.activeGame, G.pendingGameState); else showGamesMenu(); }
    else if (G.peer.connected) showHub();
  });
}

/* ================= screens ================= */

function swap(el) {
  const app = qs('#app');
  const old = app.firstElementChild;
  if (old && old.classList.contains('screen')) { old.classList.add('leaving'); setTimeout(() => old.remove(), 260); }
  app.append(el);
  screen = el.dataset.screen;
}

/* ---- home ---- */

function showHome(prefill = '') {
  removeFab();
  let mode = 'create';
  const name = h('input', { class: 'field', placeholder: 'Your name', maxlength: 24, value: loadSession()?.name || '', 'data-k': 'name' });
  let emoji = EMOJIS[0];
  const emojiRow = h('div', { class: 'emoji-row' }, EMOJIS.map((e, i) => h('button', {
    class: `emoji-pick ${i === 0 ? 'on' : ''}`,
    onclick: (ev) => { emoji = e; emojiRow.querySelectorAll('.emoji-pick').forEach((b) => b.classList.remove('on')); ev.currentTarget.classList.add('on'); sfx.tap(); },
  }, e)));
  const code = h('input', { class: 'field code-input', placeholder: 'LOVE-42', maxlength: 10, value: prefill, 'data-k': 'code' });
  const joinFields = h('div', { class: 'hidden', style: 'display:flex; flex-direction:column; gap:12px' }, code);
  const err = h('div', { class: 'g-sub', style: 'color:#ff8aa0; min-height:18px; text-align:center' });

  const card = h('div', { class: 'home-card glass' },
    h('div', { class: 'seg' },
      h('button', { class: 'on', onclick: (e) => switchMode('create', e.currentTarget) }, 'Start a night 🕯️'),
      h('button', { onclick: (e) => switchMode('join', e.currentTarget) }, 'Join 💞')),
    h('div', { style: 'display:flex; flex-direction:column; gap:12px' }, name, emojiRow, joinFields),
    err,
    h('button', { class: 'btn btn-primary btn-block', onclick: go }, 'Begin ✨'),
  );

  function switchMode(m, btn) {
    mode = m;
    card.querySelector('.seg .on')?.classList.remove('on');
    btn.classList.add('on');
    joinFields.classList.toggle('hidden', m === 'create');
    err.textContent = '';
  }

  async function go() {
    const n = name.value.trim();
    if (!n) { err.textContent = 'Tell us your name first 😊'; name.focus(); return; }
    try {
      if (mode === 'create') {
        const info = await api('/api/create', { name: n, emoji });
        enterRoom({ ...info, name: n, emoji });
        showWait();
      } else {
        const c = code.value.trim().toUpperCase();
        if (!c) { err.textContent = 'Enter the code your partner shared 💞'; return; }
        const info = await api('/api/join', { code: c, name: n, emoji });
        enterRoom({ ...info, name: n, emoji });
        showHub();
        toast(`You joined ${G.peer.name || 'the night'} 💞`);
      }
    } catch (e) { err.textContent = e.message; sfx.miss(); }
  }

  swap(h('div', { class: 'screen home', 'data-screen': 'home' },
    h('div', { class: 'home-inner' },
      h('div', { class: 'logo' },
        h('div', { class: 'logo-mark' }, '🌙'),
        h('h1', {}, 'Game ', h('span', { class: 'grad-text' }, 'Night')),
        h('p', {}, 'Two screens. One evening. A private hub for couples far apart — nothing saved, everything felt.')),
      card,
      h('div', { class: 'foot-note' }, 'No accounts · no history · when the tab closes, the night fades 🌙'),
    )));
  if (prefill) name.focus();
}

/* ---- wait (host waiting for partner) ---- */

function showWait() {
  buildChat();
  const link = `${location.origin}/?join=${G.me.code}`;
  swap(h('div', { class: 'screen wait', 'data-screen': 'wait' },
    h('div', { class: 'wait-inner' },
      h('div', { class: 'logo' },
        h('div', { class: 'logo-mark' }, '💌'),
        h('h1', { style: 'font-size:28px; margin-top:12px' }, 'Your night is lit — invite ', h('span', { class: 'grad-text' }, G.peer.name || 'them'))),
      h('div', { class: 'glass', style: 'padding:26px' },
        h('div', { class: 'radar' }, h('div', { class: 'radar-core' }, '💞')),
        h('p', { class: 'g-sub' }, 'Share this code with your partner'),
        h('h2', { class: 'code-big' }, G.me.code)),
      h('div', { class: 'code-actions' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => copyText(G.me.code) }, '📋 Copy code'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => copyText(link) }, '🔗 Copy link'),
        navigator.share ? h('button', { class: 'btn btn-primary btn-sm', onclick: () => navigator.share({ title: 'Game Night', text: `Join me for Game Night — code ${G.me.code}`, url: link }).catch(() => {}) }, '💌 Send invite') : null),
      h('div', { class: 'foot-note' }, 'Waiting for your person to arrive…'),
    )));
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied ✨'); sfx.pop(); }
  catch { toast(`Copy this: ${t}`, 4200); }
}

/* ---- hub ---- */

function showHub() {
  setChatMode(mq.matches ? 'desk' : 'sheet');
  ensureFab();
  if (G.peer.connected) firstMeet = false;
  const scr = h('div', { class: 'screen hub', 'data-screen': 'hub' });
  scr.append(
    h('div', { class: 'hub-head', id: 'hub-head' }),
    h('div', { class: 'hub-body' },
      h('div', { class: 'games-pane', id: 'pane-left' }),
      mq.matches ? chatRoot() : h('div')),
  );
  swap(scr);
  renderPresence();
  if (G.activeGame) { resumeGame(G.activeGame, G.pendingGameState); G.pendingGameState = null; }
  else showGamesMenu();
  chatShown();
  if (!G.peer.connected) showReconnect();
}

function renderPresence() {
  const head = qs('#hub-head');
  if (!head) return;
  head.innerHTML = '';
  const peerLive = G.peer.connected;
  head.append(
    ...[
      h('button', { class: 'code-chip', title: 'Copy code', onclick: () => copyText(G.me.code) }, '🌙 ', G.me.code),
      h('div', { class: 'presence' },
        h('div', { class: 'avatar me' }, G.me.emoji),
        h('div', { class: `presence-link ${peerLive ? '' : 'off'}` }),
        h('div', { class: `avatar ${peerLive ? 'live' : 'off'}`, title: peerLive ? `${G.peer.name} is here` : `${G.peer.name} is away` },
          G.peer.emoji, h('div', { class: 'pulse-ring' })),
      ),
      peerLive ? null : h('span', { class: 'grace-chip', 'data-grace': '1' }, '…reconnecting'),
      h('div', { class: 'settings-row', style: 'margin-left:8px' },
        h('button', { class: `icon-btn ${settings.theme === 'light' ? 'on' : ''}`, title: 'Light / dark', onclick: (e) => { toggleTheme(); e.currentTarget.classList.toggle('on'); sfx.tap(); } }, h('span', { html: themeIcon() })),
        h('button', { class: `icon-btn ${settings.sound ? 'on' : ''}`, title: 'Sound', onclick: (e) => { const v = toggleSound(); e.currentTarget.classList.toggle('on', v); if (v) sfx.pop(); } }, h('span', { html: soundIcon() })),
        h('button', { class: `icon-btn ${settings.haptics ? 'on' : ''}`, title: 'Haptics', onclick: (e) => { const v = toggleHaptics(); e.currentTarget.classList.toggle('on', v); haptic(buzz.tap); } }, h('span', { html: buzzIcon() })),
        h('button', { class: 'icon-btn', title: 'Leave the night', onclick: leaveNight }, h('span', { html: leaveIcon() })),
      ),
    ].filter(Boolean),
  );
  // grace countdown on the chip
  const chip = head.querySelector('[data-grace]');
  if (chip && G.peer.graceEndsAt) {
    const anim = () => {
      if (!chip.isConnected) return;
      if (G.peer.connected) { chip.textContent = 'together 💞'; return; }
      const rem = Math.max(0, (G.peer.graceEndsAt + G.skew) - Date.now());
      chip.textContent = `${G.peer.name || 'Partner'} back in ${Math.ceil(rem / 1000)}s`;
      requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }
}

function themeIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>'; }
function soundIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>'; }
function buzzIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 3.5a3 3 0 0 1 6 0V13a3 3 0 0 1-6 0V3.5z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'; }
function leaveIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9"/></svg>'; }

/* ---- games menu ---- */

function showGamesMenu() {
  const pane = qs('#pane-left');
  if (!pane) return;
  pane.innerHTML = '';
  pane.append(h('div', { class: 'pane-title' }, h('h2', {}, 'Tonight\u2019s games'), h('span', {}, 'open one — it opens on both screens')));

  pane.append(h('div', { class: 'game-grid' }, classicMeta().map((m) => gameCard(m))));
  pane.append(adultSection());

  function gameCard(m) {
    const sc = G.scores[m.id];
    const myRole = G.me.role, theirRole = myRole === 'host' ? 'guest' : 'host';
    const hot = m.section === 'adult';
    return h('button', {
      class: `game-card ${hot ? 'hot-card' : ''}`,
      onclick: () => { sfx.whoosh(); haptic(buzz.tap); openGame(m.id); },
    },
      h('div', { class: 'gc-top' }, h('div', { class: 'gc-icon' }, m.icon), hot ? h('span', { class: 'badge badge-18' }, '18+') : null),
      h('h3', {}, m.name),
      h('p', {}, m.tag),
      sc ? h('span', { class: 'score-chip' }, `You ${sc[myRole] ?? 0} · ${sc[theirRole] ?? 0} Them`) : null,
    );
  }

  function adultSection() {
    const wrap = h('div', {});
    if (!G.unlocked18) {
      wrap.append(h('button', {
        class: 'locked18', style: 'width:100%',
        onclick: consentModal,
      },
        h('div', { class: 'l-icon' }, '🔒'),
        h('div', {},
          h('h3', {}, 'After Dark ', h('span', { class: 'badge badge-18' }, '18+')),
          h('p', {}, 'Four games for grown-ups. Unlocks for both of you — together, on purpose.'))));
    } else {
      wrap.append(
        h('div', { class: 'section-head' },
          h('h2', {}, 'After Dark ', h('span', { class: 'badge badge-18' }, '18+')),
          h('button', { class: 'relock', onclick: () => { send('unlock', { on: false }); G.unlocked18 = false; showGamesMenu(); } }, 'turn off')),
        h('div', { class: 'game-grid' }, adultMeta().map((m) => gameCard(m))));
    }
    return wrap;
  }
}

function consentModal() {
  sfx.tap();
  modal((box, close) => {
    let agreed = false;
    const check = h('input', { type: 'checkbox' });
    const unlockBtn = h('button', {
      class: 'btn btn-hot btn-block', disabled: true,
      onclick: () => {
        if (!agreed) return;
        G.unlocked18 = true;
        send('unlock', { on: true });
        close(); sfx.match(); haptic(buzz.match);
        showGamesMenu();
        toast('After Dark unlocked — have fun, you two 🔥');
      },
    }, 'Unlock After Dark 🔓');
    check.addEventListener('change', () => { agreed = check.checked; unlockBtn.disabled = !agreed; });
    box.append(
      h('div', { style: 'font-size:44px' }, '🌙'),
      h('h3', {}, 'After Dark ', h('span', { class: 'badge badge-18' }, '18+')),
      h('p', {}, 'This section contains intimate, adult prompts meant strictly for couples. Every game has a pass button — no explanations ever needed.'),
      h('label', { class: 'consent-check' }, check, h('span', {}, 'We are both 18+ and we both want to continue.')),
      unlockBtn,
      h('button', { class: 'btn btn-ghost btn-sm', onclick: close }, 'Not now'),
    );
  });
}

/* ---- game view ---- */

function showGameView() {
  const pane = qs('#pane-left');
  const g = activeGame();
  const mod = g && getGame(g.id);
  if (!pane || !mod) return;
  pane.innerHTML = '';
  const hot = mod.section === 'adult';
  pane.append(
    h('div', { class: 'game-view' },
      h('div', { class: 'game-bar' },
        h('h2', {}, mod.icon, ' ', mod.name, hot ? h('span', { class: 'badge badge-18' }, '18+') : null),
        h('button', {
          class: 'icon-btn', title: 'End game for both',
          onclick: async () => {
            const ok = await confirmModal({ title: 'Wrap up this game?', body: 'It closes on both of your screens. Your scores stay for the night.', okLabel: 'End game', hot: true });
            if (ok) { sfx.whoosh(); closeGame(); showGamesMenu(); }
          },
        }, h('span', { html: closeIcon() }))),
      h('div', { class: 'game-stage glass', id: 'game-stage' }),
    ));

  function closeIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'; }
}

/* ---- leave / end ---- */

async function leaveNight() {
  const ok = await confirmModal({ title: 'End the night?', body: 'The room, chat and scores disappear — nothing is ever saved.', okLabel: 'End the night', cancelLabel: 'Stay', hot: true });
  if (!ok) return;
  try { await api('/api/leave', { token: G.me.token }); } catch { /* */ }
  teardown();
  showHome();
  toast('The night ended — thanks for playing 🌙');
}

function teardown() {
  disconnectStream();
  clearSession();
  closeGame();
  removeFab();
  closeSheet(true);
  G.chat = []; G.unread = 0; G.peer = { name: '', emoji: '💖', connected: false, graceEndsAt: null };
  G.scores = {}; G.unlocked18 = false; G.activeGame = null; G.me = null;
  hideReconnect();
  firstMeet = true;
}

function showEnd(reason) {
  if (screen === 'end' && !G.me) return;
  teardown();
  const copy = reason === 'left'
    ? { icon: '🕯️', title: 'Your partner left the night', body: 'The candles are out — but you can light them again whenever you like. Nothing was saved.' }
    : { icon: '🌙', title: 'The night has ended', body: 'The connection faded and your partner didn\u2019t make it back in time. Everything was session-only — it\u2019s all gone now, on purpose.' };
  swap(h('div', { class: 'screen end-screen', 'data-screen': 'end' },
    h('div', { class: 'end-card glass' },
      h('div', { style: 'font-size:56px' }, copy.icon),
      h('h3', { style: 'margin:0; font-size:23px' }, copy.title),
      h('p', { class: 'muted', style: 'line-height:1.55' }, copy.body),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => showHome() }, 'Light a new candle 🕯️'))));
}

/* ---- reconnect overlay (partner's 60s grace) ---- */

function showReconnect() {
  if (reconnectOv || !G.me || screen === 'home' || screen === 'end') return;
  const count = h('div', { class: 'grace-count' }, '60');
  reconnectOv = h('div', { class: 'overlay' },
    h('div', { class: 'reconnect-card glass' },
      h('div', { class: 'broken-heart' }, '💔'),
      h('h3', { style: 'margin:0; font-size:20px' }, `${G.peer.name || 'Your partner'} lost connection`),
      h('p', { class: 'muted', style: 'font-size:14px; line-height:1.5' }, 'Maybe the wifi blinked or a pocket ended the call. We\u2019ll hold your game for'),
      count,
      h('div', { class: 'g-sub' }, 'seconds before the night fades.'),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: hideReconnect }, 'Keep me posted — dismiss'),
    ));
  qs('#overlays').append(reconnectOv);
  const anim = () => {
    if (!reconnectOv) return;
    if (G.peer.connected) { hideReconnect(); return; }
    const end = G.peer.graceEndsAt ? (G.peer.graceEndsAt + G.skew) : (Date.now() + 60000);
    count.textContent = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}
function hideReconnect() {
  reconnectOv?.remove();
  reconnectOv = null;
}
