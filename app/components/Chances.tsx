// The app's predictions, shared by the matches list and "Check any job."
// ChancesHeadline: the three odds every applicant asks about, shown up front on every job.
// ScoreDetails: the full scorecard (how you fit, all six odds, the reason, and the best next step).
import { Text, View } from 'react-native';
import { colors, radius, space, type, themed } from '../theme';

export type Part = { score: number | null; note: string };
export type Odds = 'interview' | 'hire' | 'promotion_1yr' | 'retain_12' | 'retain_18' | 'retain_24';
export type Requirement = { skill: string; from: 'listing' | 'onet'; have: boolean; evidence: string };
export type Card = {
  id: string; overall: number | null; parts: Record<string, Part>; explanation?: string; improve?: string; basis?: string;
  predictions: Partial<Record<Odds, number>>;
  requirements?: Requirement[]; occupation?: { code: string; title: string } | null;
};

const PART_LABELS: Record<string, string> = { skills: 'Skills', credentials: 'Credentials', experience: 'Experience', pay: 'Pay', commute: 'Commute' };
const ODDS: [Odds, string][] = [
  ['interview', 'Get an interview'], ['hire', 'Get hired'], ['promotion_1yr', 'Promoted within 1 year'],
  ['retain_12', 'Still there at 12 months'], ['retain_18', 'Still there at 18 months'], ['retain_24', 'Still there at 24 months'],
];
const HEADLINE: [Odds, string][] = [['interview', 'Interview'], ['hire', 'Hired'], ['retain_12', 'Still there at 1 year']];

export function Bar({ label, value }: { label: string; value?: number | null }) {
  const v = value ?? 0;
  return (
    <View style={styles.barRow} accessible accessibilityLabel={`${label}: ${value == null ? 'unknown' : `${v} percent`}`}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}><View style={[styles.barFill, { width: `${v}%` }]} /></View>
      <Text style={styles.barValue}>{value == null ? '–' : `${v}%`}</Text>
    </View>
  );
}

export function ChancesHeadline({ card }: { card?: Card }) {
  return (
    <View style={styles.headline}>
      <Text style={styles.headlineTitle}>Your chances</Text>
      <View style={styles.tiles}>
        {HEADLINE.map(([k, label]) => {
          const v = card?.predictions[k];
          return (
            <View key={k} style={styles.tile} accessible accessibilityLabel={`Chance ${label.toLowerCase()}: ${v == null ? 'still estimating' : `${v} percent`}`}>
              <Text style={styles.tileNum}>{v == null ? '…' : `${v}%`}</Text>
              <Text style={styles.tileLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ScoreDetails({ card }: { card: Card }) {
  return (
    <View style={{ gap: space.md }}>
      <Text style={styles.sub} role="heading" aria-level={3}>All your chances (estimates)</Text>
      {ODDS.map(([k, label]) => <Bar key={k} label={label} value={card.predictions[k]} />)}
      {card.explanation ? <Text style={type.small}>{card.explanation}</Text> : null}
      {card.basis ? <Text style={styles.note}>{card.basis}</Text> : null}
      {card.improve ? (
        <View style={styles.tip}>
          <Text style={styles.tipTitle}>Best next step to raise your chances</Text>
          <Text style={type.body}>{card.improve}</Text>
        </View>
      ) : null}
      <Text style={styles.sub} role="heading" aria-level={3}>How you fit ({card.overall ?? '–'} out of 100)</Text>
      {Object.entries(PART_LABELS).map(([k, label]) => (
        <View key={k} style={{ gap: 2 }}>
          <Bar label={label} value={card.parts[k]?.score} />
          <Text style={styles.note}>{card.parts[k]?.note}</Text>
        </View>
      ))}
      <Text style={styles.note}>
        Estimates use fixed rules: typical U.S. hiring and turnover patterns for this kind of job (from Bureau of Labor Statistics data), adjusted for your fit. The same job always gets the same estimate. They are not guarantees.
      </Text>
    </View>
  );
}

const styles = themed(() => ({
  headline: { backgroundColor: colors.tint, borderRadius: radius, padding: space.sm, gap: 4 },
  headlineTitle: { fontSize: 15, fontWeight: '700', color: colors.red, textTransform: 'uppercase', letterSpacing: 0.5 },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius, paddingVertical: space.sm, paddingHorizontal: 4 },
  tileNum: { fontSize: 26, fontWeight: '800', color: colors.blue },
  tileLabel: { fontSize: 15, color: colors.ink, textAlign: 'center' },
  sub: { ...type.heading, fontSize: 18 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barLabel: { width: 150, fontSize: 16, color: colors.ink },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.tint, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: 12, backgroundColor: colors.blue },
  barValue: { width: 48, textAlign: 'right', fontSize: 16, fontWeight: '700', color: colors.ink },
  note: { ...type.small, fontSize: 15 },
  tip: { backgroundColor: colors.tint, borderLeftWidth: 4, borderLeftColor: colors.red, padding: space.md, borderRadius: radius, gap: 4 },
  tipTitle: { fontSize: 16, fontWeight: '700', color: colors.red },
}));
