import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isDue, Outcome, Stage, STAGES, TrackedJob, useTracker } from '../tracker';
import { colors, radius, space, type } from '../theme';

const OUTCOMES: Outcome[] = ['Accepted', 'Rejected', 'Withdrew', 'No response'];
const NEXT: Partial<Record<Stage, Stage>> = { Saved: 'Applied', Applied: 'Screening', Screening: 'Interviewing', Interviewing: 'Offer' };

function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

function Item({ t, tracker }: { t: TrackedJob; tracker: ReturnType<typeof useTracker> }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(t.notes);
  const due = isDue(t);
  const next = NEXT[t.stage];

  return (
    <View style={[styles.card, due && { borderColor: colors.red }]}>
      <View style={{ gap: 2 }}>
        <Text style={styles.jobTitle} role="heading" aria-level={3}>{t.job.title}</Text>
        <Text style={type.small}>{[t.job.company, t.job.city].filter(Boolean).join(' · ')}</Text>
        <Text style={type.small}>
          {t.appliedAt ? `Applied ${t.appliedAt}` : `Saved ${t.savedAt}`}
          {t.score?.overall != null ? ` · Score ${t.score.overall}/100` : ''}
          {t.outcome ? ` · ${t.outcome}` : ''}
        </Text>
        {t.followUp && (
          <Text style={[styles.follow, due && { color: colors.red }]} role={due ? 'alert' : undefined}>
            {due ? `Follow up today (planned ${t.followUp})` : `Follow up on ${t.followUp}`}
          </Text>
        )}
      </View>

      {next && (
        <Pressable style={styles.primary} onPress={() => tracker.move(t.id, next)} accessibilityRole="button" accessibilityLabel={`Move to ${next}`}>
          <Text style={styles.primaryText}>Move to {next}</Text>
        </Pressable>
      )}

      {editing ? (
        <View style={{ gap: space.sm }}>
          <Text style={styles.label}>Stage</Text>
          <View style={styles.chips}>
            {STAGES.filter((s) => s !== 'Closed').map((s) => <Chip key={s} label={s} selected={t.stage === s} onPress={() => tracker.move(t.id, s)} />)}
          </View>
          <Text style={styles.label}>Close it out</Text>
          <View style={styles.chips}>
            {OUTCOMES.map((o) => <Chip key={o} label={o} selected={t.outcome === o} onPress={() => tracker.move(t.id, 'Closed', o)} />)}
          </View>
          <Text style={styles.label} nativeID={`notes-${t.id}`}>Notes (contacts, interview dates, questions)</Text>
          <TextInput
            style={styles.notes}
            multiline
            value={notes}
            onChangeText={setNotes}
            onBlur={() => tracker.update(t.id, { notes })}
            aria-labelledby={`notes-${t.id}`}
            accessibilityLabel="Notes"
          />
          <View style={styles.chips}>
            <Chip label="Done" onPress={() => { tracker.update(t.id, { notes }); setEditing(false); }} />
            <Chip label="Remove from tracker" onPress={() => tracker.remove(t.id)} />
          </View>
        </View>
      ) : (
        <View style={styles.chips}>
          <Chip label="Update" onPress={() => setEditing(true)} />
          {t.job.url ? <Chip label="Open posting" onPress={() => Linking.openURL(t.job.url!)} /> : null}
        </View>
      )}
      {!editing && t.notes ? <Text style={type.small}>Notes: {t.notes}</Text> : null}
    </View>
  );
}

export default function TrackerScreen({ onBack }: { onBack: () => void }) {
  const tracker = useTracker();
  const dueCount = tracker.items.filter(isDue).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} role="heading" aria-level={1}>My applications</Text>
        <Text style={type.small}>Saved on this device only. {dueCount > 0 ? `${dueCount} follow-up${dueCount > 1 ? 's' : ''} due.` : ''}</Text>

        {!tracker.ready && <ActivityIndicator color={colors.blue} />}
        {tracker.ready && tracker.items.length === 0 && (
          <Text style={type.body}>Nothing here yet. Save a job from your matches to start tracking it.</Text>
        )}

        {STAGES.map((stage) => {
          const list = tracker.items.filter((t) => t.stage === stage);
          if (!list.length) return null;
          return (
            <View key={stage} style={{ gap: space.sm }}>
              <Text style={styles.stage} role="heading" aria-level={2}>{stage} ({list.length})</Text>
              {list.map((t) => <Item key={t.id} t={t} tracker={tracker} />)}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: { padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 18, color: colors.blue, fontWeight: '600' },
  title: { ...type.title, color: colors.red },
  stage: { ...type.heading, color: colors.blue, marginTop: space.sm },
  card: { borderWidth: 2, borderColor: colors.line, borderRadius: radius, padding: space.md, gap: space.sm },
  jobTitle: { fontSize: 19, fontWeight: '700', color: colors.ink },
  follow: { fontSize: 16, fontWeight: '700', color: colors.blue },
  primary: { backgroundColor: colors.blue, minHeight: 48, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 48, paddingHorizontal: space.md, borderRadius: 24, borderWidth: 2, borderColor: colors.blue, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontSize: 16, fontWeight: '600', color: colors.blue },
  label: { fontSize: 16, fontWeight: '700', color: colors.ink },
  notes: { minHeight: 90, borderWidth: 2, borderColor: colors.ink, borderRadius: radius, padding: space.sm, fontSize: 17, color: colors.ink, textAlignVertical: 'top' },
});
