// app/post/create.tsx
// Compose a post after attending an event.
// Pick a photo from your library, write a caption with hashtags,
// optionally tag an event, and share to the feed.

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  supabase, createPost, parseHashtags, getPosts, Event,
} from '../../lib/supabase';

// ─── Caption rendering — highlight #hashtags ────────────────────────────────
function CaptionPreview({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(#[a-zA-Z0-9_-]+)/g);
  return (
    <Text style={cap.preview}>
      {parts.map((part, i) =>
        part.startsWith('#')
          ? <Text key={i} style={cap.tag}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

const cap = StyleSheet.create({
  preview: { fontSize: 14, color: colors.gray1, lineHeight: 21 },
  tag:     { color: '#9B8EC4', fontWeight: '700' },
});

// ─── Main component ─────────────────────────────────────────────────────────
export default function CreatePost() {
  const { user, profile } = useAuth();
  // When launched from an event page, these params pre-link the post
  const { eventId, eventSlug, eventTitle } = useLocalSearchParams<{
    eventId?: string; eventSlug?: string; eventTitle?: string;
  }>();

  const [imageUri,   setImageUri]   = useState<string | null>(null);
  const [mediaType,  setMediaType]  = useState<'photo' | 'video'>('photo');
  const [caption,    setCaption]    = useState('');
  const [linkedEvent,setLinkedEvent]= useState<Event | null>(null);
  const [myEvents,   setMyEvents]   = useState<Event[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview,setShowPreview]= useState(false);

  const hashtags = parseHashtags(caption);

  // Load recent events the user hosted — plus pre-link if launched from event page
  useFocusEffect(useCallback(() => {
    if (!user) return;
    // If opened from an event page, auto-link that event
    if (eventId && eventTitle) {
      setLinkedEvent({ id: eventId, title: eventTitle, slug: eventSlug ?? '' } as Event);
    }
    supabase
      .from('events')
      .select('id, title, date, slug')
      .eq('host_id', user.id)
      .order('date', { ascending: false })
      .limit(10)
      .then(({ data }) => setMyEvents(data ?? [] as Event[]))
      .catch(() => {});
  }, [user, eventId, eventTitle]));

  const pickMedia = async (type: 'photo' | 'video' | 'both' = 'both') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const mediaTypes =
      type === 'photo' ? ImagePicker.MediaTypeOptions.Images
      : type === 'video' ? ImagePicker.MediaTypeOptions.Videos
      : ImagePicker.MediaTypeOptions.All;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: type !== 'video', // editing not supported for video
      aspect: [4, 3],
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setMediaType(asset.type === 'video' ? 'video' : 'photo');
    }
  };

  const takeMedia = async (type: 'photo' | 'video' = 'photo') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: type === 'video'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: type !== 'video',
      aspect: [4, 3],
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setMediaType(asset.type === 'video' ? 'video' : 'photo');
    }
  };

  const handleSubmit = async () => {
    if (!caption.trim() && !imageUri) {
      Alert.alert('Nothing to post', 'Add a photo or write a caption first.');
      return;
    }
    if (!user) { Alert.alert('Sign in required'); return; }

    setSubmitting(true);
    try {
      let mediaUrl: string | null = null;
      if (imageUri) {
        const isVideo = mediaType === 'video';
        const ext = isVideo ? 'mp4' : 'jpg';
        const mime = isVideo ? 'video/mp4' : 'image/jpeg';
        const path = `posts/${user.id}/${Date.now()}.${ext}`;

        if (isVideo) {
          // Videos: use FormData with file URI — base64 is too slow for large files
          const formData = new FormData();
          formData.append('file', { uri: imageUri, name: `upload.${ext}`, type: mime } as any);
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
          const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token ?? supabaseKey;
          const res = await fetch(
            `${supabaseUrl}/storage/v1/object/posts/${path}`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey }, body: formData }
          );
          if (!res.ok) throw new Error('Video upload failed');
        } else {
          // Photos: use base64 (works reliably for iOS ph:// URIs)
          const resp = await fetch(imageUri);
          const blob = await resp.blob();
          const ab = await blob.arrayBuffer();
          const bytes = new Uint8Array(ab);
          const { error: upErr } = await supabase.storage
            .from('posts')
            .upload(path, bytes, { upsert: false, contentType: mime });
          if (upErr) throw upErr;
        }

        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      }
      await createPost({
        author_id:  user.id,
        event_id:   linkedEvent?.id ?? null,
        caption:    caption,
        media_url:  mediaUrl,
        media_type: mediaUrl ? mediaType : 'text',
        hashtags,
      });

      Alert.alert('Posted!', "Your post is live.", [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Could not post', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = !!(caption.trim() || imageUri);

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

        {/* ── Author preview row ────────────────────────────────── */}
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{profile?.avatar_emoji ?? '⭐'}</Text>
          </View>
          <View>
            <Text style={styles.authorName}>{profile?.display_name ?? 'You'}</Text>
            <Text style={styles.authorHandle}>@{profile?.username}</Text>
          </View>
        </View>

        {/* ── Media picker ─────────────────────────────────────── */}
        {imageUri ? (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            {mediaType === 'video' && (
              <View style={styles.videoBadge}>
                <Text style={styles.videoBadgeText}>🎥 Video selected</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => { setImageUri(null); setMediaType('photo'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.removeImageText}>✕ Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pickerRow}>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => pickMedia('photo')} activeOpacity={0.8}>
              <Text style={styles.pickerIcon}>🖼️</Text>
              <Text style={styles.pickerLabel}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => pickMedia('video')} activeOpacity={0.8}>
              <Text style={styles.pickerIcon}>🎥</Text>
              <Text style={styles.pickerLabel}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => takeMedia('photo')} activeOpacity={0.8}>
              <Text style={styles.pickerIcon}>📷</Text>
              <Text style={styles.pickerLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => takeMedia('video')} activeOpacity={0.8}>
              <Text style={styles.pickerIcon}>🎬</Text>
              <Text style={styles.pickerLabel}>Record</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Caption ──────────────────────────────────────────── */}
        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={styles.captionInput}
          value={caption}
          onChangeText={setCaption}
          placeholder={'Write your caption… use #hashtags to tag moments\nE.g. "Best sunset hike of the year 🌅 #hiking #san-diego"'}
          placeholderTextColor={colors.gray2}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={500}
        />
        <View style={styles.captionMeta}>
          <Text style={styles.captionCount}>{caption.length}/500</Text>
          {hashtags.length > 0 && (
            <Text style={styles.hashtagBadge}>{hashtags.length} hashtag{hashtags.length !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {/* Hashtag preview chips */}
        {hashtags.length > 0 && (
          <View style={styles.tagChips}>
            {hashtags.map(t => (
              <View key={t} style={styles.tagChip}>
                <Text style={styles.tagChipText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Link to event ─────────────────────────────────────── */}
        <Text style={styles.label}>Link to Event <Text style={styles.optional}>(optional)</Text></Text>
        {linkedEvent ? (
          <View style={styles.linkedEvent}>
            <Text style={styles.linkedEventTitle} numberOfLines={1}>📋 {linkedEvent.title}</Text>
            <TouchableOpacity onPress={() => setLinkedEvent(null)} activeOpacity={0.7}>
              <Text style={styles.unlinkText}>Unlink</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.linkEventBtn}
            onPress={() => setShowEvents(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.linkEventBtnText}>
              {showEvents ? '▲ Hide events' : '+ Link an event'}
            </Text>
          </TouchableOpacity>
        )}

        {showEvents && !linkedEvent && myEvents.length > 0 && (
          <View style={styles.eventList}>
            {myEvents.map(ev => (
              <TouchableOpacity
                key={ev.id}
                style={styles.eventRow}
                onPress={() => { setLinkedEvent(ev); setShowEvents(false); }}
                activeOpacity={0.75}
              >
                <Text style={styles.eventRowTitle} numberOfLines={1}>{ev.title}</Text>
                <Text style={styles.eventRowDate}>{ev.date}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showEvents && !linkedEvent && myEvents.length === 0 && (
          <Text style={styles.noEventsText}>No recent events found.</Text>
        )}

        {/* ── Submit ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.postBtn, (!canPost || submitting) && styles.postBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canPost || submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.postBtnText}>Share Post →</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 80, paddingTop: spacing.md },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1.5,
    borderColor: 'rgba(249,115,22,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22 },
  authorName:  { fontSize: 16, fontWeight: '700', color: colors.white },
  authorHandle:{ fontSize: 12, color: colors.gray2, marginTop: 1 },

  // Image picker
  pickerRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  pickerBtn: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.lg,
    alignItems: 'center', gap: 6, borderStyle: 'dashed',
  },
  pickerIcon:  { fontSize: 26 },
  pickerLabel: { fontSize: 13, color: colors.gray1, fontWeight: '600' },

  imagePreviewWrap: { borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.md, position: 'relative' },
  imagePreview: { width: '100%', height: 220, borderRadius: radius.md },
  videoBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  videoBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  removeImageBtn: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  removeImageText: { color: colors.white, fontWeight: '600', fontSize: 13 },

  // Caption
  label: {
    fontSize: 11, fontWeight: '700', color: colors.gray2,
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 8, marginTop: spacing.md,
  },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingTop: 13, paddingBottom: 13,
    color: colors.white, fontSize: 15, lineHeight: 22, minHeight: 120,
  },
  captionMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: spacing.sm },
  captionCount:  { fontSize: 11, color: colors.gray2 },
  hashtagBadge: {
    fontSize: 11, color: '#9B8EC4', fontWeight: '700',
    backgroundColor: 'rgba(155,142,196,0.12)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },

  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  tagChip:  {
    backgroundColor: 'rgba(155,142,196,0.1)', borderWidth: 1,
    borderColor: 'rgba(155,142,196,0.3)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tagChipText: { fontSize: 12, color: '#9B8EC4', fontWeight: '600' },

  // Event linking
  linkEventBtn: {
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  linkEventBtnText: { color: colors.gray1, fontWeight: '600', fontSize: 14 },
  linkedEvent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(249,115,22,0.07)', borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)', borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  linkedEventTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.white },
  unlinkText:       { fontSize: 13, color: colors.orange, fontWeight: '600', marginLeft: 10 },
  eventList: {
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, overflow: 'hidden', marginTop: 4,
  },
  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  eventRowTitle: { fontSize: 14, fontWeight: '600', color: colors.white, flex: 1 },
  eventRowDate:  { fontSize: 12, color: colors.gray2, marginLeft: 8 },
  noEventsText:  { fontSize: 13, color: colors.gray2, textAlign: 'center', paddingVertical: spacing.md },

  // Post button
  postBtn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.xl,
  },
  postBtnDisabled: { backgroundColor: 'rgba(249,115,22,0.35)' },
  postBtnText:     { color: colors.white, fontSize: 17, fontWeight: '700' },
});
