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
import AccountScreen from './screens/AccountScreen';
import { getAccount, pull, scheduleSync } from './account';
import { API_URL } from './api';

type Screen = 'welcome' | 'import' | 'chat' | 'matches' | 'tracker' | 'coach' | 'settings' | 'check' | 'account';

export default function App() {
  const [screen, setScreenState] = useState<Screen>('welcome');
  const [previous, setPrevious] = useState<Screen>('welcome');
  const setScreen = (s: Screen) => { setPrevious(screen); setScreenState(s); };
  const [profile, setProfileState] = useState<Profile>({});
  const [prefs, setPrefsState] = useState<Prefs>({});
  const [coachFor, setCoachFor] = useState<{ item: TrackedJob; task: CoachTask } | null>(null);

  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  // Sign-in shows only when the server has accounts turned on (it needs a database when hosted).
  const [accountsOn, setAccountsOn] = useState(false);
  useEffect(() => {
    fetch(`${API_URL}/api/health`).then((r) => r.json()).then((h) => setAccountsOn(!!h.accounts)).catch(() => {});
  }, []);

  // The profile and settings are kept on this device, so returning applicants don't start over.
  // When signed in, they also come from the account, so changes made on another device show up here.
  useEffect(() => {
    AsyncStorage.multiGet(['profile.v1', 'prefs.v1']).then(([[, p], [, pr]]) => {
      if (p) setProfileState(JSON.parse(p));
      if (pr) setPrefsState(JSON.parse(pr));
    });
    getAccount().then((a) => {
      if (!a) return;
      setAccountEmail(a.email);
      pull().then((saved) => { if (saved) { setProfileState(saved.profile); setPrefsState(saved.prefs); } });
    });
  }, []);
  const setProfile = (p: Profile) => { setProfileState(p); AsyncStorage.setItem('profile.v1', JSON.stringify(p)).then(scheduleSync); };
  const setPrefs = (p: Prefs) => { setPrefsState(p); AsyncStorage.setItem('prefs.v1', JSON.stringify(p)).then(scheduleSync); };

  return (
    <>
      {screen === 'welcome' && (
        <WelcomeScreen
          onStart={() => setScreen('import')}
          onTracker={() => setScreen('tracker')}
          onCheckJob={() => setScreen('check')}
          onAccount={accountsOn ? () => setScreen('account') : undefined}
          accountEmail={accountEmail}
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
      {screen === 'matches' && <MatchesScreen profile={profile} prefs={prefs} onBack={() => setScreen('chat')} onTracker={() => setScreen('tracker')} onCheckJob={() => setScreen('check')} signedIn={!!accountEmail || !accountsOn} onAccount={() => setScreen('account')} />}
      {screen === 'account' && (
        <AccountScreen
          email={accountEmail}
          onBack={() => setScreenState(previous === 'account' ? 'welcome' : previous)}
          onSignedIn={(email, data) => { setAccountEmail(email); setProfileState(data.profile); setPrefsState(data.prefs); setScreenState(previous === 'account' ? 'welcome' : previous); }}
          onSignedOut={() => { setAccountEmail(null); setProfileState({}); setPrefsState({}); setScreenState('welcome'); }}
        />
      )}
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
