// Application tracker, stored on the applicant's device (private by default; no account needed).
// When the applicant is signed in, every change is also saved to their account (see account.ts).
// Each item keeps the scorecard from when it was saved, so outcomes can later be compared with predictions.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { scheduleSync } from './account';

export const STAGES = ['Saved', 'Applied', 'Screening', 'Interviewing', 'Offer', 'Closed'] as const;
export type Stage = (typeof STAGES)[number];
export type Outcome = 'Accepted' | 'Rejected' | 'Withdrew' | 'No response';

export type TrackedJob = {
  id: string;
  job: { title: string; company?: string; city?: string; url?: string; source?: string; pay_min?: number; pay_max?: number };
  score?: { overall: number | null; predictions: Record<string, number | undefined> };
  stage: Stage;
  outcome?: Outcome;
  notes: string;
  savedAt: string;
  appliedAt?: string;
  followUp?: string; // date (YYYY-MM-DD) for the next follow-up
  history: { stage: Stage; at: string }[];
};

const KEY = 'tracker.v1';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export function useTracker() {
  const [items, setItems] = useState<TrackedJob[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => { setItems(raw ? JSON.parse(raw) : []); setReady(true); });
  }, []);

  const save = useCallback((next: TrackedJob[]) => {
    setItems(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).then(scheduleSync);
  }, []);

  const add = useCallback((id: string, job: TrackedJob['job'], score?: TrackedJob['score'], stage: Stage = 'Saved') => {
    setItems((cur) => {
      if (cur.some((t) => t.id === id)) return cur;
      const now = today();
      const next = [{ id, job, score, stage, notes: '', savedAt: now, history: [{ stage, at: now }],
        ...(stage === 'Applied' && { appliedAt: now, followUp: addDays(7) }) }, ...cur];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).then(scheduleSync);
      return next;
    });
  }, []);

  const update = useCallback((id: string, patch: Partial<TrackedJob>) => {
    save(items.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, [items, save]);

  const move = useCallback((id: string, stage: Stage, outcome?: Outcome) => {
    const now = today();
    save(items.map((t) => (t.id !== id ? t : {
      ...t, stage, outcome: stage === 'Closed' ? outcome : undefined,
      history: [...t.history, { stage, at: now }],
      // Applying sets a reminder to follow up in a week.
      ...(stage === 'Applied' && { appliedAt: t.appliedAt ?? now, followUp: addDays(7) }),
      ...(stage === 'Closed' && { followUp: undefined }),
    })));
  }, [items, save]);

  const remove = useCallback((id: string) => save(items.filter((t) => t.id !== id)), [items, save]);

  return { items, ready, add, update, move, remove, has: (id: string) => items.some((t) => t.id === id) };
}

export const isDue = (t: TrackedJob) => !!t.followUp && t.followUp <= today();
