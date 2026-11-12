// The Predictability Scorecard page: a full sample scorecard, so people see what they'll get before starting.
// The sample data lives in sampleScorecard.ts (shared with the mini scorecard on the opening page).
import { Pressable, SafeAreaView, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { colors, space, type, themed } from '../theme';
import Wordmark from '../components/Wordmark';
import { Meter, Ring } from '../components/ScoreRing';
import FitBreakdown, { Area, points } from '../components/FitBreakdown';
import { CHANCES, FIT, OVERALL, SAMPLE_JOB, STAY } from '../sampleScorecard';

export default function ScoreScreen({ onBack, onStart, onCheckJob }: {
  onBack: () => void; onStart: () => void; onCheckJob: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const tileWidth = width >= 1000 ? '23.5%' : width >= 520 ? '48%' : '100%';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to home" style={styles.back}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Wordmark size={26} />
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={styles.eyebrow}>THE PREDICTABILITY SCORECARD</Text>
          <Text style={styles.h1} role="heading" aria-level={1}>
            See your future <Text style={{ color: colors.red }}>before you apply.</Text>
          </Text>
          <Text style={styles.lead}>
            Every job we find comes with a scorecard like this one: one overall score, your real chances at each
            step, and exactly what's helping or holding you back.
          </Text>
        </View>

        {/* The sample scorecard */}
        <View style={styles.card} accessibilityLabel="Sample scorecard">
          <View style={styles.sampleTag}><Text style={styles.sampleTagText}>SAMPLE SCORECARD</Text></View>

          <View style={[styles.header, { flexDirection: wide ? 'row' : 'column' }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.jobTitle}>{SAMPLE_JOB.title}</Text>
              <Text style={type.small}>{SAMPLE_JOB.where}</Text>
              <Text style={type.small}>{SAMPLE_JOB.who}</Text>
              <View style={styles.verdict}>
                <Text style={[styles.verdictText, { color: colors.green }]}>✓ Worth applying</Text>
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Ring value={OVERALL} />
              <Text style={styles.ringLabel}>Predictability Score</Text>
            </View>
          </View>

          {/* Chances */}
          <Text style={styles.h2} role="heading" aria-level={2}>Your chances</Text>
          <View style={styles.grid}>
            {CHANCES.map((c) => (
              <View key={c.label} style={[styles.tile, { width: tileWidth, borderTopColor: colors[c.color] }]}
                accessible accessibilityLabel={`${c.label}: ${c.value} percent. ${c.note}`}>
                <Text style={styles.tileIcon} accessibilityElementsHidden importantForAccessibility="no">{c.icon}</Text>
                <Text style={[styles.tileNum, { color: colors[c.color] }]}>{c.value}%</Text>
                <Text style={styles.tileLabel}>{c.label}</Text>
                <Text style={type.small}>{c.note}</Text>
              </View>
            ))}
          </View>

          <View style={styles.stay}>
            <Text style={styles.areaLabel}>How long you're likely to stay</Text>
            {STAY.map((s) => (
              <View key={s.label} style={styles.stayRow} accessible accessibilityLabel={`Still there at ${s.label}: ${s.value} percent`}>
                <Text style={styles.stayLabel}>{s.label}</Text>
                <View style={{ flex: 1 }}><Meter value={s.value} color={colors.purple} /></View>
                <Text style={[styles.stayValue, { color: colors.purple }]}>{s.value}%</Text>
              </View>
            ))}
          </View>

          {/* Fit areas */}
          <Text style={styles.h2} role="heading" aria-level={2}>How you fit: the five areas behind your score</Text>
          {FIT.map((f) => (
            <View key={f.label} style={[styles.area, { borderLeftColor: colors[f.color] }]}
              accessible accessibilityLabel={`${f.label}: ${f.score} percent. It counts for ${f.weight} percent of your score and adds ${points(f)} of ${f.weight} points. ${f.note}`}>
              <View style={styles.areaTop}>
                <Text style={styles.areaIcon} accessibilityElementsHidden importantForAccessibility="no">{f.icon}</Text>
                <Text style={styles.areaLabel}>{f.label}</Text>
                <Text style={[styles.weight, { color: colors[f.color], borderColor: colors[f.color] }]}>adds {points(f)} of {f.weight} points</Text>
                <Text style={[styles.areaScore, { color: colors[f.color] }]}>{f.score}%</Text>
              </View>
              <Meter value={f.score} color={colors[f.color]} />
              <Text style={type.small}>{f.note}</Text>
            </View>
          ))}
          <FitBreakdown overall={OVERALL} areas={FIT.map((f) => ({ key: f.label, label: f.label, weight: f.weight, score: f.score, color: f.color as Area['color'] }))} />

          {/* Next step */}
          <View style={styles.next}>
            <Text style={styles.nextTitle}>⭐ Your best next step</Text>
            <Text style={type.body}>
              Earn your ServSafe Manager certificate (usually one day of training). Your Credentials score would go
              from 60 to 100, and your Predictability Score from 77 to 87.
            </Text>
          </View>
        </View>

        {/* How it's calculated */}
        <View style={{ gap: space.sm }}>
          <Text style={styles.h2} role="heading" aria-level={2}>How the score works</Text>
          <Text style={type.body}>
            <Text style={styles.bold}>Your Predictability Score</Text> (0 to 100) adds up the five areas above. Each
            area gets its own score from 0 to 100%, then counts for part of the total: skills 30%, credentials 25%, and
            experience, pay, and commute 15% each. So Skills at 78% adds 78% × 30 = 23.4 points, and all five add up
            to the score on the card.
          </Text>
          <Text style={type.body}>
            <Text style={styles.bold}>Your chances</Text> start from real U.S. hiring and turnover patterns for that
            kind of job (Bureau of Labor Statistics data), then adjust for how well you fit. The same job always gets the
            same estimate, and age, race, gender, religion, and disability are never used.
          </Text>
          <Text style={type.small}>Scores and chances are estimates to help you decide where to spend your time, not guarantees.</Text>
        </View>

        <View style={styles.ctaRow}>
          <Pressable style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.blueDark }]}
            onPress={onStart} accessibilityRole="button" accessibilityLabel="Get my own scorecard">
            <Text style={styles.ctaText}>Get my own scorecard</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.ctaSecondary, pressed && { backgroundColor: colors.tint }]}
            onPress={onCheckJob} accessibilityRole="button" accessibilityLabel="Score a job I found">
            <Text style={styles.ctaSecondaryText}>Score a job I found</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: space.lg, gap: space.xl, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { minHeight: 48, justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.blue, fontWeight: '600' },
  eyebrow: { fontSize: 14, fontWeight: '800', letterSpacing: 1.2, color: colors.blue },
  h1: { fontSize: 40, lineHeight: 46, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  lead: { fontSize: 20, lineHeight: 30, color: colors.muted },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.ink },
  bold: { fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.lg,
    shadowColor: '#1A1A1A', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  sampleTag: { alignSelf: 'flex-start', backgroundColor: colors.tint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  sampleTagText: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.muted },
  header: { gap: space.lg, alignItems: 'center' },
  jobTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.ink },
  verdict: { alignSelf: 'flex-start', marginTop: space.sm, borderRadius: 999, borderWidth: 2, borderColor: colors.green, paddingHorizontal: 14, paddingVertical: 6 },
  verdictText: { fontSize: 18, fontWeight: '800' },
  ringLabel: { fontSize: 15, fontWeight: '800', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { backgroundColor: colors.tint, borderRadius: 16, borderTopWidth: 6, padding: space.md, gap: 4 },
  tileIcon: { fontSize: 24, lineHeight: 30 },
  tileNum: { fontSize: 40, lineHeight: 44, fontWeight: '900' },
  tileLabel: { fontSize: 17, fontWeight: '800', color: colors.ink },
  stay: { backgroundColor: colors.tint, borderRadius: 16, padding: space.md, gap: space.sm },
  stayRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stayLabel: { width: 90, fontSize: 16, color: colors.ink },
  stayValue: { width: 48, textAlign: 'right', fontSize: 17, fontWeight: '800' },
  area: { borderLeftWidth: 6, borderRadius: 12, backgroundColor: colors.tint, padding: space.md, gap: space.sm },
  areaTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  areaIcon: { fontSize: 22, lineHeight: 28 },
  areaLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
  weight: { fontSize: 13, fontWeight: '800', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  areaScore: { marginLeft: 'auto', fontSize: 26, lineHeight: 30, fontWeight: '900' },
  next: { borderRadius: 16, borderWidth: 2, borderColor: colors.orange, padding: space.md, gap: space.sm },
  nextTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cta: { backgroundColor: colors.blue, minHeight: 56, borderRadius: 999, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onAccent, fontSize: 20, fontWeight: '700' },
  ctaSecondary: { borderWidth: 2, borderColor: colors.blue, minHeight: 56, borderRadius: 999, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  ctaSecondaryText: { color: colors.blue, fontSize: 20, fontWeight: '700' },
}));
