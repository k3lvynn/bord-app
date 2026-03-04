import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Share, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';

import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import * as ExpoClipboard from 'expo-clipboard';
import { colors, spacing, radius, globalStyles} from '../../../lib/theme';
import { supabase, getEventRSVPs, formatDate, formatTime, sendThankYouNote, createPost, parseHashtags, Event, RSVP, EventAdmin, AdminRole, getEventAdmins, addEventAdmin, removeEventAdmin, searchBordUsers } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import ShareCanvas from '../../../components/ShareCanvas';
import ShareFormatPicker from '../../../components/ShareFormatPicker';
import { useInstagramShare } from '../../../hooks/useInstagramShare';

const RSVP_BASE_URL = 'https://bordevents.com/events';

export default function HostEventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [tab, setTab] = useState<'confirmed' | 'waitlist' | 'admins'>('confirmed');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [postingToFeed, setPostingToFeed] = useState(false);
  const {
    canvasRef: igCanvasRef,
    pickerVisible: igPickerVisible,
    selectedFormat: igSelectedFormat,
    isCapturing: igIsCapturing,
    openPicker: openIgPicker,
    closePicker: closeIgPicker,
    onFormatSelected: onIgFormatSelected,
  } = useInstagramShare();
  // Thank-you note state
  const [noteTarget, setNoteTarget] = useState<RSVP | null>(null);
  const [noteMessage, setNoteMessage] = useState('');
  const [sendingNote, setSendingNote] = useState(false);

  // Edit event state — full field set
  const [showEditModal,    setShowEditModal]    = useState(false);
  const [editTitle,        setEditTitle]        = useState('');
  const [editLocation,     setEditLocation]     = useState('');
  const [editDescription,  setEditDescription]  = useState('');
  const [editCap,          setEditCap]          = useState('');
  const [editDate,         setEditDate]         = useState('');
  const [editTime,         setEditTime]         = useState('');
  const [editBuyIn,        setEditBuyIn]        = useState('');
  const [editHasBuyIn,     setEditHasBuyIn]     = useState(false);
  const [editRecurrence,   setEditRecurrence]   = useState('none');
  const [editSaving,       setEditSaving]       = useState(false);

  const [myAdminRole,   setMyAdminRole]   = useState<AdminRole | null>(null);
  // Admin state
  const [admins,        setAdmins]        = useState<EventAdmin[]>([]);
  const [adminSearch,   setAdminSearch]   = useState('');
  const [adminResults,  setAdminResults]  = useState<any[]>([]);
  const [adminSearching, setAdminSearching] = useState(false);
  const [addingAdmin,   setAddingAdmin]   = useState<string | null>(null); // userId being added

  const openEdit = () => {
    if (!event) return;
    setEditTitle(event.title);
    setEditLocation(event.location);
    setEditDescription(event.description ?? '');
    setEditCap(String(event.cap));
    setEditDate(event.date ?? '');
    setEditTime(event.time ?? '');
    setEditHasBuyIn(!!event.has_buy_in);
    setEditBuyIn(event.buy_in_amount ? String(event.buy_in_amount) : '');
    setEditRecurrence(event.recurrence ?? 'none');
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    const cap = parseInt(editCap, 10);
    if (!editTitle.trim()) { Alert.alert('Required', 'Event title cannot be empty.'); return; }
    if (isNaN(cap) || cap < 1) { Alert.alert('Invalid cap', 'Capacity must be at least 1.'); return; }
    setEditSaving(true);
    try {
      const buyInAmount = editHasBuyIn ? parseFloat(editBuyIn) : null;
      if (editHasBuyIn && (isNaN(buyInAmount!) || buyInAmount! <= 0)) {
        Alert.alert('Invalid buy-in', 'Enter a valid buy-in amount (e.g. 5.00).');
        setEditSaving(false); return;
      }
      if (!editDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        Alert.alert('Invalid date', 'Date must be in YYYY-MM-DD format.');
        setEditSaving(false); return;
      }
      // Re-geocode if location changed
      let latUpdate: number | null | undefined = undefined;
      let lngUpdate: number | null | undefined = undefined;
      if (editLocation.trim() !== event?.location) {
        try {
          const Location = require('expo-location');
          const geo = await Location.geocodeAsync(editLocation.trim());
          if (geo.length > 0) {
            latUpdate = geo[0].latitude;
            lngUpdate = geo[0].longitude;
          } else {
            latUpdate = null; lngUpdate = null;
          }
        } catch (_) {}
      }

      const updatePayload: Record<string, any> = {
        title:        editTitle.trim(),
        location:     editLocation.trim(),
        description:  editDescription.trim() || null,
        cap,
        date:         editDate,
        time:         editTime.trim() || null,
        has_buy_in:   editHasBuyIn,
        buy_in_amount: buyInAmount,
        recurrence:   editRecurrence,
      };
      if (latUpdate !== undefined) { updatePayload.latitude = latUpdate; updatePayload.longitude = lngUpdate; }

      const { error } = await supabase.from('events').update(updatePayload).eq('id', id!);
      if (error) throw error;
      setShowEditModal(false);
      load();
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'This will permanently delete the event and cancel all RSVPs. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('events').delete().eq('id', id!);
              if (error) throw error;
              router.replace('/(tabs)/my-events');
            } catch (e: any) {
              Alert.alert('Delete failed', e.message ?? 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const load = async () => {
    try {
      const { data: ev } = await supabase.from('events').select('*').eq('id', id).single();
      setEvent(ev);
      const all = await getEventRSVPs(id!);
      setRsvps(all);
      const adminList = await getEventAdmins(id!).catch(() => []);
      setAdmins(adminList);
      // Check if current user is an appointed admin (for non-host access)
      if (user) {
        const myRole = adminList.find(a => a.user_id === user.id)?.role ?? null;
        setMyAdminRole(myRole);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [id]));
  const onRefresh = () => { setRefreshing(true); load(); };


  // ── Admin helpers ──────────────────────────────────────────────────────────
  const searchAdmins = async (q: string) => {
    setAdminSearch(q);
    if (q.length < 2) { setAdminResults([]); return; }
    setAdminSearching(true);
    try {
      const results = await searchBordUsers(q);
      // Filter out current host and already-appointed admins
      const adminIds = new Set(admins.map(a => a.user_id));
      setAdminResults(results.filter(r => r.id !== user?.id && !adminIds.has(r.id)));
    } finally {
      setAdminSearching(false);
    }
  };

  const appointAdmin = async (userId: string, role: AdminRole) => {
    if (!user || !id) return;
    setAddingAdmin(userId);
    try {
      await addEventAdmin(id, user.id, userId, role);
      const updated = await getEventAdmins(id);
      setAdmins(updated);
      setAdminResults(prev => prev.filter(r => r.id !== userId));
      setAdminSearch('');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not appoint admin.');
    } finally {
      setAddingAdmin(null);
    }
  };

  const dismissAdmin = (userId: string, name: string) => {
    Alert.alert(
      'Remove Admin',
      `Remove ${name} as admin for this event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await removeEventAdmin(id!, userId);
            setAdmins(prev => prev.filter(a => a.user_id !== userId));
          } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Could not remove admin.');
          }
        }},
      ]
    );
  };

  const isOwner = event?.host_id === user?.id;
  const canManage = isOwner || !!myAdminRole; // both host and admins see the page

  const rsvpLink = event ? `${RSVP_BASE_URL}/${event.slug}` : '';
  const confirmed = rsvps.filter(r => r.status === 'confirmed');
  const waitlisted = rsvps.filter(r => r.status === 'waitlisted').sort((a, b) => (a.waitlist_position ?? 99) - (b.waitlist_position ?? 99));

  const copyLink = async () => {
    setShowShareSheet(false);
    await ExpoClipboard.setStringAsync(rsvpLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareNative = async () => {
    setShowShareSheet(false);
    try {
      await Share.share({
        message: (event?.title ?? '') + '\n' + formatDate(event?.date ?? '') + ' · ' + (event?.location ?? '') + '\n\n' + rsvpLink,
        url: rsvpLink,
        title: event?.title,
      });
    } catch {}
  };

  const postToBordFeed = async () => {
    setShowShareSheet(false);
    if (!user || !event) return;
    setPostingToFeed(true);
    try {
      const caption = event.title + ' — ' + formatDate(event.date) + ' at ' + event.location + '. Register now!\n\n' + rsvpLink + ' #bord #events';
      await createPost({
        author_id: user.id, event_id: event.id,
        caption, media_url: null, media_type: 'text',
        hashtags: parseHashtags(caption),
      });
      Alert.alert('Posted to Bord Feed!', 'Others can tap your post to see this event.');
    } catch (e: any) {
      Alert.alert('Could not post', e?.message ?? 'Please try again.');
    } finally {
      setPostingToFeed(false);
    }
  };

  if (loading || !event) {
    return (
      <View style={globalStyles.screen}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.gray1 }}>Loading...</Text>
        </View>
      </View>
    );
  }

  const spotsLeft = event.cap - event.rsvp_count;
  const fillPct = Math.min(100, (event.rsvp_count / event.cap) * 100);

  return (
    <>
    <View style={globalStyles.screen}>
      {/* Edit Event Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Scrim tap to close */}
          <TouchableOpacity style={hstyles.modalOverlay} activeOpacity={1} onPress={() => setShowEditModal(false)} />
          {/* Sheet sits at bottom */}
          <View style={hstyles.editSheet}>
            {/* Drag handle */}
            <View style={{ width: 36, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 14 }} />
            <Text style={hstyles.noteTitle}>✏️ Edit Event</Text>
            {/* Scrollable field area */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >

              {/* Title */}
              <Text style={hstyles.editLabel}>Event Title</Text>
              <TextInput style={hstyles.noteInput} value={editTitle} onChangeText={setEditTitle}
                placeholderTextColor={colors.gray2} placeholder="Event title" />

              {/* Date + Time row */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={hstyles.editLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput style={hstyles.noteInput} value={editDate} onChangeText={setEditDate}
                    placeholderTextColor={colors.gray2} placeholder="2025-03-15"
                    keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={hstyles.editLabel}>Time (HH:MM)</Text>
                  <TextInput style={hstyles.noteInput} value={editTime} onChangeText={setEditTime}
                    placeholderTextColor={colors.gray2} placeholder="09:00"
                    keyboardType="numbers-and-punctuation" />
                </View>
              </View>

              {/* Location */}
              <Text style={hstyles.editLabel}>Location</Text>
              <TextInput style={hstyles.noteInput} value={editLocation} onChangeText={setEditLocation}
                placeholderTextColor={colors.gray2} placeholder="Location" />

              {/* Capacity */}
              <Text style={hstyles.editLabel}>Capacity</Text>
              <TextInput style={hstyles.noteInput} value={editCap} onChangeText={setEditCap}
                placeholderTextColor={colors.gray2} keyboardType="number-pad" placeholder="Max attendees" />

              {/* Buy-in toggle */}
              <View style={hstyles.editToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={hstyles.editLabel}>Paid Event / Buy-In</Text>
                  <Text style={{ fontSize: 11, color: colors.gray2 }}>Toggle to charge admission</Text>
                </View>
                <TouchableOpacity
                  style={[hstyles.editToggle, editHasBuyIn && hstyles.editToggleOn]}
                  onPress={() => setEditHasBuyIn(v => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: editHasBuyIn ? '#fff' : colors.gray2 }}>
                    {editHasBuyIn ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
              {editHasBuyIn && (
                <>
                  <Text style={hstyles.editLabel}>Buy-In Amount ($)</Text>
                  <TextInput style={hstyles.noteInput} value={editBuyIn} onChangeText={setEditBuyIn}
                    placeholderTextColor={colors.gray2} keyboardType="decimal-pad" placeholder="5.00" />
                </>
              )}

              {/* Recurrence */}
              <Text style={hstyles.editLabel}>Recurrence</Text>
              <View style={hstyles.editSegment}>
                {(['none','weekly','biweekly','monthly'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[hstyles.editSegBtn, editRecurrence === r && hstyles.editSegBtnActive]}
                    onPress={() => setEditRecurrence(r)}
                    activeOpacity={0.8}
                  >
                    <Text style={[hstyles.editSegBtnText, editRecurrence === r && { color: '#fff' }]}>
                      {r === 'none' ? 'One-time' : r === 'biweekly' ? 'Bi-weekly' : r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={hstyles.editLabel}>Description (optional)</Text>
              <TextInput style={[hstyles.noteInput, { minHeight: 70 }]} value={editDescription}
                onChangeText={setEditDescription} placeholderTextColor={colors.gray2}
                placeholder="Event description..." multiline numberOfLines={3} />

              <View style={[hstyles.noteActions, { marginTop: 16 }]}>
                <TouchableOpacity style={hstyles.noteCancelBtn} onPress={() => setShowEditModal(false)} activeOpacity={0.8}>
                  <Text style={hstyles.noteCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[hstyles.noteSendBtn, editSaving && { opacity: 0.5 }]}
                  onPress={saveEdit} disabled={editSaving} activeOpacity={0.8}
                >
                  <Text style={hstyles.noteSendText}>{editSaving ? 'Saving…' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Thank-You Note Modal ── */}
      <Modal visible={!!noteTarget} transparent animationType="slide" onRequestClose={() => setNoteTarget(null)}>
        <View style={hstyles.modalOverlay}>
          <View style={hstyles.noteModal}>
            <Text style={hstyles.noteTitle}>💌 Send a Thank-You</Text>
            <Text style={hstyles.noteSub}>
              To {noteTarget?.name?.split(' ')[0]} for coming to {event.title}
            </Text>
            <TextInput
              style={hstyles.noteInput}
              placeholder={"Write a short note... (e.g. 'Great energy, see you next time!')"}
              placeholderTextColor={colors.gray2}
              value={noteMessage}
              onChangeText={setNoteMessage}
              multiline
              numberOfLines={4}
              maxLength={300}
            />
            <Text style={hstyles.noteCount}>{noteMessage.length}/300</Text>
            <View style={hstyles.noteActions}>
              <TouchableOpacity
                style={hstyles.noteCancelBtn}
                onPress={() => { setNoteTarget(null); setNoteMessage(''); }}
                activeOpacity={0.8}
              >
                <Text style={hstyles.noteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[hstyles.noteSendBtn, (!noteMessage.trim() || sendingNote) && { opacity: 0.5 }]}
                activeOpacity={0.8}
                disabled={!noteMessage.trim() || sendingNote}
                onPress={async () => {
                  if (!user || !noteTarget || !event) return;
                  setSendingNote(true);
                  try {
                    // We use event_id + from_user_id + to_user_id
                    // to_user_id: look up profile by email — best effort
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('id')
                      .eq('id', noteTarget.user_id ?? noteTarget.id)
                      .maybeSingle()
                      .catch(() => ({ data: null }));

                    await sendThankYouNote({
                      event_id:     event.id,
                      from_user_id: user.id,
                      to_user_id:   profile?.id ?? noteTarget.id, // fallback: rsvp id as placeholder
                      message:      noteMessage.trim(),
                    });
                    setNoteTarget(null);
                    setNoteMessage('');
                    Alert.alert('Sent! 💌', `Your note to ${noteTarget.name?.split(' ')[0]} was delivered.`);
                  } catch (e: any) {
                    Alert.alert('Could not send', e?.message ?? 'Try again');
                  } finally {
                    setSendingNote(false);
                  }
                }}
              >
                <Text style={hstyles.noteSendText}>{sendingNote ? 'Sending…' : 'Send Note 💌'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
      >
        {/* Event header */}
        <View style={styles.eventHeader}>
          {event.has_buy_in && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>💰 ${event.buy_in_amount} BUY-IN · COMPETE</Text>
            </View>
          )}
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventMeta}>
            📅 {formatDate(event.date)} · {formatTime(event.time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
          </Text>
          <Text style={styles.eventMeta}>📍 {event.location}</Text>
          {/* Privacy indicator */}
          <View style={[styles.badge, event.is_private
            ? { backgroundColor:'rgba(155,142,196,0.12)', borderColor:'rgba(155,142,196,0.35)' }
            : { backgroundColor:'rgba(52,211,153,0.08)', borderColor:'rgba(52,211,153,0.25)' }
          ]}>
            <Text style={[styles.badgeText, { color: event.is_private ? '#9B8EC4' : '#34D399' }]}>
              {event.is_private ? '🔒 PRIVATE · INVITE ONLY' : '🌐 PUBLIC EVENT'}
            </Text>
          </View>

          {/* Edit / Delete — host only */}
          {isOwner && (
            <View style={styles.hostActions}>
              <TouchableOpacity style={styles.editEventBtn} onPress={openEdit} activeOpacity={0.8}>
                <Text style={styles.editEventBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteEventBtn} onPress={handleDelete} activeOpacity={0.8}>
                <Text style={styles.deleteEventBtnText}>🗑️ Delete</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Admin role badge */}
          {!isOwner && myAdminRole && (
            <View style={styles.adminAccessBanner}>
              <Text style={styles.adminAccessText}>
                {myAdminRole === 'captain' ? '⚑ You are a Team Captain' : '👑 You are a Co-Admin'} for this event
              </Text>
              <Text style={styles.adminAccessSub}>You can view attendees, send announcements, and manage RSVPs.</Text>
            </View>
          )}
        </View>

        {/* Cap bar */}
        <View style={styles.capCard}>
          <View style={styles.capHeader}>
            <Text style={styles.capLabel}>RSVP CAP: {event.cap}</Text>
            <Text style={[styles.capCount, spotsLeft <= 0 && { color: colors.rose }]}>
              {spotsLeft <= 0 ? `FULL · ${event.waitlist_count} waitlisted` : `${event.rsvp_count} registered · ${spotsLeft} left`}
            </Text>
          </View>
          <View style={styles.capBarBg}>
            <View style={[styles.capBarFill, { width: `${fillPct}%` as any }, spotsLeft <= 0 && { backgroundColor: colors.rose }]} />
          </View>
        </View>

        {/* RSVP Link card */}
        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>🔗 YOUR RSVP LINK</Text>
          <Text style={styles.linkUrl} numberOfLines={1}>{rsvpLink}</Text>
          <View style={styles.linkBtns}>
            <TouchableOpacity style={styles.linkBtn} onPress={copyLink} activeOpacity={0.8}>
              <Text style={styles.linkBtnText}>{copied ? '✓ Copied!' : 'Copy Link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkBtn, styles.linkBtnShare]} onPress={() => setShowShareSheet(true)} activeOpacity={0.8}>
              <Text style={[styles.linkBtnText, { color: colors.orange }]}>Share →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Door QR — shown for paid events so host can display at entrance */}
        {event.has_buy_in && (
          <TouchableOpacity
            style={styles.doorQrBtn}
            onPress={() => router.push({ pathname: '/ticket/door/[slug]', params: { slug: event.slug } })}
            activeOpacity={0.85}
          >
            <Text style={styles.doorQrEmoji}>🚪</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.doorQrTitle}>Door QR Code</Text>
              <Text style={styles.doorQrSub}>Show at the entrance — attendees scan to verify their ticket</Text>
            </View>
            <Text style={styles.doorQrArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Tournament bracket button */}
        {event.is_tournament && (
          <TouchableOpacity
            style={styles.bracketBtn}
            onPress={() => router.push({
              pathname: '/tournament/manage',
              params: {
                eventId: event.id,
                eventTitle: event.title,
                prizePool: String(Math.floor((event.buy_in_amount ?? 0) * event.rsvp_count * 0.9)),
              }
            })}
            activeOpacity={0.85}
          >
            <Text style={styles.bracketBtnText}>🏆 Manage Tournament Bracket →</Text>
          </TouchableOpacity>
        )}

        {/* Door scanner button — shown for all paid events */}
        {event.has_buy_in && (
          <TouchableOpacity
            style={styles.scannerBtn}
            onPress={() => router.push({
              pathname: '/host/scan/[eventId]',
              params: { eventId: event.id, eventTitle: event.title },
            })}
            activeOpacity={0.85}
          >
            <Text style={styles.scannerBtnText}>
              {(event as any).door_checkin_enabled ? '📷 Open Door Scanner' : '📋 Door Check-In List'}
            </Text>
            <Text style={styles.scannerBtnSub}>
              {(event as any).door_checkin_enabled
                ? 'Scan QR codes or check names manually'
                : 'Manually check attendees in at the door'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'confirmed' && styles.tabActive]}
            onPress={() => setTab('confirmed')}
          >
            <Text style={[styles.tabText, tab === 'confirmed' && styles.tabTextActive]}>
              Confirmed ({confirmed.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'waitlist' && styles.tabActive]}
            onPress={() => setTab('waitlist')}
          >
            <Text style={[styles.tabText, tab === 'waitlist' && styles.tabTextActive]}>
              Waitlist ({waitlisted.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'admins' && styles.tabActive]}
            onPress={() => setTab('admins')}
          >
            <Text style={[styles.tabText, tab === 'admins' && styles.tabTextActive]}>
              Admins {admins.length > 0 ? `(${admins.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* RSVP list */}
        {tab === 'confirmed' && (
          <View style={styles.list}>
            {confirmed.length === 0
              ? <Text style={styles.emptyList}>No confirmed RSVPs yet. Share your link!</Text>
              : confirmed.map((r, i) => <RSVPRow key={r.id} rsvp={r} index={i + 1} onNote={() => setNoteTarget(r)} />)
            }
          </View>
        )}

        {tab === 'waitlist' && (
          <View style={styles.list}>
            {waitlisted.length === 0
              ? <Text style={styles.emptyList}>No one on the waitlist.</Text>
              : waitlisted.map(r => <WaitlistRow key={r.id} rsvp={r} />)
            }
          </View>
        )}

        {/* ── Admins tab ──────────────────────────────────────────────── */}
        {tab === 'admins' && (
          <View style={styles.list}>
            {/* Header explainer */}
            <View style={styles.adminHeader}>
              <Text style={styles.adminHeaderTitle}>👑 Event Admins</Text>
              <Text style={styles.adminHeaderSub}>
                {'Admins can send announcements and view the attendee list.\nCaptains manage their team roster and check-ins.'}
              </Text>
            </View>

            {/* Search to add */}
            <View style={styles.adminSearchRow}>
              <TextInput
                style={styles.adminSearchInput}
                value={adminSearch}
                onChangeText={searchAdmins}
                placeholder="Search @username or name..."
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {adminSearching && <Text style={{ color: '#888', marginLeft: 8 }}>…</Text>}
            </View>

            {/* Search results */}
            {adminResults.length > 0 && (
              <View style={styles.adminResultsList}>
                {adminResults.map(u => (
                  <View key={u.id} style={styles.adminResultRow}>
                    <Text style={styles.adminResultAvatar}>{u.avatar_emoji || '👤'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adminResultName}>{u.display_name}</Text>
                      <Text style={styles.adminResultUsername}>@{u.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.adminApptBtn, { backgroundColor: 'rgba(249,115,22,0.15)' }]}
                      onPress={() => appointAdmin(u.id, 'admin')}
                      disabled={addingAdmin === u.id}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.adminApptBtnText, { color: '#F97316' }]}>
                        {addingAdmin === u.id ? '…' : '+ Admin'}
                      </Text>
                    </TouchableOpacity>
                    {event?.is_tournament && (
                      <TouchableOpacity
                        style={[styles.adminApptBtn, { backgroundColor: 'rgba(96,165,250,0.15)', marginLeft: 6 }]}
                        onPress={() => appointAdmin(u.id, 'captain')}
                        disabled={addingAdmin === u.id}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.adminApptBtnText, { color: '#60A5FA' }]}>
                          {addingAdmin === u.id ? '…' : '⚑ Captain'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Current admin list */}
            {admins.length === 0 ? (
              <Text style={styles.emptyList}>
                No admins yet. Search a Bord username above to appoint someone.
              </Text>
            ) : (
              admins.map(a => (
                <View key={a.id} style={styles.adminRow}>
                  <Text style={styles.adminAvatar}>{a.profile?.avatar_emoji || '👤'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminName}>{a.profile?.display_name ?? 'Unknown'}</Text>
                    <Text style={styles.adminMeta}>@{a.profile?.username ?? '—'}</Text>
                  </View>
                  <View style={[
                    styles.adminRolePill,
                    { backgroundColor: a.role === 'captain' ? 'rgba(96,165,250,0.12)' : 'rgba(249,115,22,0.12)' }
                  ]}>
                    <Text style={[
                      styles.adminRolePillText,
                      { color: a.role === 'captain' ? '#60A5FA' : '#F97316' }
                    ]}>
                      {a.role === 'captain' ? '⚑ Captain' : '👑 Admin'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.adminRemoveBtn}
                    onPress={() => dismissAdmin(a.user_id, a.profile?.display_name ?? 'this user')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.adminRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>

      {/* ── Share sheet ───────────────────────────────────────────────── */}
      <Modal visible={showShareSheet} transparent animationType="fade" onRequestClose={() => setShowShareSheet(false)}>
        <Pressable style={ssStyles.backdrop} onPress={() => setShowShareSheet(false)}>
          <Pressable style={ssStyles.sheet} onPress={e => e.stopPropagation()}>
            <View style={ssStyles.handle} />
            <Text style={ssStyles.title}>Share Event</Text>
            <Text style={ssStyles.sub} numberOfLines={2}>{event?.title ?? ''}</Text>

            <TouchableOpacity style={ssStyles.row} onPress={() => { setShowShareSheet(false); openIgPicker(); }} activeOpacity={0.8}>
              <View style={[ssStyles.iconBox, { backgroundColor: 'rgba(249,115,22,0.18)' }]}><Text style={ssStyles.rowIcon}>🖼️</Text></View>
              <View style={ssStyles.rowText}>
                <Text style={ssStyles.rowTitle}>Share as Image</Text>
                <Text style={ssStyles.rowSub}>Square, Story (9:16), or Landscape</Text>
              </View>
            </TouchableOpacity>
            <View style={ssStyles.divider} />

            <TouchableOpacity style={ssStyles.row} onPress={shareNative} activeOpacity={0.8}>
              <View style={[ssStyles.iconBox, { backgroundColor: 'rgba(249,115,22,0.12)' }]}><Text style={ssStyles.rowIcon}>📤</Text></View>
              <View style={ssStyles.rowText}>
                <Text style={ssStyles.rowTitle}>Share Link via...</Text>
                <Text style={ssStyles.rowSub}>Messages, WhatsApp, email & more</Text>
              </View>
            </TouchableOpacity>
            <View style={ssStyles.divider} />

            <TouchableOpacity style={ssStyles.row} onPress={copyLink} activeOpacity={0.8}>
              <View style={[ssStyles.iconBox, { backgroundColor: 'rgba(155,142,196,0.12)' }]}><Text style={ssStyles.rowIcon}>🔗</Text></View>
              <View style={ssStyles.rowText}>
                <Text style={ssStyles.rowTitle}>Copy Event Link</Text>
                <Text style={ssStyles.rowSub}>{rsvpLink}</Text>
              </View>
            </TouchableOpacity>
            <View style={ssStyles.divider} />

            <TouchableOpacity style={[ssStyles.row, postingToFeed && { opacity: 0.5 }]} onPress={postToBordFeed} disabled={postingToFeed} activeOpacity={0.8}>
              <View style={[ssStyles.iconBox, { backgroundColor: 'rgba(52,211,153,0.12)' }]}><Text style={ssStyles.rowIcon}>{postingToFeed ? '⏳' : '🤝'}</Text></View>
              <View style={ssStyles.rowText}>
                <Text style={ssStyles.rowTitle}>{postingToFeed ? 'Posting...' : 'Post to Bord Feed'}</Text>
                <Text style={ssStyles.rowSub}>Others on Bord can tap to see & register</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={ssStyles.cancelBtn} onPress={() => setShowShareSheet(false)} activeOpacity={0.8}>
              <Text style={ssStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ShareFormatPicker visible={igPickerVisible} onSelect={onIgFormatSelected} onDismiss={closeIgPicker} isCapturing={igIsCapturing} />
      {event && (
        <ShareCanvas
          ref={igCanvasRef}
          format={igSelectedFormat ?? 'story'}
          event={{
            title: event.title,
            date: formatDate(event.date),
            time: formatTime(event.time),
            price: event.has_buy_in && event.buy_in_amount ? event.buy_in_amount : null,
            spotsLeft: Math.max(0, event.cap - (event.rsvp_count ?? 0)),
            totalSpots: event.cap,
            category: event.category ?? 'EVENT',
            coverImageUrl: null,
            eventUrl: rsvpLink,
          }}
        />
      )}
    </>
  );
}

function RSVPRow({ rsvp, index, onNote }: { rsvp: RSVP; index: number; onNote: () => void }) {
  const deadline = new Date(rsvp.cancellation_deadline ?? '');
  const hoursLeft = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 3600000));
  const canStillCancel = deadline > new Date();

  return (
    <View style={styles.rsvpRow}>
      <View style={styles.rsvpNum}>
        <Text style={styles.rsvpNumText}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.rsvpName}>{rsvp.name}</Text>
          {rsvp.is_running_late && (
            <View style={hstyles.lateBadge}>
              <Text style={hstyles.lateBadgeText}>🕐 Running Late</Text>
            </View>
          )}
        </View>
        <Text style={styles.rsvpEmail}>{rsvp.email}</Text>
        {rsvp.phone && <Text style={styles.rsvpMeta}>📱 {rsvp.phone}</Text>}
        {rsvp.bringing && rsvp.bringing !== 'nothing' && (
          <Text style={styles.rsvpMeta}>🧺 Bringing: {rsvp.bringing}</Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {canStillCancel && (
          <Text style={styles.cancelWindow}>{hoursLeft}h window</Text>
        )}
        <TouchableOpacity style={hstyles.noteBtn} onPress={onNote} activeOpacity={0.8}>
          <Text style={hstyles.noteBtnText}>💌</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function WaitlistRow({ rsvp }: { rsvp: RSVP }) {
  return (
    <View style={styles.rsvpRow}>
      <View style={[styles.rsvpNum, { backgroundColor: 'rgba(244,63,94,0.12)', borderColor: 'rgba(244,63,94,0.25)' }]}>
        <Text style={[styles.rsvpNumText, { color: colors.rose }]}>#{rsvp.waitlist_position}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rsvpName}>{rsvp.name}</Text>
        <Text style={styles.rsvpEmail}>{rsvp.email}</Text>
      </View>
      <Text style={styles.waitlistBadge}>Waiting</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },
  eventHeader: {
    marginBottom: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.orange,
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 6,
    lineHeight: 32,
  },
  eventMeta: {
    fontSize: 14,
    color: colors.gray1,
    fontWeight: '500',
    marginBottom: 3,
  },
  capCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  capHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  capLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray2,
    letterSpacing: 1,
  },
  capCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orange,
  },
  capBarBg: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  capBarFill: {
    height: '100%',
    backgroundColor: colors.orange,
    borderRadius: 3,
  },
  linkCard: {
    backgroundColor: 'rgba(249,115,22,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  linkLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.orange,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  linkUrl: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  linkBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  linkBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkBtnShare: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: 'rgba(249,115,22,0.3)',
  },
  doorQrBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(52,211,153,0.07)', borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)', borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  doorQrEmoji: { fontSize: 26 },
  doorQrTitle: { fontSize: 15, fontWeight: '700', color: colors.white },
  doorQrSub:   { fontSize: 12, color: colors.gray2, marginTop: 2 },
  doorQrArrow: { color: colors.green, fontSize: 16, fontWeight: '700' },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  tabActive: {
    backgroundColor: colors.orange,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray1,
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  list: { gap: 8 },
  emptyList: {
    textAlign: 'center',
    color: colors.gray2,
    fontSize: 14,
    paddingVertical: spacing.xl,
    fontWeight: '500',
  },
  rsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  rsvpNum: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.orange,
  },
  rsvpName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  rsvpEmail: {
    fontSize: 12,
    color: colors.gray1,
    fontWeight: '500',
  },
  rsvpMeta: {
    fontSize: 11,
    color: colors.gray2,
    fontWeight: '500',
  },
  cancelWindow: {
    fontSize: 10,
    color: colors.gray2,
    fontWeight: '600',
    textAlign: 'right',
  },
  waitlistBadge: {
    fontSize: 11,
    color: colors.rose,
    fontWeight: '700',
    backgroundColor: 'rgba(244,63,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.2)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bracketBtn: {
    backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)', paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md,
  },
  bracketBtnText: { color: colors.orange, fontWeight: '700', fontSize: 15 },
  scannerBtn: {
    backgroundColor: 'rgba(52,211,153,0.07)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)',
    paddingVertical: 14, paddingHorizontal: spacing.md,
    marginBottom: spacing.md, alignItems: 'center', gap: 4,
  },
  scannerBtnText: { color: '#34D399', fontWeight: '700', fontSize: 15 },
  scannerBtnSub:  { color: '#6b7280', fontSize: 12, fontWeight: '500' },

  hostActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  editEventBtn: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center',
  },
  editEventBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  deleteEventBtn: {
    flex: 1, backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)', borderRadius: radius.sm,
    paddingVertical: 10, alignItems: 'center',
  },
  deleteEventBtnText: { color: colors.red, fontWeight: '600', fontSize: 14 },
});

// ── Host-specific Gather styles ───────────────────────────────────────────────
const hstyles = StyleSheet.create({
  // Running late badge on RSVP row
  lateBadge: {
    backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)', borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  lateBadgeText: { fontSize: 10, fontWeight: '700', color: colors.orange },

  // 💌 note button on RSVP row
  noteBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(155,142,196,0.1)', borderWidth: 1,
    borderColor: 'rgba(155,142,196,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  noteBtnText: { fontSize: 14 },

  // Thank-you note modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  editSheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 50,
    maxHeight: '90%',
  },
  // ── Edit modal styles ─────────────────────────────────────────────────
  editLabel: { fontSize: 12, fontWeight: '700', color: colors.gray1, marginBottom: 5, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  editToggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4, gap: 12 },
  editToggle: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#2C2C2C', borderWidth: 1, borderColor: '#3C3C3C',
  },
  editToggleOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  editSegment: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  editSegBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#2C2C2C', borderWidth: 1, borderColor: '#3C3C3C',
  },
  editSegBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  editSegBtnText: { fontSize: 12, fontWeight: '700', color: colors.gray2 },
  // ─────────────────────────────────────────────────────────────────────
  noteModal: {
    backgroundColor: colors.panel, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: colors.border,
    padding: spacing.lg, paddingBottom: 40,
  },
  noteTitle: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 4 },
  noteSub:   { fontSize: 14, color: colors.gray1, marginBottom: spacing.md },
  noteInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.white,
    fontSize: 15, minHeight: 100, textAlignVertical: 'top',
    marginBottom: 6,
  },
  noteCount: { fontSize: 11, color: colors.gray2, textAlign: 'right', marginBottom: spacing.md },
  noteActions: { flexDirection: 'row', gap: spacing.sm },
  noteCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.card,
  },
  noteCancelText: { color: colors.gray1, fontWeight: '600', fontSize: 15 },
  noteSendBtn: {
    flex: 2, backgroundColor: '#9B8EC4', borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  noteSendText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  // ── Admin tab styles ──────────────────────────────────────────────────────
  adminHeader: { marginBottom: 16, padding: 14, backgroundColor: 'rgba(249,115,22,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)' },
  adminHeaderTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  adminHeaderSub: { fontSize: 12, color: '#A8A29E', lineHeight: 18 },
  adminSearchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  adminSearchInput: {
    flex: 1, backgroundColor: '#1E1E1E', borderRadius: 10, padding: 11,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#333',
  },
  adminResultsList: { backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#2C2C2C', marginBottom: 12, overflow: 'hidden' },
  adminResultRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#222', gap: 10 },
  adminResultAvatar: { fontSize: 22 },
  adminResultName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  adminResultUsername: { fontSize: 11, color: '#888' },
  adminApptBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  adminApptBtnText: { fontSize: 12, fontWeight: '800' },
  adminRow: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#1A1A1A', borderRadius: 12, marginBottom: 8, gap: 10 },
  adminAvatar: { fontSize: 24 },
  adminName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  adminMeta: { fontSize: 11, color: '#888' },
  adminRolePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  adminRolePillText: { fontSize: 11, fontWeight: '800' },
  adminRemoveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  adminRemoveText: { fontSize: 12, color: '#888', fontWeight: '700' },

  adminAccessBanner: {
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 10, padding: 12, marginBottom: 12,
  },
  adminAccessText: { fontSize: 13, fontWeight: '800', color: '#F97316', marginBottom: 2 },
  adminAccessSub: { fontSize: 12, color: '#A8A29E' },
});

const ssStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 13, color: '#A8A29E', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowIcon: { fontSize: 22 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  rowSub: { fontSize: 12, color: '#A8A29E', lineHeight: 17 },
  divider: { height: 1, backgroundColor: '#2C2C2C', marginVertical: 2 },
  cancelBtn: { marginTop: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: '#2C2C2C', borderRadius: 12 },
  cancelText: { color: '#A8A29E', fontSize: 15, fontWeight: '600' },
});