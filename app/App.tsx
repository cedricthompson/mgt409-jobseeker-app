import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import WelcomeScreen from './screens/WelcomeScreen';
import ImportScreen from './screens/ImportScreen';

type Screen = 'welcome' | 'import';

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  return (
    <>
      {screen === 'welcome' && <WelcomeScreen onStart={() => setScreen('import')} />}
      {screen === 'import' && <ImportScreen onBack={() => setScreen('welcome')} />}
      <StatusBar style="dark" />
    </>
  );
}
