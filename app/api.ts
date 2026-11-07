// Shared server calls. One session id per app launch, used for per-applicant token tracking.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
export const session = Math.random().toString(36).slice(2);

export type Profile = Record<string, unknown>;
export type Prefs = { plain_language?: boolean; one_step?: boolean; language?: string };

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
