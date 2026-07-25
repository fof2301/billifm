import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import PlayerScreen from './src/screens/PlayerScreen';

/**
 * Three screens, one state machine. No navigation library - there is nowhere to
 * navigate to (rules.md 2: no abstraction until the second use).
 */
export default function App() {
  const [screen, setScreen] = useState<'home' | 'player'>('home');
  const [classic, setClassic] = useState(false);

  return (
    <>
      <StatusBar hidden />
      {screen === 'home' ? (
        <HomeScreen
          onEnter={(isClassic) => {
            setClassic(isClassic);
            setScreen('player');
          }}
        />
      ) : (
        <PlayerScreen classic={classic} />
      )}
    </>
  );
}
