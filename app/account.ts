// Optional account. Signed out, everything stays on this device (as before).
// Signed in, the profile, settings, and application tracker are saved to the account after every change,
// and loaded on any device the applicant signs in on.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, Prefs, Profile } from './api';

const ACCOUNT = 'account.v1';
const KEYS = { profile: 'profile.v1', prefs: 'prefs.v1', tracker: 'tracker.v1' };
type Saved = { profile?: Profile; prefs?: Prefs; tracker?: { id: string }[] };
export type Account = { token: string; email: string };

let current: Account | null = null;
let loaded = false;
export async function getAccount(): Promise<Account | null> {
  if (!loaded) { const raw = await AsyncStorage.getItem(ACCOUNT); current = raw ? JSON.parse(raw) : null; loaded = true; }
  return current;
}

async function call<T>(method: string, path: string, body?: object): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(current && { Authorization: `Bearer ${current.token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && current && !path.startsWith('/api/log')) await forget(); // signed out elsewhere or expired
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

async function readLocal(): Promise<Required<Saved>> {
  const [[, p], [, pr], [, t]] = await AsyncStorage.multiGet([KEYS.profile, KEYS.prefs, KEYS.tracker]);
  return { profile: p ? JSON.parse(p) : {}, prefs: pr ? JSON.parse(pr) : {}, tracker: t ? JSON.parse(t) : [] };
}

const filled = (o?: object) => !!o && Object.keys(o).length > 0;

// Combine what's on this device with what's in the account. The account's profile and settings win when
// it has them; tracked jobs are combined, so nothing saved on either side is lost.
async function applySaved(saved?: Saved | null): Promise<Required<Saved>> {
  const local = await readLocal();
  const ids = new Set((saved?.tracker || []).map((t) => t.id));
  const merged = {
    profile: filled(saved?.profile) ? saved!.profile! : local.profile,
    prefs: filled(saved?.prefs) ? saved!.prefs! : local.prefs,
    tracker: [...(saved?.tracker || []), ...local.tracker.filter((t) => !ids.has(t.id))],
  };
  await AsyncStorage.multiSet([
    [KEYS.profile, JSON.stringify(merged.profile)], [KEYS.prefs, JSON.stringify(merged.prefs)], [KEYS.tracker, JSON.stringify(merged.tracker)],
  ]);
  return merged;
}

async function remember(token: string, email: string, saved?: { data: Saved } | null) {
  current = { token, email }; loaded = true;
  await AsyncStorage.setItem(ACCOUNT, JSON.stringify(current));
  const merged = await applySaved(saved?.data);
  await push();
  return merged;
}

async function forget() {
  current = null; loaded = true;
  await AsyncStorage.removeItem(ACCOUNT);
}

export async function signUp(email: string, password: string) {
  const r = await call<{ token: string; email: string; saved: { data: Saved } | null }>('POST', '/api/signup', { email, password });
  return remember(r.token, r.email, r.saved);
}

export async function signIn(email: string, password: string) {
  const r = await call<{ token: string; email: string; saved: { data: Saved } | null }>('POST', '/api/login', { email, password });
  return remember(r.token, r.email, r.saved);
}

// On app start: bring in changes made on other devices.
export async function pull(): Promise<Required<Saved> | null> {
  if (!(await getAccount())) return null;
  try {
    const r = await call<{ saved: { data: Saved } | null }>('GET', '/api/me');
    const merged = await applySaved(r.saved?.data);
    if (!r.saved) await push();
    return merged;
  } catch {
    return null; // offline: keep using what's on the device
  }
}

async function push() {
  if (!current) return;
  await call('PUT', '/api/me', await readLocal());
}

// Called after every change. Waits a moment so a burst of changes is saved once.
let timer: ReturnType<typeof setTimeout> | undefined;
export function scheduleSync() {
  if (!current) return;
  clearTimeout(timer);
  timer = setTimeout(() => { push().catch(() => {}); }, 1500);
}

// Signing out also clears this device, so the next person on a shared or library computer can't see it.
export async function signOut() {
  clearTimeout(timer);
  await push().catch(() => {});
  await call('POST', '/api/logout', {}).catch(() => {});
  await forget();
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

export async function deleteAccount() {
  clearTimeout(timer);
  await call('DELETE', '/api/me');
  await forget();
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
