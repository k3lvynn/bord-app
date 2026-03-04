// app/ticket/[rsvpId].tsx
// Full-screen ticket / QR code shown to paid attendees.
// Pull up at the door — host or door person scans the QR to confirm entry.
//
// The QR encodes:  bord://checkin/<ticketCode>
// which the host scanner page reads via expo-camera.

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Share, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';
import { supabase, formatDate, formatTime, RSVP } from '../../lib/supabase';

// Safe-require QRCode — needs react-native-svg + react-native-qrcode-svg
// Only available in custom builds (not Expo Go)
let QRCode: any = null;
try { QRCode = require('react-native-qrcode-svg').default; } catch (_) {}

const SPORT_CATS = new Set([
  'flag_football','basketball','soccer','volleyball','softball','tennis',
  'pickleball','golf','cornhole','dodgeball','kickball','ultimate_frisbee',
]);

export default function TicketPage() {
  const { rsvpId } = useLocalSearchParams<{ rsvpId: string }>();
  const insets = useSafeAreaInsets();

  const [rsvp,    setRsvp]    = useState<RSVP | null>(null);
  const [event,   setEvent]   = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!rsvpId) return;
    try {
      const { data: rsvpData, error: re } = await supabase
        .from('rsvps')
        .select('*')
        .eq('id', rsvpId)
        .single();
      if (re || !rsvpData) throw re ?? new Error('RSVP not found');

      const { data: evData, error: ee } = await supabase
        .from('events')
        .select('id,title,date,time,end_time,location,category,has_buy_in,buy_in_amount,door_checkin_enabled')
        .eq('id', rsvpData.event_id)
        .single();
      if (ee || !evData) throw ee ?? new Error('Event not found');

      setRsvp(rsvpData as RSVP);
      setEvent(evData);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not load ticket');
    } finally {
      setLoading(false);
    }
  }, [rsvpId]);

  useFocusEffect(load);

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  if (!rsvp || !event) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.gray1, fontSize: 16 }}>Ticket not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.orange, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCompete   = SPORT_CATS.has(event.category ?? '');
  const ticketCode  = (rsvp as any).ticket_code ?? rsvp.id;
  const qrValue     = `bord://checkin/${ticketCode}`;
  const isCheckedIn = (rsvp as any).checked_in === true;

  const accentColor = isCheckedIn
    ? colors.green
    : isCompete ? colors.orange : colors.lavender;

  const shareTicket = async () => {
    await Share.share({
      message: `My ticket for ${event.title} on Bord — ${formatDate(event.date)} at ${formatTime(event.time)}`,
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Ticket</Text>
          <TouchableOpacity onPress={shareTicket} style={styles.shareBtn}>
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Ticket card */}
        <View style={[styles.ticketCard, { borderColor: accentColor + '55' }]}>

          {/* Top stripe */}
          <View style={[styles.ticketStripe, { backgroundColor: accentColor }]} />

          {/* Checked-in badge */}
          {isCheckedIn && (
            <View style={styles.checkedInBanner}>
              <Text style={styles.checkedInText}>✅ Checked In</Text>
            </View>
          )}

          {/* Event info */}
          <View style={styles.ticketBody}>
            <Text style={[styles.ticketType, { color: accentColor }]}>
              {isCompete ? '🏆 COMPETE' : '🎟️ TICKET'}
            </Text>
            <Text style={styles.ticketTitle}>{event.title}</Text>

            <View style={styles.ticketMeta}>
              <View style={styles.ticketMetaRow}>
                <Text style={styles.ticketMetaIcon}>📅</Text>
                <Text style={styles.ticketMetaText}>
                  {formatDate(event.date)} · {formatTime(event.time)}
                </Text>
              </View>
              <View style={styles.ticketMetaRow}>
                <Text style={styles.ticketMetaIcon}>📍</Text>
                <Text style={styles.ticketMetaText}>{event.location}</Text>
              </View>
              <View style={styles.ticketMetaRow}>
                <Text style={styles.ticketMetaIcon}>👤</Text>
                <Text style={styles.ticketMetaText}>{rsvp.name}</Text>
              </View>
              {event.buy_in_amount && (
                <View style={styles.ticketMetaRow}>
                  <Text style={styles.ticketMetaIcon}>
                    {isCompete ? '💰' : '🎟️'}
                  </Text>
                  <Text style={[styles.ticketMetaText, { color: accentColor, fontWeight: '700' }]}>
                    {isCompete ? 'Buy-In' : 'Ticket'}: ${event.buy_in_amount} — Paid ✓
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Tear line */}
          <View style={styles.tearLine}>
            <View style={[styles.tearCircle, styles.tearCircleLeft, { backgroundColor: colors.black }]} />
            <View style={styles.tearDashes}>
              {Array.from({ length: 18 }).map((_, i) => (
                <View key={i} style={styles.tearDash} />
              ))}
            </View>
            <View style={[styles.tearCircle, styles.tearCircleRight, { backgroundColor: colors.black }]} />
          </View>

          {/* QR section */}
          <View style={styles.qrSection}>
            {event.door_checkin_enabled ? (
              <>
                <Text style={styles.qrLabel}>
                  {isCheckedIn ? 'Already scanned at the door' : 'Show this to get in'}
                </Text>

                <View style={[styles.qrWrap, { borderColor: accentColor + '44', opacity: isCheckedIn ? 0.5 : 1 }]}>
                  {QRCode ? (
                    <QRCode
                      value={qrValue}
                      size={200}
                      color={colors.white}
                      backgroundColor="#1a1a1a"
                      quietZone={12}
                    />
                  ) : (
                    /* Fallback for Expo Go — show the code as text */
                    <View style={styles.qrFallback}>
                      <Text style={styles.qrFallbackIcon}>📱</Text>
                      <Text style={styles.qrFallbackText}>QR available in the{'\n'}installed app</Text>
                      <Text style={styles.qrFallbackCode}>{ticketCode.slice(0, 8).toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.ticketCodeText}>
                  #{ticketCode.slice(0, 8).toUpperCase()}
                </Text>
                <Text style={styles.qrHint}>
                  {isCheckedIn
                    ? 'Your entry has been confirmed'
                    : 'The host or door staff will scan this QR code'}
                </Text>
              </>
            ) : (
              /* No door scanner — just show name/email confirmation */
              <View style={styles.noDoorScan}>
                <Text style={styles.noDoorIcon}>✅</Text>
                <Text style={styles.noDoorTitle}>{'You\'re confirmed!'}</Text>
                <Text style={styles.noDoorSub}>
                  Your name is on the list. Give your name at the door.
                </Text>
                <View style={styles.noDoorCode}>
                  <Text style={styles.noDoorCodeLabel}>Confirmation #</Text>
                  <Text style={styles.noDoorCodeVal}>
                    {ticketCode.slice(0, 8).toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Bottom stripe */}
          <View style={[styles.ticketStripe, { backgroundColor: accentColor, marginTop: 0 }]} />
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteText}>
            {'💬 A confirmation email was sent to '}
            <Text style={{ color: colors.white, fontWeight: '600' }}>{rsvp.email}</Text>
            {' with your ticket details.'}
          </Text>
        </View>

        {/* Back to event */}
        <TouchableOpacity
          style={styles.btnEvent}
          onPress={() => router.push(`/event/${event.slug ?? event.id}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnEventText}>View Event →</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  backBtn:     { padding: 4 },
  backText:    { color: colors.orange, fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  shareBtn:    { padding: 4 },
  shareText:   { color: colors.orange, fontSize: 15, fontWeight: '600' },

  // Ticket card
  ticketCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  ticketStripe: { height: 6 },

  checkedInBanner: {
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52,211,153,0.25)',
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  checkedInText: { color: colors.green, fontSize: 14, fontWeight: '700' },

  ticketBody: { padding: spacing.lg },
  ticketType: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  ticketTitle: {
    fontSize: 26, fontWeight: '900', color: colors.white,
    lineHeight: 30, marginBottom: spacing.md,
  },

  ticketMeta:    { gap: 8 },
  ticketMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ticketMetaIcon:{ fontSize: 14, width: 20 },
  ticketMetaText:{ flex: 1, fontSize: 14, color: colors.gray1, lineHeight: 20 },

  // Tear line between body and QR
  tearLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -1,
    marginVertical: spacing.sm,
    position: 'relative',
  },
  tearCircle: {
    width: 24, height: 24, borderRadius: 12,
    position: 'absolute', zIndex: 2,
  },
  tearCircleLeft:  { left: -12 },
  tearCircleRight: { right: -12 },
  tearDashes: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-evenly',
    paddingHorizontal: 16,
  },
  tearDash: {
    width: 6, height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // QR section
  qrSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
  qrLabel:   { fontSize: 12, color: colors.gray2, fontWeight: '600', marginBottom: spacing.md, textAlign: 'center' },

  qrWrap: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  qrFallback: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', gap: 8 },
  qrFallbackIcon: { fontSize: 40 },
  qrFallbackText: { fontSize: 13, color: colors.gray1, textAlign: 'center', lineHeight: 19 },
  qrFallbackCode: {
    fontSize: 22, fontWeight: '900', color: colors.white,
    letterSpacing: 3, marginTop: 8,
    fontVariant: ['tabular-nums'],
  },

  ticketCodeText: {
    fontSize: 16, fontWeight: '800', color: colors.gray1,
    letterSpacing: 3, marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  qrHint: { fontSize: 12, color: colors.gray2, textAlign: 'center', lineHeight: 18 },

  // No door scanner mode
  noDoorScan: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  noDoorIcon: { fontSize: 48 },
  noDoorTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  noDoorSub:   { fontSize: 14, color: colors.gray1, textAlign: 'center', lineHeight: 20 },
  noDoorCode: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    alignItems: 'center', marginTop: spacing.sm,
  },
  noDoorCodeLabel: { fontSize: 10, color: colors.gray2, letterSpacing: 1, fontWeight: '700', textTransform: 'uppercase' },
  noDoorCodeVal:   { fontSize: 24, fontWeight: '900', color: colors.white, letterSpacing: 4, marginTop: 4 },

  infoNote: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  infoNoteText: { fontSize: 13, color: colors.gray2, lineHeight: 20, textAlign: 'center' },

  btnEvent: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 15, alignItems: 'center',
  },
  btnEventText: { color: colors.orange, fontSize: 15, fontWeight: '700' },
});
