import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { post, Prefs, Profile } from '../api';
import { colors, radius, space, type } from '../theme';

type Job = { id: string; title: string; company?: string; city?: string; pay_min?: number; pay_max?: number; pay_text?: string; url?: string; source?: string };
type Match = { id: string; fit: 'strong' | 'good' | 'stretch'; why: string; gaps: string[]; job: Job };
type Part = { score: number | null; note: string };
type Card = {
  id: string; overall: number | null; parts: Record<string, Part>; explanation?: string; improve?: string;
  predictions: Partial<Record<'interview' | 'hire' | 'promotion_1yr' | 'retain_12' | 'retain_18' | 'retain_24', number>>;
};

const PART_LABELS: Record<string, string> = { skills: 'Skills', credentials: 'Credentials', experience: 'Experience', pay: 'Pay', commute: 'Commute' };
const ODDS: [keyof Card['predictions'], string][] = [
  ['interview', 'Get an interview'], ['hire', 'Get hired'], ['promotion_1yr', 'Promoted within 1 year'],
  ['retain_12', 'Still there at 12 months'], ['retain_18', 'Still there at 18 months'], ['retain_24', 'Still there at 24 months'],
];
const FIT_LABEL = { strong: 'Strong match', good: 'Good match', stretch: 'Stretch' };
const money = (n?: number) => (n ? `$${Math.round(n).toLocaleString()}` : '');

function Bar({ label, value }: { label: string; value?: number | null }) {
  const v = value ?? 0;
  return (
    <View style={styles.barRow} accessible accessibilityLabel={`${label}: ${value == null ? 'unknown' : `${v} percent`}`}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}><View style={[styles.barFill, { width: `${v}%` }]} /></View>
      <Text style={styles.barValue}>{value == null ? '–' : `${v}%`}</Text>
    </View>
  );
}

export default function MatchesScreen({ profile, prefs, onBack }: { profile: Profile; prefs: Prefs; onBack: () => void }) {
  const [step, setStep] = useState('Finding jobs near you…');
  const [matches, setMatches] = useState<Match[]>([]);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [sample, setSample] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const m = await post<{ matches: Match[]; data: string }>('/api/match', { profile, prefs });
        setMatches(m.matches); setSample(m.data === 'sample');
        setStep('Scoring each job…');
        const s = await post<Card[]>('/api/scorecard', { profile, prefs, jobs: m.matches.map((x) => x.job) });
        setCards(Object.fromEntries(s.map((c) => [c.id, c])));
        setStep('');
      } catch (e) {
        setError(`Something went wrong. ${(e as Error).message}`); setStep('');
      }
    })();
  }, []);

  const sorted = [...matches].sort((a, b) => (cards[b.id]?.overall ?? -1) - (cards[a.id]?.overall ?? -1));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to profile chat" style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} role="heading" aria-level={1}>Your job matches</Text>

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
                  <Text style={styles.jobTitle} role="heading" aria-level={2}>{job.title}</Text>
                  <Text style={type.small}>{[job.company, job.city].filter(Boolean).join(' · ')}</Text>
                  <Text style={type.small}>
                    {job.pay_min ? `${money(job.pay_min)} – ${money(job.pay_max)}` : job.pay_text || 'Pay not listed'}
                    {job.source ? ` · ${job.source}` : ''}
                  </Text>
                  <Text style={[styles.fit, fit === 'stretch' && { color: colors.muted }]}>{FIT_LABEL[fit]}</Text>
                </View>
              </View>

              <Text style={type.body}>{why}</Text>
              {gaps.length > 0 && <Text style={type.small}>To close the gap: {gaps.map((g) => g.replace(/\.$/, '')).join('; ')}.</Text>}

              {c && (
                <Pressable
                  onPress={() => setOpen(expanded ? null : id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={expanded ? 'Hide scorecard' : 'Show scorecard'}
                  style={styles.toggle}
                >
                  <Text style={styles.toggleText}>{expanded ? 'Hide scorecard ▲' : 'Show scorecard ▼'}</Text>
                </Pressable>
              )}

              {c && expanded && (
                <View style={{ gap: space.md }}>
                  <Text style={styles.sub} role="heading" aria-level={3}>How you fit</Text>
                  {Object.entries(PART_LABELS).map(([k, label]) => (
                    <View key={k} style={{ gap: 2 }}>
                      <Bar label={label} value={c.parts[k]?.score} />
                      <Text style={styles.note}>{c.parts[k]?.note}</Text>
                    </View>
                  ))}
                  <Text style={styles.sub} role="heading" aria-level={3}>Your chances (estimates)</Text>
                  {ODDS.map(([k, label]) => <Bar key={k} label={label} value={c.predictions[k]} />)}
                  {c.explanation ? <Text style={type.small}>{c.explanation}</Text> : null}
                  {c.improve ? (
                    <View style={styles.tip}>
                      <Text style={styles.tipTitle}>Best next step</Text>
                      <Text style={type.body}>{c.improve}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.note}>
                    Estimates use your fit and typical hiring and turnover patterns for this kind of job. They are not guarantees.
                  </Text>
                </View>
              )}

              {job.url && (
                <Pressable
                  style={styles.apply}
                  onPress={() => Linking.openURL(job.url!)}
                  accessibilityRole="link"
                  accessibilityLabel={`View and apply for ${job.title}`}
                >
                  <Text style={styles.applyText}>View and apply</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
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
  jobTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  fit: { fontSize: 16, fontWeight: '700', color: colors.blue },
  toggle: { minHeight: 48, justifyContent: 'center' },
  toggleText: { fontSize: 18, fontWeight: '600', color: colors.blue },
  sub: { ...type.heading, fontSize: 18 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barLabel: { width: 150, fontSize: 16, color: colors.ink },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.tint, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: 12, backgroundColor: colors.blue },
  barValue: { width: 48, textAlign: 'right', fontSize: 16, fontWeight: '700', color: colors.ink },
  note: { ...type.small, fontSize: 15 },
  tip: { backgroundColor: colors.tint, borderLeftWidth: 4, borderLeftColor: colors.red, padding: space.md, borderRadius: radius, gap: 4 },
  tipTitle: { fontSize: 16, fontWeight: '700', color: colors.red },
  apply: { backgroundColor: colors.blue, minHeight: 52, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: colors.white, fontSize: 18, fontWeight: '700' },
});
