// app/profile/edit.tsx — profile editor with photo upload + email_hidden toggle

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Image, Switch,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import TagInput from '../../components/TagInput';

const EMOJIS = [
  '🏈','🎯','🎲','🎨','🎵','🍕','🌮','🏃','🤝','⭐',
  '🔥','💫','🎭','🎪','🌟','🦁','🐯','🦊','🎸','🏄',
  '🧠','🌈','🎤','🏋️','🧗','🚴','🏊','🧘','🎻','🌿',
];

const AGE_RANGES = [
  { key: 'under-18', label: 'Under 18' },
  { key: '18-24',    label: '18–24' },
  { key: '25-34',    label: '25–34' },
  { key: '35-44',    label: '35–44' },
  { key: '45-54',    label: '45–54' },
  { key: '55-plus',  label: '55+' },
];

export default function EditProfile() {
  const { profile, user, updateProfile } = useAuth();

  const [displayName,    setDisplayName]    = useState(profile?.display_name ?? '');
  const [bio,            setBio]            = useState(profile?.bio ?? '');
  const [location,       setLocation]       = useState(profile?.location ?? '');
  const [avatarEmoji,    setAvatarEmoji]    = useState(profile?.avatar_emoji ?? '⭐');
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(profile?.avatar_url ?? null);
  const [emailHidden,    setEmailHidden]    = useState(profile?.email_hidden ?? false);
  const [ageRange,       setAgeRange]       = useState<string>(profile?.age_range ?? '');
  const [preferredModes, setPreferredModes] = useState<string[]>(profile?.preferred_modes ?? []);
  const [selectedTags,   setSelectedTags]   = useState<string[]>(profile?.interest_tags ?? []);
  const [instagram,      setInstagram]      = useState(profile?.instagram_handle ?? '');
  const [twitter,        setTwitter]        = useState(profile?.twitter_handle ?? '');
  const [threads,        setThreads]        = useState(profile?.threads_handle ?? '');
  const [saving,         setSaving]         = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [focused,        setFocused]        = useState<string | null>(null);

  const inp = (f: string) => [styles.input, focused === f && styles.inputFocused];

  const toggleMode = (mode: string) =>
    setPreferredModes(prev =>
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,   // ← required on iOS: ph:// URIs can't be fetched directly
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert('Error', 'Could not read image data.'); return; }
    setUploading(true);
    try {
      const ext = (asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg').replace('jpeg','jpg');
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const path = `avatars/${user?.id ?? 'unknown'}.jpg`;
      // Decode base64 → Uint8Array for reliable upload on both iOS and Android
      const binary = atob(asset.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, bytes, { upsert: true, contentType: mime });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);
      // Cache-bust so the Image component picks up the new upload immediately
      setAvatarUrl(urlData.publicUrl + '?t=' + Date.now());
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert('Error', 'Could not read image data.'); return; }
    setUploading(true);
    try {
      const path = `avatars/${user?.id ?? 'unknown'}.jpg`;
      const binary = atob(asset.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl + '?t=' + Date.now());
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    setAvatarUrl(null);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Please enter your display name.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        display_name:     displayName.trim(),
        bio:              bio.trim() || null,
        location:         location.trim() || null,
        avatar_emoji:     avatarEmoji,
        avatar_url:       avatarUrl,
        email_hidden:     emailHidden,
        age_range:        ageRange || null,
        preferred_modes:  preferredModes,
        interest_tags:    selectedTags,
        instagram_handle: instagram.replace(/^@/, '').trim() || null,
        twitter_handle:   twitter.replace(/^@/, '').trim() || null,
        threads_handle:   threads.replace(/^@/, '').trim() || null,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.black }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Username (read-only) */}
        <View style={styles.readOnlyCard}>
          <Text style={styles.readOnlyLabel}>USERNAME (PERMANENT)</Text>
          <Text style={styles.readOnlyValue}>@{profile?.username}</Text>
          <Text style={styles.readOnlyNote}>Your username is your unique ID and cannot be changed.</Text>
        </View>

        {/* Profile Photo */}
        <Text style={styles.sectionLabel}>Profile Photo</Text>
        <View style={styles.photoSection}>
          {/* Current avatar preview */}
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.photoPreview} />
          ) : (
            <View style={styles.emojiPreview}>
              <Text style={{ fontSize: 44 }}>{avatarEmoji}</Text>
            </View>
          )}

          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.8} disabled={uploading}>
              {uploading
                ? <ActivityIndicator size="small" color={colors.orange} />
                : <Text style={styles.photoBtnText}>📷 Choose Photo</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.8} disabled={uploading}>
              <Text style={styles.photoBtnText}>📸 Take Photo</Text>
            </TouchableOpacity>
            {avatarUrl && (
              <TouchableOpacity style={styles.photoBtnRemove} onPress={removePhoto} activeOpacity={0.8}>
                <Text style={styles.photoBtnRemoveText}>Remove Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Emoji (fallback when no photo) */}
        {!avatarUrl && (
          <>
            <Text style={styles.sectionLabel}>Emoji Avatar <Text style={styles.optional}>(used when no photo)</Text></Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, avatarEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setAvatarEmoji(e)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Display Name */}
        <Text style={styles.sectionLabel}>Display Name</Text>
        <TextInput
          style={inp('name')} value={displayName} onChangeText={setDisplayName}
          placeholder="Your name" placeholderTextColor={colors.gray2}
          autoCapitalize="words"
          onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
        />

        {/* Bio */}
        <Text style={styles.sectionLabel}>Bio <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={[inp('bio'), styles.textArea]} value={bio} onChangeText={setBio}
          placeholder="Tell people a bit about yourself..."
          placeholderTextColor={colors.gray2}
          multiline numberOfLines={3} textAlignVertical="top"
          onFocus={() => setFocused('bio')} onBlur={() => setFocused(null)}
          maxLength={160}
        />
        <Text style={styles.charCount}>{bio.length}/160</Text>

        {/* Location */}
        <Text style={styles.sectionLabel}>City / Location <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={inp('loc')} value={location} onChangeText={setLocation}
          placeholder="San Diego, CA" placeholderTextColor={colors.gray2}
          onFocus={() => setFocused('loc')} onBlur={() => setFocused(null)}
        />

        {/* Privacy — email hidden */}
        <Text style={styles.sectionLabel}>Privacy</Text>
        <View style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Hide Email</Text>
            <Text style={styles.toggleSub}>Your email won{"'"}t appear on your profile</Text>
          </View>
          <Switch
            value={emailHidden}
            onValueChange={setEmailHidden}
            trackColor={{ false: colors.border, true: 'rgba(249,115,22,0.5)' }}
            thumbColor={emailHidden ? colors.orange : colors.gray2}
          />
        </View>

        {/* Age Range */}
        <Text style={styles.sectionLabel}>Age Range <Text style={styles.optional}>(optional)</Text></Text>
        <View style={styles.pillRow}>
          {AGE_RANGES.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.pill, ageRange === key && styles.pillActive]}
              onPress={() => setAgeRange(ageRange === key ? '' : key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillText, ageRange === key && styles.pillTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preferred Modes */}
        <Text style={styles.sectionLabel}>Preferred Mode</Text>
        <View style={styles.modeRow}>
          {([
            { key: 'compete', label: '🏆 Compete', color: colors.orange },
            { key: 'gather',  label: '🤝 Gather',  color: '#9B8EC4' },
          ] as const).map(({ key, label, color }) => {
            const active = preferredModes.includes(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.modePill, active && { borderColor: color, backgroundColor: color + '18' }]}
                onPress={() => toggleMode(key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.modePillText, active && { color }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Interest Tags */}
        <Text style={styles.sectionLabel}>
          Interests
          {selectedTags.length > 0 && <Text style={styles.tagCount}> ({selectedTags.length})</Text>}
        </Text>
        <TagInput
          selected={selectedTags}
          onChange={setSelectedTags}
          placeholder="Search or create tags… e.g. sunset-hikes"
        />

        {/* Social Links */}
        <Text style={styles.sectionLabel}>Social Links <Text style={styles.optional}>(optional)</Text></Text>
        <View style={styles.socialRow}>
          <Text style={styles.socialIcon}>📸</Text>
          <TextInput
            style={[inp('ig'), styles.socialInput]} value={instagram} onChangeText={setInstagram}
            placeholder="@instagram" placeholderTextColor={colors.gray2}
            autoCapitalize="none" autoCorrect={false}
            onFocus={() => setFocused('ig')} onBlur={() => setFocused(null)}
          />
        </View>
        <View style={styles.socialRow}>
          <Text style={styles.socialIcon}>𝕏</Text>
          <TextInput
            style={[inp('tw'), styles.socialInput]} value={twitter} onChangeText={setTwitter}
            placeholder="@x_handle" placeholderTextColor={colors.gray2}
            autoCapitalize="none" autoCorrect={false}
            onFocus={() => setFocused('tw')} onBlur={() => setFocused(null)}
          />
        </View>
        <View style={styles.socialRow}>
          <Text style={styles.socialIcon}>🧵</Text>
          <TextInput
            style={[inp('th'), styles.socialInput]} value={threads} onChangeText={setThreads}
            placeholder="@threads" placeholderTextColor={colors.gray2}
            autoCapitalize="none" autoCorrect={false}
            onFocus={() => setFocused('th')} onBlur={() => setFocused(null)}
          />
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave} disabled={saving} activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 80, paddingTop: spacing.md },

  readOnlyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  readOnlyLabel: { fontSize: 9, fontWeight: '700', color: colors.gray2, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  readOnlyValue: { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: 6 },
  readOnlyNote:  { fontSize: 12, color: colors.gray2, lineHeight: 17 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.gray2, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: spacing.lg },
  optional:  { fontWeight: '400', color: colors.gray2, textTransform: 'none', letterSpacing: 0 },
  tagCount:  { fontWeight: '700', color: '#9B8EC4', textTransform: 'none', letterSpacing: 0 },
  charCount: { fontSize: 11, color: colors.gray2, textAlign: 'right', marginTop: 4 },

  // Photo section
  photoSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  photoPreview: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(249,115,22,0.4)' },
  emojiPreview: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 2, borderColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoActions: { flex: 1, gap: 8 },
  photoBtn: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center',
  },
  photoBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  photoBtnRemove: {
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.sm, paddingVertical: 7, alignItems: 'center',
  },
  photoBtnRemoveText: { color: colors.red, fontWeight: '600', fontSize: 12 },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 48, height: 48, borderRadius: radius.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.12)' },
  emoji: { fontSize: 26 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 13,
    color: colors.white, fontSize: 15, fontWeight: '500',
  },
  inputFocused: { borderColor: 'rgba(249,115,22,0.5)' },
  textArea: { height: 90, paddingTop: 12 },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.white },
  toggleSub:   { fontSize: 12, color: colors.gray2, marginTop: 2 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive:     { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.1)' },
  pillText:       { fontSize: 14, color: colors.gray1, fontWeight: '500' },
  pillTextActive: { color: colors.orange, fontWeight: '700' },

  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modePill: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center',
  },
  modePillText: { fontSize: 15, fontWeight: '600', color: colors.gray1 },

  socialRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  socialIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  socialInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    color: colors.white, fontSize: 15, fontWeight: '500',
  },

  saveBtn: { backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.xl },
  saveBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
