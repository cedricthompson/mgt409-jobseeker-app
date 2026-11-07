import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const session = Math.random().toString(36).slice(2);

type Profile = Record<string, unknown>;
type ImportResult = { profile: Profile; summary: string; missing: string[] };

export default function App() {
  const [resumeText, setResumeText] = useState('');
  const [plainLanguage, setPlainLanguage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  async function importText() {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, kind: 'text', data: resumeText, prefs: { plain_language: plainLanguage } }),
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} role="heading" aria-level={1}>Build your job profile</Text>
        <Text style={styles.body}>
          Paste your resume or LinkedIn profile below. You can also use the microphone on your keyboard to speak it.
        </Text>

        <TextInput
          style={styles.input}
          multiline
          value={resumeText}
          onChangeText={setResumeText}
          placeholder="Paste or speak your resume here"
          placeholderTextColor="#595959"
          accessibilityLabel="Resume text"
          accessibilityHint="Paste or dictate your resume or LinkedIn profile"
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
          onPress={importText}
          disabled={!resumeText.trim() || loading}
          accessibilityRole="button"
          accessibilityLabel="Build my profile"
          accessibilityState={{ disabled: !resumeText.trim() || loading, busy: loading }}
        >
          <Text style={styles.buttonText}>{loading ? 'Reading your resume…' : 'Build my profile'}</Text>
        </Pressable>

        {loading && <ActivityIndicator size="large" color="#0B3D91" accessibilityLabel="Loading" />}

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
            </View>
          )}
        </View>
      </ScrollView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

// High-contrast colors (WCAG AA or better) and 48pt minimum touch targets.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 20, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#111111' },
  subtitle: { fontSize: 20, fontWeight: '700', color: '#111111' },
  body: { fontSize: 18, lineHeight: 26, color: '#222222' },
  input: {
    minHeight: 180, borderWidth: 2, borderColor: '#333333', borderRadius: 8,
    padding: 12, fontSize: 18, color: '#111111', textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  button: { backgroundColor: '#0B3D91', minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonDisabled: { backgroundColor: '#6B7A99' },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  card: { borderWidth: 2, borderColor: '#0B3D91', borderRadius: 8, padding: 16, gap: 8 },
  error: { fontSize: 18, color: '#B00020' },
});
