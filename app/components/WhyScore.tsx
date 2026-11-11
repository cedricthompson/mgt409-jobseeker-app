// "Why this score?": feedback on one job. Shows each requirement the job needs, checked against the applicant's
// own background (skills you have, with the evidence, and skills to build), which O*NET occupation the job was
// compared with, and then the full breakdown of the score and chances.
import { Text, View } from 'react-native';
import { colors, space, type, themed } from '../theme';
import { Card, ScoreDetails } from './Chances';

export default function WhyScore({ card }: { card: Card }) {
  const reqs = card.requirements ?? [];
  const have = reqs.filter((r) => r.have), need = reqs.filter((r) => !r.have);
  return (
    <View style={styles.panel}>
      <Text style={styles.title} role="heading" aria-level={3}>Why you got this score</Text>
      {card.explanation ? <Text style={type.body}>{card.explanation}</Text> : null}

      {reqs.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text style={styles.sub} role="heading" aria-level={4}>
            Skills check: you have {have.length} of {reqs.length}
          </Text>
          {have.length > 0 && (
            <View style={[styles.list, { borderLeftColor: colors.green }]}>
              <Text style={[styles.listTitle, { color: colors.green }]}>✓ Skills you have</Text>
              {have.map((r) => (
                <Text key={r.skill} style={type.small} accessibilityLabel={`You have ${r.skill}. ${r.evidence}`}>
                  <Text style={styles.skill}>{r.skill}</Text>{r.evidence ? ` — ${r.evidence}` : ''}{r.from === 'onet' ? ' (O*NET)' : ''}
                </Text>
              ))}
            </View>
          )}
          {need.length > 0 && (
            <View style={[styles.list, { borderLeftColor: colors.orange }]}>
              <Text style={[styles.listTitle, { color: colors.orange }]}>✕ Skills to build or show</Text>
              {need.map((r) => (
                <Text key={r.skill} style={type.small} accessibilityLabel={`Missing or not shown: ${r.skill}. ${r.evidence}`}>
                  <Text style={styles.skill}>{r.skill}</Text>{r.evidence ? ` — ${r.evidence}` : ''}{r.from === 'onet' ? ' (O*NET)' : ''}
                </Text>
              ))}
              <Text style={styles.hint}>If you have one of these, add it to your profile in your own words. It will count the next time you search.</Text>
            </View>
          )}
          <Text style={styles.hint}>
            Requirements come from this job's description{card.occupation ? `, plus core skills from O*NET's profile of ${card.occupation.title}` : ''}.
            {' '}O*NET is the U.S. Department of Labor's database of the skills each occupation needs.
          </Text>
        </View>
      )}

      <ScoreDetails card={card} />
    </View>
  );
}

const styles = themed(() => ({
  panel: { gap: space.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 18, fontWeight: '800', color: colors.ink },
  list: { borderLeftWidth: 5, borderRadius: 8, backgroundColor: colors.tint, padding: space.md, gap: 6 },
  listTitle: { fontSize: 17, fontWeight: '800' },
  skill: { fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, lineHeight: 20, color: colors.muted },
}));
