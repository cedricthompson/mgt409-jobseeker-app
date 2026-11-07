import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Prefs, Profile } from './api';
import WelcomeScreen from './screens/WelcomeScreen';
import ImportScreen from './screens/ImportScreen';
import ChatScreen from './screens/ChatScreen';

type Screen = 'welcome' | 'import' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [profile, setProfile] = useState<Profile>({});
  const [prefs, setPrefs] = useState<Prefs>({});

  return (
    <>
      {screen === 'welcome' && <WelcomeScreen onStart={() => setScreen('import')} />}
      {screen === 'import' && (
        <ImportScreen
          onBack={() => setScreen('welcome')}
          onContinue={(p, pr) => { setProfile(p); setPrefs(pr); setScreen('chat'); }}
        />
      )}
      {screen === 'chat' && (
        <ChatScreen
          profile={profile}
          prefs={prefs}
          onBack={() => setScreen('import')}
          onDone={(p) => setProfile(p)}
        />
      )}
      <StatusBar style="dark" />
    </>
  );
}
