// Typewriter sounds for the typing headline, made in the browser with the Web Audio API (no audio files):
// a short filtered click per key, a softer one for spaces, and a bell when the line is done.
// Browsers only allow sound after the visitor has clicked or tapped the page, so the first visit types
// silently unless they press "Play with sound". Web only; the phone apps stay silent.
import { Platform } from 'react-native';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export const soundAvailable = () => audio() != null;
// True once the browser lets this page play sound (after any click or tap).
export const soundAllowed = () => audio()?.state === 'running';
// Call from a click or tap: lets the page play sound from then on.
export async function unlockSound() {
  const c = audio();
  if (c && c.state !== 'running') await c.resume().catch(() => {});
  return soundAllowed();
}

function noiseBuffer(c: AudioContext) {
  if (noise) return noise;
  noise = c.createBuffer(1, Math.round(c.sampleRate * 0.05), c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  return noise;
}

// One key strike. Spaces are softer; every key varies a little in pitch and loudness, like a real typewriter.
export function keyClick(ch: string) {
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = (ch === ' ' ? 900 : 1800) + Math.random() * 900;
  filter.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.setValueAtTime((ch === ' ' ? 0.08 : 0.16) * (0.8 + Math.random() * 0.4), t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + 0.05);
}

// The bell at the end of the line.
export function bell() {
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + 0.08;
  for (const [freq, level] of [[2093, 0.08], [4186, 0.025]] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.95);
  }
}
