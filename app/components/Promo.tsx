import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

// Promo lines that fade in one after another on the welcome page.
export const PROMO_MINUTES = 10;
const LINES = [
  'We are here to help you optimize your job search.',
  `Give us ${PROMO_MINUTES} minutes, and we will give you the knowledge for the career of a lifetime.`,
  'See your best matches, your real chances, and your next step.',
];

export default function Promo({ reduceMotion: forced = false }: { reduceMotion?: boolean }) {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  // People who turn on Reduce Motion see the lines without animation.
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion || forced) return;
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.delay(3800),
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && setIndex((i) => (i + 1) % LINES.length));
    return () => anim.stop();
  }, [index, reduceMotion, forced]);

  // Screen readers get all lines at once instead of text that keeps changing.
  const allText = LINES.join(' ');

  if (reduceMotion || forced) {
    return (
      <View style={styles.box} accessible accessibilityLabel={allText}>
        {LINES.map((l) => <Text key={l} style={styles.text}>{l}</Text>)}
      </View>
    );
  }
  return (
    <View style={styles.box} accessible accessibilityLabel={allText}>
      <Animated.Text style={[styles.text, { opacity }]} importantForAccessibility="no-hide-descendants">
        {LINES[index]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 84, justifyContent: 'center', paddingHorizontal: 8, gap: 6 },
  text: { fontSize: 22, lineHeight: 30, fontWeight: '600', color: colors.blue, textAlign: 'center' },
});
