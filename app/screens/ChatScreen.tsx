import { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { post, Prefs, Profile } from '../api';
import { colors, radius, space, type } from '../theme';

type Msg = { role: 'user' | 'assistant'; content: string; why?: string };
type ChatReply = { agent: 'intake' | 'gap'; reply: string; why?: string; profile: Profile; missing: string[]; done: boolean };

export default function ChatScreen({ profile: start, prefs, onBack, onDone }: {
  profile: Profile; prefs: Prefs; onBack: () => void; onDone: (p: Profile) => void;
}) {
  const [profile, setProfile] = useState<Profile>(start);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  async function send(history: Msg[]) {
    setMessages(history); setLoading(true); setError('');
    try {
      const r = await post<ChatReply>('/api/profile-chat', {
        profile, prefs, messages: history.map(({ role, content }) => ({ role, content })),
      });
      setProfile(r.profile);
      setMessages([...history, { role: 'assistant', content: r.reply, why: r.why }]);
      setDone(r.done);
    } catch (e) {
      setError(`Something went wrong. ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  // The agent asks the first question as soon as the screen opens.
  // The ref guard stops a duplicate (paid) call if the effect runs twice.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    send([]);
  }, []);

  function submit() {
    const text = draft.trim();
    if (!text || loading) return;
    setDraft('');
    send([...messages, { role: 'user', content: text }]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title} role="heading" aria-level={1}>Complete your profile</Text>
          {messages.length > 0 && !done && (
            <Pressable
              onPress={() => onDone(profile)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Skip questions and see job matches now"
              style={styles.back}
            >
              <Text style={styles.backText}>See matches now ›</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === 'user' ? styles.user : styles.coach]}
              accessible
              accessibilityLabel={`${m.role === 'user' ? 'You said' : 'Coach said'}: ${m.content}${m.why ? `. Why this matters: ${m.why}` : ''}`}
            >
              <Text style={[type.body, m.role === 'user' && { color: colors.white }]}>{m.content}</Text>
              {m.why ? <Text style={styles.why}>Why this matters: {m.why}</Text> : null}
            </View>
          ))}
          <View aria-live="polite">
            {loading && <ActivityIndicator color={colors.blue} accessibilityLabel="Coach is thinking" />}
            {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
          </View>
          {done && (
            <Pressable style={styles.cta} onPress={() => onDone(profile)} accessibilityRole="button" accessibilityLabel="See my job matches">
              <Text style={styles.ctaText}>See my job matches</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder="Type or speak your answer"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Your answer"
            accessibilityHint="Type, or use the keyboard microphone to speak"
            multiline
            blurOnSubmit
            returnKeyType="send"
          />
          <Pressable
            style={[styles.send, (!draft.trim() || loading) && { backgroundColor: colors.line }]}
            onPress={submit}
            disabled={!draft.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel="Send answer"
            accessibilityState={{ disabled: !draft.trim() || loading }}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 18, color: colors.blue, fontWeight: '600' },
  title: { ...type.heading, color: colors.red },
  thread: { padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' },
  bubble: { padding: space.md, borderRadius: radius, maxWidth: '88%', gap: space.sm },
  coach: { backgroundColor: colors.tint, alignSelf: 'flex-start' },
  user: { backgroundColor: colors.blue, alignSelf: 'flex-end' },
  why: { ...type.small, fontStyle: 'italic' },
  error: { fontSize: 18, color: colors.red },
  cta: { backgroundColor: colors.red, minHeight: 56, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  composer: {
    flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderColor: colors.line,
    maxWidth: 820, width: '100%', alignSelf: 'center',
  },
  input: {
    flex: 1, minHeight: 52, maxHeight: 140, borderWidth: 2, borderColor: colors.ink, borderRadius: radius,
    paddingHorizontal: space.md, paddingVertical: 12, fontSize: 18, color: colors.ink,
  },
  send: { backgroundColor: colors.blue, minHeight: 52, minWidth: 80, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontSize: 18, fontWeight: '700' },
});
