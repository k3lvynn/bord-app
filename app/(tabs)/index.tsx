// app/(tabs)/index.tsx
// Home — Compete / Gather toggle with event cards.
// Each card shows a small static-style map pin preview when coordinates exist.

import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Animated, Dimensions, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../lib/theme';
import {
  supabase, formatDate, formatTime, advanceRecurringEvents, Event,
  getCategoryEmoji, formatCategoryLabel, getPosts, Post, getInboxUnreadCount,
} from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const { width: SCREEN_W } = Dimensions.get('window');

// Lazy-load MapView — only works in custom/production builds
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
let MapView: any = null;
let Marker: any = null;
if (!IS_EXPO_GO) {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker  = Maps.Marker;
  } catch (_) {}
}

const TABS = ['🏆  Compete', '🤝  Gather'] as const;
type TabKey = 0 | 1;

const SPORT_CATS = new Set([
  'flag_football','basketball','soccer','volleyball','softball','tennis',
  'pickleball','golf','cornhole','dodgeball','kickball','ultimate_frisbee',
]);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomeTab() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>(0);
  const [compete,   setCompete]   = useState<Event[]>([]);
  const [gather,    setGather]    = useState<Event[]>([]);
  const [posts,     setPosts]     = useState<Post[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [fabOpen,   setFabOpen]   = useState(false);
  const [inboxCount,setInboxCount]= useState(0);
  const fabAnim    = useRef(new Animated.Value(0)).current;
  const scrollRef  = useRef<ScrollView>(null);
  const indicatorX = useRef(new Animated.Value(0)).current;

  const load = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [cRes, gRes, postsData, unread] = await Promise.all([
        supabase.from('events').select('*')
          .eq('is_active', true).eq('is_private', false)
          .gte('date', today).order('date').limit(25),
        supabase.from('events').select('*')
          .eq('has_buy_in', false).eq('is_active', true).eq('is_private', false)
          .gte('date', today).order('date').limit(25),
        getPosts({ limit: 30 }).catch(() => [] as Post[]),
        user ? getInboxUnreadCount(user.id).catch(() => 0) : Promise.resolve(0),
      ]);
      setCompete((cRes.data ?? []).filter((e: Event) => e.has_buy_in));
      setGather(gRes.data ?? []);
      setPosts(postsData.filter((p: Post) => !!p.media_url));
      setInboxCount(unread);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => {
    // Roll forward any recurring events whose date has passed
    advanceRecurringEvents().catch(() => {});
    load();
  }, [user]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const toggleFab = () => {
    const toValue = fabOpen ? 0 : 1;
    setFabOpen(!fabOpen);
    Animated.spring(fabAnim, { toValue, useNativeDriver: true, tension: 120, friction: 8 }).start();
  };

  const closeFab = () => {
    if (!fabOpen) return;
    setFabOpen(false);
    Animated.spring(fabAnim, { toValue: 0, useNativeDriver: true }).start();
  };

  const switchTab = (idx: TabKey) => {
    setActiveTab(idx);
    scrollRef.current?.scrollTo({ x: idx * SCREEN_W, animated: true });
    Animated.spring(indicatorX, { toValue: idx, useNativeDriver: false }).start();
  };

  const indicatorLeft = indicatorX.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '50%'],
  });

  const greeting = profile?.display_name
    ? 'Hey ' + profile.display_name.split(' ')[0] + ' 👋'
    : 'Welcome to Bord 👋';

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.sub}>What are you doing this weekend?</Text>
        </View>
        {/* Inbox bell */}
        <TouchableOpacity
          style={styles.inboxBtn}
          onPress={() => { closeFab(); router.push('/inbox'); }}
          activeOpacity={0.85}
        >
          <Text style={styles.inboxIcon}>💬</Text>
          {inboxCount > 0 && (
            <View style={styles.inboxBadge}>
              <Text style={styles.inboxBadgeText}>{inboxCount > 9 ? '9+' : inboxCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Compete / Gather toggle */}
      <View style={styles.switcherWrap}>
        <View style={styles.switcher}>
          {TABS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={styles.switcherTab}
              onPress={() => switchTab(i as TabKey)}
              activeOpacity={0.8}
            >
              <Text style={[styles.switcherLabel, activeTab === i && styles.switcherLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <Animated.View style={[styles.indicator, { left: indicatorLeft }]} />
        </View>
      </View>

      {/* Paged lists */}
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      >
        <View style={{ width: SCREEN_W }}>
          <FlatList
            data={compete}
            keyExtractor={e => e.id}
            renderItem={({ item }) => <EventCard event={item} mode="compete" mediaPosts={posts} />}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
            ListEmptyComponent={loading ? null : <EmptyState mode="compete" />}
          />
        </View>
        <View style={{ width: SCREEN_W }}>
          <FlatList
            data={gather}
            keyExtractor={e => e.id}
            renderItem={({ item }) => <EventCard event={item} mode="gather" mediaPosts={posts} />}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lavender} />}
            ListEmptyComponent={loading ? null : <EmptyState mode="gather" />}
          />
        </View>
      </ScrollView>

      {/* FAB backdrop — tap to close menu */}
      {fabOpen && (
        <TouchableOpacity style={styles.fabBackdrop} onPress={closeFab} activeOpacity={1} />
      )}

      {/* FAB menu items — animate in/out */}
      <Animated.View style={[
        styles.fabMenu,
        {
          opacity: fabAnim,
          transform: [{ translateY: fabAnim.interpolate({ inputRange: [0,1], outputRange: [20, 0] }) }],
          pointerEvents: fabOpen ? 'auto' : 'none',
        },
      ]}>
        <TouchableOpacity
          style={styles.fabMenuItem}
          onPress={() => { closeFab(); router.push('/post/create'); }}
          activeOpacity={0.85}
        >
          <Text style={styles.fabMenuEmoji}>📸</Text>
          <Text style={styles.fabMenuLabel}>Post Photo / Video</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fabMenuItem}
          onPress={() => { closeFab(); router.push('/host/create'); }}
          activeOpacity={0.85}
        >
          <Text style={styles.fabMenuEmoji}>🎉</Text>
          <Text style={styles.fabMenuLabel}>Create Event</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* FAB button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={toggleFab}
        activeOpacity={0.9}
      >
        <Animated.Text style={[
          styles.fabIcon,
          { transform: [{ rotate: fabAnim.interpolate({ inputRange: [0,1], outputRange: ['0deg','45deg'] }) }] },
        ]}>
          +
        </Animated.Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────
function EventCard({
  event, mode, mediaPosts,
}: {
  event: Event; mode: 'compete' | 'gather'; mediaPosts: Post[];
}) {
  const accent    = mode === 'compete' ? colors.orange : colors.lavender;
  const spotsLeft = event.cap - event.rsvp_count;
  const isFull    = spotsLeft <= 0;
  const pct       = Math.min(100, (event.rsvp_count / event.cap) * 100);
  const prizePool = mode === 'compete' ? (event.buy_in_amount ?? 0) * event.cap : 0;
  const linked    = mediaPosts.filter(p => p.event_id === event.id).slice(0, 5);
  const hasCoords = !!event.latitude && !!event.longitude;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/event/' + event.slug)}
      activeOpacity={0.82}
    >
      <View style={[styles.cardBar, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>

        {/* Category + badge */}
        <View style={styles.cardTop}>
          <Text style={styles.cardCat}>
            {getCategoryEmoji(event.category)}{' '}{formatCategoryLabel(event.category).toUpperCase()}
          </Text>
          {mode === 'compete' && prizePool > 0 ? (
            <View style={styles.prizePill}>
              <Text style={styles.prizeText}>{'💰 $'}{prizePool.toLocaleString()}{' pool'}</Text>
            </View>
          ) : mode === 'gather' ? (
            <View style={[styles.prizePill, { borderColor: 'rgba(155,142,196,0.35)', backgroundColor: 'rgba(155,142,196,0.1)' }]}>
              <Text style={[styles.prizeText, { color: colors.lavender }]}>FREE</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.cardMeta}>{'📅 '}{formatDate(event.date)}{' · '}{formatTime(event.time)}</Text>

        {/* Mini map OR location text */}
        {hasCoords && MapView ? (
          <TouchableOpacity
            style={styles.miniMapWrap}
            onPress={() => router.push('/event/' + event.slug)}
            activeOpacity={0.9}
          >
            <MapView
              style={styles.miniMap}
              initialRegion={{
                latitude:      event.latitude!,
                longitude:     event.longitude!,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              customMapStyle={darkMapStyle}
              pointerEvents="none"
            >
              <Marker coordinate={{ latitude: event.latitude!, longitude: event.longitude! }}>
                <View style={[styles.miniPin, { backgroundColor: accent }]}>
                  <Text style={{ fontSize: 11 }}>{getCategoryEmoji(event.category)}</Text>
                </View>
              </Marker>
            </MapView>
            <View style={styles.miniMapLabel}>
              <Text style={styles.miniMapLabelText} numberOfLines={1}>{'📍 '}{event.location}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.locationPill}>
            <Text style={styles.locationPillText} numberOfLines={1}>{'📍 '}{event.location}</Text>
          </View>
        )}

        {/* Media thumbnails */}
        {linked.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip} contentContainerStyle={{ gap: 6 }}>
            {linked.map(p => (
              <TouchableOpacity key={p.id} onPress={(ev) => { ev.stopPropagation(); router.push('/post/create'); }} activeOpacity={0.85}>
                <Image source={{ uri: p.media_url! }} style={styles.thumb} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.thumbAdd} onPress={(ev) => { ev.stopPropagation(); router.push('/post/create'); }} activeOpacity={0.8}>
              <Text style={styles.thumbAddText}>{'📸\n+Add'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          {mode === 'compete' && event.buy_in_amount ? (
            <View style={[styles.buyInPill, { borderColor: colors.orange + '44', backgroundColor: colors.orange + '18' }]}>
              <Text style={[styles.buyInText, { color: colors.orange }]}>{'$'}{event.buy_in_amount}{' / person'}</Text>
            </View>
          ) : mode === 'gather' && event.buy_in_amount ? (
            <View style={[styles.buyInPill, { borderColor: colors.lavender + '44', backgroundColor: colors.lavender + '18' }]}>
              <Text style={[styles.buyInText, { color: colors.lavender }]}>{'🎟️ $'}{event.buy_in_amount}{' / ticket'}</Text>
            </View>
          ) : <View />}
          <Text style={[styles.spotsText, isFull && { color: colors.rose }]}>
            {isFull ? 'Full \u00b7 ' + event.waitlist_count + ' waiting' : spotsLeft + ' spots left'}
          </Text>
        </View>

        {/* Capacity bar */}
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: pct + '%', backgroundColor: isFull ? colors.rose : accent }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ mode }: { mode: 'compete' | 'gather' }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{mode === 'compete' ? '🏆' : '🤝'}</Text>
      <Text style={styles.emptyTitle}>No events yet</Text>
      <Text style={styles.emptySub}>
        {'Be the first to host a '}{mode === 'compete' ? 'competitive' : 'community'}{' event.'}
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/host/create')}>
        <Text style={styles.emptyBtnText}>+ Create Event</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Dark map style ────────────────────────────────────────────────────────────
const darkMapStyle = [
  { elementType: 'geometry',            stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#8a8a9a' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#111' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.white },
  sub:      { fontSize: 12, color: colors.gray1, marginTop: 2 },
  // Inbox bell
  inboxBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  inboxIcon:      { fontSize: 20 },
  inboxBadge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: colors.orange, borderRadius: 9,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  inboxBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },

  // FAB
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
  fabMenu: {
    position: 'absolute', bottom: 90, right: spacing.lg,
    gap: spacing.sm, zIndex: 20, alignItems: 'flex-end',
  },
  fabMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabMenuEmoji: { fontSize: 20 },
  fabMenuLabel: { fontSize: 15, fontWeight: '700', color: colors.white },
  fab: {
    position: 'absolute', bottom: 24, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.orange, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8, zIndex: 30,
  },
  fabIcon: { color: colors.white, fontSize: 30, fontWeight: '300', lineHeight: 34, marginTop: -2 },

  switcherWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  switcher: {
    flexDirection: 'row', backgroundColor: colors.panel, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    position: 'relative', height: 42,
  },
  switcherTab:         { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  switcherLabel:       { fontSize: 13, fontWeight: '600', color: colors.gray1 },
  switcherLabelActive: { color: colors.white, fontWeight: '800' },
  indicator: {
    position: 'absolute', width: '50%', height: '100%',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.orange,
  },

  list: { paddingHorizontal: spacing.md, paddingBottom: 20 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, marginBottom: spacing.sm,
    flexDirection: 'row', overflow: 'hidden', ...shadow.sm,
  },
  cardBar:  { width: 4 },
  cardBody: { flex: 1, padding: spacing.md },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardCat:  { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 0.8 },
  prizePill: {
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)', backgroundColor: 'rgba(52,211,153,0.1)',
    borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2,
  },
  prizeText: { fontSize: 10, fontWeight: '700', color: colors.green },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginBottom: 6, lineHeight: 22 },
  cardMeta:  { fontSize: 12, color: colors.gray1, marginBottom: 4, fontWeight: '500' },

  // Mini map
  miniMapWrap:  { height: 100, borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing.sm, position: 'relative' },
  miniMap:      { width: '100%', height: '100%' },
  miniPin:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  miniMapLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 4,
  },
  miniMapLabelText: { fontSize: 11, color: colors.white, fontWeight: '600' },

  // Location fallback pill
  locationPill: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: spacing.sm,
  },
  locationPillText: { fontSize: 12, color: colors.gray1, fontWeight: '500' },

  // Thumbnails
  thumbStrip: { marginBottom: spacing.xs },
  thumb: { width: 68, height: 68, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  thumbAdd: {
    width: 68, height: 68, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center',
  },
  thumbAddText: { fontSize: 11, color: colors.gray2, textAlign: 'center', lineHeight: 17 },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: spacing.xs, marginBottom: 6,
  },
  buyInPill:  { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  buyInText:  { fontSize: 11, fontWeight: '700' },
  spotsText:  { fontSize: 11, fontWeight: '600', color: colors.gray1 },
  barBg:      { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 2 },

  empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyEmoji:   { fontSize: 48, marginBottom: spacing.md },
  emptyTitle:   { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  emptySub:     { fontSize: 14, color: colors.gray1, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  emptyBtn:     { backgroundColor: colors.orange, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  emptyBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
