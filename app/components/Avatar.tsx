// Illustrated portraits of the five AI coaches. Drawn in code (no photos), so they stay sharp at any size
// and work in light and dark mode. The team reflects the people the app serves: a range of skin tones,
// ages, and styles. Every portrait has alt text describing it.
// The head (hair, face, neck) is exported as <Head> so the opening-page work scenes share the same style.
import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';

export type Look = {
  skin: string; hair: string; shirt: string; bg: string; alt: string;
  back?: 'afro' | 'long' | 'bob' | 'bun'; front: 'curls' | 'short' | 'bangs' | 'part' | 'swept';
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
  coach: { skin: '#EFC6A4', hair: '#A9A9A9', shirt: '#3A56A6', bg: '#E4E7EE', front: 'swept', beard: true,
    alt: 'Illustration of Marcus, an older man with a full head of gray hair and a gray beard, smiling' },
};

// Every hairstyle starts from a full cap that rises well above the top of the head (the head's top is at y=24),
// so no scalp ever shows. Only the hairline across the forehead changes from style to style.
const FRONT: Record<Look['front'], string> = {
  curls: 'M31 44 C28 8 72 8 69 44 C66 36 62 33 57 34 C55 31 52 31 50 33 C48 31 45 31 43 34 C38 33 34 36 31 44 Z',
  short: 'M32 43 C29 9 71 9 68 43 C67 35 64 32 60 31 C55 33 45 33 40 31 C36 32 33 35 32 43 Z',
  bangs: 'M31 48 C28 8 72 8 69 48 C67 41 64 38 60 37 L40 37 C36 38 33 41 31 48 Z',
  part: 'M31 48 C28 8 72 8 69 48 C67 36 62 30 53 29 C51 33 42 36 31 48 Z',
  swept: 'M32 43 C29 8 71 8 68 43 C66 34 62 31 56 31 C50 30 44 33 38 31 C35 33 33 36 32 43 Z',
};

// The neck, head, hair, and face, drawn in a 100 by 100 box (head centered at 50, 44).
// `body` is drawn after the hair that falls behind the head, so long hair sits behind the shoulders.
export function Head({ l, body }: { l: Look; body?: ReactNode }) {
  const brow = l.hair === '#A9A9A9' ? '#7D7D7D' : l.hair;
  return (
    <G>
      {/* hair behind the head */}
      {l.back === 'afro' && <Circle cx={50} cy={36} r={28} fill={l.hair} />}
      {l.back === 'long' && <Path d="M29 46 C26 12 74 12 71 46 L73 80 L27 80 Z" fill={l.hair} />}
      {l.back === 'bob' && <Path d="M30 54 C26 14 74 14 70 54 L70 61 L30 61 Z" fill={l.hair} />}
      {l.back === 'bun' && <Circle cx={50} cy={13} r={9} fill={l.hair} />}
      {body}
      {/* neck */}
      <Rect x={43} y={57} width={14} height={16} rx={4} fill={l.skin} />
      {/* head */}
      <Ellipse cx={33.5} cy={46} rx={3.5} ry={5} fill={l.skin} />
      <Ellipse cx={66.5} cy={46} rx={3.5} ry={5} fill={l.skin} />
      <Ellipse cx={50} cy={44} rx={17} ry={20} fill={l.skin} />
      {/* hair in front */}
      <Path d={FRONT[l.front]} fill={l.hair} />
      {l.front === 'curls' && (
        <G fill={l.hair}>
          <Circle cx={35} cy={26} r={6} /><Circle cx={42} cy={19} r={6} /><Circle cx={50} cy={16} r={6} />
          <Circle cx={58} cy={19} r={6} /><Circle cx={65} cy={26} r={6} />
        </G>
      )}
      {l.front === 'swept' && (
        <Path d="M38 22 C44 13 58 13 64 21" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      )}
      {/* face */}
      <Path d="M40 39.5 Q43 38 46 39.5" stroke={brow} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M54 39.5 Q57 38 60 39.5" stroke={brow} strokeWidth={1.6} fill="none" strokeLinecap="round" />
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
    </G>
  );
}

export default function Avatar({ coach, size = 72 }: { coach: string; size?: number }) {
  const l = LOOKS[coach];
  if (!l) return null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={l.alt} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={50} fill={l.bg} />
        <Head l={l} body={<Path d="M14 100 C14 80 30 71 50 71 C70 71 86 80 86 100 Z" fill={l.shirt} />} />
        <Path d="M43 71 L50 78 L57 71" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} />
      </Svg>
    </View>
  );
}
