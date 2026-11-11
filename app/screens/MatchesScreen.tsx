import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { post, Prefs, Profile } from '../api';
import { colors, radius, space, type, themed } from '../theme';
import { useTracker } from '../tracker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, ChancesHeadline } from '../components/Chances';
import WhyScore from '../components/WhyScore';
import SearchElsewhere from '../components/SearchElsewhere';

type Job = { id: string; hiring_now?: boolean; title: string; company?: string; city?: string; pay_min?: number; pay_max?: number; pay_estimated?: boolean; pay_text?: string; url?: string; source?: string };
type Match = { id: string; fit: 'strong' | 'good' | 'stretch'; why: string; gaps: string[]; job: Job };
const FIT_LABEL = { strong: 'Strong match', good: 'Good match', stretch: 'Stretch' };
export const MATCHES_KEY = 'matches.v1';
const money = (n?: number) => (n ? `$${Math.round(n).toLocaleString()}` : '');

export default function MatchesScreen({ profile, prefs, onBack, onTracker, onCheckJob, signedIn, onAccount }: {
  profile: Profile; prefs: Prefs; onBack: () => void; onTracker: () => void; onCheckJob: () => void;
  signedIn: boolean; onAccount: () => void;
}) {
  const tracker = useTracker();
  const [step, setStep] = useState('Finding jobs near you…');
  const [matches, setMatches] = useState<Match[]>([]);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [sample, setSample] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  // The last matches for this profile are kept on the device, so they're still here after leaving this
  // screen or reloading the page. "Search again" runs a fresh search.
  const search = async (fresh: boolean) => {
    setError(''); setOpen(null);
    try {
      if (!fresh) {
        const saved = JSON.parse((await AsyncStorage.getItem(MATCHES_KEY)) || 'null');
        if (saved?.profile === JSON.stringify(profile) && saved.matches?.length) {
          setMatches(saved.matches); setCards(saved.cards || {}); setSample(!!saved.sample); setStep('');
          return;
        }
      }
      setMatches([]); setCards({}); setStep('Finding jobs near you…');
      const m = await post<{ matches: Match[]; data: string }>('/api/match', { profile, prefs });
      setMatches(m.matches); setSample(m.data === 'sample');
      setStep('Scoring each job…');
      const s = await post<Card[]>('/api/scorecard', { profile, prefs, jobs: m.matches.map((x) => x.job) });
      const byId = Object.fromEntries(s.map((c) => [c.id, c]));
      setCards(byId);
      setStep('');
      AsyncStorage.setItem(MATCHES_KEY, JSON.stringify({ profile: JSON.stringify(profile), matches: m.matches, cards: byId, sample: m.data === 'sample', at: Date.now() }));
    } catch (e) {
      setError(`Something went wrong. ${(e as Error).message}`); setStep('');
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    search(false);
  }, []);

  // Saving keeps a copy of the scorecard so the outcome can later be compared with the prediction.
  const save = (id: string, job: Job, c?: Card) =>
    tracker.add(id, job, c ? { overall: c.overall, predictions: c.predictions } : undefined);

  const sorted = [...matches].sort((a, b) => (cards[b.id]?.overall ?? -1) - (cards[a.id]?.overall ?? -1));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to profile chat" style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={styles.title} role="heading" aria-level={1}>Your job matches</Text>
          <Pressable onPress={onTracker} accessibilityRole="button" accessibilityLabel={`My applications, ${tracker.items.length} saved`} style={styles.back}>
            <Text style={styles.backText}>My applications ({tracker.items.length}) ›</Text>
          </Pressable>
        </View>
        {!step && matches.length > 0 && (
          <Pressable onPress={() => search(true)} accessibilityRole="button" accessibilityLabel="Search again for new jobs" style={styles.back}>
            <Text style={styles.backText}>↻ Search again for new jobs</Text>
          </Pressable>
        )}

        {!signedIn && (
          <Pressable onPress={onAccount} style={styles.banner} accessibilityRole="button" accessibilityLabel="Create a free account to keep your profile and applications on any device">
            <Text style={type.small}><Text style={{ fontWeight: '700', color: colors.blue }}>Save your progress: </Text>create a free account to see your profile and applications on any phone or computer ›</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onCheckJob}
          style={({ pressed }) => [styles.checkBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Check a job you found"
          accessibilityHint="Paste a link or job description to see your chances for that job"
        >
          <Text style={styles.checkText}>Found a job somewhere else? Check your chances ›</Text>
        </Pressable>

        <View aria-live="polite">
          {step ? <View style={styles.row}><ActivityIndicator color={colors.blue} /><Text style={type.body}>{step}</Text></View> : null}
          {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
        </View>

        {sample && (
          <Text style={styles.banner}>
            These are sample jobs for practice. Live listings appear when job sources are connected.
          </Text>
        )}

        {sorted.map(({ id, fit, why, gaps, job }) => {
          const c = cards[id];
          const expanded = open === id;
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardTop}>
                <View
                  style={styles.score}
                  accessible
                  accessibilityLabel={c?.overall != null ? `Overall score ${c.overall} out of 100` : 'Scoring'}
                >
                  <Text style={styles.scoreNum}>{c?.overall ?? '…'}</Text>
                  <Text style={styles.scoreOf}>/100</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  {job.hiring_now && <Text style={styles.now} accessibilityLabel="Hiring now: this employer says it hires quickly">Hiring now</Text>}
                  <Text style={styles.jobTitle} role="heading" aria-level={2}>{job.title}</Text>
                  <Text style={type.small}>{[job.company, job.city].filter(Boolean).join(' · ')}</Text>
                  <Text style={type.small}>
                    {job.pay_min
                      ? job.pay_min === job.pay_max ? money(job.pay_min) : `${money(job.pay_min)} – ${money(job.pay_max)}`
                      : job.pay_text || 'Pay not listed'}
                    {job.pay_estimated ? ' (estimated)' : ''}
                    {job.source ? ` · ${job.source}` : ''}
                  </Text>
                  <Text style={[styles.fit, fit === 'stretch' && { color: colors.muted }]}>{FIT_LABEL[fit]}</Text>
                </View>
              </View>

              <ChancesHeadline card={c} />
              <Text style={type.body}>{why}</Text>
              {gaps.length > 0 && <Text style={type.small}>To close the gap: {gaps.map((g) => g.replace(/\.$/, '')).join('; ')}.</Text>}

              {c && expanded && <WhyScore card={c} />}

              <View style={styles.actions}>
                <Pressable
                  style={[styles.saveBtn, tracker.has(id) && { borderColor: colors.line }]}
                  onPress={() => save(id, job, c)}
                  disabled={tracker.has(id)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: tracker.has(id) }}
                  accessibilityLabel={tracker.has(id) ? `${job.title} is in your tracker` : `Save ${job.title} to my applications`}
                >
                  <Text style={[styles.saveText, tracker.has(id) && { color: colors.muted }]}>{tracker.has(id) ? 'Saved ✓' : 'Save'}</Text>
                </Pressable>
                {c && (
                  <Pressable
                    style={[styles.whyBtn, expanded && { backgroundColor: colors.tint }]}
                    onPress={() => setOpen(expanded ? null : id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={expanded ? `Hide why ${job.title} scored ${c.overall}` : `Why ${job.title} scored ${c.overall}: skills you have, skills to build, and how your chances were figured`}
                  >
                    <Text style={styles.whyText}>{expanded ? 'Hide feedback ▲' : 'Why this score?'}</Text>
                  </Pressable>
                )}
                {job.url && (
                  <Pressable
                    style={[styles.apply, { flexGrow: 1, minWidth: 180 }]}
                    onPress={() => { save(id, job, c); Linking.openURL(job.url!); }}
                    accessibilityRole="link"
                    accessibilityLabel={`View and apply for ${job.title}. It will be saved to your tracker.`}
                  >
                    <Text style={styles.applyText}>View and apply</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        {!step && <SearchElsewhere profile={profile} />}

        {matches.some((m) => m.job.source === 'Adzuna') && (
          <Pressable onPress={() => Linking.openURL('https://www.adzuna.com')} accessibilityRole="link" accessibilityLabel="Jobs by Adzuna">
            <Text style={styles.credit}>Jobs by Adzuna</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 18, color: colors.blue, fontWeight: '600' },
  title: { ...type.title, color: colors.red },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  error: { fontSize: 18, color: colors.red },
  banner: { ...type.small, backgroundColor: colors.tint, padding: space.md, borderRadius: radius },
  card: { borderWidth: 2, borderColor: colors.line, borderRadius: radius, padding: space.md, gap: space.sm },
  cardTop: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  score: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 24, fontWeight: '800', color: colors.blue },
  scoreOf: { fontSize: 12, color: colors.muted, marginTop: -4 },
  now: { alignSelf: 'flex-start', backgroundColor: colors.red, color: colors.onAccent, fontSize: 14, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  jobTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  fit: { fontSize: 16, fontWeight: '700', color: colors.blue },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  whyBtn: { minHeight: 52, borderRadius: radius, borderWidth: 2, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  whyText: { fontSize: 18, fontWeight: '700', color: colors.orange },
  saveBtn: { minHeight: 52, minWidth: 100, borderRadius: radius, borderWidth: 2, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  saveText: { fontSize: 18, fontWeight: '700', color: colors.blue },
  apply: { backgroundColor: colors.blue, minHeight: 52, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: colors.onAccent, fontSize: 18, fontWeight: '700' },
  checkBtn: { minHeight: 52, borderRadius: radius, borderWidth: 2, borderColor: colors.red, justifyContent: 'center', paddingHorizontal: space.md },
  checkText: { fontSize: 18, fontWeight: '700', color: colors.red },
  credit: { ...type.small, color: colors.blue, textDecorationLine: 'underline', textAlign: 'center', paddingVertical: space.md },
}));
