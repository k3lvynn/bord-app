// app/ticket/door/[slug].tsx
// The host shows this screen at the venue entrance.
// It displays a large QR code encoding bord://entry/{eventSlug}
// Attendees scan it with their Bord app to verify their ticket.

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, radius } from '../../../lib/theme';
import { getEventBySlug, formatDate, formatTime, Event } from '../../../lib/supabase';

// Lazy-load QR — requires react-native-svg + react-native-qrcode-svg
let QRCode: any = null;
try { QRCode = require('react-native-qrcode-svg').default; } catch (_) {}

export default function DoorQR() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [event,   setEvent]   = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const qrValue   = `bord://entry/${slug}`;
  const qrSize    = Math.min(width - 96, 300);

  useEffect(() => {
    if (!slug) return;
    getEventBySlug(slug as string)
      .then(setEvent)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.orange} style={{ marginTop: 120 }} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.errorText}>Event not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Door QR</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>

        {/* Instruction label */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionEmoji}>🚪</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.instructionTitle}>Show this at the entrance</Text>
            <Text style={styles.instructionBody}>
              Attendees scan this with their Bord app to verify their ticket. Keep it visible at the door.
            </Text>
          </View>
        </View>

        {/* QR Code card */}
        <View style={styles.qrCard}>
          {/* Event name above QR */}
          <Text style={styles.qrEventName} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.qrEventMeta}>
            📅 {formatDate(event.date)} · {formatTime(event.time)}
          </Text>
          <Text style={styles.qrEventMeta}>📍 {event.location}</Text>

          <View style={styles.qrWrap}>
            {QRCode ? (
              <QRCode
                value={qrValue}
                size={qrSize}
                color="#000000"
                backgroundColor="#FFFFFF"
                logo={undefined}
                logoSize={0}
                quietZone={16}
              />
            ) : (
              // Fallback if QRCode library not available
              <View style={[styles.qrFallback, { width: qrSize, height: qrSize }]}>
                <Text style={styles.qrFallbackEmoji}>🔲</Text>
                <Text style={styles.qrFallbackText}>QR code requires a dev build</Text>
                <Text style={styles.qrFallbackCode} numberOfLines={2} selectable>{qrValue}</Text>
              </View>
            )}
          </View>

          {/* Bord branding below QR */}
          <View style={styles.qrBrand}>
            <Text style={styles.qrBrandText}>
              <Text style={{ color: '#000' }}>B</Text>
              <Text style={{ color: '#F97316' }}>ord</Text>
              {' '}· Scan to verify entry
            </Text>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Quick tips</Text>
          <Text style={styles.tipRow}>{'✓  '}<Text style={styles.tipText}>One QR per event — works for all attendees</Text></Text>
          <Text style={styles.tipRow}>{'✓  '}<Text style={styles.tipText}>Attendees must be logged in to their Bord account to scan</Text></Text>
          <Text style={styles.tipRow}>{'✓  '}<Text style={styles.tipText}>Shows their name, ticket status, and photo</Text></Text>
          <Text style={styles.tipRow}>{'✓  '}<Text style={styles.tipText}>Keep screen brightness up — bright light helps scanning</Text></Text>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, padding: spacing.lg, gap: spacing.md },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle:     { fontSize: 16, fontWeight: '700', color: colors.white },
  backArrow:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backArrowText:   { color: colors.orange, fontSize: 22 },

  // Instruction banner
  instructionCard: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)', borderRadius: radius.md, padding: spacing.md,
  },
  instructionEmoji: { fontSize: 28 },
  instructionTitle: { fontSize: 14, fontWeight: '700', color: colors.orange, marginBottom: 4 },
  instructionBody:  { fontSize: 13, color: colors.gray1, lineHeight: 19 },

  // QR card — white background so QR is legible
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 16,
    elevation: 8,
  },
  qrEventName: { fontSize: 18, fontWeight: '800', color: '#111', textAlign: 'center' },
  qrEventMeta: { fontSize: 12, color: '#666', textAlign: 'center' },
  qrWrap:      { marginVertical: spacing.sm },

  qrFallback: {
    backgroundColor: '#f5f5f5', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: spacing.md,
  },
  qrFallbackEmoji: { fontSize: 48 },
  qrFallbackText:  { fontSize: 13, color: '#666', textAlign: 'center' },
  qrFallbackCode:  { fontSize: 11, color: '#999', textAlign: 'center', fontFamily: 'monospace' },

  qrBrand: {
    borderTopWidth: 1, borderTopColor: '#eee',
    width: '100%', paddingTop: spacing.sm, alignItems: 'center',
  },
  qrBrandText: { fontSize: 13, fontWeight: '700', color: '#555' },

  // Tips
  tipsCard: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 8,
  },
  tipsTitle: { fontSize: 12, fontWeight: '700', color: colors.gray2, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  tipRow:    { fontSize: 13, color: colors.gray1, lineHeight: 19 },
  tipText:   { color: colors.gray1 },

  errorText: { color: colors.gray1, textAlign: 'center', fontSize: 16, marginBottom: spacing.lg },
  backBtn:   { margin: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, alignItems: 'center' },
  backBtnText: { color: colors.gray1, fontSize: 15, fontWeight: '600' },
});
