// The ForeSIGHT wordmark: heavy type, "Fore" in blue and underlined, "SIGHT" in red. Screen readers hear one word, "Foresight".
import { Text } from 'react-native';
import { NAME_PARTS, SPOKEN_NAME } from '../brand';
import { colors } from '../theme';

export default function Wordmark({ size = 28 }: { size?: number }) {
  const style = { fontSize: size, lineHeight: Math.round(size * 1.15), fontWeight: '900' as const, letterSpacing: -0.04 * size };
  return (
    <Text style={style} accessibilityRole="header" accessibilityLabel={SPOKEN_NAME}>
      <Text style={{ color: colors.blue, textDecorationLine: 'underline', textDecorationColor: colors.blue }}>{NAME_PARTS[0]}</Text>
      <Text style={{ color: colors.red }}>{NAME_PARTS[1]}</Text>
    </Text>
  );
}
