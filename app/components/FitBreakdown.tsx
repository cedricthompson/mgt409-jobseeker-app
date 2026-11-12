// How the five fit areas add up to the overall Predictability Score. Each area has its own 0-100% score;
// it adds (its % x its weight) points, and the points add up to the overall score on the card.
// Matches server/agents/scorecard.js: weights skills 30, credentials 25, experience 15, pay 15, commute 15,
// and an area with no information counts as 50%.
import { Text, View } from 'react-native';
import { colors, space, themed } from '../theme';

export type Area = { key: string; label: string; weight: number; score: number | null; color: 'teal' | 'purple' | 'orange' | 'green' | 'blue' };

export const AREAS: Omit<Area, 'score'>[] = [
  { key: 'skills', label: 'Skills', weight: 30, color: 'teal' },
  { key: 'credentials', label: 'Credentials', weight: 25, color: 'purple' },
  { key: 'experience', label: 'Experience', weight: 15, color: 'orange' },
  { key: 'pay', label: 'Pay', weight: 15, color: 'green' },
  { key: 'commute', label: 'Commute', weight: 15, color: 'blue' },
];

export const points = (a: { weight: number; score: number | null }) => (a.weight * (a.score ?? 50)) / 100;
const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

export default function FitBreakdown({ areas, overall, compact = false }: { areas: Area[]; overall: number | null; compact?: boolean }) {
  const total = areas.reduce((s, a) => s + points(a), 0);
  return (
    <View style={styles.box} accessible
      accessibilityLabel={`How your score adds up: ${areas.map((a) => `${a.label} ${a.score ?? 'unknown'} percent adds ${fmt(points(a))} of ${a.weight} points`).join('; ')}. Total ${overall ?? Math.round(total)} out of 100.`}>
      {!compact && <Text style={styles.title}>How your score adds up</Text>}
      {/* Stacked bar: each area's points in its color, out of 100 */}
      <View style={styles.track}>
        {areas.map((a) => <View key={a.key} style={{ width: `${points(a)}%`, backgroundColor: colors[a.color] }} />)}
      </View>
      {!compact && (
        <View style={{ gap: 4 }}>
          {areas.map((a) => (
            <View key={a.key} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: colors[a.color] }]} />
              <Text style={styles.label}>{a.label}</Text>
              <Text style={styles.math}>{a.score == null ? 'unknown (50%)' : `${a.score}%`} × {a.weight}%</Text>
              <Text style={[styles.pts, { color: colors[a.color] }]}>+{fmt(points(a))}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{compact ? 'Adds up to' : 'Total'}</Text>
        <Text style={styles.total}>
          {fmt(total) !== String(overall) && !compact ? `${fmt(total)} → ` : ''}{overall ?? Math.round(total)} out of 100
        </Text>
      </View>
    </View>
  );
}

const styles = themed(() => ({
  box: { backgroundColor: colors.tint, borderRadius: 16, padding: space.md, gap: space.sm },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  track: { height: 18, borderRadius: 9, backgroundColor: colors.line, overflow: 'hidden', flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { width: 100, fontSize: 16, fontWeight: '700', color: colors.ink },
  math: { flex: 1, fontSize: 15, color: colors.muted },
  pts: { width: 56, textAlign: 'right', fontSize: 17, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.ink },
  total: { fontSize: 18, fontWeight: '900', color: colors.ink },
}));
