import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, RefreshControl, Modal, Image, Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { supabase, getMyThankYouNotes, markNoteRead, getPosts, getCrewCount, Event, ThankYouNote, Post } from '../../lib/supabase';

export default function ProfileTab() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [hostedEvents, setHostedEvents] = useState<Event[]>([]);
  const [notes, setNotes] = useState<ThankYouNote[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [crewCount, setCrewCount] = useState(0);

  const unreadCount = notes.filter(n => !n.is_read).length;

  const load = async () => {
    if (!user) return;
    try {
      await refreshProfile();
      const [{ data: evData }, noteData, postsData, crew] = await Promise.all([
        supabase.from('events').select('*').eq('host_id', user.id).order('date', { ascending: false }).limit(5),
        getMyThankYouNotes(user.id).catch(() => [] as ThankYouNote[]),
        getPosts({ authorId: user.id, limit: 30 }).catch(() => [] as Post[]),
        getCrewCount(user.id).catch(() => 0),
      ]);
      setHostedEvents(evData ?? []);
      setNotes(noteData);
      setMyPosts(postsData);
      setCrewCount(crew);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.gray1 }}>Loading profile...</Text>
      </View>
    );
  }

  const reliabilityPct = profile.reliability_total && profile.reliability_total > 0
    ? Math.round(((profile.reliability_attended ?? 0) / profile.reliability_total) * 100)
    : null;

  const showEmail = !profile.email_hidden;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Settings gear — pinned to screen, above ScrollView, respects safe area */}
      <TouchableOpacity
        style={[styles.gearBtn, { top: insets.top + 10, right: spacing.md }]}
        onPress={() => router.push('/settings')}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.gearIcon}>⚙️</Text>
      </TouchableOpacity>
      {/* Thank-You Notes Inbox Modal */}
      <Modal visible={showInbox} transparent animationType="slide" onRequestClose={() => setShowInbox(false)}>
        <View style={pstyles.modalOverlay}>
          <View style={pstyles.inboxModal}>
            <View style={pstyles.inboxHeader}>
              <Text style={pstyles.inboxTitle}>💌 Thank-You Notes</Text>
              <TouchableOpacity onPress={() => setShowInbox(false)} activeOpacity={0.7}>
                <Text style={pstyles.inboxClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {notes.length === 0 ? (
              <Text style={pstyles.inboxEmpty}>No notes yet — attend events and hosts will thank you here.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {notes.map(note => (
                  <TouchableOpacity
                    key={note.id}
                    style={[pstyles.noteCard, note.is_read && pstyles.noteCardRead]}
                    activeOpacity={0.8}
                    onPress={async () => {
                      if (!note.is_read) {
                        await markNoteRead(note.id).catch(() => {});
                        setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_read: true } : n));
                      }
                    }}
                  >
                    <View style={pstyles.noteCardHeader}>
                      <Text style={pstyles.noteAvatar}>{note.from_avatar_emoji ?? '⭐'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={pstyles.noteFrom}>{note.from_display_name ?? 'A host'}</Text>
                        <Text style={pstyles.noteEvent} numberOfLines={1}>re: {note.event_title}</Text>
                      </View>
                      {!note.is_read && <View style={pstyles.unreadDot} />}
                    </View>
                    <Text style={pstyles.noteBody}>"{note.message}"</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.black }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl + 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => router.push('/profile/edit')}
            activeOpacity={0.85}
          >
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarEmojiBg}>
                <Text style={styles.avatarEmoji}>{profile.avatar_emoji}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={{ fontSize: 10 }}>✏️</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.displayName}>{profile.display_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>

          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/profile/edit')} activeOpacity={0.7}>
              <Text style={styles.bioPlaceholder}>+ Add a bio</Text>
            </TouchableOpacity>
          )}

          {profile.location ? <Text style={styles.location}>📍 {profile.location}</Text> : null}

          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/profile/edit')} activeOpacity={0.8}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox value={profile.events_hosted ?? 0} label="Hosted" />
          <View style={styles.statDivider} />
          <StatBox value={profile.events_attended ?? 0} label="Attended" />
          <View style={styles.statDivider} />
          <StatBox value={crewCount} label="Crew" />
        </View>

        {/* Community standing */}
        {((profile.public_badges?.length ?? 0) > 0 || reliabilityPct !== null) && (
          <View style={pstyles.gatherCard}>
            <Text style={pstyles.gatherCardLabel}>COMMUNITY STANDING</Text>
            {reliabilityPct !== null && (
              <View style={pstyles.reliabilityRow}>
                <Text style={pstyles.reliabilityLabel}>📅 Show-up rate</Text>
                <View style={pstyles.reliabilityBarBg}>
                  <View style={[pstyles.reliabilityBarFill, { width: `${reliabilityPct}%` as any }]} />
                </View>
                <Text style={pstyles.reliabilityPct}>{reliabilityPct}%</Text>
              </View>
            )}
            {(profile.public_badges?.length ?? 0) > 0 && (
              <View style={pstyles.badgesRow}>
                {profile.public_badges!.map(badge => (
                  <View key={badge} style={pstyles.badgePill}>
                    <Text style={pstyles.badgePillText}>{badge}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Thank-You Notes inbox */}
        <TouchableOpacity style={pstyles.inboxBtn} onPress={() => setShowInbox(true)} activeOpacity={0.85}>
          <Text style={pstyles.inboxBtnEmoji}>💌</Text>
          <View style={{ flex: 1 }}>
            <Text style={pstyles.inboxBtnTitle}>Thank-You Notes</Text>
            <Text style={pstyles.inboxBtnSub}>
              {notes.length === 0 ? 'No notes yet'
                : unreadCount > 0 ? `${unreadCount} unread · ${notes.length} total`
                : `${notes.length} note${notes.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={pstyles.unreadBadge}>
              <Text style={pstyles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
          <Text style={{ color: colors.gray2, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        {/* Recent hosted events */}
        {hostedEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECENTLY HOSTED</Text>
            {hostedEvents.slice(0, 3).map(e => (
              <TouchableOpacity
                key={e.id}
                style={styles.eventRow}
                onPress={() => router.push(`/host/event/${e.id}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.eventRowEmoji}>{e.has_buy_in ? '🏆' : '🤝'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventRowTitle} numberOfLines={1}>{e.title}</Text>
                  <Text style={styles.eventRowMeta}>{e.rsvp_count}/{e.cap} · {e.date}</Text>
                </View>
                <Text style={styles.eventRowArrow}>›</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => router.push('/(tabs)/my-events')}>
              <Text style={styles.viewAll}>View all events →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* My Posts / Media Grid */}
        <View style={styles.section}>
          <View style={pgstyles.sectionHeader}>
            <Text style={styles.sectionLabel}>MY POSTS</Text>
            <TouchableOpacity onPress={() => router.push('/post/create')} activeOpacity={0.8}>
              <Text style={pgstyles.postCta}>+ Add Post</Text>
            </TouchableOpacity>
          </View>
          {myPosts.length === 0 ? (
            <TouchableOpacity style={pgstyles.postsEmpty} onPress={() => router.push('/post/create')} activeOpacity={0.85}>
              <Text style={pgstyles.postsEmptyEmoji}>{'📸'}</Text>
              <Text style={pgstyles.postsEmptyText}>Share your first moment</Text>
            </TouchableOpacity>
          ) : (
            <View style={pgstyles.grid}>
              {myPosts.slice(0, 12).map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={pgstyles.gridItem}
                  onPress={() => setSelectedPost(p)}
                  activeOpacity={0.85}
                >
                  {p.media_url ? (
                    p.media_type === 'video' ? (
                      <>
                        <Video
                          source={{ uri: p.media_url }}
                          style={pgstyles.gridImg}
                          resizeMode={ResizeMode.COVER}
                          isLooping
                          isMuted
                          shouldPlay={false}
                        />
                        <View style={pgstyles.gridVideoTag}>
                          <Text style={{ fontSize: 10, color: '#fff' }}>🎥</Text>
                        </View>
                      </>
                    ) : (
                      <Image source={{ uri: p.media_url }} style={pgstyles.gridImg} />
                    )
                  ) : (
                    <View style={pgstyles.gridTextPost}>
                      <Text style={pgstyles.gridTextCaption} numberOfLines={4}>{p.caption}</Text>
                    </View>
                  )}
                  {p.like_count > 0 && (
                    <View style={pgstyles.gridLikes}>
                      <Text style={pgstyles.gridLikesText}>{'🤙 '}{p.like_count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {myPosts.length > 12 && (
                <View style={[pgstyles.gridItem, pgstyles.gridMore]}>
                  <Text style={pgstyles.gridMoreText}>{'+'}{myPosts.length - 12}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.settingsCard}>
            {showEmail && (
              <>
                <SettingsRow icon="✉️" label="Email" value={user?.email ?? ''} />
                <View style={styles.settingsDivider} />
              </>
            )}
            <SettingsRow icon="📅" label="Member since" value={
              profile.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : 'Bord member'
            } />
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-screen post viewer */}
      <Modal
        visible={!!selectedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <TouchableOpacity
          style={pgstyles.postOverlay}
          activeOpacity={1}
          onPress={() => setSelectedPost(null)}
        >
          {selectedPost && (
            <View style={pgstyles.postViewer}>
              {selectedPost.media_url ? (
                selectedPost.media_type === 'video' ? (
                  <Video
                    source={{ uri: selectedPost.media_url }}
                    style={pgstyles.postViewerImg}
                    resizeMode={ResizeMode.CONTAIN}
                    isLooping
                    isMuted={false}
                    shouldPlay
                    useNativeControls
                  />
                ) : (
                  <Image
                    source={{ uri: selectedPost.media_url }}
                    style={pgstyles.postViewerImg}
                    resizeMode="contain"
                  />
                )
              ) : null}
              {selectedPost.caption ? (
                <View style={pgstyles.postViewerCaption}>
                  <Text style={pgstyles.postViewerCaptionText}>{selectedPost.caption}</Text>
                </View>
              ) : null}
              {selectedPost.event_title ? (
                <Text style={pgstyles.postViewerEvent}>{'📋 '}{selectedPost.event_title}</Text>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingsRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel}>{label}</Text>
        <Text style={styles.settingsValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  gearBtn: { position: 'absolute', zIndex: 20, padding: 10 },
  gearIcon: { fontSize: 24 },

  avatarSection: { alignItems: 'center', marginBottom: spacing.lg, paddingTop: spacing.sm },
  avatarWrap: { position: 'relative', marginBottom: spacing.sm },
  avatarImage: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: 'rgba(249,115,22,0.4)',
  },
  avatarEmojiBg: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 2, borderColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 44 },
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: colors.orange, borderRadius: 10,
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.black,
  },

  displayName: { fontSize: 24, fontWeight: '800', color: colors.white, marginBottom: 2 },
  username: { fontSize: 14, color: colors.gray1, fontWeight: '500', marginBottom: spacing.xs },
  bio: {
    fontSize: 14, color: colors.gray1, textAlign: 'center',
    lineHeight: 20, marginTop: spacing.xs, marginBottom: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  bioPlaceholder: { fontSize: 13, color: colors.orange, fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs },
  location: { fontSize: 13, color: colors.gray2, marginTop: 4 },
  editBtn: {
    marginTop: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 9,
    backgroundColor: colors.card,
  },
  editBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },

  statsRow: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, overflow: 'hidden',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.orange },
  statLabel: { fontSize: 11, color: colors.gray2, fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  section: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.gray2, textTransform: 'uppercase', marginBottom: spacing.sm },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.xs,
  },
  eventRowEmoji: { fontSize: 20 },
  eventRowTitle: { fontSize: 14, fontWeight: '700', color: colors.white },
  eventRowMeta: { fontSize: 12, color: colors.gray2, marginTop: 2 },
  eventRowArrow: { fontSize: 20, color: colors.gray2 },
  viewAll: { fontSize: 13, color: colors.orange, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm },

  settingsCard: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  settingsDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  settingsIcon: { fontSize: 18 },
  settingsLabel: { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  settingsValue: { fontSize: 14, color: colors.white, fontWeight: '500' },
  signOutBtn: {
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.07)',
  },
  signOutText: { color: colors.red, fontWeight: '700', fontSize: 15 },
});

const pstyles = StyleSheet.create({
  gatherCard: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm,
  },
  gatherCardLabel: { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing.sm },
  reliabilityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  reliabilityLabel: { fontSize: 13, color: colors.gray1, fontWeight: '600', width: 100 },
  reliabilityBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  reliabilityBarFill: { height: '100%', backgroundColor: '#9B8EC4', borderRadius: 3 },
  reliabilityPct: { fontSize: 13, fontWeight: '700', color: '#9B8EC4', width: 36, textAlign: 'right' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  badgePill: {
    backgroundColor: 'rgba(155,142,196,0.1)', borderWidth: 1,
    borderColor: 'rgba(155,142,196,0.3)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  badgePillText: { fontSize: 12, color: '#9B8EC4', fontWeight: '600' },
  inboxBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg,
  },
  inboxBtnEmoji: { fontSize: 22 },
  inboxBtnTitle: { fontSize: 15, fontWeight: '700', color: colors.white },
  inboxBtnSub: { fontSize: 12, color: colors.gray2, marginTop: 2 },
  unreadBadge: {
    backgroundColor: '#9B8EC4', borderRadius: radius.full,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  inboxModal: {
    backgroundColor: colors.panel, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: colors.border,
    padding: spacing.lg, paddingBottom: 40, maxHeight: '80%',
  },
  inboxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  inboxTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  inboxClose: { fontSize: 20, color: colors.gray2, fontWeight: '600' },
  inboxEmpty: { textAlign: 'center', color: colors.gray2, fontSize: 14, paddingVertical: spacing.xl, lineHeight: 22 },
  noteCard: {
    backgroundColor: 'rgba(155,142,196,0.08)', borderWidth: 1,
    borderColor: 'rgba(155,142,196,0.25)', borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  noteCardRead: { opacity: 0.65 },
  noteCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8 },
  noteAvatar: { fontSize: 22 },
  noteFrom: { fontSize: 14, fontWeight: '700', color: colors.white },
  noteEvent: { fontSize: 11, color: colors.gray2, marginTop: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9B8EC4' },
  noteBody: { fontSize: 14, color: colors.gray1, fontStyle: 'italic', lineHeight: 21 },
});

// ── Posts Grid Styles ─────────────────────────────────────────────────────────
const GRID_SIZE = (Dimensions.get('window').width - spacing.md * 2 - 8) / 3;

const pgstyles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  postCta: { fontSize: 13, color: colors.orange, fontWeight: '700' },

  postsEmpty: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, borderStyle: 'dashed',
    padding: spacing.lg, alignItems: 'center', gap: 8,
  },
  postsEmptyEmoji: { fontSize: 32 },
  postsEmptyText:  { fontSize: 13, color: colors.gray2, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridItem: {
    width: GRID_SIZE, height: GRID_SIZE,
    borderRadius: radius.sm, overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  gridImg: { width: '100%', height: '100%' },
  gridTextPost: {
    flex: 1, padding: 8,
    backgroundColor: 'rgba(249,115,22,0.07)',
    justifyContent: 'center',
  },
  gridTextCaption: { fontSize: 11, color: colors.gray1, lineHeight: 16 },
  gridVideoTag: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  gridLikes: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  gridLikesText: { fontSize: 10, color: colors.white, fontWeight: '700' },
  gridMore: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gridMoreText: { fontSize: 18, fontWeight: '700', color: colors.gray1 },

  // Full-screen post viewer
  postOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  postViewer: {
    width: '92%', maxHeight: '85%',
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  postViewerImg: {
    width: '100%', height: Dimensions.get('window').height * 0.55,
    backgroundColor: colors.black,
  },
  postViewerCaption: { padding: spacing.md },
  postViewerCaptionText: { fontSize: 14, color: colors.white, lineHeight: 21 },
  postViewerEvent: { fontSize: 12, color: colors.gray2, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
