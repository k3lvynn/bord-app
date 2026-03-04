// app/team/create.tsx
// Create a team — you become captain automatically.
// Team logo: upload a photo OR pick an emoji fallback.

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, FlatList, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, shadow } from '../../lib/theme';
import { createTeam, uploadTeamLogo, TEAM_EMOJIS } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

export default function CreateTeam() {
  const { eventId, eventTitle, category, maxSize } = useLocalSearchParams<{
    eventId: string;
    eventTitle: string;
    category: string;
    maxSize: string;
  }>();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [name,          setName]          = useState('');
  const [logoMode,      setLogoMode]      = useState<'emoji' | 'photo'>('emoji');
  const [emoji,         setEmoji]         = useState('🛡️');
  const [photoUri,      setPhotoUri]      = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload a team logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setLogoMode('photo');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to take a team photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setLogoMode('photo');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Give your team a name.'); return; }
    if (!user) { Alert.alert('Sign in required', 'You must be signed in to create a team.'); return; }

    setLoading(true);
    try {
      // Create team first to get the ID
      const team = await createTeam({
        event_id:     eventId,
        name:         name.trim(),
        logo_emoji:   logoMode === 'emoji' ? emoji : '🛡️',
        logo_url:     null,
        captain_id:   user.id,
        captain_name: profile?.display_name ?? profile?.username ?? 'Captain',
        max_size:     parseInt(maxSize ?? '10', 10),
      });

      // Upload photo if selected
      if (logoMode === 'photo' && photoUri) {
        setUploadingPhoto(true);
        try {
          const url = await uploadTeamLogo(team.id, photoUri);
          const { updateTeam } = await import('../../lib/supabase');
          await updateTeam(team.id, { logo_url: url });
        } catch (uploadErr) {
          // Non-fatal — team exists, just no photo
          console.warn('Photo upload failed:', uploadErr);
          Alert.alert(
            'Photo upload failed',
            'Your team was created but the logo photo could not be uploaded. You can try again from the team page.',
            [{ text: 'OK' }]
          );
        } finally {
          setUploadingPhoto(false);
        }
      }

      router.replace({
        pathname: '/team/[id]',
        params: { id: team.id, eventId, eventTitle, category },
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create team. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const logoSource = logoMode === 'photo' && photoUri ? { uri: photoUri } : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Your Team</Text>
          <Text style={styles.headerSub}>{eventTitle ? `for ${eventTitle}` : "You'll be team captain"}</Text>
        </View>

        {/* Captain badge */}
        <View style={styles.captainBadge}>
          <Text style={styles.captainEmoji}>⚔️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.captainTitle}>{"You're the Captain"}</Text>
            <Text style={styles.captainSub}>
              {"You'll approve join requests and assign positions to your roster."}
            </Text>
          </View>
        </View>

        {/* Team Name */}
        <Text style={styles.sectionLabel}>TEAM NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. VFA-122 Mavericks"
          placeholderTextColor={colors.gray2}
          maxLength={40}
          autoCapitalize="words"
        />
        <Text style={styles.inputHint}>{name.length}/40 characters</Text>

        {/* Logo Section */}
        <Text style={styles.sectionLabel}>TEAM LOGO</Text>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, logoMode === 'photo' && styles.modeBtnActive]}
            onPress={() => setLogoMode('photo')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeBtnEmoji}>📸</Text>
            <Text style={[styles.modeBtnText, logoMode === 'photo' && styles.modeBtnTextActive]}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, logoMode === 'emoji' && styles.modeBtnActive]}
            onPress={() => setLogoMode('emoji')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeBtnEmoji}>😎</Text>
            <Text style={[styles.modeBtnText, logoMode === 'emoji' && styles.modeBtnTextActive]}>Emoji</Text>
          </TouchableOpacity>
        </View>

        {/* Photo Upload */}
        {logoMode === 'photo' && (
          <View style={styles.photoSection}>
            {photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity style={styles.changePhotoBtn} onPress={pickPhoto} activeOpacity={0.8}>
                  <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderIcon}>🖼️</Text>
                <Text style={styles.photoPlaceholderText}>No photo selected</Text>
              </View>
            )}
            <View style={styles.photoButtonRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.8}>
                <Text style={styles.photoBtnText}>📷 Choose from Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.8}>
                <Text style={styles.photoBtnText}>📸 Take Photo</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.photoHint}>Square photos work best. Will be cropped to a circle.</Text>
          </View>
        )}

        {/* Emoji Picker */}
        {logoMode === 'emoji' && (
          <View>
            <View style={styles.selectedEmoji}>
              <Text style={styles.selectedEmojiText}>{emoji}</Text>
              <Text style={styles.selectedEmojiLabel}>Selected</Text>
            </View>
            <FlatList
              data={TEAM_EMOJIS}
              numColumns={8}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.emojiBtn, item === emoji && styles.emojiBtnActive]}
                  onPress={() => setEmoji(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiBtnText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Preview Card */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>PREVIEW</Text>
        <View style={styles.previewCard}>
          {logoSource ? (
            <Image source={logoSource} style={styles.previewLogoImg} />
          ) : (
            <View style={styles.previewLogoEmoji}>
              <Text style={{ fontSize: 36 }}>{emoji}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName}>{name || 'Your Team Name'}</Text>
            <Text style={styles.previewCaptain}>
              Captain: {profile?.display_name ?? profile?.username ?? 'You'}
            </Text>
          </View>
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>CAPTAIN</Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createBtn, (!name.trim() || loading) && { opacity: 0.5 }]}
          onPress={handleCreate}
          disabled={!name.trim() || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.createBtnText}>
                {uploadingPhoto ? 'Uploading logo...' : 'Creating team...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.createBtnText}>Create Team →</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },

  header: { paddingTop: spacing.lg, paddingBottom: spacing.lg },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.white, marginBottom: 4 },
  headerSub: { fontSize: 14, color: colors.gray1 },

  captainBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  captainEmoji: { fontSize: 28 },
  captainTitle: { fontSize: 15, fontWeight: '700', color: colors.orange, marginBottom: 3 },
  captainSub: { fontSize: 12, color: colors.gray1, lineHeight: 18 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.gray2,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: spacing.lg,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 13,
    color: colors.white, fontSize: 16, fontWeight: '600',
  },
  inputHint: { fontSize: 11, color: colors.gray2, marginTop: 5, textAlign: 'right' },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12,
  },
  modeBtnActive: { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.1)' },
  modeBtnEmoji: { fontSize: 18 },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: colors.gray1 },
  modeBtnTextActive: { color: colors.orange },

  // Photo
  photoSection: { marginBottom: spacing.sm },
  photoPreviewWrap: { alignItems: 'center', marginBottom: spacing.md },
  photoPreview: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: colors.orange,
    marginBottom: spacing.sm,
  },
  changePhotoBtn: {
    backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 6,
  },
  changePhotoBtnText: { color: colors.orange, fontSize: 13, fontWeight: '600' },
  photoPlaceholder: {
    alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  photoPlaceholderIcon: { fontSize: 40, marginBottom: spacing.sm },
  photoPlaceholderText: { color: colors.gray2, fontSize: 13 },
  photoButtonRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  photoBtn: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 13, alignItems: 'center',
  },
  photoBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  photoHint: { fontSize: 11, color: colors.gray2, textAlign: 'center', fontStyle: 'italic' },

  // Emoji
  selectedEmoji: {
    alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, marginBottom: spacing.sm,
  },
  selectedEmojiText: { fontSize: 52, marginBottom: 4 },
  selectedEmojiLabel: { fontSize: 11, color: colors.gray2, fontWeight: '600' },
  emojiBtn: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    margin: 3, borderRadius: radius.sm, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  emojiBtnActive: { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.15)' },
  emojiBtnText: { fontSize: 22 },

  // Preview
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, ...shadow.sm,
  },
  previewLogoImg: { width: 52, height: 52, borderRadius: 26 },
  previewLogoEmoji: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewName: { fontSize: 17, fontWeight: '700', color: colors.white, marginBottom: 2 },
  previewCaptain: { fontSize: 12, color: colors.gray1 },
  previewBadge: {
    backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3,
  },
  previewBadgeText: { fontSize: 10, fontWeight: '800', color: colors.orange, letterSpacing: 1 },

  createBtn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.xl,
  },
  createBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  cancelBtnText: { color: colors.gray1, fontSize: 14 },
});
