// Sign in or create an account, so the profile, settings, and tracker follow the applicant to any device.
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { Prefs, Profile } from '../api';
import { deleteAccount, signIn, signOut, signUp } from '../account';
import { colors, radius, space, type, themed } from '../theme';

type Loaded = { profile: Profile; prefs: Prefs };

export default function AccountScreen({ email, onBack, onSignedIn, onSignedOut }: {
  email: string | null; onBack: () => void; onSignedIn: (email: string, data: Loaded) => void; onSignedOut: () => void;
}) {
  const [mode, setMode] = useState<'signin' | 'create'>('create');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const submit = () => run(async () => {
    const data = await (mode === 'create' ? signUp : signIn)(address.trim(), password);
    setPassword('');
    onSignedIn(address.trim().toLowerCase(), data);
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        {email ? (
          <>
            <Text style={styles.title} role="heading" aria-level={1}>Your account</Text>
            <Text style={type.body}>Signed in as <Text style={{ fontWeight: '700' }}>{email}</Text>.</Text>
            <Text style={type.body}>
              Your profile, settings, and applications are saved to your account after every change. Sign in on any phone,
              tablet, or computer to pick up where you left off.
            </Text>
            <Pressable style={styles.secondary} onPress={() => run(async () => { await signOut(); onSignedOut(); })} disabled={busy}
              accessibilityRole="button" accessibilityLabel="Sign out" accessibilityHint="Also removes your information from this device">
              <Text style={styles.secondaryText}>Sign out</Text>
            </Pressable>
            <Text style={type.small}>Signing out also clears this device, so it's safe on a shared or library computer.</Text>

            <View style={styles.danger}>
              <Text style={styles.label} role="heading" aria-level={2}>Delete my account</Text>
              <Text style={type.small}>This permanently deletes your account, profile, and saved applications. It can't be undone.</Text>
              {confirmDelete ? (
                <View style={styles.row}>
                  <Pressable style={[styles.button, { backgroundColor: colors.red, flex: 1 }]} disabled={busy}
                    onPress={() => run(async () => { await deleteAccount(); onSignedOut(); })}
                    accessibilityRole="button" accessibilityLabel="Yes, delete everything">
                    <Text style={styles.buttonText}>Yes, delete everything</Text>
                  </Pressable>
                  <Pressable style={[styles.secondary, { flex: 1 }]} onPress={() => setConfirmDelete(false)} accessibilityRole="button" accessibilityLabel="Keep my account">
                    <Text style={styles.secondaryText}>Keep my account</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.secondary} onPress={() => setConfirmDelete(true)} accessibilityRole="button" accessibilityLabel="Delete my account">
                  <Text style={[styles.secondaryText, { color: colors.red }]}>Delete my account</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title} role="heading" aria-level={1}>{mode === 'create' ? 'Save your progress' : 'Welcome back'}</Text>
            <Text style={type.body}>
              {mode === 'create'
                ? 'Create a free account to keep your profile and applications on any device. You can also keep using the app without one.'
                : 'Sign in to bring back your profile and applications.'}
            </Text>

            <View style={styles.tabs} role="tablist">
              {(['create', 'signin'] as const).map((m) => (
                <Pressable key={m} onPress={() => { setMode(m); setError(''); }} style={[styles.tab, mode === m && styles.tabOn]}
                  accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
                  <Text style={[styles.tabText, mode === m && { color: colors.onAccent }]}>{m === 'create' ? 'Create account' : 'Sign in'}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label} nativeID="emailLabel">Email</Text>
            <TextInput value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              inputMode="email" autoComplete="email" textContentType="emailAddress" style={styles.input}
              accessibilityLabel="Email" aria-labelledby="emailLabel" />
            <Text style={styles.label} nativeID="pwLabel">Password{mode === 'create' ? ' (at least 8 characters)' : ''}</Text>
            <View style={styles.row}>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                textContentType={mode === 'create' ? 'newPassword' : 'password'}
                style={[styles.input, { flex: 1 }]} accessibilityLabel="Password" aria-labelledby="pwLabel" onSubmitEditing={submit} />
              <Pressable style={styles.showBtn} onPress={() => setShow(!show)} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}>
                <Text style={styles.secondaryText}>{show ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            <Pressable style={({ pressed }) => [styles.button, (busy || !address || !password) && styles.disabled, pressed && { opacity: 0.85 }]}
              onPress={submit} disabled={busy || !address || !password} accessibilityRole="button"
              accessibilityLabel={mode === 'create' ? 'Create my account' : 'Sign in'}>
              <Text style={styles.buttonText}>{mode === 'create' ? 'Create my account' : 'Sign in'}</Text>
            </Pressable>
            <Text style={type.small}>
              We save your profile, settings, and applications so you can use them on any device. We never share them, and you can delete your account at any time.
            </Text>
          </>
        )}

        <View aria-live="polite">
          {busy ? <ActivityIndicator color={colors.blue} /> : null}
          {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: space.lg, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 18, color: colors.blue, fontWeight: '600' },
  title: { ...type.title, color: colors.red },
  label: { fontSize: 18, fontWeight: '700', color: colors.ink },
  input: { minHeight: 52, borderWidth: 2, borderColor: colors.muted, borderRadius: 8, paddingHorizontal: 12, fontSize: 18, color: colors.ink },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  showBtn: { minHeight: 52, minWidth: 72, borderRadius: radius, borderWidth: 2, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  button: { backgroundColor: colors.blue, minHeight: 52, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  disabled: { backgroundColor: colors.muted },
  buttonText: { color: colors.onAccent, fontSize: 18, fontWeight: '700' },
  secondary: { minHeight: 52, borderRadius: radius, borderWidth: 2, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  secondaryText: { fontSize: 18, fontWeight: '700', color: colors.blue },
  tabs: { flexDirection: 'row', borderWidth: 2, borderColor: colors.blue, borderRadius: radius, overflow: 'hidden' },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.blue },
  tabText: { fontSize: 18, fontWeight: '700', color: colors.blue },
  danger: { borderTopWidth: 2, borderTopColor: colors.line, paddingTop: space.md, gap: space.sm, marginTop: space.lg },
  error: { fontSize: 18, color: colors.red },
}));
