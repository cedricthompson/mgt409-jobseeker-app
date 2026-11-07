import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import Promo from '../components/Promo';

// Photos of job seekers for the opening page. Each needs alt text for screen readers.
// Sources are listed in assets/people/CREDITS.md.
const PHOTOS: { source: number; alt: string }[] = [
  { source: require('../assets/people/food-service.jpg'), alt: 'A woman in an apron and gloves cooking at a food counter' },
  { source: require('../assets/people/construction.jpg'), alt: 'A construction worker in a yellow hard hat taking a break on site' },
  { source: require('../assets/people/office.jpg'), alt: 'A man working on a laptop at his desk' },
];

const STEPS = [
  { title: 'Share your background', text: 'Upload, photograph, paste, or speak your resume.' },
  { title: 'Find your hidden strengths', text: 'We ask a few questions to uncover skills that raise your pay.' },
  { title: 'See your best matches', text: 'Every job gets a 0 to 100 score with your chances explained.' },
  { title: 'Track every application', text: 'Stay organized from first click to job offer.' },
];

export default function WelcomeScreen({ onStart, onTracker }: { onStart: () => void; onTracker: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={require('../assets/logo-full.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Chart Academy"
          alt="Chart Academy"
        />

        <Text style={styles.title} role="heading" aria-level={1}>Your next job starts here</Text>
        <Promo />

        {PHOTOS.length > 0 && (
          <View style={styles.photoGrid}>
            {PHOTOS.map((p) => (
              <Image key={p.alt} source={p.source} style={styles.photo} accessibilityLabel={p.alt} alt={p.alt} />
            ))}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.blueDark }]}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="Get started"
          accessibilityHint="Begin building your job profile"
        >
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
        <Pressable onPress={onTracker} accessibilityRole="button" accessibilityLabel="My applications" style={styles.link}>
          <Text style={styles.linkText}>My applications</Text>
        </Pressable>

        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <Text style={styles.stepNum} accessibilityElementsHidden importantForAccessibility="no">{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle} role="heading" aria-level={2}>{s.title}</Text>
                <Text style={type.small}>{s.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: { padding: space.lg, gap: space.lg, maxWidth: 820, width: '100%', alignSelf: 'center', alignItems: 'stretch' },
  logo: { width: 180, height: 180, alignSelf: 'center' },
  title: { ...type.title, textAlign: 'center', color: colors.red },
  lead: { ...type.body, textAlign: 'center', color: colors.muted },
  photoGrid: { flexDirection: 'row', gap: space.sm },
  photo: { flex: 1, height: 170, borderRadius: radius },
  cta: { backgroundColor: colors.blue, minHeight: 56, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 18, fontWeight: '600', color: colors.blue, textDecorationLine: 'underline' },
  ctaText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  steps: { gap: space.md, backgroundColor: colors.tint, borderRadius: radius, padding: space.lg },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepNum: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.red, color: colors.white,
    textAlign: 'center', lineHeight: 36, fontSize: 18, fontWeight: '700', overflow: 'hidden',
  },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.blue },
});
