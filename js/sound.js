/* Tiny synthesized sound design + haptics. No audio assets — pure WebAudio. */
import { settings, saveSettings } from './state.js';

let ctx = null;
function ac() {
  if (!settings.sound) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
document.addEventListener('pointerdown', () => ac(), { once: true, capture: true });

function tone(freq, dur, { type = 'sine', vol = .16, at = 0, slide = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + .05);
}

export const sfx = {
  tap()     { tone(560, .09, { type: 'triangle', vol: .1, slide: -160 }); },
  send()    { tone(520, .14, { type: 'sine', vol: .12, slide: 300 }); },
  recv()    { tone(660, .12, { vol: .13 }); tone(880, .16, { vol: .13, at: .09 }); },
  tick()    { tone(1150, .045, { type: 'square', vol: .05 }); },
  match()   { tone(660, .12, { vol: .14 }); tone(830, .14, { vol: .14, at: .1 }); tone(990, .2, { vol: .14, at: .2 }); },
  miss()    { tone(300, .18, { type: 'sine', vol: .1, slide: -90 }); },
  win()     { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, { vol: .16, at: i * .12, type: 'triangle' })); },
  lose()    { tone(392, .25, { vol: .12 }); tone(311, .35, { vol: .12, at: .2 }); },
  whoosh()  { tone(240, .3, { type: 'sawtooth', vol: .05, slide: 500 }); },
  pop()     { tone(880, .07, { type: 'triangle', vol: .12, slide: 240 }); },
  spin()    { for (let i = 0; i < 10; i++) tone(400 + i * 55, .05, { type: 'square', vol: .05, at: i * .28 }); },
  heartbeat() { tone(85, .12, { vol: .22, type: 'sine' }); tone(75, .16, { vol: .18, at: .22 }); },
};

export function haptic(pattern) {
  if (!settings.haptics) return;
  try { navigator.vibrate && navigator.vibrate(pattern); } catch { /* */ }
}
export const buzz = {
  tap: 10, match: [20, 40, 20], win: [50, 60, 50, 60, 130], recv: 15,
};

export function toggleSound() { settings.sound = !settings.sound; saveSettings(); return settings.sound; }
export function toggleHaptics() { settings.haptics = !settings.haptics; saveSettings(); return settings.haptics; }
export function toggleTheme() { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; saveSettings(); return settings.theme; }
