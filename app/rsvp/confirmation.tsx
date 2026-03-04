import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert, Modal, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import ShareCanvas, { ShareCanvasEvent } from '../../components/ShareCanvas';
import ShareFormatPicker from '../../components/ShareFormatPicker';
import { useInstagramShare } from '../../hooks/useInstagramShare';
import * as Calendar from 'expo-calendar';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, globalStyles } from '../../lib/theme';
import { formatDate, formatTime, setRunningLate, eventToCalendarPayload, createPost, parseHashtags } from '../../lib/supabase';

// Clever waitlist messages — rotated by waitlist position so it feels personal
const WAITLIST_HEADLINES = [
  "You're On Deck.",
  "First to Know.",
  "You're In the Wings.",
  "You're Next in Line.",
  "Holding Your Spot.",
];

const WAITLIST_SUBS = [
  (pos: number, name: string) =>
    `${name.split(' ')[0]}, you're #${pos} on the waitlist. The second someone drops, you're in — no scrambling, no group chat chaos.`,
  (pos: number, name: string) =>
    `Spots open up more than you'd think. You're #${pos}, ${name.split(' ')[0]} — sit tight and we'll text you the moment a slot opens.`,
  (pos: number, name: string) =>
    `You're #${pos} in line, ${name.split(' ')[0]}. If anyone cancels within their 72-hour window, you get the call first. Stay ready.`,
];

