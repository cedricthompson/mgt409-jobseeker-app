// "Your coaches" key on the matches page: tap a coach to talk with them again and update your profile,
// then your matches refresh. A side panel on wide screens, a scrolling row of portraits on phones.
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colors, space, type, themed } from '../theme';
import { TEAM } from '../team';
import Avatar from './Avatar';

// What each coach can help change from here, in a few words.
export const CAN_HELP: Record<string, string> = {
  intake: 'Location, commute, work style, and pay',
  gap: 'Skills and certifications you haven\'t mentioned',
  matcher: 'The kinds of jobs and titles to search',
  scorecard: 'What\'s lowering your chances, and what to change',
  coach: 'How your experience and results come across',
};

// One-word topic under each portrait on phones.
const TOPIC: Record<string, string> = { intake: 'Basics', gap: 'Skills', matcher: 'Job types', scorecard: 'Chances', coach: 'Resume' };

export default function CoachKey({ onCoach, wide }: { onCoach: (coach: string) => void; wide: boolean }) {
  const items = TEAM.map((c) => (
    <Pressable
      key={c.key}
      onPress={() => onCoach(c.key)}
      style={({ pressed }) => [wide ? styles.row : styles.chip, pressed && { backgroundColor: colors.tint }]}
      accessibilityRole="button"
      accessibilityLabel={`Talk with ${c.name}, ${c.role}: ${CAN_HELP[c.key]}`}
    >
      <Avatar coach={c.key} size={wide ? 52 : 56} />
      <View style={wide ? { flex: 1, gap: 2 } : { alignItems: 'center', gap: 2 }}>
        <Text style={styles.name}>{c.name}</Text>
        {wide ? <Text style={styles.help}>{CAN_HELP[c.key]}</Text> : <Text style={styles.role}>{TOPIC[c.key]}</Text>}
      </View>
    </Pressable>
  ));
  return (
    <View style={wide ? styles.panel : styles.strip} accessibilityLabel="Your coaches">
      <Text style={styles.title} role="heading" aria-level={2}>Talk with a coach</Text>
      <Text style={type.small}>Update what you're looking for, and your matches refresh with better chances.</Text>
      {wide ? <View style={{ gap: space.xs }}>{items}</View>
        : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>{items}</ScrollView>}
    </View>
  );
}

const styles = themed(() => ({
  panel: { width: 290, gap: space.sm, padding: space.md, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
    shadowColor: '#1A1A1A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  strip: { gap: space.sm, padding: space.md, borderRadius: 16, backgroundColor: colors.tint },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: 14, minHeight: 64 },
  chip: { width: 92, alignItems: 'center', gap: 4, padding: space.sm, borderRadius: 14, backgroundColor: colors.surface },
  name: { fontSize: 17, fontWeight: '800', color: colors.ink },
  help: { fontSize: 14, lineHeight: 19, color: colors.muted },
  role: { fontSize: 12, fontWeight: '700', color: colors.blue },
}));
