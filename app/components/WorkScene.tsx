// Cartoon scenes of job seekers at work for the opening page: food service, construction, and office.
// Drawn in code in the same style as the coach portraits (components/Avatar.tsx), so there are no photo
// licenses to track and they stay sharp at any size. Each scene has alt text for screen readers.
import { View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { Head, Look } from './Avatar';

export type SceneKind = 'kitchen' | 'construction' | 'office';

export const SCENES: { kind: SceneKind; alt: string }[] = [
  { kind: 'kitchen', alt: 'Illustration of a woman in an apron and gloves cooking at a restaurant stove' },
  { kind: 'construction', alt: 'Illustration of a construction worker in a yellow hard hat and safety vest taking a coffee break on site' },
  { kind: 'office', alt: 'Illustration of a man working on a laptop at his office desk' },
];

// The person's head sits at the center of a 300 by 200 scene; the head box is 100 by 100.
const HEAD_AT = 'translate(100 22)';
const torso = (fill: string) => <Path d="M104 200 C104 124 122 93 150 93 C178 93 196 124 196 200 Z" fill={fill} />;
const steam = (xs: number[], y: number) => (
  <G stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={3} fill="none" strokeLinecap="round">
    {xs.map((x) => <Path key={x} d={`M${x} ${y} C${x - 6} ${y - 8} ${x + 6} ${y - 14} ${x} ${y - 22}`} />)}
  </G>
);

function Kitchen() {
  const l: Look = { skin: '#8D5A3B', hair: '#2A1A12', shirt: '#3A56A6', bg: '', alt: '', back: 'bun', front: 'part' };
  return (
    <G>
      <Rect width={300} height={200} fill="#FDEBDD" />
      <G stroke="#F3D3BE" strokeWidth={2}><Line x1={0} y1={44} x2={300} y2={44} /><Line x1={0} y1={88} x2={300} y2={88} /><Line x1={0} y1={132} x2={300} y2={132} /></G>
      {/* shelf with jars */}
      <Rect x={14} y={70} width={72} height={5} fill="#C08A5E" />
      <Rect x={20} y={52} width={14} height={18} rx={3} fill="#F5C518" />
      <Rect x={40} y={48} width={14} height={22} rx={3} fill="#D71F2D" />
      <Rect x={60} y={54} width={14} height={16} rx={3} fill="#3E8E5A" />
      <G transform={HEAD_AT}>
        <Head l={l} body={
          <G transform="translate(-100 -22)">
            {torso(l.shirt)}
            {/* apron */}
            <Path d="M128 112 L172 112 L180 200 L120 200 Z" fill="#FFFFFF" />
            <G stroke="#FFFFFF" strokeWidth={4}><Line x1={131} y1={113} x2={140} y2={96} /><Line x1={169} y1={113} x2={160} y2={96} /></G>
            {/* arms reaching to the stove, in blue gloves */}
            <Path d="M188 116 C204 132 214 142 226 146" stroke={l.shirt} strokeWidth={16} strokeLinecap="round" fill="none" />
            <Path d="M112 116 C100 136 104 150 116 154" stroke={l.shirt} strokeWidth={16} strokeLinecap="round" fill="none" />
          </G>
        } />
      </G>
      {/* counter, cutting board, pan */}
      <Rect x={0} y={158} width={300} height={42} fill="#9AA3B2" />
      <Rect x={0} y={155} width={300} height={6} fill="#C3C9D3" />
      <Rect x={28} y={149} width={66} height={8} rx={3} fill="#C08A5E" />
      <Circle cx={46} cy={144} r={7} fill="#D71F2D" />
      <Circle cx={64} cy={145} r={6} fill="#3E8E5A" />
      <Circle cx={80} cy={146} r={5} fill="#F57C1F" />
      <Ellipse cx={250} cy={155} rx={30} ry={8} fill="#2E2E2E" />
      <Line x1={278} y1={154} x2={298} y2={149} stroke="#2E2E2E" strokeWidth={5} strokeLinecap="round" />
      <Circle cx={242} cy={152} r={4} fill="#F5C518" /><Circle cx={256} cy={153} r={4} fill="#F57C1F" />
      {steam([238, 252, 266], 144)}
      <Line x1={230} y1={147} x2={250} y2={156} stroke="#555555" strokeWidth={3} strokeLinecap="round" />
      <Circle cx={228} cy={146} r={8} fill="#4FA3D9" />
      <Circle cx={118} cy={154} r={8} fill="#4FA3D9" />
    </G>
  );
}

function Construction() {
  const l: Look = { skin: '#C58C5C', hair: '#3B2416', shirt: '#5A6372', bg: '', alt: '', front: 'short', beard: true };
  return (
    <G>
      <Rect width={300} height={200} fill="#DCEAF7" />
      <Circle cx={268} cy={30} r={15} fill="#FFE08A" />
      {/* steel frame of a building going up */}
      <G stroke="#D71F2D" strokeWidth={5}>
        <Line x1={18} y1={56} x2={18} y2={180} /><Line x1={62} y1={56} x2={62} y2={180} />
        <Line x1={14} y1={60} x2={66} y2={60} /><Line x1={14} y1={100} x2={66} y2={100} /><Line x1={14} y1={140} x2={66} y2={140} />
      </G>
      {/* crane */}
      <G stroke="#F5C518" strokeWidth={6} strokeLinecap="round">
        <Line x1={250} y1={44} x2={250} y2={180} /><Line x1={204} y1={46} x2={296} y2={46} />
      </G>
      <Line x1={214} y1={46} x2={214} y2={84} stroke="#444444" strokeWidth={2} />
      <Rect x={207} y={84} width={14} height={8} rx={2} fill="#444444" />
      <Rect x={0} y={172} width={300} height={28} fill="#CDB892" />
      <G transform={HEAD_AT}>
        <Head l={l} body={
          <G transform="translate(-100 -22)">
            {torso(l.shirt)}
            {/* safety vest with reflective stripes */}
            <Path d="M116 110 L144 100 L146 200 L110 200 Z" fill="#F57C1F" />
            <Path d="M184 110 L156 100 L154 200 L190 200 Z" fill="#F57C1F" />
            <G fill="#EDEDED"><Rect x={111} y={140} width={35} height={6} /><Rect x={154} y={140} width={35} height={6} />
              <Rect x={110} y={164} width={36} height={6} /><Rect x={154} y={164} width={36} height={6} /></G>
            <Path d="M112 116 C104 140 104 160 108 178" stroke={l.shirt} strokeWidth={16} strokeLinecap="round" fill="none" />
            <Path d="M188 116 C200 140 196 156 180 158" stroke={l.shirt} strokeWidth={16} strokeLinecap="round" fill="none" />
          </G>
        } />
        {/* hard hat over a full head of hair */}
        <Path d="M31 36 C31 10 69 10 69 36 Z" fill="#F5C518" />
        <Rect x={25} y={33} width={50} height={6} rx={3} fill="#E0B000" />
        <Line x1={50} y1={14} x2={50} y2={33} stroke="#E0B000" strokeWidth={3} />
      </G>
      {/* coffee cup */}
      <Rect x={168} y={138} width={16} height={20} rx={2} fill="#FFFFFF" />
      <Rect x={166} y={135} width={20} height={5} rx={2} fill="#8A5A3C" />
      {steam([176], 130)}
      <Circle cx={178} cy={158} r={7} fill={l.skin} />
      <Circle cx={108} cy={180} r={7} fill={l.skin} />
    </G>
  );
}

function Office() {
  const l: Look = { skin: '#5C3A24', hair: '#111111', shirt: '#2B4080', bg: '', alt: '', front: 'short' };
  return (
    <G>
      <Rect width={300} height={200} fill="#E6EDF8" />
      {/* window with a city view */}
      <Rect x={214} y={22} width={72} height={92} rx={4} fill="#BFD8F2" stroke="#FFFFFF" strokeWidth={5} />
      <G fill="#9FBBDB"><Rect x={220} y={78} width={14} height={34} /><Rect x={238} y={64} width={16} height={48} /><Rect x={258} y={84} width={22} height={28} /></G>
      <Line x1={250} y1={22} x2={250} y2={114} stroke="#FFFFFF" strokeWidth={4} />
      {/* plant */}
      <G fill="#3E8E5A"><Ellipse cx={34} cy={112} rx={8} ry={18} /><Ellipse cx={48} cy={104} rx={8} ry={22} /><Ellipse cx={60} cy={114} rx={8} ry={16} /></G>
      <Rect x={30} y={124} width={34} height={26} rx={3} fill="#D71F2D" />
      <G transform={HEAD_AT}>
        <Head l={l} body={
          <G transform="translate(-100 -22)">
            {torso(l.shirt)}
            <Path d="M140 96 L150 110 L160 96" fill="none" stroke="#FFFFFF" strokeWidth={4} />
            <Path d="M112 116 C104 132 106 142 112 148" stroke={l.shirt} strokeWidth={16} strokeLinecap="round" fill="none" />
            <Path d="M188 116 C196 132 194 142 188 148" stroke={l.shirt} strokeWidth={16} strokeLinecap="round" fill="none" />
          </G>
        } />
      </G>
      {/* desk, laptop, mug */}
      <Rect x={0} y={152} width={300} height={48} fill="#A0714F" />
      <Rect x={0} y={148} width={300} height={7} fill="#B98560" />
      <Path d="M118 104 L182 104 L186 148 L114 148 Z" fill="#C9CED6" />
      <Circle cx={150} cy={126} r={5} fill="#FFFFFF" />
      <Rect x={104} y={146} width={92} height={5} rx={2} fill="#AEB4BE" />
      <Circle cx={112} cy={148} r={7} fill={l.skin} />
      <Circle cx={188} cy={148} r={7} fill={l.skin} />
      <Rect x={222} y={126} width={20} height={22} rx={3} fill="#FFFFFF" />
      <Circle cx={244} cy={136} r={6} fill="none" stroke="#FFFFFF" strokeWidth={3} />
      {steam([232], 120)}
    </G>
  );
}

export default function WorkScene({ kind, alt, style }: { kind: SceneKind; alt: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={alt} style={[{ overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
        {kind === 'kitchen' && <Kitchen />}
        {kind === 'construction' && <Construction />}
        {kind === 'office' && <Office />}
      </Svg>
    </View>
  );
}