export default function RSVPConfirmation() {
  const params = useLocalSearchParams<{
    rsvpId: string;
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    eventEndTime: string;
    eventLocation: string;
    eventSlug: string;
    eventDescription: string;
    hasBuyIn: string;
    buyInAmount: string;
    name: string;
    isConfirmed: string;
    waitlistPosition: string;
    cancellationDeadline: string;
    eventCategory: string;
    eventCap: string;
    prizePool: string;
  }>();

  const { user, profile } = useAuth();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied,    setLinkCopied]    = useState(false);
  const {
    canvasRef: igCanvasRef,
    pickerVisible: igPickerVisible,
    selectedFormat: igSelectedFormat,
    isCapturing: igIsCapturing,
    openPicker: openIgPicker,
    closePicker: closeIgPicker,
    onFormatSelected: onIgFormatSelected,
  } = useInstagramShare();
  const [postingToFeed, setPostingToFeed] = useState(false);
  const isConfirmed  = params.isConfirmed === '1';
  const hasBuyIn     = params.hasBuyIn === '1';
  const waitlistPos  = params.waitlistPosition ? parseInt(params.waitlistPosition) : 1;
  const firstName    = (params.name ?? '').split(' ')[0];

  const [calAdded,    setCalAdded]    = useState(false);
  const [calLoading,  setCalLoading]  = useState(false);
  const [runningLate, setRunningLateState] = useState(false);
  const [lateLoading, setLateLoading] = useState(false);

  // ── Add to Calendar ──────────────────────────────────────────────────────
  const addToCalendar = async () => {
    setCalLoading(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow calendar access in your device settings.');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      // Prefer a default writable calendar
      const writable = calendars.find(c => c.allowsModifications && c.source?.isLocalAccount) ??
                       calendars.find(c => c.allowsModifications) ??
                       calendars[0];
      if (!writable) { Alert.alert('No calendar found'); return; }

      // Build a minimal Event object for the helper
      const mockEvent = {
        title:       params.eventTitle ?? '',
        date:        params.eventDate  ?? '',
        time:        params.eventTime  ?? '',
        end_time:    params.eventEndTime || null,
        location:    params.eventLocation ?? '',
        description: params.eventDescription || null,
        has_buy_in:  hasBuyIn,
        buy_in_amount: hasBuyIn ? Number(params.buyInAmount) : null,
        slug:        params.eventSlug ?? '',
      } as any;

      const payload = eventToCalendarPayload(mockEvent);

      await Calendar.createEventAsync(writable.id, {
        title:     payload.title,
        startDate: payload.startDate,
        endDate:   payload.endDate,
        location:  payload.location,
        notes:     payload.notes,
        alarms:    [{ relativeOffset: -60 }],  // 1hr reminder
      });

      setCalAdded(true);
      Alert.alert('Added!', `"${params.eventTitle}" is now in your calendar with a 1-hour reminder.`);
    } catch (e: any) {
      Alert.alert('Could not add', e?.message ?? 'Unknown error');
    } finally {
      setCalLoading(false);
    }
  };

  // ── Running Late ─────────────────────────────────────────────────────────
  const handleRunningLate = async () => {
    if (!params.rsvpId || runningLate) return;
    setLateLoading(true);
    try {
      await setRunningLate(params.rsvpId);
      setRunningLateState(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not send notification');
    } finally {
      setLateLoading(false);
    }
  };

  // Pick headline + sub based on waitlist position
  const wlHeadline = WAITLIST_HEADLINES[(waitlistPos - 1) % WAITLIST_HEADLINES.length];
  const wlSub      = WAITLIST_SUBS[(waitlistPos - 1) % WAITLIST_SUBS.length](waitlistPos, params.name ?? '');

  const deadline = params.cancellationDeadline
    ? new Date(params.cancellationDeadline).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : null;

  const eventUrl = `https://bordevents.com/events/${params.eventSlug}`;

  // Native share sheet — opens Instagram, Snapchat, Threads, Messages, etc.
  const shareNative = async () => {
    setShowShareMenu(false);
    try {
      await Share.share({
        message: `🎉 ${params.eventTitle}\n${formatDate(params.eventDate ?? '')} · ${params.eventLocation ?? ''}\n\nJoin me on Bord! ${eventUrl}`,
        url: eventUrl,
        title: params.eventTitle ?? 'Check out this event on Bord',
      });
    } catch {}
  };

  const copyLink = async () => {
    setShowShareMenu(false);
    await Clipboard.setStringAsync(eventUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const postToFeed = async () => {
    setShowShareMenu(false);
    if (!user) { router.push('/(auth)/sign-in'); return; }
    setPostingToFeed(true);
    try {
      const caption = `Just registered for ${params.eventTitle}! 🎉 ${formatDate(params.eventDate ?? '')} · ${params.eventLocation ?? ''}\n\n${eventUrl} #bord #events`;
      await createPost({
        author_id:  user.id,
        event_id:   params.eventId ?? null,
        caption,
        media_url:  null,
        media_type: 'text',
        hashtags:   parseHashtags(caption),
      });
      Alert.alert('Posted to Bord! 🎉', 'Others can tap your post to see the event and register.');
    } catch (e: any) {
      Alert.alert('Could not post', e.message ?? 'Please try again.');
    } finally {
      setPostingToFeed(false);
    }
  };

  const shareEvent = () => openIgPicker();

  return (
    <View style={globalStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── STATUS ICON ──────────────────────────────────────────── */}
        <View style={[styles.iconRing, !isConfirmed && styles.iconRingWaitlist]}>
          <Text style={styles.icon}>{isConfirmed ? '✅' : '🎯'}</Text>
        </View>

        {/* ── HEADLINE ─────────────────────────────────────────────── */}
        {isConfirmed ? (
          <>
            <Text style={styles.headlineConfirmed}>{"You're In!"}</Text>
            <Text style={styles.sub}>
              See you there, {firstName}. A confirmation's been sent to your email.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.headlineWaitlist}>{wlHeadline}</Text>
            <Text style={styles.sub}>{wlSub}</Text>
          </>
        )}

        {/* ── EVENT CARD ───────────────────────────────────────────── */}
        <View style={styles.eventCard}>
          <View style={[styles.eventCardBar, !isConfirmed && styles.eventCardBarWaitlist]} />
          <View style={styles.eventCardBody}>
            <Text style={styles.eventTitle}>{params.eventTitle}</Text>
            <Text style={styles.eventMeta}>📅 {formatDate(params.eventDate)} · {formatTime(params.eventTime)}</Text>
            <Text style={styles.eventMeta}>📍 {params.eventLocation}</Text>
          </View>
        </View>

        {/* ── CONFIRMED-SPECIFIC CONTENT ───────────────────────────── */}
        {isConfirmed && (
          <>
            {/* Cancellation window */}
            {deadline && (
              <View style={styles.cancelCard}>
                <Text style={styles.cancelTitle}>⏱ Cancellation Window</Text>
                <Text style={styles.cancelBody}>
                  You can cancel for a full refund until{' '}
                  <Text style={{ color: colors.white, fontWeight: '700' }}>{deadline}</Text>.
                  After that, your spot is locked. The link to cancel is in your confirmation email.
                </Text>
              </View>
            )}

            {/* What to bring */}
            <View style={styles.checklistCard}>
                <Text style={styles.checklistTitle}>{"Checklist: You're all set"}</Text>
              <CheckRow text="Check your email — the host will include all details" />
              <CheckRow text="Show up on time — your name's on the roster" />
              <CheckRow text="Questions? Reach the host via the event board" />
            </View>
          </>
        )}

        {/* ── WAITLIST-SPECIFIC CONTENT ────────────────────────────── */}
        {!isConfirmed && (
          <>
            <View style={styles.waitlistCard}>
              <Text style={styles.waitlistCardTitle}>📋 How the waitlist works</Text>
              <WaitlistRow label="Your position" value={`#${waitlistPos}`} highlight />
              <WaitlistRow label="When you'll hear" value="The second someone cancels" />
              <WaitlistRow label="Response window" value="24 hours to confirm your spot" />
              <WaitlistRow label="Payment" value={hasBuyIn ? 'Only charged if you get a spot' : 'Free — nothing to pay'} />
              <WaitlistRow label="Notification" value="Email + text if you added your number" />
            </View>

            <View style={styles.waitlistQuoteCard}>
              <Text style={styles.waitlistQuote}>
                "Spots open up more often than you'd think — people's schedules change. Cancellations close within 72 hours, so the list moves fast."
              </Text>
              <Text style={styles.waitlistQuoteAttrib}>— The Bord Team</Text>
            </View>
          </>
        )}

        {/* ── ACTIONS ──────────────────────────────────────────────── */}
        <View style={styles.actions}>
          {isConfirmed && (
            <>
              {/* Ticket / QR — only for paid events */}
              {hasBuyIn && params.rsvpId && (
                <TouchableOpacity
                  style={styles.btnTicket}
                  onPress={() => router.push(`/ticket/${params.rsvpId}`)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnTicketText}>🎟️ View My Ticket & QR Code</Text>
                </TouchableOpacity>
              )}

              {/* Calendar sync */}
              <TouchableOpacity
                style={[styles.btnCalendar, calAdded && styles.btnCalendarDone]}
                onPress={addToCalendar}
                activeOpacity={0.85}
                disabled={calAdded || calLoading}
              >
                <Text style={styles.btnCalendarText}>
                  {calLoading ? 'Adding…' : calAdded ? '✓ Added to Calendar' : '📅 Add to Calendar'}
                </Text>
              </TouchableOpacity>

              {/* Scan to Enter — shown for paid events only */}
              {hasBuyIn && (
                <TouchableOpacity
                  style={styles.btnScan}
                  onPress={() => router.push('/ticket/scan')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnScanText}>🎟️ Scan to Enter at the Door</Text>
                </TouchableOpacity>
              )}

              {/* Running Late */}
              <TouchableOpacity
                style={[styles.btnLate, runningLate && styles.btnLateDone]}
                onPress={handleRunningLate}
                activeOpacity={0.85}
                disabled={runningLate || lateLoading}
              >
                <Text style={styles.btnLateText}>
                  {lateLoading ? 'Sending…' : runningLate ? '✓ Host Notified' : '🕐 I\'m Running Late'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnShare} onPress={shareEvent} activeOpacity={0.85}>
                <Text style={styles.btnShareText}>📲 Share this Event →</Text>
              </TouchableOpacity>

      {/* ── Share menu modal ─────────────────────────────────── */}
      {/* ── Share as Image modal ──────────────────────────────────── */}
      <ShareFormatPicker
        visible={igPickerVisible}
        onSelect={onIgFormatSelected}
        onDismiss={closeIgPicker}
        isCapturing={igIsCapturing}
      />

      {/* Offscreen ShareCanvas for confirmation page */}
      <ShareCanvas
        ref={igCanvasRef}
        format={igSelectedFormat ?? 'story'}
        event={{
          title:         params.eventTitle ?? '',
          date:          params.eventDate ?? '',
          time:          params.eventTime ?? '',
          price:         params.hasBuyIn === '1' && params.buyInAmount ? parseFloat(params.buyInAmount) : null,
          spotsLeft:     0,
          totalSpots:    parseInt(params.eventCap ?? '0') || 0,
          category:      params.eventCategory ?? 'EVENT',
          coverImageUrl: null,
          eventUrl:      `https://bordevents.com/events/${params.eventSlug}`,
        }}
      />

      <Modal visible={showShareMenu} transparent animationType="fade" onRequestClose={() => setShowShareMenu(false)}>
        <Pressable style={shareStyles.backdrop} onPress={() => setShowShareMenu(false)}>
          <Pressable style={shareStyles.sheet} onPress={e => e.stopPropagation()}>
            <View style={shareStyles.handle} />
            <Text style={shareStyles.title}>Share Event</Text>
            <Text style={shareStyles.subtitle} numberOfLines={2}>{params.eventTitle}</Text>

            {/* Share as image card */}
            <TouchableOpacity
              style={shareStyles.row}
              onPress={() => { setShowShareMenu(false); openIgPicker(); }}
              activeOpacity={0.8}
            >
              <View style={[shareStyles.iconBox, { backgroundColor: 'rgba(249,115,22,0.18)' }]}>
                <Text style={shareStyles.icon}>🖼️</Text>
              </View>
              <View style={shareStyles.rowText}>
                <Text style={shareStyles.rowTitle}>Share as Image</Text>
                <Text style={shareStyles.rowSub}>Post to Instagram, Snapchat, Threads & more</Text>
              </View>
            </TouchableOpacity>

            <View style={shareStyles.divider} />

            {/* Native share — opens system sheet with Instagram, Snapchat, Threads, etc. */}
            <TouchableOpacity style={shareStyles.row} onPress={shareNative} activeOpacity={0.8}>
              <View style={[shareStyles.iconBox, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                <Text style={shareStyles.icon}>📤</Text>
              </View>
              <View style={shareStyles.rowText}>
                <Text style={shareStyles.rowTitle}>Share Link via...</Text>
                <Text style={shareStyles.rowSub}>Messages, WhatsApp, email & more</Text>
              </View>
            </TouchableOpacity>

            <View style={shareStyles.divider} />

            {/* Copy link */}
            <TouchableOpacity style={shareStyles.row} onPress={copyLink} activeOpacity={0.8}>
              <View style={[shareStyles.iconBox, { backgroundColor: 'rgba(155,142,196,0.12)' }]}>
                <Text style={shareStyles.icon}>🔗</Text>
              </View>
              <View style={shareStyles.rowText}>
                <Text style={shareStyles.rowTitle}>Copy Event Link</Text>
                <Text style={shareStyles.rowSub}>{eventUrl}</Text>
              </View>
            </TouchableOpacity>

            <View style={shareStyles.divider} />

            {/* Post to Bord feed */}
            <TouchableOpacity
              style={[shareStyles.row, postingToFeed && { opacity: 0.5 }]}
              onPress={postToFeed}
              disabled={postingToFeed}
              activeOpacity={0.8}
            >
              <View style={[shareStyles.iconBox, { backgroundColor: 'rgba(52,211,153,0.12)' }]}>
                <Text style={shareStyles.icon}>{postingToFeed ? '⏳' : '🤝'}</Text>
              </View>
              <View style={shareStyles.rowText}>
                <Text style={shareStyles.rowTitle}>{postingToFeed ? 'Posting…' : 'Post to Bord Feed'}</Text>
                <Text style={shareStyles.rowSub}>Others on Bord can tap to see the event & register</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={shareStyles.cancelBtn} onPress={() => setShowShareMenu(false)} activeOpacity={0.8}>
              <Text style={shareStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
            </>
          )}
          <TouchableOpacity
            style={styles.btnHome}
            onPress={() => router.replace('/')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnHomeText}>Back to Bord</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function CheckRow({ text }: { text: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkDot}>
        <Text style={styles.checkDotText}>✓</Text>
      </View>
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

function WaitlistRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.wlRow}>
      <Text style={styles.wlLabel}>{label}</Text>
      <Text style={[styles.wlValue, highlight && { color: colors.orange, fontSize: 17 }]}>{value}</Text>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.xxl,
    paddingTop: spacing.xl, alignItems: 'center',
  },

  iconRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 2, borderColor: 'rgba(52,211,153,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconRingWaitlist: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor:     'rgba(249,115,22,0.35)',
  },
  icon: { fontSize: 42 },

  headlineConfirmed: {
    fontSize: 40, fontWeight: '800', color: colors.green,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  headlineWaitlist: {
    fontSize: 34, fontWeight: '800', color: colors.orange,
    textAlign: 'center', marginBottom: spacing.sm, lineHeight: 40,
  },
  sub: {
    fontSize: 15, color: colors.gray1, textAlign: 'center',
    lineHeight: 23, marginBottom: spacing.xl, paddingHorizontal: spacing.sm,
  },

  // Event card
  eventCard: {
    width: '100%', backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', flexDirection: 'row', marginBottom: spacing.md,
  },
  eventCardBar:         { width: 4, backgroundColor: colors.green },
  eventCardBarWaitlist: { backgroundColor: colors.orange },
  eventCardBody: { flex: 1, padding: spacing.md },
  eventTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginBottom: 6 },
  eventMeta:  { fontSize: 13, color: colors.gray1, fontWeight: '500', marginBottom: 3 },

  // Cancellation
  cancelCard: {
    width: '100%', backgroundColor: 'rgba(249,115,22,0.07)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.22)',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  cancelTitle: { fontSize: 14, fontWeight: '700', color: colors.orange, marginBottom: spacing.xs },
  cancelBody:  { fontSize: 13, color: colors.gray1, lineHeight: 20 },

  // Checklist
  checklistCard: {
    width: '100%', backgroundColor: 'rgba(52,211,153,0.05)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.18)',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  checklistTitle: { fontSize: 14, fontWeight: '700', color: colors.green, marginBottom: spacing.sm },
  checkRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' },
  checkDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(52,211,153,0.15)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkDotText: { color: colors.green, fontSize: 12, fontWeight: '700' },
  checkText: { flex: 1, fontSize: 13, color: colors.gray1, lineHeight: 19 },

  // Waitlist card
  waitlistCard: {
    width: '100%', backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  waitlistCardTitle: { fontSize: 14, fontWeight: '700', color: colors.white, marginBottom: spacing.sm },
  wlRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  wlLabel: { fontSize: 13, color: colors.gray1, flex: 1 },
  wlValue: { fontSize: 13, color: colors.white, fontWeight: '600', textAlign: 'right', flex: 1 },

  // Waitlist quote
  waitlistQuoteCard: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.orange,
  },
  waitlistQuote: { fontSize: 13, color: colors.gray1, fontStyle: 'italic', lineHeight: 20, marginBottom: spacing.xs },
  waitlistQuoteAttrib: { fontSize: 11, color: colors.gray2, fontWeight: '600' },

  // Actions
  actions: { width: '100%', gap: spacing.sm },
  btnTicket: {
    backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.orange,
    paddingVertical: 16, alignItems: 'center',
  },
  btnTicketText: { color: colors.orange, fontSize: 16, fontWeight: '800' },
  btnCalendar: {
    backgroundColor: 'rgba(155,142,196,0.12)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(155,142,196,0.35)',
    paddingVertical: 15, alignItems: 'center',
  },
  btnCalendarDone: { borderColor: 'rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)' },
  btnCalendarText: { color: '#9B8EC4', fontSize: 15, fontWeight: '700' },
  btnScan: {
    backgroundColor: 'rgba(52,211,153,0.1)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.35)',
    paddingVertical: 15, alignItems: 'center',
  },
  btnScanText: { color: colors.green, fontSize: 15, fontWeight: '700' },
  btnLate: {
    backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    paddingVertical: 15, alignItems: 'center',
  },
  btnLateDone: { borderColor: 'rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)' },
  btnLateText: { color: colors.orange, fontSize: 15, fontWeight: '700' },
  btnShare: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  btnShareText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  btnHome: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 15, alignItems: 'center',
  },
  btnHomeText: { color: colors.gray1, fontSize: 15, fontWeight: '600' },
});

const shareStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E1E1E', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#444', borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  title:    { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#A8A29E', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon:     { fontSize: 22 },
  rowText:  { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  rowSub:   { fontSize: 12, color: '#A8A29E', lineHeight: 17 },
  divider:  { height: 1, backgroundColor: '#2C2C2C', marginVertical: 2 },
  cancelBtn: {
    marginTop: 16, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#2C2C2C', borderRadius: 12,
  },
  cancelText: { color: '#A8A29E', fontSize: 15, fontWeight: '600' },
});
