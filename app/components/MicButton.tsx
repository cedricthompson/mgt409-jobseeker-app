// "Speak" button for answers. On the website it uses the browser's built-in speech recognition
// (Chrome, Edge, and Safari), so it costs no tokens. On phones the keyboard's microphone already
// does this, so the button only appears on the web, and only in browsers that support it.
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { colors, radius, themed } from '../theme';

const Recognition: any =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export const canDictate = !!Recognition;

// onText gets the full spoken text so far; the caller adds it after whatever was already typed.
export default function MicButton({ onStart, onText, language = 'en-US', disabled }: {
  onStart?: () => void; onText: (spoken: string) => void; language?: string; disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef<any>(null);

  useEffect(() => () => rec.current?.abort(), []); // stop listening when the screen closes
  if (!Recognition) return null;

  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    Speech.stop(); // don't let the coach's voice be picked up as the answer
    setError('');
    const r = new Recognition();
    r.lang = language;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onText(text.trim());
    };
    r.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Allow microphone access in your browser to speak your answer.');
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setError('The microphone stopped. Tap Speak to try again.');
      }
    };
    r.onend = () => setListening(false);
    rec.current = r;
    onStart?.();
    r.start();
    setListening(true);
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        disabled={disabled}
        style={({ pressed }) => [styles.button, listening && styles.on, disabled && styles.disabled, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop speaking' : 'Speak your answer'}
        accessibilityHint={listening ? 'Stops the microphone' : 'Turns on the microphone so you can say your answer'}
        accessibilityState={{ disabled, selected: listening }}
      >
        <Text style={[styles.text, listening && { color: colors.onAccent }]}>{listening ? '■ Stop' : '🎤 Speak'}</Text>
      </Pressable>
      {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
    </View>
  );
}

const styles = themed(() => ({
  wrap: { gap: 4, maxWidth: 220 },
  button: {
    minHeight: 52, minWidth: 96, paddingHorizontal: 12, borderRadius: radius, borderWidth: 2,
    borderColor: colors.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  on: { backgroundColor: colors.red, borderColor: colors.red },
  disabled: { opacity: 0.5 },
  text: { fontSize: 18, fontWeight: '700', color: colors.blue },
  error: { fontSize: 16, color: colors.red },
}));
