// Buttons that open Indeed's and LinkedIn's own job search, filled in with the applicant's target job and city.
// Neither site lets outside apps search or read its listings, so the applicant browses there, then pastes a job
// into "Check any job" to see their chances. (Many of their listings also arrive through Google Jobs.)
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Profile } from '../api';
import { colors, radius, space, type } from '../theme';

export function searchTerms(profile: Profile) {
  const role = (profile.target_roles as string[] | undefined)?.[0] || (profile.experience as { title?: string }[] | undefined)?.[0]?.title || '';
  const city = String(profile.city || '');
  return { role, city };
}

export default function SearchElsewhere({ profile, note }: { profile: Profile; note?: string }) {
  const { role, city } = searchTerms(profile);
  const q = encodeURIComponent(role), l = encodeURIComponent(city);
  const sites = [
    { name: 'Indeed', url: `https://www.indeed.com/jobs?q=${q}&l=${l}` },
    { name: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}` },
  ];
  return (
    <View style={styles.wrap}>
      <Text style={type.small}>{note ?? `Search more jobs${role ? ` for "${role}"` : ''}${city ? ` near ${city}` : ''}:`}</Text>
      <View style={styles.row}>
        {sites.map((s) => (
          <Pressable key={s.name} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={() => Linking.openURL(s.url)}
            accessibilityRole="link" accessibilityLabel={`Search ${s.name} for ${role || 'jobs'}${city ? ` near ${city}` : ''}. Opens ${s.name}.`}>
            <Text style={styles.btnText}>Search {s.name} ↗</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  btn: { flexGrow: 1, minHeight: 52, borderRadius: radius, borderWidth: 2, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  btnText: { fontSize: 18, fontWeight: '700', color: colors.blue },
});
