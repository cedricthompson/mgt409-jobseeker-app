import { Image, Pressable, SafeAreaView, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, space, type, themed } from '../theme';
import { coachFor } from '../team';
import Avatar from '../components/Avatar';
import { APP_NAME, APP_TAGLINE } from '../brand';
import Wordmark from '../components/Wordmark';
import { PROMO_MINUTES } from '../components/Promo';

// Photos of job seekers for the opening page. Each needs alt text for screen readers.
// Sources are listed in assets/people/CREDITS.md.
const PHOTOS: { source: number; alt: string }[] = [
  { source: require('../assets/people/food-service.jpg'), alt: 'A woman in an apron and gloves cooking at a food counter' },
  { source: require('../assets/people/construction.jpg'), alt: 'A construction worker in a yellow hard hat taking a break on site' },
  { source: require('../assets/people/office.jpg'), alt: 'A man working on a laptop at his desk' },
];

// Example Predictability Scores shown in the hero, so people see what they'll get before starting.
const EXAMPLES = [
  { title: 'Kitchen Manager', where: 'Columbus, OH · $52K', score: 86, verdict: 'Worth applying', note: 'Strong fit: 3 years leading the grill line' },
  { title: 'Restaurant General Manager', where: 'Columbus, OH · $68K', score: 38, verdict: 'Long shot for now', note: 'Most hires have 5+ years managing budgets' },
];

// Stories: written examples until real video testimonials are recorded.
// To add a video later, record a 15-30 second clip with captions and add it here with the person's permission.
const STORIES = [
  { quote: `I didn't know how to get my job search started. ${APP_NAME} walked me through it one question at a time, and I applied to three jobs that first week.`, who: 'Job seeker starting out' },
  { quote: "I have a lot of work experience and wasn't sure which direction to go. The coaches helped me narrow it down to the jobs that actually fit me.", who: 'Experienced worker changing direction' },
  { quote: "The Predictability Score told me which jobs to skip. I stopped wasting evenings on applications that were never going to call back.", who: 'Parent job hunting after work' },
];

// How it works: one step per coach, shown as vertical cards with each coach's portrait.
const STEPS = [
  { coach: 'intake', title: 'Share your background', text: 'Upload, photograph, paste, or speak your resume.' },
  { coach: 'gap', title: 'Find your hidden strengths', text: 'A few smart questions uncover skills that raise your pay.' },
  { coach: 'matcher', title: 'See real jobs near you', text: 'Openings from Indeed, LinkedIn, USAJOBS, and more.' },
  { coach: 'scorecard', title: 'Predict your chances', text: 'A 0 to 100 Predictability Score with your odds of an interview, an offer, and lasting a year.' },
  { coach: 'coach', title: 'Apply with confidence', text: 'A tailored resume, cover letter, and follow-ups for the jobs worth your time.' },
];

