// The scorecard's ring (overall score) and colored bar (one area or chance), shared by the full and mini scorecards.
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, themed } from '../theme';

export function Ring({ value, size = 150 }: { value: number; size?: number }) {
  const stroke = Math.max(8, Math.round(size * 0.09)), r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const num = Math.round(size * 0.3);
  const color = value >= 70 ? colors.green : value >= 50 ? colors.orange : colors.red;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible accessibilityRole="image" accessibilityLabel={`Overall Predictability Score ${value} out of 100`}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={[ringStyles.ringNum, { fontSize: num, lineHeight: Math.round(num * 1.1) }]}>{value}</Text>
      {size >= 120 && <Text style={ringStyles.ringOf}>out of 100</Text>}
    </View>
  );
}

export function Meter({ value, color, height = 12 }: { value: number; color: string; height?: number }) {
  return (
    <View style={[ringStyles.track, { height, borderRadius: height / 2 }]}>
      <View style={[ringStyles.fill, { width: `${value}%`, backgroundColor: color, height, borderRadius: height / 2 }]} />
    </View>
  );
}


const ringStyles = themed(() => ({
  ringNum: { fontWeight: '900', color: colors.ink },
  ringOf: { fontSize: 13, color: colors.muted },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
}));
