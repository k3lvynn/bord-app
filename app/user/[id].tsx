// app/user/[id].tsx
// Public profile page — any signed-in user can view.
// Friend system:
//   Public account  → Add Friend auto-accepts + both users notified
//   Private account → request stays pending; owner gets notification to accept/reject
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Share, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import {
  getFriendshipStatus, sendFriendRequest, removeFriendship,
  FriendshipStatus,
} from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius } from '../../lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PublicProfile {
  id: string;
  display_name: string;
  username: string;
  avatar_emoji: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  events_hosted: number;
  events_attended: number;
  public_badges: string[] | null;
  reliability_attended: number | null;
  reliability_total: number | null;
  is_private_account: boolean;
}

interface PublicEvent {
  id: string; title: string; date: string;
  rsvp_count: number; cap: number; category: string; slug: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile,         setProfile]         = useState<PublicProfile | null>(null);
  const [events,          setEvents]           = useState<PublicEvent[]>([]);
  const [loading,         setLoading]          = useState(true);
  const [notFound,        setNotFound]         = useState(false);

  const [friendStatus,    setFriendStatus]     = useState<FriendshipStatus>('none');
  const [friendshipId,    setFriendshipId]     = useState<string | null>(null);
  const [friendLoading,   setFriendLoading]    = useState(false);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data: p } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_emoji, avatar_url, bio, location, events_hosted, events_attended, public_badges, reliability_attended, reliability_total, is_private_account')
          .eq('id', id)
          .maybeSingle();

        if (!p) { setNotFound(true); setLoading(false); return; }
        setProfile(p as PublicProfile);

        // Load their upcoming public events
        const today = new Date().toISOString().split('T')[0];
        const { data: ev } = await supabase
          .from('events')
          .select('id, title, date, rsvp_count, cap, category, slug')
          .eq('host_id', id).eq('is_active', true).eq('is_private', false)
          .gte('date', today).order('date').limit(5);
        setEvents((ev ?? []) as PublicEvent[]);

        // Load friendship status
        if (user && user.id !== id) {
          const fs = await getFriendshipStatus(user.id, id);
          setFriendStatus(fs.status);
          setFriendshipId(fs.friendshipId);
        }
      } catch (e) {
        console.error('PublicProfile load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  const reliabilityPct = profile?.reliability_total
    ? Math.round(((profile.reliability_attended ?? 0) / profile.reliability_total) * 100)
    : null;

  // ── Friend actions ──────────────────────────────────────────────────────────
  const handleAddFriend = async () => {
    if (!user || !profile) return;
    setFriendLoading(true);
    try {
      const { friendshipId: fid, autoAccepted } = await sendFriendRequest(
        user.id, profile.id, profile.is_private_account ?? false,
      );
      setFriendshipId(fid);
      if (autoAccepted) {
        setFriendStatus('accepted');
        Alert.alert('Friends! 🎉', `You and ${profile.display_name} are now friends.`);
      } else {
        setFriendStatus('pending_sent');
        Alert.alert('Request sent!', `${profile.display_name} will be notified of your request.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not send friend request.');
    } finally {
      setFriendLoading(false);
    }
  };

  const handleCancelOrUnfriend = async () => {
    if (!friendshipId) return;
    const label = friendStatus === 'accepted' ? 'Remove Friend' : 'Cancel Request';
    const msg   = friendStatus === 'accepted'
      ? `Remove ${profile?.display_name} as a friend?`
      : 'Cancel your pending friend request?';

    Alert.alert(label, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label, style: 'destructive',
        onPress: async () => {
          setFriendLoading(true);
          try {
            await removeFriendship(friendshipId);
            setFriendStatus('none');
            setFriendshipId(null);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setFriendLoading(false);
          }
        },
      },
    ]);
  };

  const shareProfile = async () => {
    if (!profile) return;
    await Share.share({
      message: `Check out ${profile.display_name} (@${profile.username}) on Bord!\nhttps://bordevents.com/users/${profile.username}`,
    });
  };

  // ── Friend button ───────────────────────────────────────────────────────────
  const renderFriendButton = () => {
    if (isOwnProfile) return null;
    if (friendLoading) return (
      <View style={[styles.friendBtn, styles.friendBtnPending]}>
        <ActivityIndicator size="small" color={colors.orange} />
      </View>
    );
    switch (friendStatus) {
      case 'none':
        return (
          <TouchableOpacity style={styles.friendBtn} onPress={handleAddFriend} activeOpacity={0.8}>
            <Text style={styles.friendBtnText}>👤 Add Friend</Text>
          </TouchableOpacity>
        );
      case 'pending_sent':
        return (
          <TouchableOpacity style={[styles.friendBtn, styles.friendBtnPending]} onPress={handleCancelOrUnfriend} activeOpacity={0.8}>
            <Text style={[styles.friendBtnText, { color: colors.gray1 }]}>⏳ Pending · Tap to cancel</Text>
          </TouchableOpacity>
        );
      case 'pending_received':
        return (
          <TouchableOpacity
            style={[styles.friendBtn, { flex: 1, backgroundColor: colors.orange }]}
            onPress={() => router.push('/inbox')}
            activeOpacity={0.8}
          >
            <Text style={[styles.friendBtnText, { color: '#fff' }]}>✓ Accept in Inbox</Text>
          </TouchableOpacity>
        );
      case 'accepted':
        return (
          <TouchableOpacity style={[styles.friendBtn, styles.friendBtnAccepted]} onPress={handleCancelOrUnfriend} activeOpacity={0.8}>
            <Text style={[styles.friendBtnText, { color: '#34D399' }]}>✓ Friends · Tap to remove</Text>
          </TouchableOpacity>
        );
      default: return null;
    }
  };

  // ── Loading / not found ─────────────────────────────────────────────────────
  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.orange} size="large" /></View>
  );
  if (notFound || !profile) return (
    <View style={styles.center}>
      <Text style={styles.notFoundEmoji}>😶</Text>
      <Text style={styles.notFoundText}>Profile not found</Text>
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.avatarWrap}>
          {profile.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            : <View style={styles.avatarEmojiBg}><Text style={styles.avatarEmoji}>{profile.avatar_emoji}</Text></View>
          }
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.is_private_account && (
          <View style={styles.privateBadge}>
            <Text style={styles.privateBadgeText}>🔒 Private account</Text>
          </View>
        )}
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        {profile.location ? <Text style={styles.location}>📍 {profile.location}</Text> : null}

        <View style={styles.actionRow}>
          {isOwnProfile
            ? <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/profile/edit')} activeOpacity={0.8}>
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            : renderFriendButton()
          }
          <TouchableOpacity style={styles.shareBtn} onPress={shareProfile} activeOpacity={0.8}>
            <Text style={styles.shareBtnText}>🔗</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{profile.events_hosted ?? 0}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{profile.events_attended ?? 0}</Text>
          <Text style={styles.statLabel}>Attended</Text>
        </View>
        {reliabilityPct !== null && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{reliabilityPct}%</Text>
              <Text style={styles.statLabel}>Show-up</Text>
            </View>
          </>
        )}
      </View>

      {/* Badges */}
      {(profile.public_badges?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BADGES</Text>
          <View style={styles.badgesWrap}>
            {profile.public_badges!.map(badge => (
              <View key={badge} style={styles.badgePill}>
                <Text style={styles.badgePillText}>{badge}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Upcoming events — always shown if the event is public (is_private=false on the event itself) */}
      {events.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>UPCOMING EVENTS</Text>
          {events.map(e => (
            <TouchableOpacity key={e.id} style={styles.eventRow} onPress={() => router.push(`/event/${e.slug}`)} activeOpacity={0.8}>
              <Text style={styles.eventEmoji}>
                {e.category === 'flag_football' ? '🏈' : e.category === 'basketball' ? '🏀'
                  : e.category === 'soccer' ? '⚽' : e.category === 'volleyball' ? '🏐'
                  : e.category === 'social' ? '🤝' : e.category === 'food' ? '🍲' : '🏆'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                <Text style={styles.eventMeta}>{e.rsvp_count}/{e.cap} · {e.date}</Text>
              </View>
              <Text style={styles.eventArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}


    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: colors.black },
  center:        { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  notFoundEmoji: { fontSize: 48, marginBottom: spacing.sm },
  notFoundText:  { fontSize: 16, color: colors.gray1 },

  headerCard:    { backgroundColor: colors.panel, margin: spacing.md, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  avatarWrap:    { marginBottom: spacing.md },
  avatar:        { width: 90, height: 90, borderRadius: 45, borderWidth: 2.5, borderColor: colors.orange },
  avatarEmojiBg: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.orange },
  avatarEmoji:   { fontSize: 44 },
  displayName:   { fontSize: 24, fontWeight: '800', color: colors.white, marginBottom: 3 },
  username:      { fontSize: 14, color: colors.orange, marginBottom: spacing.xs },
  privateBadge:  { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: spacing.sm },
  privateBadgeText: { color: colors.gray2, fontSize: 12 },
  bio:           { fontSize: 14, color: colors.gray1, textAlign: 'center', lineHeight: 20, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  location:      { fontSize: 13, color: colors.gray2, marginBottom: spacing.md },

  actionRow:        { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, width: '100%' },
  editBtn:          { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  editBtnText:      { color: colors.white, fontWeight: '600', fontSize: 14 },
  shareBtn:         { backgroundColor: 'rgba(232,124,47,0.12)', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.orange },
  shareBtnText:     { color: colors.orange, fontWeight: '600', fontSize: 18 },

  friendBtn:         { flex: 1, backgroundColor: 'rgba(232,124,47,0.12)', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.orange },
  friendBtnPending:  { backgroundColor: colors.card, borderColor: colors.border },
  friendBtnAccepted: { backgroundColor: 'rgba(52,211,153,0.10)', borderColor: '#34D399' },
  friendBtnText:     { color: colors.orange, fontWeight: '700', fontSize: 14 },

  statsRow:    { flexDirection: 'row', backgroundColor: colors.panel, marginHorizontal: spacing.md, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  statBox:     { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 26, fontWeight: '800', color: colors.orange },
  statLabel:   { fontSize: 11, color: colors.gray2, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  section:      { marginHorizontal: spacing.md, marginBottom: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.gray2, letterSpacing: 1.2, marginBottom: spacing.sm },
  badgesWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgePill:    { backgroundColor: 'rgba(232,124,47,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.orange },
  badgePillText:{ color: colors.orange, fontSize: 12, fontWeight: '600' },

  eventRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  eventEmoji: { fontSize: 22, marginRight: spacing.sm },
  eventTitle: { fontSize: 14, fontWeight: '700', color: colors.white },
  eventMeta:  { fontSize: 12, color: colors.gray2, marginTop: 2 },
  eventArrow: { fontSize: 22, color: colors.gray2, marginLeft: spacing.xs },

  lockedCard:  { marginHorizontal: spacing.md, padding: spacing.xl, alignItems: 'center', backgroundColor: colors.panel, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  lockedEmoji: { fontSize: 40, marginBottom: spacing.sm },
  lockedTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  lockedSub:   { fontSize: 14, color: colors.gray2, textAlign: 'center', lineHeight: 20 },
});
