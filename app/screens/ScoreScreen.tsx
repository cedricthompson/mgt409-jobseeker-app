// The Predictability Scorecard page: a full sample scorecard, so people see what they'll get before starting.
// The sample numbers come from the app's real rules (server/agents/scorecard.js) for this example applicant:
// fit parts skills 78, credentials 60, experience 100, pay 90, commute 70 -> overall 77; food service, mid level,
// medium competition -> interview 46%, hired 28%, promoted 18%, still there 54% / 44% / 37% at 12 / 18 / 24 months.
import { Pressable, SafeAreaView, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, space, type, themed } from '../theme';
import Wordmark from '../components/Wordmark';

type Color = 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'red';

const CHANCES: { label: string; value: number; color: Color; icon: string; note: string }[] = [
  { label: 'Get an interview', value: 46, color: 'blue', icon: '📞', note: 'About 1 in 2. Most applicants for this kind of job hear back less often.' },
  { label: 'Get hired', value: 28, color: 'green', icon: '🤝', note: 'Your odds of an offer, counting the interview step.' },
  { label: 'Promoted within a year', value: 18, color: 'orange', icon: '📈', note: 'Kitchen roles promote from within more than most.' },
  { label: 'Still there after 1 year', value: 54, color: 'purple', icon: '📅', note: 'Above average for food service, where about half of new hires stay a year.' },
];

const STAY = [{ label: '12 months', value: 54 }, { label: '18 months', value: 44 }, { label: '24 months', value: 37 }];

const FIT: { label: string; icon: string; weight: number; score: number; color: Color; note: string }[] = [
  { label: 'Skills', icon: '🧰', weight: 30, score: 78, color: 'teal', note: 'Grill, prep, and training new hires match the job. Ordering and inventory would be new to you.' },
  { label: 'Credentials', icon: '🎓', weight: 25, score: 60, color: 'purple', note: 'You have ServSafe Food Handler. The job asks for ServSafe Manager.' },
  { label: 'Experience', icon: '⏱️', weight: 15, score: 100, color: 'orange', note: 'You have 3 years. The job asks for 2.' },
  { label: 'Pay', icon: '💵', weight: 15, score: 90, color: 'green', note: 'Pays about $47,500. Your target is $50,000.' },
  { label: 'Commute', icon: '🚌', weight: 15, score: 70, color: 'blue', note: 'About 39 minutes each way by bus. Your limit is 30.' },
];

const OVERALL = 77;

function Ring({ value, size = 150 }: { value: number; size?: number }) {
  const stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const color = value >= 70 ? colors.green : value >= 50 ? colors.orange : colors.red;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible accessibilityRole="image" accessibilityLabel={`Overall Predictability Score ${value} out of 100`}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={styles.ringNum}>{value}</Text>
      <Text style={styles.ringOf}>out of 100</Text>
    </View>
  );
}

function Meter({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

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
              <Text style={styles.jobTitle}>Kitchen Manager</Text>
              <Text style={type.small}>Riverside Grill (sample) · Columbus, OH · $47,500 a year</Text>
              <Text style={type.small}>For Maria: 3 years as a line cook, ServSafe Food Handler, wants to lead a kitchen.</Text>
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
              accessible accessibilityLabel={`${f.label}: ${f.score} out of 100, ${f.weight} percent of your score. ${f.note}`}>
              <View style={styles.areaTop}>
                <Text style={styles.areaIcon} accessibilityElementsHidden importantForAccessibility="no">{f.icon}</Text>
                <Text style={styles.areaLabel}>{f.label}</Text>
                <Text style={[styles.weight, { color: colors[f.color], borderColor: colors[f.color] }]}>{f.weight}% of score</Text>
                <Text style={[styles.areaScore, { color: colors[f.color] }]}>{f.score}</Text>
              </View>
              <Meter value={f.score} color={colors[f.color]} />
              <Text style={type.small}>{f.note}</Text>
            </View>
          ))}

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
            <Text style={styles.bold}>Your Predictability Score</Text> (0 to 100) adds up the five areas above:
            skills count most (30%), then credentials (25%), then experience, pay, and commute (15% each).
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
  ringNum: { fontSize: 46, lineHeight: 50, fontWeight: '900', color: colors.ink },
  ringOf: { fontSize: 13, color: colors.muted },
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
  track: { height: 12, borderRadius: 6, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
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
