// Shared server calls. One session id per app launch, used for per-applicant token tracking.
import { Platform } from 'react-native';

// In development the API runs on port 3001. In the hosted web app, the same server
// serves both the app and the API, so requests go to the same address the page came from.
export const API_URL = process.env.EXPO_PUBLIC_API_URL
  ?? (Platform.OS === 'web' && !__DEV__ ? '' : 'http://localhost:3001');
export const session = Math.random().toString(36).slice(2);

export type Profile = Record<string, unknown>;
export type Prefs = { plain_language?: boolean; one_step?: boolean; language?: string; read_aloud?: boolean; reduce_motion?: boolean;
  look?: 'light' | 'dark' | 'contrast'; text_scale?: number };

// A dropped connection or a proxy hiccup (502, 503, 504) gets one quiet retry, so a brief network
// blip doesn't show the applicant an error. Repeated answers are cheap: the server caches them.
async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${API_URL}${path}`, init);
    if (![502, 503, 504].includes(res.status)) return res;
  } catch { /* network error: retry below */ }
  await new Promise((r) => setTimeout(r, 1500));
  return fetch(`${API_URL}${path}`, init);
}

export async function post<T>(path: string, body: object): Promise<T> {
  const res = await send(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
