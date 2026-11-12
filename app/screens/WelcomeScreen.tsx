import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Platform, Pressable, SafeAreaView, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, space, type, themed } from '../theme';
import { coachFor } from '../team';
import Avatar from '../components/Avatar';
import { APP_NAME, APP_TAGLINE } from '../brand';
import Brand from '../components/Brand';
import { START_METHODS, StartMethod } from '../start';
import { PROMO_MINUTES } from '../components/Promo';
import MiniScorecard from '../components/MiniScorecard';

// Photos of job seekers for the opening page. Each needs alt text for screen readers.
// Sources are listed in assets/people/CREDITS.md.
const PHOTOS: { source: number; alt: string }[] = [
  { source: require('../assets/people/food-service.jpg'), alt: 'A woman in an apron and gloves cooking at a food counter' },
  { source: require('../assets/people/construction.jpg'), alt: 'A construction worker in a yellow hard hat taking a break on site' },
  { source: require('../assets/people/office.jpg'), alt: 'A man working on a laptop at his desk' },
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

// The headline types itself out quickly, like a typewriter. The rest of the line is already there but invisible,
// so nothing below it jumps while it types. Screen readers hear the whole line at once.
const HEADLINE = ['Let us help you ', 'predict your future.'] as const;
function TypedHeadline({ animate, onDone }: { animate: boolean; onDone: () => void }) {
  const full = HEADLINE.join('');
  const [n, setN] = useState(animate ? 0 : full.length);
  useEffect(() => {
    if (!animate) { setN(full.length); return; }
    const id = setInterval(() => setN((k) => (k >= full.length ? k : k + 1)), 70); // about two and a half seconds in all, a natural typing pace
    return () => clearInterval(id);
  }, [animate]);
  useEffect(() => { if (n >= full.length) onDone(); }, [n >= full.length]);
  const cut = HEADLINE[0].length;
  const typing = n < full.length;
  return (
    <Text style={styles.hero} role="heading" aria-level={1} accessibilityLabel={full}>
      {full.slice(0, Math.min(n, cut))}
      <Text style={{ color: colors.red }}>{n > cut ? full.slice(cut, n) : ''}</Text>
      {typing && <Text style={{ color: colors.blue, fontWeight: '400' }}>|</Text>}
      {typing && <Text style={{ color: 'transparent' }}>{full.slice(n)}</Text>}
    </Text>
  );
}

// The line under the headline fades up once the headline has finished typing.
// It is in the page from the start, so screen readers can read it right away.
function FadeUp({ show, animate, children }: { show: boolean; animate: boolean; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) { t.setValue(1); return; }
    if (show) Animated.timing(t, { toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [show, animate]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={{ opacity: t, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// The sample scorecard flies in from the right as the page opens.
function FlyIn({ animate, children }: { animate: boolean; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) { t.setValue(1); return; }
    Animated.timing(t, { toValue: 1, duration: 1200, delay: 500, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [animate]);
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [160, 0] });
  return <Animated.View style={{ opacity: t, transform: [{ translateX }] }}>{children}</Animated.View>;
}

export default function WelcomeScreen({ onStart, onTracker, onCheckJob, onScorecard, onMatches, onAccount, accountEmail, onSettings, reduceMotion }: {
  onStart: (method?: StartMethod) => void; onTracker: () => void; onCheckJob: () => void; onScorecard: () => void; onMatches?: () => void; onAccount?: () => void; accountEmail: string | null;
  onSettings: () => void; reduceMotion?: boolean;
}) {
  // Step cards: five across on wide screens, three then two on tablets, one per row on phones.
  const { width } = useWindowDimensions();
  const stepWidth = width >= 1100 ? '18.4%' : width >= 640 ? '31%' : '100%';
  const startWidth = width >= 1100 ? '23%' : width >= 520 ? '47%' : '100%';
  const wideHero = width >= 900;
  // Motion is skipped when the applicant turned on Reduce motion in Settings or on their device.
  const [deviceReduce, setDeviceReduce] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setDeviceReduce).catch(() => {}); }, []);
  const animate = !reduceMotion && !deviceReduce;
  const [typed, setTyped] = useState(false);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Brand size={30} />
          <View style={styles.topLinks}>
            <Pressable onPress={onScorecard} accessibilityRole="button" accessibilityLabel="See the Predictability Scorecard" style={styles.topLink}>
              <Text style={styles.topLinkText}>Scorecard</Text>
            </Pressable>
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

        {/* Hero: the promise on the left, a miniature sample scorecard on the right (stacked on phones) */}
        <View style={[styles.heroRow, { flexDirection: wideHero ? 'row' : 'column' }]}>
          <View style={[styles.section, wideHero && { flex: 1.3 }]}>
            <Text style={styles.eyebrow}>{APP_TAGLINE.toUpperCase()}</Text>
            <TypedHeadline animate={animate} onDone={() => setTyped(true)} />
            <FadeUp show={typed} animate={animate}>
              <Text style={styles.lead}>
                <Text style={styles.bold}>Our job Predictability Scorecard is all you need to manage your job search.</Text>{' '}
                Apply to jobs that get you closer to your dream.
              </Text>
            </FadeUp>
          </View>
          <View style={wideHero ? { flex: 1, maxWidth: 400 } : { width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <FlyIn animate={animate}><MiniScorecard onOpen={onScorecard} /></FlyIn>
          </View>
        </View>

        {/* Four ways to start: their own bordered box, centered, with thick colored borders on each choice */}
        <View style={styles.startBox}>
          <Text style={styles.startBoxTitle} role="heading" aria-level={2}>Four ways to start your future</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>
            Pick whichever is easiest for you. It takes about {PROMO_MINUTES} minutes, and no account is needed.
          </Text>
          <View style={styles.startGrid}>
            {START_METHODS.map((m) => {
              const accent = colors[m.color];
              return (
                <Pressable
                  key={m.key}
                  onPress={() => onStart(m.key)}
                  // A light wash of the card's color (8%, deeper when hovered or pressed) inside a thick colored border.
                  style={(state) => {
                    const active = state.pressed || (state as { hovered?: boolean }).hovered;
                    return [styles.startCard, { width: startWidth, borderColor: accent, backgroundColor: `${accent}${active ? '29' : '14'}` },
                      active && { transform: [{ translateY: -2 }] }];
                  }}
                  accessibilityRole="button" accessibilityLabel={m.title} accessibilityHint={m.hint}
                >
                  <View style={[styles.startIconWrap, { backgroundColor: accent }]} accessibilityElementsHidden importantForAccessibility="no">
                    <Text style={styles.startIcon}>{m.icon}</Text>
                  </View>
                  <Text style={styles.startTitle}>{m.title}</Text>
                  <Text style={type.small}>{m.hint}</Text>
                  <Text style={[styles.startGo, { color: accent }]} accessibilityElementsHidden importantForAccessibility="no">Start →</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.startLinks}>
            {onMatches && (
              <Pressable onPress={onMatches} accessibilityRole="button" accessibilityLabel="See my last job matches" style={styles.textLink}>
                <Text style={styles.textLinkText}>See my last matches →</Text>
              </Pressable>
            )}
            <Pressable onPress={onCheckJob} accessibilityRole="button" accessibilityLabel="Check a job you found" style={styles.textLink}>
              <Text style={styles.textLinkText}>Found a job on Indeed or LinkedIn? Check your chances →</Text>
            </Pressable>
            <Pressable onPress={onTracker} accessibilityRole="button" accessibilityLabel="My applications" style={styles.textLink}>
              <Text style={styles.textLinkText}>See my applications</Text>
            </Pressable>
          </View>
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
            onPress={() => onStart()} accessibilityRole="button" accessibilityLabel="Get started"
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
  topBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', rowGap: space.xs },
  topLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginLeft: -space.sm },
  textLink: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  textLinkText: { fontSize: 18, fontWeight: '700', color: colors.blue, textDecorationLine: 'underline' },
  topLink: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.sm },
  topLinkText: { fontSize: 18, fontWeight: '600', color: colors.blue },
  section: { gap: space.md },
  eyebrow: { fontSize: 14, fontWeight: '800', letterSpacing: 1.2, color: colors.blue },
  hero: { fontSize: 48, lineHeight: 54, fontWeight: '900', color: colors.ink, letterSpacing: -1 },
  lead: { fontSize: 20, lineHeight: 30, color: colors.muted },
  bold: { fontWeight: '700', color: colors.ink },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cta: { backgroundColor: colors.blue, minHeight: 56, borderRadius: 999, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onAccent, fontSize: 20, fontWeight: '700' },
  ctaSecondary: { borderWidth: 2, borderColor: colors.blue, minHeight: 56, borderRadius: 999, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  ctaSecondaryText: { color: colors.blue, fontSize: 20, fontWeight: '700' },
  photoGrid: { flexDirection: 'row', gap: space.sm },
  photo: { flex: 1, height: 190, borderRadius: 16 },
  h2: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  heroRow: { gap: space.xl, alignItems: 'center' },
  startBox: { borderWidth: 2, borderColor: colors.line, borderRadius: 28, backgroundColor: colors.surface, padding: space.lg, gap: space.md,
    alignItems: 'center', shadowColor: '#1A1A1A', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
  startBoxTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.ink, textAlign: 'center', letterSpacing: -0.3 },
  startLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space.lg },
  startGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center', width: '100%' },
  startCard: { ...card, borderWidth: 5, borderRadius: 20, gap: 8, minHeight: 190, padding: space.lg,
    shadowColor: '#1A1A1A', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  startIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  startIcon: { fontSize: 26, lineHeight: 32 },
  startTitle: { fontSize: 19, lineHeight: 24, fontWeight: '800', color: colors.ink },
  startGo: { fontSize: 17, fontWeight: '800', marginTop: 'auto' },
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
