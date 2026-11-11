// Illustrated portraits of the five AI coaches. Drawn in code (no photos), so they stay sharp at any size
// and work in light and dark mode. The team reflects the people the app serves: a range of skin tones,
// ages, and styles. Every portrait has alt text describing it.
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';

type Look = {
  skin: string; hair: string; shirt: string; bg: string; alt: string;
  back?: 'afro' | 'long' | 'bob'; front: 'curls' | 'short' | 'bangs' | 'part' | 'receding';
  glasses?: boolean; beard?: boolean;
};

export const LOOKS: Record<string, Look> = {
  intake: { skin: '#7A4A2A', hair: '#1B120D', shirt: '#3A56A6', bg: '#DCE3F5', back: 'afro', front: 'curls',
    alt: 'Illustration of Maya, a Black woman with natural curly hair, smiling' },
  gap: { skin: '#C58C5C', hair: '#2B1B10', shirt: '#D71F2D', bg: '#F8DDE0', front: 'short', glasses: true,
    alt: 'Illustration of Theo, a Latino man with short dark hair and glasses, smiling' },
  matcher: { skin: '#F1C7A1', hair: '#141414', shirt: '#2B4080', bg: '#DDE6F7', back: 'bob', front: 'bangs',
    alt: 'Illustration of Jordan, an East Asian person with a short black bob, smiling' },
  scorecard: { skin: '#A86B45', hair: '#1A0F0A', shirt: '#D71F2D', bg: '#F6E1D6', back: 'long', front: 'part',
    alt: 'Illustration of Priya, a South Asian woman with long dark hair, smiling' },
  coach: { skin: '#EFC6A4', hair: '#A9A9A9', shirt: '#3A56A6', bg: '#E4E7EE', front: 'receding', beard: true,
    alt: 'Illustration of Marcus, an older man with gray hair and a gray beard, smiling' },
};

export default function Avatar({ coach, size = 72 }: { coach: string; size?: number }) {
  const l = LOOKS[coach];
  if (!l) return null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={l.alt} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={50} fill={l.bg} />
        {/* hair behind the head */}
        {l.back === 'afro' && <Circle cx={50} cy={38} r={27} fill={l.hair} />}
        {l.back === 'long' && <Path d="M29 46 C27 18 73 18 71 46 L73 80 L27 80 Z" fill={l.hair} />}
        {l.back === 'bob' && <Path d="M30 52 C27 22 73 22 70 52 L70 60 L30 60 Z" fill={l.hair} />}
        {/* shoulders and neck */}
        <Path d="M14 100 C14 80 30 71 50 71 C70 71 86 80 86 100 Z" fill={l.shirt} />
        <Rect x={43} y={57} width={14} height={16} rx={4} fill={l.skin} />
        <Path d="M43 71 L50 78 L57 71" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} />
        {/* head */}
        <Ellipse cx={33.5} cy={46} rx={3.5} ry={5} fill={l.skin} />
        <Ellipse cx={66.5} cy={46} rx={3.5} ry={5} fill={l.skin} />
        <Ellipse cx={50} cy={44} rx={17} ry={20} fill={l.skin} />
        {/* hair in front */}
        {l.front === 'curls' && <Path d="M32 42 C30 22 70 22 68 42 C64 32 56 30 50 31 C44 30 36 32 32 42 Z" fill={l.hair} />}
        {l.front === 'short' && <Path d="M33 41 C31 21 69 21 67 41 C65 31 58 29 50 29 C42 29 35 31 33 41 Z" fill={l.hair} />}
        {l.front === 'bangs' && <Path d="M32 44 C30 21 70 21 68 44 C66 38 60 36 50 36 C40 36 34 38 32 44 Z" fill={l.hair} />}
        {l.front === 'part' && <Path d="M32 46 C30 20 70 20 68 46 C66 34 58 29 52 29 C50 33 40 36 32 46 Z" fill={l.hair} />}
        {l.front === 'receding' && <Path d="M33 42 C32 26 40 23 44 25 C46 28 54 28 56 25 C60 23 68 26 67 42 C66 36 64 32 61 31 C56 33 44 33 39 31 C36 32 34 36 33 42 Z" fill={l.hair} />}
        {/* face */}
        <Path d="M40 39.5 Q43 38 46 39.5" stroke={l.hair === '#A9A9A9' ? '#7D7D7D' : l.hair} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Path d="M54 39.5 Q57 38 60 39.5" stroke={l.hair === '#A9A9A9' ? '#7D7D7D' : l.hair} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Circle cx={43} cy={45} r={1.9} fill="#22160F" />
        <Circle cx={57} cy={45} r={1.9} fill="#22160F" />
        {l.beard && <Path d="M34 46 C34 66 44 66 50 66 C56 66 66 66 66 46 C63 55 58 57 50 57 C42 57 37 55 34 46 Z" fill={l.hair} />}
        <Path d="M44 53 Q50 58.5 56 53" stroke="#5A2E22" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        {l.glasses && (
          <G stroke="#1A1A1A" strokeWidth={1.6} fill="none">
            <Circle cx={43} cy={45} r={5.2} />
            <Circle cx={57} cy={45} r={5.2} />
            <Line x1={48.2} y1={45} x2={51.8} y2={45} />
          </G>
        )}
      </Svg>
    </View>
  );
}
