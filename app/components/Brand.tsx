// The Chart Academy logo next to the ForeSIGHT name, shown at the top of every screen.
import { Image, View } from 'react-native';
import Wordmark from './Wordmark';

export default function Brand({ size = 24 }: { size?: number }) {
  const icon = Math.round(size * 1.5);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={require('../assets/logo-icon.png')} style={{ width: icon, height: icon }} resizeMode="contain"
        accessibilityLabel="Chart Academy" alt="Chart Academy" />
      <Wordmark size={size} />
    </View>
  );
}
