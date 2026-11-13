import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { post, Prefs, Profile } from '../api';
import { colors, radius, space, type, themed } from '../theme';
import { useTracker } from '../tracker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, ChancesHeadline } from '../components/Chances';
import WhyScore from '../components/WhyScore';
import SearchElsewhere from '../components/SearchElsewhere';
import Brand from '../components/Brand';

type Job = { id: string; hiring_now?: boolean; title: string; company?: string; city?: string; pay_min?: number; pay_max?: number; pay_estimated?: boolean; pay_text?: string; url?: string; source?: string };
type Match = { id: string; fit: 'strong' | 'good' | 'stretch'; why: string; gaps: string[]; job: Job; card?: Card };
type Employer = { name: string; kind: string; city?: string | null; website?: string | null; openings: number; example: string };
type MatchReply = { matches: Match[]; data: string; considered: number; scored: number; next_round: number | null; checked: string[]; reach_out: Employer[] };
export const MATCHES_KEY = 'matches.v3';
// Matches saved under the older rules (interview chance only). Their profile gets a fresh search with the new rules.
export const OLD_MATCHES_KEY = 'matches.v2';
// A job is only shown when the applicant has at least this chance of an interview AND of an offer.
// The server only returns jobs that clear both; the check here also covers matches saved on the device.
export const MATCH_MIN_INTERVIEW = 50;
export const MATCH_MIN_HIRE = 50;
const qualifies = (c?: Card) => (c?.predictions.interview ?? 0) >= MATCH_MIN_INTERVIEW && (c?.predictions.hire ?? 0) >= MATCH_MIN_HIRE;
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
  // Where "Keep looking" continues (null once every search has been tried), the jobs already checked so they
  // aren't scored twice, how many jobs were looked at, and nearby employers to contact directly.
  const [nextRound, setNextRound] = useState<number | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [considered, setConsidered] = useState(0);
  const [reachOut, setReachOut] = useState<Employer[]>([]);
  const started = useRef(false);

  const SEARCHING = 'Searching jobs near you and scoring your chances. This can take a minute or two…';

  // Runs searches until at least one job clears both 50% bars or every search has been tried.
  // Each request widens the search on the server (other titles for the same work, more pages of results).
  type Found = { matches: Match[]; checked: string[]; considered: number; reach: Employer[]; sample: boolean };
  const look = async (round: number, prev: Found, target = 6): Promise<Found & { next: number | null }> => {
    let all = prev.matches, seen = prev.checked, total = prev.considered, reach = prev.reach, isSample = prev.sample;
    let next: number | null = round;
    do {
      setStep(!all.length ? (round === 0 && !total ? SEARCHING : `Still looking: checked ${total} jobs so far. Searching more…`) : 'Finding more jobs for you…');
      const m: MatchReply = await post<MatchReply>('/api/match', { profile, prefs, round: next, exclude: seen, target });
      const have = new Set(all.map((x) => x.id));
      all = [...all, ...m.matches.filter((x) => !have.has(x.id))];
      seen = m.checked; total += m.considered; next = m.next_round; isSample = isSample || m.data === 'sample';
      const names = new Set(reach.map((e) => e.name.toLowerCase()));
      reach = [...reach, ...(m.reach_out || []).filter((e) => !names.has(e.name.toLowerCase()))].slice(0, 10);
      setMatches(all); setCards(Object.fromEntries(all.filter((x) => x.card).map((x) => [x.id, x.card!])));
      setChecked(seen); setConsidered(total); setNextRound(next); setReachOut(reach); setSample(isSample);
    } while (!all.some((x) => qualifies(x.card)) && next != null);
    setStep('');
    AsyncStorage.setItem(MATCHES_KEY, JSON.stringify({ profile: JSON.stringify(profile), matches: all, sample: isSample,
      next_round: next, checked: seen, considered: total, reach_out: reach, at: Date.now() }));
    return { matches: all, checked: seen, considered: total, reach, sample: isSample, next };
  };

  // The last matches for this profile are kept on the device, so they're still here after leaving this
  // screen or reloading the page. "Search again" runs a fresh search.
  const search = async (fresh: boolean) => {
    setError(''); setOpen(null);
    try {
      if (!fresh) {
        const saved = JSON.parse((await AsyncStorage.getItem(MATCHES_KEY)) || 'null');
        if (saved?.profile === JSON.stringify(profile) && saved.matches) {
          setMatches(saved.matches); setCards(Object.fromEntries(saved.matches.filter((x: Match) => x.card).map((x: Match) => [x.id, x.card])));
          setSample(!!saved.sample); setNextRound(saved.next_round ?? null); setChecked(saved.checked || []);
          setConsidered(saved.considered || 0); setReachOut(saved.reach_out || []); setStep('');
          return;
        }
        AsyncStorage.removeItem(OLD_MATCHES_KEY); // made under the old rules: search again
      }
      setMatches([]); setCards({}); setReachOut([]); setConsidered(0); setChecked([]);
      // Speed: show the first 3 jobs that clear both bars as soon as they're found, then find more in the background.
      const first = await look(0, { matches: [], checked: [], considered: 0, reach: [], sample: false }, 3);
      if (first.next != null && first.matches.filter((x) => qualifies(x.card)).length < 6) await look(first.next, first, 6);
    } catch (e) {
      setError(`Something went wrong. ${(e as Error).message}`); setStep('');
    }
  };
  const keepLooking = async () => {
    if (nextRound == null) return;
    setError('');
    try { await look(nextRound, { matches, checked, considered, reach: reachOut, sample }); }
    catch (e) { setError(`Something went wrong. ${(e as Error).message}`); setStep(''); }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    search(false);
  }, []);

  // Saving keeps a copy of the scorecard so the outcome can later be compared with the prediction.
  const save = (id: string, job: Job, c?: Card) =>
    tracker.add(id, job, c ? { overall: c.overall, predictions: c.predictions } : undefined);

  // Only jobs with at least a 50% chance of an interview and of an offer are shown, best combined chance first.
  const both = (m: Match) => (cards[m.id]?.predictions.interview ?? 0) * (cards[m.id]?.predictions.hire ?? 0);
  const good = matches.filter((m) => qualifies(cards[m.id])).sort((a, b) => both(b) - both(a));
  const scored = !step && considered > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Brand />
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to profile chat" style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={styles.title} role="heading" aria-level={1}>Your job matches</Text>
          <Pressable onPress={onTracker} accessibilityRole="button" accessibilityLabel={`My applications, ${tracker.items.length} saved`} style={styles.back}>
            <Text style={styles.backText}>My applications ({tracker.items.length}) ›</Text>
          </Pressable>
        </View>
        {!step && considered > 0 && (
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

        {scored && (
          <Text style={type.small}>
            {good.length
              ? `We checked ${considered} jobs. Showing ${good.length} where you have at least a ${MATCH_MIN_INTERVIEW}% chance of an interview and at least a ${MATCH_MIN_HIRE}% chance of an offer, best chances first.`
              : `We checked ${considered} jobs near you, and none give you at least a ${MATCH_MIN_INTERVIEW}% chance of both an interview and an offer yet. ${nextRound != null ? 'Tap Keep looking to search further. ' : ''}Telling Theo more about the jobs you want, allowing a longer commute, or checking a job you found can help. The employers below are hiring for similar work and are worth contacting directly.`}
          </Text>
        )}

        {good.map(({ id, why, gaps, job }) => {
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
                  {/* Every job shown has at least a 50% chance of an interview and of an offer. */}
                  <Text style={[styles.fit, { color: colors.green }]}>✓ Worth applying</Text>
                </View>
              </View>

              <ChancesHeadline card={c} />
              {why ? <Text style={type.body}>{why}</Text> : null}
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

        {!step && nextRound != null && (
          <Pressable
            onPress={keepLooking}
            style={good.length ? styles.whyBtn : styles.apply}
            accessibilityRole="button"
            accessibilityLabel={good.length ? 'Find more jobs where you have at least a 50 percent chance' : 'Keep looking for jobs where you have at least a 50 percent chance'}
          >
            <Text style={good.length ? styles.whyText : styles.applyText}>{good.length ? 'Find more jobs like these' : 'Keep looking'}</Text>
          </Pressable>
        )}


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
  reach: { borderTopWidth: 2, borderColor: colors.line, paddingTop: space.md, gap: space.sm },
  employer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  credit: { ...type.small, color: colors.blue, textDecorationLine: 'underline', textAlign: 'center', paddingVertical: space.md },
}));
