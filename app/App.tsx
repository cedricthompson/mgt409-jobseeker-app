import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Prefs, Profile } from './api';
import WelcomeScreen from './screens/WelcomeScreen';
import ImportScreen from './screens/ImportScreen';
import ChatScreen from './screens/ChatScreen';
import MatchesScreen from './screens/MatchesScreen';
import TrackerScreen from './screens/TrackerScreen';
import CoachScreen, { CoachTask } from './screens/CoachScreen';
import { TrackedJob } from './tracker';
import SettingsScreen from './screens/SettingsScreen';
import CheckJobScreen from './screens/CheckJobScreen';

type Screen = 'welcome' | 'import' | 'chat' | 'matches' | 'tracker' | 'coach' | 'settings' | 'check';

export default function App() {
  const [screen, setScreenState] = useState<Screen>('welcome');
  const [previous, setPrevious] = useState<Screen>('welcome');
  const setScreen = (s: Screen) => { setPrevious(screen); setScreenState(s); };
  const [profile, setProfileState] = useState<Profile>({});
  const [prefs, setPrefsState] = useState<Prefs>({});
  const [coachFor, setCoachFor] = useState<{ item: TrackedJob; task: CoachTask } | null>(null);

  // The profile and settings are kept on this device only, so returning applicants don't start over.
  useEffect(() => {
    AsyncStorage.multiGet(['profile.v1', 'prefs.v1']).then(([[, p], [, pr]]) => {
      if (p) setProfileState(JSON.parse(p));
      if (pr) setPrefsState(JSON.parse(pr));
    });
  }, []);
  const setProfile = (p: Profile) => { setProfileState(p); AsyncStorage.setItem('profile.v1', JSON.stringify(p)); };
  const setPrefs = (p: Prefs) => { setPrefsState(p); AsyncStorage.setItem('prefs.v1', JSON.stringify(p)); };

  return (
    <>
      {screen === 'welcome' && (
        <WelcomeScreen
          onStart={() => setScreen('import')}
          onTracker={() => setScreen('tracker')}
          onCheckJob={() => setScreen('check')}
          onSettings={() => setScreen('settings')}
          reduceMotion={prefs.reduce_motion}
        />
      )}
      {screen === 'settings' && <SettingsScreen prefs={prefs} onChange={setPrefs} onBack={() => setScreenState(previous === 'settings' ? 'welcome' : previous)} />}
      {screen === 'import' && (
        <ImportScreen
          prefs={prefs}
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
      {screen === 'matches' && <MatchesScreen profile={profile} prefs={prefs} onBack={() => setScreen('chat')} onTracker={() => setScreen('tracker')} onCheckJob={() => setScreen('check')} />}
      {screen === 'check' && (
        <CheckJobScreen
          profile={profile}
          prefs={prefs}
          onBack={() => setScreenState(previous === 'check' ? 'welcome' : previous)}
          onTracker={() => setScreen('tracker')}
          onBuildProfile={() => setScreen('import')}
        />
      )}
      {screen === 'tracker' && (
        <TrackerScreen
          onBack={() => setScreen(previous === 'tracker' || previous === 'coach' ? 'welcome' : previous)}
          onCoach={(item, task) => { setCoachFor({ item, task }); setScreen('coach'); }}
        />
      )}
      {screen === 'coach' && coachFor && (
        <CoachScreen task={coachFor.task} item={coachFor.item} profile={profile} prefs={prefs} onBack={() => setScreenState('tracker')} />
      )}
      <StatusBar style="dark" />
    </>
  );
}
