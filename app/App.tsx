import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Prefs, Profile } from './api';
import WelcomeScreen from './screens/WelcomeScreen';
import ImportScreen from './screens/ImportScreen';
import ChatScreen from './screens/ChatScreen';
import MatchesScreen from './screens/MatchesScreen';
import TrackerScreen from './screens/TrackerScreen';

type Screen = 'welcome' | 'import' | 'chat' | 'matches' | 'tracker';

export default function App() {
  const [screen, setScreenState] = useState<Screen>('welcome');
  const [previous, setPrevious] = useState<Screen>('welcome');
  const setScreen = (s: Screen) => { setPrevious(screen); setScreenState(s); };
  const [profile, setProfile] = useState<Profile>({});
  const [prefs, setPrefs] = useState<Prefs>({});

  return (
    <>
      {screen === 'welcome' && <WelcomeScreen onStart={() => setScreen('import')} onTracker={() => setScreen('tracker')} />}
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
          onDone={(p) => { setProfile(p); setScreen('matches'); }}
        />
      )}
      {screen === 'matches' && <MatchesScreen profile={profile} prefs={prefs} onBack={() => setScreen('chat')} onTracker={() => setScreen('tracker')} />}
      {screen === 'tracker' && <TrackerScreen onBack={() => setScreen(previous === 'tracker' ? 'welcome' : previous)} />}
      <StatusBar style="dark" />
    </>
  );
}
