// The Foresight wordmark: heavy type, "Fore" in blue and "sight" in red. Screen readers hear one word.
import { Text } from 'react-native';
import { APP_NAME, NAME_PARTS } from '../brand';
import { colors } from '../theme';

export default function Wordmark({ size = 28 }: { size?: number }) {
  const style = { fontSize: size, lineHeight: Math.round(size * 1.15), fontWeight: '900' as const, letterSpacing: -0.04 * size };
  return (
    <Text style={style} accessibilityRole="header" accessibilityLabel={APP_NAME}>
      <Text style={{ color: colors.blue }}>{NAME_PARTS[0]}</Text>
      <Text style={{ color: colors.red }}>{NAME_PARTS[1]}</Text>
    </Text>
  );
}
