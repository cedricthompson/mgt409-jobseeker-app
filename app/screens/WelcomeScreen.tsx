import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { colors, radius, space, type, themed } from '../theme';
import { TEAM } from '../team';
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
  { quote: "I didn't know how to get my job search started. Career Coach walked me through it one question at a time, and I applied to three jobs that first week.", who: 'Job seeker starting out' },
  { quote: "I have a lot of work experience and wasn't sure which direction to go. The coaches helped me narrow it down to the jobs that actually fit me.", who: 'Experienced worker changing direction' },
  { quote: "The Predictability Score told me which jobs to skip. I stopped wasting evenings on applications that were never going to call back.", who: 'Parent job hunting after work' },
];

const STEPS = [
  { coach: 'Maya', title: 'Share your background', text: 'Upload, photograph, paste, or speak your resume.' },
  { coach: 'Theo', title: 'Find your hidden strengths', text: 'A few questions uncover skills that raise your pay.' },
  { coach: 'Jordan', title: 'See real jobs near you', text: 'Openings from Indeed, LinkedIn, USAJOBS, and more.' },
  { coach: 'Priya', title: 'Know where to apply', text: 'A 0 to 100 Predictability Score and your odds of an interview, an offer, and still being there a year later.' },
  { coach: 'Priya', title: 'Check any job you find', text: 'Paste a link or description from Indeed, LinkedIn, or any site to see your chances.' },
  { coach: 'Marcus', title: 'Apply with confidence', text: 'A tailored resume, cover letter, and follow-ups.' },
];

export default function WelcomeScreen({ onStart, onTracker, onCheckJob, onAccount, accountEmail, onSettings }: {
  onStart: () => void; onTracker: () => void; onCheckJob: () => void; onAccount?: () => void; accountEmail: string | null;
  onSettings: () => void; reduceMotion?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <Image source={require('../assets/logo-icon.png')} style={styles.brandIcon} resizeMode="contain"
              accessibilityLabel="Chart Academy" alt="Chart Academy" />
            <Text style={styles.brandText}>Career Coach</Text>
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
          <Text style={styles.eyebrow}>FREE AI CAREER COACH FROM CHART ACADEMY</Text>
          <Text style={styles.hero} role="heading" aria-level={1}>
            Know which jobs are <Text style={{ color: colors.red }}>worth your time.</Text>
          </Text>
          <Text style={styles.lead}>
            Every job we find gets a <Text style={styles.bold}>Predictability Score</Text> from 0 to 100 that
            estimates your chances of an interview and an offer. Spend your time on the jobs you're likely to
            land, and skip the ones that won't call back.
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

        {/* Meet the team */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>MEET YOUR COACHING TEAM</Text>
          <Text style={styles.h2} role="heading" aria-level={2}>Five coaches, one goal: your next job</Text>
          <Text style={type.small}>Your coaches are AI assistants. Each one handles one part of your search and hands off to the next.</Text>
          <View style={styles.teamGrid}>
            {TEAM.map((c) => (
              <View key={c.key} style={styles.teamCard}>
                <View style={[styles.avatar, { backgroundColor: c.color }]} accessibilityElementsHidden importantForAccessibility="no">
                  <Text style={styles.avatarText}>{c.name[0]}</Text>
                </View>
                <Text style={styles.cardTitle}>{c.name}</Text>
                <Text style={styles.role}>{c.role}</Text>
                <Text style={type.small}>{c.line}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How it works */}
        <View style={styles.steps}>
          <Text style={styles.h2} role="heading" aria-level={2}>How it works</Text>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <Text style={styles.stepNum} accessibilityElementsHidden importantForAccessibility="no">{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle} role="heading" aria-level={3}>{s.title}</Text>
                <Text style={type.small}>{s.text} <Text style={styles.with}>With {s.coach}.</Text></Text>
              </View>
            </View>
          ))}
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
          <Text style={styles.closingTitle} role="heading" aria-level={2}>Ready to find out where you'll stand out?</Text>
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
  page: { padding: space.lg, gap: space.xl, maxWidth: 960, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brandIcon: { width: 44, height: 44 },
  brandText: { fontSize: 20, fontWeight: '800', color: colors.ink },
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
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  teamCard: { ...card, flexGrow: 1, flexBasis: 260, gap: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { color: colors.onAccent, fontSize: 24, fontWeight: '800' },
  role: { fontSize: 16, fontWeight: '700', color: colors.blue },
  steps: { gap: space.md, backgroundColor: colors.tint, borderRadius: 24, padding: space.lg },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepNum: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.red, color: colors.onAccent,
    textAlign: 'center', lineHeight: 36, fontSize: 18, fontWeight: '700', overflow: 'hidden',
  },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  with: { fontWeight: '700', color: colors.blue },
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
