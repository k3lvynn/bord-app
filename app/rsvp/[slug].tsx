import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
let useStripe: (() => { initPaymentSheet: any; presentPaymentSheet: any }) | null = null;
try {
  useStripe = require('@stripe/stripe-react-native').useStripe;
} catch (_) {}
import { colors, spacing, radius, globalStyles } from '../../lib/theme';
import { getEventBySlug, submitRSVP, updateRsvpBringing, Event, BRING_OPTIONS } from '../../lib/supabase';
import { createPaymentIntent, PLATFORM_FEE_PCT, formatAmount } from '../../lib/stripe';

export default function RSVPScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const stripeHook = useStripe ? useStripe() : null;
  const initPaymentSheet    = stripeHook?.initPaymentSheet    ?? (async () => ({ error: { message: 'Stripe not available in Expo Go' } }));
  const presentPaymentSheet = stripeHook?.presentPaymentSheet ?? (async () => ({ error: { code: 'NativeModuleNotFound', message: 'Stripe not available in Expo Go. Use a dev build.' } }));

  const [event,        setEvent]        = useState<Event | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [step,         setStep]         = useState<'form' | 'paying'>('form');
  const [focused,      setFocused]      = useState<string | null>(null);

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [agreed,   setAgreed]   = useState(false);
  const [bringing, setBringing] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getEventBySlug(slug as string)
      .then(setEvent)
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [slug]);

  const isFull      = event ? event.rsvp_count >= event.cap : false;
  const buyInAmount = event?.buy_in_amount ?? 0;
  const fee         = buyInAmount * PLATFORM_FEE_PCT;
  const total       = buyInAmount + fee;
  const totalCents  = Math.round(total * 100);

  const inp = (f: string) => [styles.input, focused === f && styles.inputFocused];

  const validate = (): string | null => {
    if (!name.trim())                         return 'Please enter your name.';
    if (!email.trim() || !email.includes('@')) return 'Please enter a valid email.';
    if (!agreed)                              return 'Please agree to the terms to continue.';
    return null;
  };

  // Shared confirmation params builder
  const confirmationParams = (rsvp: any, isConfirmed: boolean) => ({
    rsvpId:               rsvp.id,
    eventId:              event!.id,
    eventTitle:           event!.title,
    eventDate:            event!.date,
    eventTime:            event!.time,
    eventEndTime:         event!.end_time ?? '',
    eventLocation:        event!.location,
    eventSlug:            event!.slug,
    eventDescription:     event!.description ?? '',
    eventCategory:        event!.category ?? '',
    eventCap:             String(event!.cap),
    prizePool:            event!.prize_pool ?? '',
    name:                 rsvp.name,
    isConfirmed:          isConfirmed ? '1' : '0',
    waitlistPosition:     rsvp.waitlist_position?.toString() ?? '',
    cancellationDeadline: rsvp.cancellation_deadline ?? '',
    hasBuyIn:             event!.has_buy_in ? '1' : '0',
    buyInAmount:          buyInAmount.toString(),
  });

  // ── FREE EVENT ─────────────────────────────────────────────────────────────
  const handleFreeSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert('Almost there', err); return; }
    if (!event) return;

    setSubmitting(true);
    try {
      const { rsvp, isConfirmed } = await submitRSVP(event.id, {
        name:  name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
      });
      if (bringing && bringing !== 'nothing') {
        await updateRsvpBringing(rsvp.id, bringing).catch(() => {});
      }
      router.replace({ pathname: '/rsvp/confirmation', params: confirmationParams(rsvp, isConfirmed) });
    } catch (e: any) {
      if (e.message === 'already_registered') {
        Alert.alert('Already registered', 'That email is already on this event. Check your inbox.');
      } else {
        Alert.alert('Something went wrong', e.message ?? 'Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── PAID EVENT ─────────────────────────────────────────────────────────────
  const handlePaidSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert('Almost there', err); return; }
    if (!event) return;

    setSubmitting(true);
    setStep('paying');
    try {
      const { clientSecret } = await createPaymentIntent({
        eventId:       event.id,
        eventTitle:    event.title,
        buyInAmount,
        attendeeName:  name.trim(),
        attendeeEmail: email.trim().toLowerCase(),
      });

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName:  'Bord',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails:     { name: name.trim(), email: email.trim() },
        appearance: {
          colors: {
            primary:             '#F97316',
            background:          '#1E1E1E',
            componentBackground: '#2C2C2C',
            componentText:       '#FFFFFF',
            primaryText:         '#FFFFFF',
            secondaryText:       '#A8A29E',
            placeholderText:     '#5C5654',
            icon:                '#F97316',
          },
        },
        applePay:  { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: __DEV__ },
      });

      if (initError) throw new Error(initError.message);

      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code === 'Canceled') { setStep('form'); setSubmitting(false); return; }
        throw new Error(payError.message);
      }

      const { rsvp, isConfirmed } = await submitRSVP(event.id, {
        name:  name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
      });

      router.replace({ pathname: '/rsvp/confirmation', params: confirmationParams(rsvp, isConfirmed) });
    } catch (e: any) {
      Alert.alert('Payment failed', e.message ?? 'Something went wrong. Your card was not charged.');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = event?.has_buy_in && !isFull ? handlePaidSubmit : handleFreeSubmit;

  if (loading || !event) {
    return (
      <View style={[globalStyles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  if (step === 'paying' && submitting) {
    return (
      <View style={[globalStyles.screen, { alignItems: 'center', justifyContent: 'center', gap: 16 }]}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={{ color: colors.gray1, fontSize: 14 }}>Opening secure payment…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={globalStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.eventCard}>
          <View style={[styles.eventCardBar, event.has_buy_in ? styles.barCompete : styles.barGather]} />
          <View style={styles.eventCardBody}>
            <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            <Text style={styles.eventMeta}>📅 {event.date} · ⏰ {event.time}</Text>
            <Text style={styles.eventMeta}>📍 {event.location}</Text>
            {event.has_buy_in && (
              <View style={styles.buyInBadge}>
                <Text style={styles.buyInBadgeText}>💰 ${buyInAmount} buy-in · Compete mode</Text>
              </View>
            )}
          </View>
        </View>

        {isFull && (
          <View style={styles.waitlistBanner}>
            <Text style={styles.waitlistTitle}>⚠️ Event is full — joining waitlist</Text>
            <Text style={styles.waitlistBody}>
              No payment today. If someone cancels, you'll be notified immediately and have 24 hours to confirm.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isFull ? 'Join Waitlist' : 'Register'}</Text>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={inp('name')} value={name} onChangeText={setName}
            placeholder="Jordan Williams" placeholderTextColor={colors.gray2}
            autoCapitalize="words" returnKeyType="next"
            onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={inp('email')} value={email} onChangeText={setEmail}
            placeholder="you@example.com" placeholderTextColor={colors.gray2}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            returnKeyType="next"
            onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
          />

          <Text style={styles.label}>Phone <Text style={styles.optional}>(optional — for reminders)</Text></Text>
          <TextInput
            style={inp('phone')} value={phone} onChangeText={setPhone}
            placeholder="(619) 555-0123" placeholderTextColor={colors.gray2}
            keyboardType="phone-pad"
            onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
          />
        </View>

        {!event.has_buy_in && (event.bring_options?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧺 Bringing anything?</Text>
            <Text style={styles.label}>Optional — the host sees this ahead of time</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {BRING_OPTIONS.filter(b => event.bring_options?.includes(b.key)).map(b => (
                <TouchableOpacity
                  key={b.key}
                  style={[styles.bringChip, bringing === b.key && styles.bringChipActive]}
                  onPress={() => setBringing(bringing === b.key ? null : b.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bringChipText}>{b.emoji} {b.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.bringChip, bringing === 'nothing' && styles.bringChipActive]}
                onPress={() => setBringing(bringing === 'nothing' ? null : 'nothing')}
                activeOpacity={0.7}
              >
                <Text style={styles.bringChipText}>✌️ Nothing</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {event.has_buy_in && !isFull && (
          <View style={styles.orderCard}>
            <Text style={styles.orderTitle}>💳 Order Summary</Text>
            <View style={styles.orderRow}>
              <Text style={styles.orderItem}>Buy-in</Text>
              <Text style={styles.orderVal}>${buyInAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderItem}>Platform fee (10%)</Text>
              <Text style={styles.orderVal}>${fee.toFixed(2)}</Text>
            </View>
            <View style={styles.orderDivider} />
            <View style={styles.orderRow}>
              <Text style={styles.orderTotal}>Total today</Text>
              <Text style={styles.orderTotalVal}>{formatAmount(totalCents)}</Text>
            </View>
            <Text style={styles.stripeNote}>🔒 Powered by Stripe · Your card is never stored by Bord</Text>
          </View>
        )}

        <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.8}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.agreeText}>
            I agree to the <Text style={styles.link}>event terms</Text> and understand I have 72 hours to cancel for a full refund.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, isFull && styles.submitBtnWaitlist, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitText}>
                {isFull ? 'Join Waitlist →' : event.has_buy_in ? `Pay ${formatAmount(totalCents)} & Register →` : 'Confirm RSVP →'}
              </Text>
          }
        </TouchableOpacity>

        <Text style={styles.submitNote}>
          {isFull
            ? "No payment today — only if a spot opens."
            : event.has_buy_in
            ? "You'll see Apple Pay / Google Pay or enter a card. 72-hr cancellation window starts after payment."
            : "Confirmation email sent immediately. 72-hr cancellation policy applies."}
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.md },

  eventCard: {
    flexDirection: 'row', overflow: 'hidden',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  eventCardBar:  { width: 4 },
  barCompete:    { backgroundColor: colors.orange },
  barGather:     { backgroundColor: colors.lavender },
  eventCardBody: { flex: 1, padding: spacing.md },
  eventTitle:    { fontSize: 17, fontWeight: '700', color: colors.white, marginBottom: 5, lineHeight: 22 },
  eventMeta:     { fontSize: 12, color: colors.gray1, fontWeight: '500', marginBottom: 2 },
  buyInBadge: {
    marginTop: spacing.xs, alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  buyInBadgeText: { fontSize: 11, fontWeight: '700', color: colors.orange },

  waitlistBanner: {
    backgroundColor: 'rgba(244,63,94,0.07)', borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)', borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  waitlistTitle: { fontSize: 14, fontWeight: '700', color: colors.rose, marginBottom: 5 },
  waitlistBody:  { fontSize: 13, color: colors.gray1, lineHeight: 20 },

  section:      { marginBottom: spacing.md },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: spacing.md },
  label: {
    fontSize: 11, fontWeight: '700', color: colors.gray2,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: spacing.sm,
  },
  optional: { fontWeight: '400', color: colors.gray2, textTransform: 'none', letterSpacing: 0 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 13,
    color: colors.white, fontSize: 15, fontWeight: '500',
  },
  inputFocused: { borderColor: 'rgba(249,115,22,0.5)' },

  orderCard: {
    backgroundColor: 'rgba(249,115,22,0.06)', borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.22)', borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  orderTitle:    { fontSize: 14, fontWeight: '700', color: colors.white, marginBottom: spacing.sm },
  orderRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderItem:     { fontSize: 13, color: colors.gray1 },
  orderVal:      { fontSize: 13, color: colors.white, fontWeight: '600' },
  orderDivider:  { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: spacing.sm },
  orderTotal:    { fontSize: 15, fontWeight: '700', color: colors.white },
  orderTotalVal: { fontSize: 18, fontWeight: '800', color: colors.orange },
  stripeNote:    { fontSize: 11, color: colors.gray2, marginTop: spacing.sm, lineHeight: 16 },

  agreeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.orange, borderColor: colors.orange },
  checkmark:   { color: colors.white, fontSize: 13, fontWeight: '700' },
  agreeText:   { flex: 1, fontSize: 13, color: colors.gray1, lineHeight: 19 },
  link:        { color: colors.orange, fontWeight: '600' },

  submitBtn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginBottom: spacing.sm,
  },
  submitBtnWaitlist: { backgroundColor: colors.rose },
  submitText:  { color: colors.white, fontSize: 17, fontWeight: '700' },
  submitNote:  { textAlign: 'center', fontSize: 12, color: colors.gray2, lineHeight: 18 },

  bringChip: {
    backgroundColor: 'rgba(155,142,196,0.06)', borderWidth: 1, borderColor: 'rgba(155,142,196,0.2)',
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
  },
  bringChipActive: { borderColor: '#9B8EC4', backgroundColor: 'rgba(155,142,196,0.18)' },
  bringChipText: { fontSize: 14, color: colors.gray1, fontWeight: '500' },
});