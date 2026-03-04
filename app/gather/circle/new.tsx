// app/gather/circle/new.tsx
// Create a new Gather Circle — a small standing community group.

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { spacing, radius, colors } from '../../../lib/theme';
import { createCircle, INTEREST_TAGS } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';

const G = {
  bg: '#0F0E0D', card: '#1A1815', border: '#2A2622',
  lavender: '#9B8EC4', text: '#E8E0D8', sub: '#8C8178',
};

const CIRCLE_EMOJIS = [
  '⭕','🌀','🔵','🟣','🟤','🌸','🌿','☕','🏃','🎲','📸','🎨','🎵','📚','✈️',
  '🏋️','🧘','🌅','🎯','🐾','🌱','💡','🤝','🏠','🌙',
];

export default function NewCircle() {
  const { user } = useAuth();
  const [name,        setName]        = useState('');
  const [emoji,       setEmoji]       = useState('⭕');
  const [description, setDescription] = useState('');
  const [tag,         setTag]         = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    if (!user) { Alert.alert('Sign in required'); return; }
    setLoading(true);
    try {
      const circle = await createCircle({
        name: name.trim(),
        emoji,
        description: description.trim() || undefined,
        interest_tag: tag ?? undefined,
        creator_id: user.id,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create circle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.headerTitle}>Start a Circle</Text>
        <Text style={styles.headerSub}>A small standing group for people who share your interests</Text>

        {/* Emoji */}
        <Text style={styles.label}>CIRCLE ICON</Text>
        <View style={styles.selectedEmoji}>
          <Text style={{ fontSize: 48 }}>{emoji}</Text>
        </View>
        <FlatList
          data={CIRCLE_EMOJIS}
          numColumns={8}
          keyExtractor={item => item}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.emojiBtn, item === emoji && styles.emojiBtnActive]}
              onPress={() => setEmoji(item)} activeOpacity={0.7}
            >
              <Text style={{ fontSize: 22 }}>{item}</Text>
            </TouchableOpacity>
          )}
        />

        {/* Name */}
        <Text style={styles.label}>CIRCLE NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekend Hikers, Late Night Cooks…"
          placeholderTextColor={G.sub}
          maxLength={40}
          autoCapitalize="words"
        />

        {/* Description */}
        <Text style={styles.label}>DESCRIPTION (optional)</Text>
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          placeholder="What's this circle about?"
          placeholderTextColor={G.sub}
          multiline
          maxLength={200}
        />

        {/* Interest tag */}
        <Text style={styles.label}>PRIMARY INTEREST</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, marginBottom: spacing.md }}>
          {INTEREST_TAGS.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tagChip, tag === t && styles.tagChipActive]}
              onPress={() => setTag(tag === t ? null : t)} activeOpacity={0.7}
            >
              <Text style={[styles.tagChipText, tag === t && styles.tagChipTextActive]}>#{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.5 }]}
          onPress={handleCreate} disabled={loading} activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.createBtnText}>Create Circle →</Text>
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
  headerTitle: { fontSize: 26, fontWeight: '800', color: G.text, paddingTop: spacing.lg },
  headerSub:   { fontSize: 13, color: G.sub, marginBottom: spacing.md },
  label: { fontSize: 10, fontWeight: '700', color: G.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: spacing.md },
  selectedEmoji: { alignItems: 'center', paddingVertical: spacing.md },
  emojiBtn:       { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 3, borderRadius: radius.sm, backgroundColor: G.card, borderWidth: 1, borderColor: G.border },
  emojiBtnActive: { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: G.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: G.text, fontSize: 15, fontWeight: '500',
  },
  tagChip:          { backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  tagChipActive:    { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  tagChipText:      { fontSize: 12, color: G.sub, fontWeight: '500' },
  tagChipTextActive:{ color: G.lavender },
  createBtn:    { backgroundColor: G.lavender, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.xl },
  createBtnText:{ color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelBtn:    { alignItems: 'center', paddingVertical: spacing.md },
  cancelBtnText:{ color: G.sub, fontSize: 14 },
});
