// components/ShareCard.tsx
// Renders an off-screen event card, captures it as an image, shares as a photo
// Instagram / Snapchat / Threads will treat it as a real image post

import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Share, Alert,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Event, formatDate, formatTime, getCategoryEmoji } from '../lib/supabase';
import { colors } from '../lib/theme';

type Props = {
  event: Event;
  eventUrl: string;
  onClose: () => void;
};

// Category display labels
const CAT_LABELS: Record<string, string> = {
  flag_football: 'Flag Football', basketball: 'Basketball', soccer: 'Soccer',
  volleyball: 'Volleyball', softball: 'Softball', tennis: 'Tennis',
  pickleball: 'Pickleball', golf: 'Golf', cornhole: 'Cornhole',
  dodgeball: 'Dodgeball', kickball: 'Kickball', ultimate_frisbee: 'Ultimate Frisbee',
  hiking: 'Hiking', running: 'Running', yoga: 'Yoga', fitness: 'Fitness',
  trivia: 'Trivia', board_games: 'Board Games', social: 'Social', party: 'Party',
  networking: 'Networking', art: 'Art', music: 'Music', food: 'Food',
  cooking: 'Cooking', other: 'Other',
};

export default function ShareCard({ event, eventUrl, onClose }: Props) {
  const cardRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const categoryLabel = CAT_LABELS[event.category ?? ''] ?? (event.category ?? 'Event');
  const categoryEmoji = getCategoryEmoji(event.category);
  const hasPrize = !!event.prize_pool;
  const isCompete = event.has_buy_in;

  const captureAndShare = async () => {
    setSharing(true);
    try {
      // Capture the card as a PNG
      const uri = await cardRef.current?.capture?.();
      if (!uri) throw new Error('Could not capture card');

      // Check if device supports sharing
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        // Share the image — after selecting an app (e.g. Instagram),
        // the native share sheet also passes the URL for apps that support it.
        // On iOS the URL opens Bord if installed, bordevents.com if not.
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Event',
          UTI: 'public.png',
        });
      } else {
        // Fallback: share URL + image together (Messages, WhatsApp, etc.)
        await Share.share({
          url: uri,
          message: `${event.title}\n\nRegister → ${eventUrl}`,
          title: event.title,
        });
      }
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) {
        Alert.alert('Could not share', e?.message ?? 'Please try again.');
      }
    } finally {
      setSharing(false);
      onClose();
    }
  };

  return (
    <View style={styles.wrapper}>

      {/* ── OFF-SCREEN CARD (captured as image) ─────────────────────── */}
      <ViewShot
        ref={cardRef}
        options={{ format: 'png', quality: 1, width: 1080, height: 1080 }}
        style={styles.cardOuter}
      >
        {/* Background gradient-like layers */}
        <View style={styles.cardBg}>
          <View style={styles.cardAccentTop} />
          <View style={styles.cardAccentBottom} />

          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardLogo}>
              <Text style={styles.cardLogoB}>B</Text>
              <Text style={styles.cardLogoRest}>ord</Text>
            </View>
            <Text style={styles.cardLogoTag}>are you bored?</Text>
          </View>

          {/* Category pill */}
          <View style={styles.catPill}>
            <Text style={styles.catPillText}>
              {categoryEmoji}  {categoryLabel.toUpperCase()}
              {isCompete ? ' · COMPETE' : ' · GATHER'}
            </Text>
          </View>

          {/* Event title */}
          <Text style={styles.cardTitle} numberOfLines={3}>{event.title}</Text>

          {/* Prize banner */}
          {hasPrize && (
            <View style={styles.prizeBanner}>
              <Text style={styles.prizeLabel}>🏆  PRIZE ON THE LINE</Text>
              <Text style={styles.prizeAmount}>{event.prize_pool}</Text>
            </View>
          )}

          {/* Meta info */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📅</Text>
              <Text style={styles.metaValue}>{formatDate(event.date)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>⏰</Text>
              <Text style={styles.metaValue}>{formatTime(event.time)}</Text>
            </View>
            <View style={[styles.metaItem, { flex: 1 }]}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{event.location}</Text>
            </View>
            {event.has_buy_in && event.buy_in_amount && (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>🎟️</Text>
                <Text style={[styles.metaValue, { color: colors.orange }]}>
                  ${event.buy_in_amount}
                </Text>
              </View>
            )}
          </View>

          {/* Spots left */}
          <View style={styles.spotsRow}>
            <View style={styles.spotsPill}>
              <Text style={styles.spotsText}>
                {event.cap - (event.rsvp_count ?? 0)} spots left of {event.cap}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* CTA */}
          <View style={styles.ctaRow}>
            <Text style={styles.ctaLabel}>Tap the link to register →</Text>
            <Text style={styles.ctaUrl}>{eventUrl}</Text>
            <Text style={styles.ctaHint}>Opens in Bord app · or bordevents.com</Text>
          </View>

          {/* Bottom watermark */}
          <Text style={styles.watermark}>Bord · San Diego Events</Text>
        </View>
      </ViewShot>

      {/* ── PREVIEW ──────────────────────────────────────────────────── */}
      <View style={styles.previewWrap}>
        <Text style={styles.previewTitle}>📸 Event Share Card</Text>
        <Text style={styles.previewSub}>
          Share this image directly to Instagram Stories, Snapchat, Threads, or any app
        </Text>
      </View>

      {/* ── ACTION BUTTONS ───────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.shareImgBtn, sharing && { opacity: 0.6 }]}
        onPress={captureAndShare}
        disabled={sharing}
        activeOpacity={0.85}
      >
        {sharing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.shareImgBtnText}>📤  Share as Image →</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
        <Text style={styles.cancelText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },

  // ── The card that gets captured ──────────────────────────────────────────
  cardOuter: { width: 360, height: 360, alignSelf: 'center', marginBottom: 16 },

  cardBg: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 24,
    position: 'relative',
  },
  cardAccentTop: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(249,115,22,0.15)',
  },
  cardAccentBottom: {
    position: 'absolute', bottom: -40, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(249,115,22,0.08)',
  },

  cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 12 },
  cardLogo: { flexDirection: 'row' },
  cardLogoB: { fontSize: 20, fontWeight: '900', color: '#fff' },
  cardLogoRest: { fontSize: 20, fontWeight: '900', color: '#F97316' },
  cardLogoTag: { fontSize: 10, color: '#A8A29E', marginLeft: 4 },

  catPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  catPillText: { fontSize: 9, fontWeight: '800', color: '#F97316', letterSpacing: 0.5 },

  cardTitle: {
    fontSize: 26, fontWeight: '900', color: '#fff',
    lineHeight: 31, marginBottom: 12,
  },

  prizeBanner: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: 10, padding: 10, marginBottom: 12,
  },
  prizeLabel: { fontSize: 9, fontWeight: '800', color: '#F97316', letterSpacing: 1 },
  prizeAmount: { fontSize: 16, fontWeight: '900', color: '#FCD34D', marginTop: 2 },

  metaGrid: { gap: 6, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaIcon: { fontSize: 12, width: 18 },
  metaValue: { fontSize: 12, color: '#E2E8F0', fontWeight: '600', flex: 1 },

  spotsRow: { marginBottom: 10 },
  spotsPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  spotsText: { fontSize: 10, fontWeight: '700', color: '#34D399' },

  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 10 },

  ctaRow: { gap: 2 },
  ctaLabel: { fontSize: 9, color: '#A8A29E', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  ctaUrl: { fontSize: 11, color: '#F97316', fontWeight: '700' },
  ctaHint: { fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 2 },

  watermark: {
    position: 'absolute', bottom: 10, right: 16,
    fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: '600',
  },

  // ── Below-card UI ────────────────────────────────────────────────────────
  previewWrap: { paddingHorizontal: 4, marginBottom: 16 },
  previewTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  previewSub: { fontSize: 12, color: '#A8A29E', lineHeight: 18 },

  shareImgBtn: {
    backgroundColor: colors.orange, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  shareImgBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  cancelBtn: {
    backgroundColor: '#2C2C2C', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#A8A29E' },
});
