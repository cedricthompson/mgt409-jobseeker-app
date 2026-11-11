// A miniature of the sample Predictability Scorecard for the opening page: the overall ring,
// the four chances, and the five fit areas as thin colored bars. Tapping it opens the full scorecard.
import { Pressable, Text, View } from 'react-native';
import { colors, space, themed } from '../theme';
import { Meter, Ring } from './ScoreRing';
import { CHANCES, FIT, OVERALL, SAMPLE_JOB } from '../sampleScorecard';

const SHORT: Record<string, string> = {
  'Get an interview': 'Interview', 'Get hired': 'Hired', 'Promoted within a year': 'Promoted', 'Still there after 1 year': 'Stays 1 year',
};

export default function MiniScorecard({ onOpen }: { onOpen: () => void }) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`Sample scorecard: ${SAMPLE_JOB.title}, Predictability Score ${OVERALL} out of 100. ` +
        CHANCES.map((c) => `${c.label} ${c.value} percent`).join(', ') + '. Opens the full sample scorecard.'}
    >
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.tag}>SAMPLE SCORECARD</Text>
          <Text style={styles.title}>{SAMPLE_JOB.title}</Text>
          <Text style={styles.verdict}>✓ Worth applying</Text>
        </View>
        <Ring value={OVERALL} size={92} />
      </View>

      <View style={styles.chances}>
        {CHANCES.map((c) => (
          <View key={c.label} style={[styles.chance, { borderColor: colors[c.color] }]}>
            <Text style={[styles.chanceNum, { color: colors[c.color] }]}>{c.value}%</Text>
            <Text style={styles.chanceLabel}>{SHORT[c.label] ?? c.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 6 }}>
        {FIT.map((f) => (
          <View key={f.label} style={styles.fitRow}>
            <Text style={styles.fitLabel}>{f.label}</Text>
            <View style={{ flex: 1 }}><Meter value={f.score} color={colors[f.color]} height={8} /></View>
            <Text style={[styles.fitScore, { color: colors[f.color] }]}>{f.score}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.link}>See the full scorecard →</Text>
    </Pressable>
  );
}

const styles = themed(() => ({
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: space.md, gap: space.md,
    shadowColor: '#1A1A1A', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tag: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: colors.muted },
  title: { fontSize: 20, lineHeight: 24, fontWeight: '800', color: colors.ink },
  verdict: { fontSize: 15, fontWeight: '800', color: colors.green },
  chances: { flexDirection: 'row', gap: 6 },
  chance: { flex: 1, borderTopWidth: 4, borderRadius: 10, backgroundColor: colors.tint, paddingVertical: 6, alignItems: 'center' },
  chanceNum: { fontSize: 20, lineHeight: 24, fontWeight: '900' },
  chanceLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  fitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fitLabel: { width: 82, fontSize: 13, color: colors.ink },
  fitScore: { width: 28, textAlign: 'right', fontSize: 14, fontWeight: '800' },
  link: { fontSize: 15, fontWeight: '800', color: colors.blue },
}));
