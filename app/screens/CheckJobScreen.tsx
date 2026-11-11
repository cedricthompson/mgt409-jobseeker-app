// "Check any job": the applicant pastes a link to a job they found anywhere, or the job description,
// and sees their predicted chances for that exact job (interview, hire, promotion, still there later).
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { post, Prefs, Profile } from '../api';
import { colors, radius, space, type, themed } from '../theme';
import { useTracker } from '../tracker';
import { Card, ChancesHeadline, ScoreDetails } from '../components/Chances';
import SearchElsewhere from '../components/SearchElsewhere';

type Job = { id: string; hiring_now?: boolean; title: string; company?: string; city?: string; pay_min?: number; pay_max?: number; url?: string; source?: string; summary?: string };
const money = (n?: number) => (n ? `$${Math.round(n).toLocaleString()}` : '');

export default function CheckJobScreen({ profile, prefs, onBack, onTracker, onBuildProfile }: {
  profile: Profile; prefs: Prefs; onBack: () => void; onTracker: () => void; onBuildProfile: () => void;
}) {
  const tracker = useTracker();
  const [link, setLink] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ job: Job; card: Card } | null>(null);
  const pasteBox = useRef<any>(null); // the paste box, focused when a site blocks reading the link

  const hasProfile = !!((profile.experience as unknown[])?.length || (profile.target_roles as unknown[])?.length);
  const ready = !!(link.trim() || text.trim()) && !loading;

  async function check() {
    setLoading(true); setError(''); setResult(null);
    try {
      // Pasted text is what gets read (sites like Indeed block apps); the link is kept so the posting can be reopened.
      const body = { ...(link.trim() && { url: link.trim() }), ...(text.trim() && { text: text.trim() }) };
      setResult(await post<{ job: Job; card: Card }>('/api/check-job', { ...body, profile, prefs }));
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (/paste/i.test(msg)) pasteBox.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  const job = result?.job;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} role="heading" aria-level={1}>Check any job</Text>
        <Text style={type.body}>
          Found a job on Indeed, LinkedIn, a company website, or anywhere else? See your chances of getting an interview,
          getting hired, and still being there a year later.
        </Text>

        {!hasProfile ? (
          <View style={styles.notice}>
            <Text style={type.body}>First we need your background, so we can predict your chances. It takes a few minutes.</Text>
            <Pressable style={styles.button} onPress={onBuildProfile} accessibilityRole="button" accessibilityLabel="Build my profile">
              <Text style={styles.buttonText}>Build my profile</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <SearchElsewhere profile={profile} note="Looking for jobs? Search Indeed or LinkedIn, then come back and check any job you like:" />
            <Text style={styles.label} nativeID="linkLabel">Link to the job</Text>
            <TextInput
              value={link}
              onChangeText={setLink}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
              style={styles.linkInput}
              accessibilityLabel="Link to the job"
              aria-labelledby="linkLabel"
              onSubmitEditing={() => ready && check()}
            />
            <Text style={styles.label} nativeID="textLabel">Or paste the job description</Text>
            <Text style={type.small}>For Indeed and LinkedIn jobs, paste the link above and the description here: those sites don't let apps open their pages, so we read what you paste and keep the link for you.</Text>
            <TextInput
              ref={pasteBox}
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Paste the full job description here"
              style={styles.textInput}
              accessibilityLabel="Job description"
              aria-labelledby="textLabel"
            />
            <Pressable
              style={({ pressed }) => [styles.button, !ready && styles.disabled, pressed && { opacity: 0.85 }]}
              onPress={check}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready }}
              accessibilityLabel="See my chances"
            >
              <Text style={styles.buttonText}>{loading ? 'Reading the job…' : 'See my chances'}</Text>
            </Pressable>
          </>
        )}

        <View aria-live="polite">
          {loading ? <View style={styles.row}><ActivityIndicator color={colors.blue} /><Text style={type.body}>Reading the job and predicting your chances…</Text></View> : null}
          {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
        </View>

        {result && job && (
          <View style={styles.card}>
            {job.hiring_now && <Text style={styles.now} accessibilityLabel="Hiring now: this employer says it hires quickly">Hiring now</Text>}
            <Text style={styles.jobTitle} role="heading" aria-level={2}>{job.title}</Text>
            <Text style={type.small}>{[job.company, job.city].filter(Boolean).join(' · ')}</Text>
            <Text style={type.small}>
              {job.pay_min ? (job.pay_min === job.pay_max || !job.pay_max ? money(job.pay_min) : `${money(job.pay_min)} – ${money(job.pay_max)}`) : 'Pay not listed'}
              {job.source ? ` · ${job.source}` : ''}
            </Text>
            {job.summary ? <Text style={type.body}>{job.summary}</Text> : null}
            <ChancesHeadline card={result.card} />
            <ScoreDetails card={result.card} />
            <View style={styles.actions}>
              <Pressable
                style={[styles.saveBtn, tracker.has(job.id) && { borderColor: colors.line }]}
                onPress={() => tracker.add(job.id, job, { overall: result.card.overall, predictions: result.card.predictions })}
                disabled={tracker.has(job.id)}
                accessibilityRole="button"
                accessibilityLabel={tracker.has(job.id) ? `${job.title} is in your tracker` : `Save ${job.title} to my applications`}
              >
                <Text style={[styles.saveText, tracker.has(job.id) && { color: colors.muted }]}>{tracker.has(job.id) ? 'Saved ✓' : 'Save'}</Text>
              </Pressable>
              {job.url ? (
                <Pressable style={[styles.button, { flex: 1 }]} onPress={() => Linking.openURL(job.url!)} accessibilityRole="link" accessibilityLabel={`Open the posting for ${job.title}`}>
                  <Text style={styles.buttonText}>Open the posting</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={onTracker} accessibilityRole="button" style={styles.back}>
              <Text style={styles.backText}>My applications ({tracker.items.length}) ›</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 18, color: colors.blue, fontWeight: '600' },
  title: { ...type.title, color: colors.red },
  label: { fontSize: 18, fontWeight: '700', color: colors.ink },
  linkInput: { minHeight: 52, borderWidth: 2, borderColor: colors.muted, borderRadius: 8, paddingHorizontal: 12, fontSize: 18, color: colors.ink },
  textInput: { minHeight: 160, borderWidth: 2, borderColor: colors.muted, borderRadius: 8, padding: 12, fontSize: 18, color: colors.ink, textAlignVertical: 'top' },
  button: { backgroundColor: colors.blue, minHeight: 52, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  disabled: { backgroundColor: colors.muted },
  buttonText: { color: colors.onAccent, fontSize: 18, fontWeight: '700' },
  notice: { backgroundColor: colors.tint, borderRadius: radius, padding: space.md, gap: space.md },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  error: { fontSize: 18, color: colors.red },
  card: { borderWidth: 2, borderColor: colors.line, borderRadius: radius, padding: space.md, gap: space.sm },
  now: { alignSelf: 'flex-start', backgroundColor: colors.red, color: colors.onAccent, fontSize: 14, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  jobTitle: { fontSize: 22, fontWeight: '700', color: colors.ink },
  actions: { flexDirection: 'row', gap: space.sm },
  saveBtn: { minHeight: 52, minWidth: 100, borderRadius: radius, borderWidth: 2, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  saveText: { fontSize: 18, fontWeight: '700', color: colors.blue },
}));
