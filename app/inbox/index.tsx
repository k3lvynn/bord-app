// app/inbox/index.tsx
// Inbox — two tabs: Direct Messages and Event Announcements from hosts.

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';
import {
  getDMThreads, getMyAnnouncements,
  getNotifications, markNotificationsRead, getPendingFriendRequests,
  acceptFriendRequest, removeFriendship,
  DMThread, HostAnnouncement, AppNotification, formatDate,
} from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

type InboxTab = 'dms' | 'announcements' | 'notifications';

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return formatDate(isoString);
}

export default function Inbox() {
  const { user } = useAuth();
  const [tab,           setTab]           = useState<InboxTab>('dms');
  const [threads,       setThreads]       = useState<DMThread[]>([]);
  const [announcements, setAnnouncements] = useState<HostAnnouncement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pendingFriends,setPendingFriends] = useState<any[]>([]);
  const [notifUnread,   setNotifUnread]   = useState(0);

  const load = async () => {
    if (!user) return;
    try {
      const [t, a, n, pf] = await Promise.all([
        getDMThreads(user.id).catch(() => [] as DMThread[]),
        getMyAnnouncements(user.id).catch(() => [] as HostAnnouncement[]),
        getNotifications(user.id).catch(() => [] as AppNotification[]),
        getPendingFriendRequests(user.id).catch(() => []),
      ]);
      setThreads(t);
      setAnnouncements(a);
      setNotifications(n);
      setPendingFriends(pf);
      setNotifUnread(n.filter(x => !x.is_read).length + pf.length);
    } catch (e) {
      console.warn('inbox load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const dmUnread    = threads.reduce((n, t) => n + t.unread_count, 0);

  // ── Render DM thread row ────────────────────────────────────────────────────
  const renderThread = ({ item }: { item: DMThread }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push({ pathname: '/inbox/dm/[userId]', params: { userId: item.other_user_id, name: item.other_display_name } })}
      activeOpacity={0.8}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarEmoji}>{item.other_avatar_emoji}</Text>
        {item.unread_count > 0 && (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
          </View>
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, item.unread_count > 0 && styles.rowNameBold]}>
            {item.other_display_name}
          </Text>
          <Text style={styles.rowTime}>{timeAgo(item.last_message_at)}</Text>
        </View>
        <Text
          style={[styles.rowPreview, item.unread_count > 0 && styles.rowPreviewBold]}
          numberOfLines={1}
        >
          {item.last_message}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // ── Render announcement row ─────────────────────────────────────────────────
  const renderAnnouncement = ({ item }: { item: HostAnnouncement }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => item.event_slug && router.push({ pathname: '/event/[slug]', params: { slug: item.event_slug } })}
      activeOpacity={0.8}
    >
      <View style={[styles.avatar, styles.avatarOrange]}>
        <Text style={styles.avatarEmoji}>{item.host_avatar_emoji ?? '📣'}</Text>
        {item.is_pinned && <View style={styles.pinDot}><Text style={{ fontSize: 8 }}>📌</Text></View>}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.host_display_name ?? 'Host'}
            {item.event_title ? (
              <Text style={styles.eventTag}>{' · '}{item.event_title}</Text>
            ) : null}
          </Text>
          <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.rowPreview} numberOfLines={2}>{item.body}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Inbox</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'dms' && styles.tabBtnActive]}
          onPress={() => setTab('dms')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, tab === 'dms' && styles.tabLabelActive]}>
            {'💬  Messages'}
            {dmUnread > 0 ? `  (${dmUnread})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'announcements' && styles.tabBtnActive]}
          onPress={() => setTab('announcements')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, tab === 'announcements' && styles.tabLabelActive]}>
            {'📣  Events'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'notifications' && styles.tabBtnActive]}
          onPress={async () => {
            setTab('notifications');
            if (user) { await markNotificationsRead(user.id); setNotifUnread(0); }
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, tab === 'notifications' && styles.tabLabelActive]}>
            {'🔔  Activity'}{notifUnread > 0 ? `  (${notifUnread})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.orange} style={{ marginTop: 60 }} />
      ) : tab === 'dms' ? (
        <FlatList
          data={threads}
          keyExtractor={t => t.other_user_id}
          renderItem={renderThread}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>
                When someone messages you or you start a conversation, it shows up here.
              </Text>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      ) : tab === 'announcements' ? (
        <FlatList
          data={announcements}
          keyExtractor={a => a.id}
          renderItem={renderAnnouncement}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📣</Text>
              <Text style={styles.emptyTitle}>No announcements yet</Text>
              <Text style={styles.emptySub}>
                Hosts can broadcast updates to all confirmed attendees of their events. Check back closer to your events.
              </Text>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      ) : (
        /* ── NOTIFICATIONS / ACTIVITY TAB ── */
        <FlatList
          data={[
            ...pendingFriends.map((pf: any) => ({ ...pf, _type: 'friend_request' })),
            ...notifications.filter((n: any) => n.type !== 'friend_request'),
          ]}
          keyExtractor={(item: any) => item.friendship_id ?? item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.md, gap: spacing.sm }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySub}>Friend requests and activity show up here.</Text>
            </View>
          }
          renderItem={({ item }: any) => {
            if (item._type === 'friend_request') {
              return (
                <View style={styles.notifCard}>
                  <View style={styles.notifAvatar}>
                    <Text style={styles.notifAvatarEmoji}>{item.requester.avatar_emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifText}>
                      <Text style={styles.notifName}>{item.requester.display_name}</Text>
                      {' wants to be your friend'}
                    </Text>
                    <Text style={styles.notifSub}>@{item.requester.username}</Text>
                  </View>
                  <View style={styles.notifActions}>
                    <TouchableOpacity
                      style={styles.notifAcceptBtn}
                      onPress={async () => {
                        try {
                          await acceptFriendRequest(item.friendship_id, item.requester.id, user!.id);
                          setPendingFriends(pf => pf.filter((r: any) => r.friendship_id !== item.friendship_id));
                          setNotifUnread(n => Math.max(0, n - 1));
                        } catch (e: any) { alert(e.message); }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.notifAcceptText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.notifRejectBtn}
                      onPress={async () => {
                        try {
                          await removeFriendship(item.friendship_id);
                          setPendingFriends(pf => pf.filter((r: any) => r.friendship_id !== item.friendship_id));
                          setNotifUnread(n => Math.max(0, n - 1));
                        } catch (e: any) { alert(e.message); }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.notifRejectText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            // Generic notification (friend accepted, auto-accepted, etc.)
            const msg = item.type === 'friend_accepted'
              ? `${item.actor?.display_name ?? 'Someone'} accepted your friend request 🎉`
              : item.type === 'friend_auto_accepted'
              ? `${item.actor?.display_name ?? 'Someone'} added you as a friend 🎉`
              : item.type === 'friend_request'
              ? `${item.actor?.display_name ?? 'Someone'} sent you a friend request`
              : 'New notification';
            return (
              <TouchableOpacity
                style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
                onPress={() => router.push(`/user/${item.actor_id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.notifAvatar}>
                  <Text style={styles.notifAvatarEmoji}>{item.actor?.avatar_emoji ?? '👤'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifText}>{msg}</Text>
                  <Text style={styles.notifSub}>@{item.actor?.username ?? ''}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title:       { fontSize: 18, fontWeight: '800', color: colors.white },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: colors.orange, fontSize: 22 },

  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.orange },
  tabLabel:      { fontSize: 13, fontWeight: '600', color: colors.gray1 },
  tabLabelActive:{ color: colors.white, fontWeight: '700' },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: spacing.md, gap: spacing.sm, backgroundColor: colors.black,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarOrange: { borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.08)' },
  avatarEmoji:  { fontSize: 24 },

  unreadDot: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: colors.orange, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  pinDot: {
    position: 'absolute', bottom: -3, right: -3,
    backgroundColor: colors.card, borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },

  rowBody:  { flex: 1, gap: 4 },
  rowTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowName:  { fontSize: 14, fontWeight: '600', color: colors.white, flex: 1, marginRight: spacing.sm },
  rowNameBold: { fontWeight: '800' },
  rowTime:  { fontSize: 11, color: colors.gray2, flexShrink: 0 },
  rowPreview: { fontSize: 13, color: colors.gray1, lineHeight: 19 },
  rowPreviewBold: { color: colors.white, fontWeight: '600' },
  eventTag: { color: colors.orange, fontWeight: '700' },

  sep: { height: 1, backgroundColor: colors.border, marginLeft: 68 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, gap: spacing.md,
  },
  emptyEmoji:  { fontSize: 48 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: colors.white, textAlign: 'center' },
  emptySub:    { fontSize: 14, color: colors.gray1, textAlign: 'center', lineHeight: 22 },

  notifCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.panel, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  notifCardUnread: {
    borderColor: colors.orange, backgroundColor: 'rgba(232,124,47,0.06)',
  },
  notifAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  notifAvatarEmoji: { fontSize: 24 },
  notifText:        { fontSize: 14, color: colors.white, lineHeight: 19, flexShrink: 1 },
  notifName:        { fontWeight: '700' },
  notifSub:         { fontSize: 12, color: colors.gray2, marginTop: 2 },
  notifActions:     { flexDirection: 'row', gap: 8 },
  notifAcceptBtn:   { backgroundColor: colors.orange, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  notifAcceptText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  notifRejectBtn:   { backgroundColor: colors.card, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  notifRejectText:  { color: colors.gray1, fontWeight: '600', fontSize: 13 },
});
