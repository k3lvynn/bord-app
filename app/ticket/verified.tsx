// app/ticket/verified.tsx
// Shown after attendee scans the host's door QR.
// Looks up their RSVP by userId + eventSlug and shows the result.

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';
import { verifyMyTicketForEvent, formatDate, formatTime, TicketVerifyResult } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

export default function TicketVerified() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [result,  setResult]  = useState<TicketVerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Pulse animation for confirmed state
  const pulse = new Animated.Value(1);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    if (!slug || !user) return;
    verifyMyTicketForEvent(slug as string, user.id)
      .then(setResult)
      .catch(() => setResult({ status: 'not_found', rsvp: null, event: null }))
      .finally(() => setLoading(false));
  }, [slug, user]);

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.orange} style={{ marginTop: 120 }} />
        <Text style={styles.loadingText}>Verifying your ticket…</Text>
      </View>
    );
  }

  // ── CONFIRMED ──────────────────────────────────────────────────────────────
  if (result?.status === 'confirmed' || result?.status === 'free_event') {
    const { event } = result;
    const isTicketed = result.status === 'confirmed';
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.content}>

          {/* Big animated checkmark */}
          <Animated.View style={[styles.ring, styles.ringGreen, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.ringEmoji}>✅</Text>
          </Animated.View>

          <Text style={styles.confirmedHeadline}>
            {isTicketed ? 'Ticket Confirmed!' : "You're In!"}
          </Text>
          <Text style={styles.confirmedSub}>
            {isTicketed
              ? `Your ticket is valid, ${profile?.display_name?.split(' ')[0] ?? 'friend'}. Welcome in! 🎉`
              : `You're on the list, ${profile?.display_name?.split(' ')[0] ?? 'friend'}. Enjoy the event!`}
          </Text>

          {/* Event card */}
          {event && (
            <View style={styles.eventCard}>
              <View style={styles.eventCardBar} />
              <View style={styles.eventCardBody}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventMeta}>📅 {formatDate(event.date)} · {formatTime(event.time)}</Text>
                <Text style={styles.eventMeta}>📍 {event.location}</Text>
                {isTicketed && event.buy_in_amount && (
                  <View style={styles.paidBadge}>
                    <Text style={styles.paidBadgeText}>🎟️ Paid · ${event.buy_in_amount}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Name row */}
          {profile && (
            <View style={styles.nameCard}>
              <Text style={styles.nameEmoji}>{profile.avatar_emoji ?? '⭐'}</Text>
              <View>
                <Text style={styles.nameName}>{profile.display_name}</Text>
                <Text style={styles.nameHandle}>@{profile.username}</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.doneBtn, { marginBottom: insets.bottom + spacing.lg }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.doneBtnText}>Back to Bord</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── WAITLISTED ─────────────────────────────────────────────────────────────
  if (result?.status === 'waitlisted') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <View style={[styles.ring, styles.ringOrange]}>
            <Text style={styles.ringEmoji}>🎯</Text>
          </View>
          <Text style={styles.waitlistHeadline}>{"You're on the Waitlist"}</Text>
          <Text style={styles.confirmedSub}>
            Your spot is not confirmed yet. Let the host know you&apos;re here — they may be able to add you.
          </Text>
          {result.event && (
            <View style={styles.eventCard}>
              <View style={[styles.eventCardBar, { backgroundColor: colors.orange }]} />
              <View style={styles.eventCardBody}>
                <Text style={styles.eventTitle}>{result.event.title}</Text>
                <Text style={styles.eventMeta}>📅 {formatDate(result.event.date)}</Text>
              </View>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.doneBtn, { marginBottom: insets.bottom + spacing.lg }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.doneBtnText}>Back to Bord</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── NOT FOUND ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={[styles.ring, styles.ringRed]}>
          <Text style={styles.ringEmoji}>❌</Text>
        </View>
        <Text style={styles.notFoundHeadline}>No Ticket Found</Text>
        <Text style={styles.confirmedSub}>
          We couldn&apos;t find a confirmed ticket for your account at this event.
          {'\n\n'}
          If you bought a ticket, make sure you&apos;re signed in with the same account you used to register.
        </Text>

        {result?.event && (
          <View style={styles.eventCard}>
            <View style={[styles.eventCardBar, { backgroundColor: colors.rose }]} />
            <View style={styles.eventCardBody}>
              <Text style={styles.eventTitle}>{result.event.title}</Text>
              <Text style={styles.eventMeta}>📅 {formatDate(result.event.date)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.rsvpBtn}
          onPress={() => result?.event
            ? router.replace({ pathname: '/rsvp/[slug]', params: { slug: result.event.slug } })
            : router.replace('/(tabs)')
          }
        >
          <Text style={styles.rsvpBtnText}>
            {result?.event ? 'Register for This Event' : 'Browse Events'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.doneBtn, { marginBottom: insets.bottom + spacing.lg }]}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.doneBtnText}>Back to Bord</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },

  loadingText: {
    textAlign: 'center', marginTop: spacing.md,
    color: colors.gray1, fontSize: 15,
  },

  // Ring
  ring: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, marginBottom: spacing.lg,
  },
  ringGreen:  { backgroundColor: 'rgba(52,211,153,0.1)',  borderColor: 'rgba(52,211,153,0.4)' },
  ringOrange: { backgroundColor: 'rgba(249,115,22,0.1)',  borderColor: 'rgba(249,115,22,0.4)' },
  ringRed:    { backgroundColor: 'rgba(244,63,94,0.1)',   borderColor: 'rgba(244,63,94,0.4)' },
  ringEmoji:  { fontSize: 52 },

  confirmedHeadline: {
    fontSize: 36, fontWeight: '900', color: colors.green,
    textAlign: 'center', marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  waitlistHeadline: {
    fontSize: 30, fontWeight: '800', color: colors.orange,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  notFoundHeadline: {
    fontSize: 30, fontWeight: '800', color: colors.rose,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  confirmedSub: {
    fontSize: 15, color: colors.gray1, textAlign: 'center',
    lineHeight: 23, marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },

  // Event card
  eventCard: {
    width: '100%', backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', overflow: 'hidden', marginBottom: spacing.md,
  },
  eventCardBar:  { width: 4, backgroundColor: colors.green },
  eventCardBody: { flex: 1, padding: spacing.md },
  eventTitle:    { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 5 },
  eventMeta:     { fontSize: 13, color: colors.gray1, marginBottom: 2 },
  paidBadge: {
    marginTop: spacing.xs, alignSelf: 'flex-start',
    backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  paidBadgeText: { fontSize: 11, fontWeight: '700', color: colors.green },

  // Name card
  nameCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: 'rgba(52,211,153,0.05)', borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.18)', borderRadius: radius.md,
    padding: spacing.md,
  },
  nameEmoji: { fontSize: 36 },
  nameName:  { fontSize: 17, fontWeight: '700', color: colors.white },
  nameHandle:{ fontSize: 13, color: colors.gray2, marginTop: 2 },

  // Buttons
  rsvpBtn: {
    width: '100%', backgroundColor: colors.orange,
    borderRadius: radius.md, paddingVertical: 15,
    alignItems: 'center', marginTop: spacing.sm,
  },
  rsvpBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  doneBtn: {
    marginHorizontal: spacing.lg, backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 15, alignItems: 'center',
  },
  doneBtnText: { color: colors.gray1, fontSize: 15, fontWeight: '600' },
});
