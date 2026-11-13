import { APP_NAME } from '../brand';
import * as Speech from 'expo-speech';
import { Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { Prefs } from '../api';
import { colors, radius, space, type, themed } from '../theme';
import Brand from '../components/Brand';

// Languages common among job seekers in DC and NYC. The coach replies in the chosen language;
// read-aloud uses the matching voice. App buttons and labels stay in English for now.
export const LANGUAGES: { name: string; native: string; voice: string }[] = [
  { name: 'English', native: 'English', voice: 'en-US' },
  { name: 'Spanish', native: 'Español', voice: 'es-US' },
  { name: 'Amharic', native: 'አማርኛ', voice: 'am-ET' },
  { name: 'Chinese', native: '中文', voice: 'zh-CN' },
  { name: 'Vietnamese', native: 'Tiếng Việt', voice: 'vi-VN' },
  { name: 'French', native: 'Français', voice: 'fr-FR' },
  { name: 'Haitian Creole', native: 'Kreyòl ayisyen', voice: 'ht-HT' },
  { name: 'Arabic', native: 'العربية', voice: 'ar-SA' },
  { name: 'Korean', native: '한국어', voice: 'ko-KR' },
  { name: 'Russian', native: 'Русский', voice: 'ru-RU' },
];
export const voiceFor = (language?: string) => LANGUAGES.find((l) => l.name === language)?.voice ?? 'en-US';

const TOGGLES: { key: 'plain_language' | 'one_step' | 'read_aloud' | 'reduce_motion'; label: string; help: string }[] = [
  { key: 'plain_language', label: 'Plain language', help: 'Short sentences and everyday words.' },
  { key: 'one_step', label: 'One question at a time', help: 'The coach asks only one simple question per message.' },
  { key: 'read_aloud', label: 'Read coach replies aloud', help: "Uses your device's voice. Works with headphones." },
  { key: 'reduce_motion', label: 'Reduce motion', help: 'Turns off moving text and animations.' },
];

// Look and text size. Changes apply right away to every screen (see applyTheme in theme.ts).
type Choice = { label: string; current: (p: Prefs) => string | number; patch: (v: string | number) => Partial<Prefs>;
  options: { label: string; value: string | number }[] };
const CHOICES: Choice[] = [
  { label: 'Appearance', current: (p) => p.look ?? 'light', patch: (v) => ({ look: v as Prefs['look'] }),
    options: [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }, { label: 'High contrast', value: 'contrast' }] },
  { label: 'Text size', current: (p) => p.text_scale ?? 1, patch: (v) => ({ text_scale: Number(v) }),
    options: [{ label: 'Standard', value: 1 }, { label: 'Large', value: 1.2 }, { label: 'Extra large', value: 1.4 }] },
];

export default function SettingsScreen({ prefs, onChange, onBack }: { prefs: Prefs; onChange: (p: Prefs) => void; onBack: () => void }) {
  const set = (patch: Partial<Prefs>) => onChange({ ...prefs, ...patch });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Brand />
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} role="heading" aria-level={1}>Appearance, accessibility, and language</Text>
        <Text style={type.small}>Saved on this device. Change them any time.</Text>

        {CHOICES.map((group) => (
          <View key={group.label} style={{ gap: space.sm }}>
            <Text style={styles.label} role="heading" aria-level={2}>{group.label}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={group.label}>
              {group.options.map((o) => {
                const selected = group.current(prefs) === o.value;
                return (
                  <Pressable
                    key={o.label}
                    onPress={() => set(group.patch(o.value))}
                    style={[styles.chip, selected && styles.chipOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    aria-checked={selected}
                    accessibilityLabel={o.label}
                  >
                    <Text style={[styles.chipText, selected && { color: colors.onAccent }]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {TOGGLES.map(({ key, label, help }) => (
          <View key={key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label} nativeID={`pref-${key}`}>{label}</Text>
              <Text style={type.small}>{help}</Text>
            </View>
            <Switch
              value={!!prefs[key]}
              onValueChange={(v) => set({ [key]: v })}
              accessibilityLabel={label}
              accessibilityHint={help}
              aria-labelledby={`pref-${key}`}
            />
          </View>
        ))}

        {prefs.read_aloud && (
          <Pressable
            style={styles.secondary}
            onPress={() => Speech.speak('This is how the coach will sound.', { language: voiceFor(prefs.language) })}
            accessibilityRole="button"
            accessibilityLabel="Test the voice"
          >
            <Text style={styles.secondaryText}>Test the voice</Text>
          </Pressable>
        )}

        <Text style={styles.label} role="heading" aria-level={2}>Coach language</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {LANGUAGES.map((l) => {
            const selected = (prefs.language ?? 'English') === l.name;
            return (
              <Pressable
                key={l.name}
                onPress={() => set({ language: l.name })}
                style={[styles.chip, selected && styles.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                accessibilityLabel={l.name}
              >
                <Text style={[styles.chipText, selected && { color: colors.onAccent }]}>{l.native}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.note}>
          <Text style={styles.label}>Also works with your device settings</Text>
          <Text style={type.small}>
            Larger text, screen readers (VoiceOver, TalkBack), voice control, switch control, and keyboard navigation on the web.
            Every button has a spoken label. You can speak any answer using your keyboard's microphone.
          </Text>
        </View>

        <View style={styles.note}>
          <Text style={styles.label}>How we count visits</Text>
          <Text style={type.small}>
            To improve {APP_NAME}, we count visits and how far people get, along with general details such as your city, education
            level, pay range, and the kinds of jobs you want. We never count your name, email, resume, or what you type to the coaches,
            and nothing is shared. To opt out, turn on Global Privacy Control in your browser.
          </Text>
        </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: space.sm },
  label: { fontSize: 18, fontWeight: '700', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 48, paddingHorizontal: space.md, borderRadius: 24, borderWidth: 2, borderColor: colors.blue, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontSize: 17, fontWeight: '600', color: colors.blue },
  secondary: { minHeight: 48, borderRadius: radius, borderWidth: 2, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 17, fontWeight: '700', color: colors.blue },
  note: { backgroundColor: colors.tint, padding: space.md, borderRadius: radius, gap: 4 },
}));