export default function WelcomeScreen({ onStart, onTracker, onCheckJob, onAccount, accountEmail, onSettings }: {
  onStart: () => void; onTracker: () => void; onCheckJob: () => void; onAccount?: () => void; accountEmail: string | null;
  onSettings: () => void; reduceMotion?: boolean;
}) {
  // Step cards: five across on wide screens, three then two on tablets, one per row on phones.
  const { width } = useWindowDimensions();
  const stepWidth = width >= 1100 ? '18.4%' : width >= 640 ? '31%' : '100%';
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <Image source={require('../assets/logo-icon.png')} style={styles.brandIcon} resizeMode="contain"
              accessibilityLabel="Chart Academy" alt="Chart Academy" />
            <Wordmark size={30} />
          </View>
          <View style={styles.topLinks}>
            <Pressable onPress={onSettings} accessibilityRole="button" accessibilityLabel="Appearance, accessibility, and language settings" style={styles.topLink}>
              <Text style={styles.topLinkText}>Settings</Text>
            </Pressable>
            {onAccount && (
              <Pressable onPress={onAccount} accessibilityRole="button" style={styles.topLink}
                accessibilityLabel={accountEmail ? `Your account, signed in as ${accountEmail}` : 'Sign in or create an account'}>
                <Text style={styles.topLinkText}>{accountEmail ? 'My account' : 'Sign in'}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Hero */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>{APP_TAGLINE.toUpperCase()} · FREE FROM CHART ACADEMY</Text>
          <Text style={styles.hero} role="heading" aria-level={1}>
            Let us help you <Text style={{ color: colors.red }}>predict your future.</Text>
          </Text>
          <Text style={styles.lead}>
            <Text style={styles.bold}>Know which jobs are worth your time.</Text> Every job we find gets a{' '}
            <Text style={styles.bold}>Predictability Score</Text> from 0 to 100 that estimates your chances of an
            interview and an offer. Spend your time on the jobs you're likely to land, and skip the ones that won't call back.
          </Text>
          <View style={styles.ctaRow}>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.blueDark }]}
              onPress={onStart} accessibilityRole="button" accessibilityLabel="Get started"
              accessibilityHint="Begin building your job profile"
            >
              <Text style={styles.ctaText}>Get started free</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.ctaSecondary, pressed && { backgroundColor: colors.tint }]}
              onPress={onTracker} accessibilityRole="button" accessibilityLabel="My applications"
            >
              <Text style={styles.ctaSecondaryText}>My applications</Text>
            </Pressable>
          </View>
          <Text style={type.small}>Takes about {PROMO_MINUTES} minutes. No account needed.</Text>
          <Pressable onPress={onCheckJob} accessibilityRole="button" accessibilityLabel="Check a job you found" style={styles.textLink}>
            <Text style={styles.textLinkText}>Found a job on Indeed or LinkedIn? Check your chances →</Text>
          </Pressable>
        </View>

        {/* Example scores */}
        <View style={styles.scorePanel} accessibilityLabel="Example Predictability Scores">
          <Text style={styles.panelLabel}>EXAMPLE</Text>
          {EXAMPLES.map((e) => {
            const good = e.score >= 70;
            return (
              <View key={e.title} style={styles.scoreCard}
                accessible accessibilityLabel={`${e.title}, ${e.where}. Predictability Score ${e.score} out of 100. ${e.verdict}. ${e.note}.`}>
                <View style={[styles.scoreBadge, { borderColor: good ? colors.blue : colors.line }]}>
                  <Text style={[styles.scoreNum, { color: good ? colors.blue : colors.muted }]}>{e.score}</Text>
                  <Text style={styles.scoreOf}>/100</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.cardTitle}>{e.title}</Text>
                  <Text style={type.small}>{e.where}</Text>
                  <Text style={[styles.verdict, { color: good ? colors.blue : colors.red }]}>{good ? '✓ ' : '✕ '}{e.verdict}</Text>
                  <Text style={type.small}>{e.note}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {PHOTOS.length > 0 && (
          <View style={styles.photoGrid}>
            {PHOTOS.map((p) => (
              <Image key={p.alt} source={p.source} style={styles.photo} accessibilityLabel={p.alt} alt={p.alt} />
            ))}
          </View>
        )}

        {/* How it works: one vertical card per coach */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>HOW IT WORKS</Text>
          <Text style={styles.h2} role="heading" aria-level={2}>Five coaches. One goal: your next job.</Text>
          <Text style={type.small}>Your coaches are AI assistants. Each one handles one step and hands you to the next.</Text>
          <View style={styles.stepGrid}>
            {STEPS.map((s, i) => {
              const c = coachFor(s.coach)!;
              return (
                <View key={s.coach} style={[styles.stepCard, { width: stepWidth }]}>
                  <Text style={styles.stepNum}>Step {i + 1}</Text>
                  <Avatar coach={s.coach} size={88} />
                  <Text style={styles.stepTitle} role="heading" aria-level={3}>{s.title}</Text>
                  <Text style={styles.with}>with {c.name}, {c.role}</Text>
                  <Text style={[type.small, { textAlign: 'center' }]}>{s.text}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stories */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>STORIES</Text>
          <Text style={styles.h2} role="heading" aria-level={2}>Built for real job searches</Text>
          <Text style={type.small}>Example stories. Video stories from Chart Academy job seekers are coming soon.</Text>
          <View style={styles.storyGrid}>
            {STORIES.map((s) => (
              <View key={s.who} style={styles.story}>
                <Text style={styles.quoteMark} accessibilityElementsHidden importantForAccessibility="no">“</Text>
                <Text style={type.body}>{s.quote}</Text>
                <Text style={styles.who}>{s.who}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Closing call to action */}
        <View style={styles.closing}>
          <Text style={styles.closingTitle} role="heading" aria-level={2}>Ready to see what your future holds?</Text>
          <Pressable
            style={({ pressed }) => [styles.ctaLight, pressed && { opacity: 0.85 }]}
            onPress={onStart} accessibilityRole="button" accessibilityLabel="Get started"
          >
            <Text style={styles.ctaLightText}>Get started free</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() => {
  const card = { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: space.md };
  return {
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: space.lg, gap: space.xl, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brandIcon: { width: 44, height: 44 },
  topLinks: { flexDirection: 'row', gap: space.sm },
  textLink: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  textLinkText: { fontSize: 18, fontWeight: '700', color: colors.blue, textDecorationLine: 'underline' },
  topLink: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.sm },
  topLinkText: { fontSize: 18, fontWeight: '600', color: colors.blue },
  section: { gap: space.md },
  eyebrow: { fontSize: 14, fontWeight: '800', letterSpacing: 1.2, color: colors.blue },
  hero: { fontSize: 44, lineHeight: 50, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  lead: { fontSize: 20, lineHeight: 30, color: colors.muted },
  bold: { fontWeight: '700', color: colors.ink },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cta: { backgroundColor: colors.blue, minHeight: 56, borderRadius: 999, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onAccent, fontSize: 20, fontWeight: '700' },
  ctaSecondary: { borderWidth: 2, borderColor: colors.blue, minHeight: 56, borderRadius: 999, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  ctaSecondaryText: { color: colors.blue, fontSize: 20, fontWeight: '700' },
  scorePanel: { backgroundColor: colors.tint, borderRadius: 24, padding: space.lg, gap: space.md },
  panelLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, color: colors.muted },
  scoreCard: { ...card, flexDirection: 'row', gap: space.md, alignItems: 'center',
    shadowColor: '#1A1A1A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  scoreBadge: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 30, fontWeight: '800', lineHeight: 34 },
  scoreOf: { fontSize: 13, color: colors.muted },
  cardTitle: { fontSize: 19, fontWeight: '700', color: colors.ink },
  verdict: { fontSize: 17, fontWeight: '700' },
  photoGrid: { flexDirection: 'row', gap: space.sm },
  photo: { flex: 1, height: 190, borderRadius: 16 },
  h2: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  stepGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  stepCard: { ...card, alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  stepNum: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.red, textTransform: 'uppercase' },
  stepTitle: { fontSize: 19, lineHeight: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  with: { fontSize: 15, fontWeight: '700', color: colors.blue, textAlign: 'center' },
  storyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  story: { ...card, flexGrow: 1, flexBasis: 260, gap: space.sm },
  quoteMark: { fontSize: 48, lineHeight: 48, fontWeight: '800', color: colors.red, height: 32 },
  who: { fontSize: 16, fontWeight: '700', color: colors.blue },
  closing: { backgroundColor: colors.blue, borderRadius: 24, padding: space.xl, gap: space.lg, alignItems: 'center' },
  closingTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.onAccent, textAlign: 'center' },
  ctaLight: { backgroundColor: colors.bg, minHeight: 56, borderRadius: 999, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  ctaLightText: { color: colors.blue, fontSize: 20, fontWeight: '700' },
};
});
