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

export async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
