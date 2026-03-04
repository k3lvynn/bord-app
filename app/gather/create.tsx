// app/gather/create.tsx
// Template-based Gather event quick-create.
// Pre-fills fields from the chosen template, user just tweaks and publishes.

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { spacing, radius, colors } from '../../lib/theme';
import {
  createEvent,
  GATHER_TEMPLATES, VIBES, INTEREST_TAGS, LOOKING_FOR_OPTIONS,
  BRING_OPTIONS,
} from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const G = {
  bg: '#0F0E0D', card: '#1A1815', border: '#2A2622',
  lavender: '#9B8EC4', text: '#E8E0D8', sub: '#8C8178',
};

export default function GatherCreateScreen() {
  const { template: templateKey } = useLocalSearchParams<{ template: string }>();
  const { user, profile } = useAuth();

  const tmpl = GATHER_TEMPLATES.find(t => t.key === templateKey) ?? GATHER_TEMPLATES[0];

  const [title,       setTitle]       = useState(tmpl.label);
  const [description, setDescription] = useState('');
  const [location,    setLocation]    = useState('');
  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [cap,         setCap]         = useState(String(tmpl.cap));
  const [vibe,        setVibe]        = useState(tmpl.vibe);
  const [tags,        setTags]        = useState<string[]>(tmpl.tags);
  const [lookingFor,  setLookingFor]  = useState<string[]>([]);
  const [bringOpts,   setBringOpts]   = useState<string[]>([]);
  const [anonRsvp,    setAnonRsvp]    = useState(false);
  const [loading,     setLoading]     = useState(false);

  const toggleTag     = (t: string)  => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleLF      = (k: string)  => setLookingFor(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  const toggleBring   = (k: string)  => setBringOpts(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  // Build a slug from title
  const makeSlug = (t: string) =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' + Math.random().toString(36).slice(2, 6);

  const handlePublish = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if (!location.trim()) { Alert.alert('Location required'); return; }
    if (!date.trim()) { Alert.alert('Date required (YYYY-MM-DD)'); return; }
    if (!time.trim()) { Alert.alert('Time required (HH:MM)'); return; }
    if (!user) { Alert.alert('Sign in required'); return; }

    setLoading(true);
    try {
      const ev = await createEvent({
        host_id:           user.id,
        title:             title.trim(),
        description:       description.trim() || null,
        location:          location.trim(),
        date,
        time,
        end_time:          null,
        category:          'social',
        has_buy_in:        false,
        buy_in_amount:     null,
        cap:               parseInt(cap, 10) || tmpl.cap,
        is_active:         true,
        slug:              makeSlug(title),
        recurrence:        'none',
        is_private:        false,
        is_tournament:     false,
        // Gather-specific
        vibe,
        interest_tags:     tags,
        looking_for_tags:  lookingFor,
        bring_options:     bringOpts,
        is_anonymous_rsvp: anonRsvp,
        template_type:     templateKey ?? tmpl.key,
      });
      router.replace(`/event/${ev.slug}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create event');
    } finally {
      setLoading(false);
    }
  };

  const vibeInfo = VIBES.find(v => v.key === vibe);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>{tmpl.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{tmpl.label}</Text>
            <Text style={styles.headerSub}>Quick Gather event</Text>
          </View>
        </View>

        {/* Vibe selector */}
        <Text style={styles.label}>VIBE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: spacing.md }}>
          {VIBES.map(v => (
            <TouchableOpacity
              key={v.key}
              style={[styles.vibeChip, vibe === v.key && { borderColor: v.color, backgroundColor: v.color + '20' }]}
              onPress={() => setVibe(v.key)} activeOpacity={0.7}
            >
              <Text style={styles.vibeEmoji}>{v.emoji}</Text>
              <Text style={[styles.vibeChipText, vibe === v.key && { color: v.color }]}>{v.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Title */}
        <Text style={styles.label}>EVENT TITLE</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Give it a name"
          placeholderTextColor={G.sub}
          maxLength={60}
        />

        {/* Description */}
        <Text style={styles.label}>DESCRIPTION (optional)</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          placeholder="What's the vibe? Who should come?"
          placeholderTextColor={G.sub}
          multiline
          maxLength={300}
        />

        {/* Location */}
        <Text style={styles.label}>LOCATION</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Park, coffee shop, address…"
          placeholderTextColor={G.sub}
        />

        {/* Date + Time */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>DATE</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={G.sub}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TIME</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor={G.sub}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* Max people */}
        <Text style={styles.label}>MAX PEOPLE</Text>
        <TextInput
          style={styles.input}
          value={cap}
          onChangeText={setCap}
          keyboardType="number-pad"
          placeholder="e.g. 8"
          placeholderTextColor={G.sub}
        />
        <Text style={styles.hint}>Suggested for {tmpl.label}: {tmpl.cap}</Text>

        {/* Interest tags */}
        <Text style={styles.label}>INTEREST TAGS</Text>
        <View style={styles.tagGrid}>
          {INTEREST_TAGS.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tagChip, tags.includes(t) && styles.tagChipActive]}
              onPress={() => toggleTag(t)} activeOpacity={0.7}
            >
              <Text style={[styles.tagChipText, tags.includes(t) && styles.tagChipTextActive]}>#{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Looking for */}
          <Text style={styles.label}>WHO IS THIS FOR?</Text>
        <View style={styles.optionRow}>
          {LOOKING_FOR_OPTIONS.map(l => (
            <TouchableOpacity
              key={l.key}
              style={[styles.optChip, lookingFor.includes(l.key) && styles.optChipActive]}
              onPress={() => toggleLF(l.key)} activeOpacity={0.7}
            >
              <Text style={styles.optChipEmoji}>{l.emoji}</Text>
              <Text style={[styles.optChipText, lookingFor.includes(l.key) && styles.optChipTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bring something */}
        <Text style={styles.label}>ATTENDEES CAN BRING</Text>
          <Text style={styles.hint}>{"Optional -- attendees select what they'll contribute"}</Text>
        <View style={styles.optionRow}>
          {BRING_OPTIONS.map(b => (
            <TouchableOpacity
              key={b.key}
              style={[styles.optChip, bringOpts.includes(b.key) && styles.optChipActive]}
              onPress={() => toggleBring(b.key)} activeOpacity={0.7}
            >
              <Text style={styles.optChipEmoji}>{b.emoji}</Text>
              <Text style={[styles.optChipText, bringOpts.includes(b.key) && styles.optChipTextActive]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Anonymous RSVP */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Anonymous headcount</Text>
            <Text style={styles.switchSub}>Show "12 going" — hide attendee names until 24hrs before</Text>
          </View>
          <Switch
            value={anonRsvp}
            onValueChange={setAnonRsvp}
            trackColor={{ false: G.border, true: G.lavender }}
            thumbColor={colors.white}
          />
        </View>

        {/* Safety note */}
        <View style={styles.safetyNote}>
          <Text style={styles.safetyNoteEmoji}>🛡️</Text>
          <Text style={styles.safetyNoteText}>
            A safety briefing will be shown to attendees before they RSVP — reminding them to share their location with a friend and meet in public.
          </Text>
        </View>

        {/* Publish */}
        <TouchableOpacity
          style={[styles.publishBtn, loading && { opacity: 0.5 }]}
          onPress={handlePublish}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.publishBtnText}>Publish Event →</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: G.bg },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  emoji:  { fontSize: 40 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: G.text },
  headerSub:   { fontSize: 12, color: G.sub, marginTop: 2 },

  label: { fontSize: 10, fontWeight: '700', color: G.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: spacing.md },
  hint:  { fontSize: 11, color: G.sub, marginTop: 4, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: G.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: G.text, fontSize: 15, fontWeight: '500',
  },
  row: { flexDirection: 'row', gap: spacing.sm },

  vibeChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  vibeEmoji:    { fontSize: 14 },
  vibeChipText: { fontSize: 12, fontWeight: '600', color: G.sub },

  tagGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.sm },
  tagChip:         { backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  tagChipActive:   { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  tagChipText:     { fontSize: 12, color: G.sub, fontWeight: '500' },
  tagChipTextActive:{ color: G.lavender },

  optionRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  optChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  optChipActive: { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  optChipEmoji:  { fontSize: 15 },
  optChipText:   { fontSize: 13, color: G.sub, fontWeight: '500' },
  optChipTextActive: { color: G.lavender },

  switchRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  switchLabel: { fontSize: 15, fontWeight: '600', color: G.text, marginBottom: 3 },
  switchSub:   { fontSize: 12, color: G.sub, lineHeight: 17 },

  safetyNote: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(52,211,153,0.06)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.2)',
    borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md,
  },
  safetyNoteEmoji: { fontSize: 20 },
  safetyNoteText:  { flex: 1, fontSize: 12, color: '#34D399', lineHeight: 18 },

  publishBtn: { backgroundColor: G.lavender, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.xl },
  publishBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelBtn:  { alignItems: 'center', paddingVertical: spacing.md },
  cancelBtnText: { color: G.sub, fontSize: 14 },
});
