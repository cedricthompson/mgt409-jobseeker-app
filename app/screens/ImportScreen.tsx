import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, Linking, Platform, Pressable, SafeAreaView, ScrollView, Switch, Text, TextInput, View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { colors, themed } from '../theme';
import { API_URL, session, Prefs, Profile } from '../api';
import MicButton from '../components/MicButton';
import { voiceFor } from './SettingsScreen';
import { LINKEDIN_STEPS, SPEAK_PROMPTS, START_METHODS, StartMethod } from '../start';


type ImportResult = { profile: Profile; summary: string; missing: string[] };

export default function ImportScreen({ prefs, method, onBack, onContinue }: {
  prefs: Prefs; method?: StartMethod; onBack: () => void; onContinue: (p: Profile, prefs: Prefs) => void;
}) {
  const chosen = START_METHODS.find((m) => m.key === method);
  const [resumeText, setResumeText] = useState('');
  const [plainLanguage, setPlainLanguage] = useState(!!prefs.plain_language);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const typedBefore = useRef('');

  async function runImport(kind: 'text' | 'pdf' | 'image', data: string, mimeType?: string) {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, kind, data, mimeType, prefs: { ...prefs, plain_language: plainLanguage } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResult(body);
    } catch (e) {
      setError(`Something went wrong. ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function pickPdf() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', base64: true });
    const file = r.assets?.[0];
    if (r.canceled || !file?.base64) return;
    runImport('pdf', file.base64);
  }

  async function pickPhoto(useCamera: boolean) {
    if (useCamera && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError('Camera permission is needed to take a photo of your resume.'); return; }
    }
    const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], base64: true, quality: 0.6 };
    const r = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const img = r.assets?.[0];
    if (r.canceled || !img?.base64) return;
    runImport('image', img.base64, img.mimeType ?? 'image/jpeg');
  }

  const actionButton = (label: string, hint: string, onPress: () => void) => (
    <Pressable
      key={label}
      style={({ pressed }) => [styles.secondaryButton, loading && styles.buttonDisabled, pressed && styles.buttonPressed]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: loading }}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );

  const primaryButton = (label: string, hint: string, onPress: () => void) => (
    <Pressable
      style={({ pressed }) => [styles.button, loading && styles.buttonDisabled, pressed && styles.buttonPressed]}
      onPress={onPress} disabled={loading}
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: loading }}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );

  const otherWays = (
    <View style={styles.buttonRow}>
            {actionButton('Upload PDF', 'Choose a resume or LinkedIn PDF from your device', pickPdf)}
            {actionButton('Take a photo', 'Use your camera to photograph a printed resume', () => pickPhoto(true))}
            {actionButton('Choose a photo', 'Pick a photo of your resume from your device', () => pickPhoto(false))}
          </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to home" style={styles.back}>
          <Text style={styles.backText}>‹ Home</Text>
        </Pressable>
        <Text style={styles.title} role="heading" aria-level={1}>Build your job profile</Text>
        {!chosen && (
          <Text style={styles.body}>
            Upload your resume, take a photo of it, or paste or speak it below. LinkedIn tip: on your profile, choose More, then Save to PDF.
          </Text>
        )}

        {chosen && (
          <View style={styles.focus}>
            <Text style={styles.subtitle} role="heading" aria-level={2}>{chosen.icon}  {chosen.title}</Text>
            {method === 'resume' && (
              <>
                <Text style={styles.body}>Choose your resume PDF. We'll read it and fill in your profile for you.</Text>
                {primaryButton('Upload resume PDF', 'Choose a resume PDF from your device', pickPdf)}
              </>
            )}
            {method === 'linkedin' && (
              <>
                {LINKEDIN_STEPS.map((step, i) => <Text key={step} style={styles.body}>{i + 1}. {step}</Text>)}
                {actionButton('Open LinkedIn', 'Opens LinkedIn so you can save your profile as a PDF', () => Linking.openURL('https://www.linkedin.com/'))}
                {primaryButton('Upload LinkedIn PDF', 'Choose the profile PDF you saved from LinkedIn', pickPdf)}
              </>
            )}
            {method === 'photo' && (
              <>
                <Text style={styles.body}>Lay your resume flat in good light and make sure all the text is in the picture.</Text>
                {primaryButton('Take a photo', 'Use your camera to photograph a printed resume', () => pickPhoto(true))}
                {actionButton('Choose a photo instead', 'Pick a photo of your resume from your device', () => pickPhoto(false))}
              </>
            )}
            {method === 'speak' && (
              <>
                <Text style={styles.body}>Tap Speak and talk naturally. You can stop and start, and fix anything before you send it. Try to cover:</Text>
                {SPEAK_PROMPTS.map((p) => <Text key={p} style={styles.body}>• {p}</Text>)}
              </>
            )}
          </View>
        )}
        {chosen && method !== 'speak' && <Text style={styles.subtitle} role="heading" aria-level={2}>Other ways</Text>}

        {method !== 'speak' && otherWays}

        <TextInput
          style={styles.input}
          multiline
          value={resumeText}
          onChangeText={setResumeText}
          placeholder="Paste or speak your resume here"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Resume text"
          accessibilityHint="Paste or dictate your resume or LinkedIn profile"
        />

        <MicButton
          language={voiceFor(prefs.language)}
          disabled={loading}
          onStart={() => { typedBefore.current = resumeText ? `${resumeText.trim()} ` : ''; }}
          onText={(spoken) => setResumeText(typedBefore.current + spoken)}
        />

        <View style={styles.row}>
          <Text style={styles.body} nativeID="plainLabel">Use plain language</Text>
          <Switch
            value={plainLanguage}
            onValueChange={setPlainLanguage}
            accessibilityLabel="Use plain language"
            aria-labelledby="plainLabel"
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, (!resumeText.trim() || loading) && styles.buttonDisabled, pressed && styles.buttonPressed]}
          onPress={() => runImport('text', resumeText)}
          disabled={!resumeText.trim() || loading}
          accessibilityRole="button"
          accessibilityLabel="Build my profile"
          accessibilityState={{ disabled: !resumeText.trim() || loading, busy: loading }}
        >
          <Text style={styles.buttonText}>{loading ? 'Reading your resume…' : 'Build my profile'}</Text>
        </Pressable>

        {method === 'speak' && (
          <>
            <Text style={styles.subtitle} role="heading" aria-level={2}>Or upload something instead</Text>
            {otherWays}
          </>
        )}

        {loading && <ActivityIndicator size="large" color={colors.blue} accessibilityLabel="Loading" />}

        <View aria-live="polite">
          {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
          {result && (
            <View style={styles.card}>
              <Text style={styles.subtitle} role="heading" aria-level={2}>What we found</Text>
              <Text style={styles.body}>{result.summary}</Text>
              {result.missing.length > 0 && (
                <>
                  <Text style={styles.subtitle} role="heading" aria-level={2}>Still needed</Text>
                  {result.missing.map((m) => <Text key={m} style={styles.body}>• {m}</Text>)}
                </>
              )}
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={() => onContinue(result.profile, { ...prefs, plain_language: plainLanguage })}
                accessibilityRole="button"
                accessibilityLabel="Continue to finish my profile"
              >
                <Text style={styles.buttonText}>Continue</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

// High-contrast colors (WCAG AA or better) and 48pt minimum touch targets.
const styles = themed(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  body: { fontSize: 18, lineHeight: 26, color: colors.ink },
  input: {
    minHeight: 180, borderWidth: 2, borderColor: colors.muted, borderRadius: 8,
    padding: 12, fontSize: 18, color: colors.ink, textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  button: { backgroundColor: colors.blue, minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonDisabled: { backgroundColor: colors.muted },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.onAccent, fontSize: 18, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  secondaryButton: {
    minHeight: 52, borderRadius: 8, borderWidth: 2, borderColor: colors.blue, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexGrow: 1,
  },
  secondaryButtonText: { color: colors.blue, fontSize: 18, fontWeight: '700' },
  focus: { backgroundColor: colors.tint, borderRadius: 16, padding: 20, gap: 12, borderWidth: 2, borderColor: colors.blue },
  card: { borderWidth: 2, borderColor: colors.blue, borderRadius: 8, padding: 16, gap: 8 },
  error: { fontSize: 18, color: colors.red },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 18, color: colors.blue, fontWeight: '600' },
}));
