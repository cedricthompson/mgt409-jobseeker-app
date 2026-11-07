import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { post, Prefs, Profile } from '../api';
import { TrackedJob } from '../tracker';
import { colors, radius, space, type } from '../theme';

export type CoachTask = 'resume' | 'cover_letter' | 'follow_up' | 'interview_prep';
export const COACH_TASKS: { task: CoachTask; label: string }[] = [
  { task: 'resume', label: 'Tailored resume' },
  { task: 'cover_letter', label: 'Cover letter' },
  { task: 'follow_up', label: 'Follow-up email' },
  { task: 'interview_prep', label: 'Interview prep' },
];

type Result = { title: string; content: string; tips: string[] };

export default function CoachScreen({ task, item, profile, prefs, onBack }: {
  task: CoachTask; item: TrackedJob; profile: Profile; prefs: Prefs; onBack: () => void;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const label = COACH_TASKS.find((t) => t.task === task)?.label;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    post<Result>('/api/coach', { task, profile, prefs, job: item.job, tracked: { appliedAt: item.appliedAt, notes: item.notes } })
      .then(setResult)
      .catch((e) => setError(`Something went wrong. ${(e as Error).message}`));
  }, []);

  async function copy() {
    if (!result) return;
    await Clipboard.setStringAsync(result.content);
    setCopied(true);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to my applications" style={styles.back}>
          <Text style={styles.backText}>‹ My applications</Text>
        </Pressable>
        <Text style={styles.title} role="heading" aria-level={1}>{label}</Text>
        <Text style={type.small}>{item.job.title}{item.job.company ? ` at ${item.job.company}` : ''}</Text>

        <View aria-live="polite">
          {!result && !error && (
            <View style={styles.row}><ActivityIndicator color={colors.blue} /><Text style={type.body}>Writing from your profile…</Text></View>
          )}
          {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
        </View>

        {result && (
          <>
            <Text style={type.small}>
              Built only from your profile. Fill in anything in [square brackets] and read it over before you send it.
            </Text>
            <View style={styles.doc}>
              <Text style={styles.docText} selectable>{result.content}</Text>
            </View>
            <Pressable style={styles.primary} onPress={copy} accessibilityRole="button" accessibilityLabel={copied ? 'Copied to clipboard' : 'Copy text'}>
              <Text style={styles.primaryText}>{copied ? 'Copied ✓' : 'Copy text'}</Text>
            </Pressable>
            {result.tips?.length > 0 && (
              <View style={styles.tips}>
                <Text style={styles.tipsTitle} role="heading" aria-level={2}>Before you send</Text>
                {result.tips.map((t) => <Text key={t} style={type.body}>• {t}</Text>)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: { padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 18, color: colors.blue, fontWeight: '600' },
  title: { ...type.title, color: colors.red },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  error: { fontSize: 18, color: colors.red },
  doc: { borderWidth: 2, borderColor: colors.line, borderRadius: radius, padding: space.lg, backgroundColor: colors.white },
  docText: { fontSize: 17, lineHeight: 26, color: colors.ink },
  primary: { backgroundColor: colors.blue, minHeight: 52, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  tips: { backgroundColor: colors.tint, borderLeftWidth: 4, borderLeftColor: colors.red, padding: space.md, borderRadius: radius, gap: 6 },
  tipsTitle: { fontSize: 18, fontWeight: '700', color: colors.red },
});
