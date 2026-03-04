// app/(tabs)/gather.tsx
// Gather — community-first, low-pressure social events.

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, TextInput, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { spacing, radius } from '../../lib/theme';
import {
  getGatherEvents, getGatherCircles, formatDate, formatTime,
  getCategoryEmoji, joinCircle, leaveCircle,
  Event, GatherCircle,
  VIBES, INTEREST_TAGS, LOOKING_FOR_OPTIONS, GATHER_TEMPLATES,
} from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const G = {
  bg: '#0F0E0D', card: '#1A1815', card2: '#201D1A', border: '#2A2622',
  lavender: '#9B8EC4', text: '#E8E0D8', sub: '#8C8178',
  mint: '#34D399', sky: '#7DD3FC',
};

export default function GatherTab() {
  const { user } = useAuth();
  const [events,       setEvents]       = useState<Event[]>([]);
  const [circles,      setCircles]      = useState<GatherCircle[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [vibe,         setVibe]         = useState<string | null>(null);
  const [activeTag,    setActiveTag]    = useState<string | null>(null);
  const [lookingFor,   setLookingFor]   = useState<string | null>(null);
  const [showFilters,  setShowFilters]  = useState(false);
  const [showTemplates,setShowTemplates]= useState(false);

  const load = useCallback(async () => {
    try {
      const [evData, circData] = await Promise.all([
        getGatherEvents({
          vibe: vibe ?? undefined,
          tags: activeTag ? [activeTag] : undefined,
          lookingFor: lookingFor ?? undefined,
        }),
        getGatherCircles(user?.id),
      ]);
      setEvents(evData);
      setCircles(circData.slice(0, 8));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [vibe, activeTag, lookingFor, user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = search.trim()
    ? events.filter(e =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.location.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  const hasFilters = !!(vibe || activeTag || lookingFor);

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🤝 Gather</Text>
          <Text style={styles.headerSub}>Community · Come as you are</Text>
        </View>
        <TouchableOpacity style={styles.hostBtn} onPress={() => setShowTemplates(true)} activeOpacity={0.85}>
          <Text style={styles.hostBtnText}>+ Host</Text>
        </TouchableOpacity>
      </View>

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search events or places…"
            placeholderTextColor={G.sub}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, hasFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.filterBtnText}>{hasFilters ? '🎯' : '⚙️'}</Text>
        </TouchableOpacity>
      </View>

      {/* Vibe pills */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.vibeRow}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}
      >
        <TouchableOpacity
          style={[styles.vibeChip, !vibe && styles.vibeChipActive]}
          onPress={() => setVibe(null)} activeOpacity={0.7}
        >
          <Text style={[styles.vibeChipText, !vibe && styles.vibeChipTextActive]}>All vibes</Text>
        </TouchableOpacity>
        {VIBES.map(v => (
          <TouchableOpacity
            key={v.key}
            style={[styles.vibeChip, vibe === v.key && { borderColor: v.color, backgroundColor: v.color + '20' }]}
            onPress={() => setVibe(vibe === v.key ? null : v.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.vibeEmoji}>{v.emoji}</Text>
            <Text style={[styles.vibeChipText, vibe === v.key && { color: v.color }]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        renderItem={({ item }) => <GatherCard event={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={G.lavender}
          />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {/* Circles */}
            {circles.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Gather Circles</Text>
                  <Text style={styles.sectionSub}>Small groups, shared interests</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {circles.map(circle => (
                    <CircleCard key={circle.id} circle={circle} userId={user?.id} onRefresh={load} />
                  ))}
                  <TouchableOpacity
                    style={styles.newCircleBtn}
                    onPress={() => router.push('/gather/circle/new')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.newCircleEmoji}>＋</Text>
                    <Text style={styles.newCircleText}>New{'\n'}Circle</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {/* Active filter chips */}
            {hasFilters && (
              <View style={styles.activeFiltersRow}>
                {vibe && (
                  <TouchableOpacity style={styles.activeFilter} onPress={() => setVibe(null)}>
                    <Text style={styles.activeFilterText}>
                      {VIBES.find(v => v.key === vibe)?.emoji} {VIBES.find(v => v.key === vibe)?.label} ×
                    </Text>
                  </TouchableOpacity>
                )}
                {activeTag && (
                  <TouchableOpacity style={styles.activeFilter} onPress={() => setActiveTag(null)}>
                    <Text style={styles.activeFilterText}>#{activeTag} ×</Text>
                  </TouchableOpacity>
                )}
                {lookingFor && (
                  <TouchableOpacity style={styles.activeFilter} onPress={() => setLookingFor(null)}>
                    <Text style={styles.activeFilterText}>
                      {LOOKING_FOR_OPTIONS.find(l => l.key === lookingFor)?.emoji} ×
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setVibe(null); setActiveTag(null); setLookingFor(null); }}>
                  <Text style={styles.clearFilters}>Clear all</Text>
                </TouchableOpacity>
              </View>
            )}

            {filtered.length > 0 && (
              <Text style={styles.eventsLabel}>{filtered.length} event{filtered.length !== 1 ? 's' : ''}</Text>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🤝</Text>
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptySub}>
                {hasFilters ? 'Try different filters, or be the first to host!' : 'Create the first community event in your area.'}
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowTemplates(true)}>
                <Text style={styles.emptyBtnText}>+ Host an Event</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      <FilterModal
        visible={showFilters}
        currentVibe={vibe}
        currentTag={activeTag}
        currentLookingFor={lookingFor}
        onApply={(v, t, l) => { setVibe(v); setActiveTag(t); setLookingFor(l); setShowFilters(false); }}
        onClose={() => setShowFilters(false)}
      />
      <TemplatesModal visible={showTemplates} onClose={() => setShowTemplates(false)} />
    </SafeAreaView>
  );
}

// ── Gather Card ──────────────────────────────────────────────────────────────
function GatherCard({ event }: { event: Event }) {
  const spotsLeft = event.cap - event.rsvp_count;
  const isFull    = spotsLeft <= 0;
  const vibeInfo  = VIBES.find(v => v.key === event.vibe);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/event/${event.slug}`)}
      activeOpacity={0.82}
    >
      <View style={[styles.cardAccent, { backgroundColor: vibeInfo?.color ?? G.lavender }]} />
      <View style={styles.cardInner}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardCategory}>
            {getCategoryEmoji(event.category)} {event.category.toUpperCase()}
          </Text>
          <View style={styles.badgeRow}>
            {event.is_trusted_host && (
              <View style={styles.trustedBadge}>
                <Text style={styles.trustedBadgeText}>✓ Trusted</Text>
              </View>
            )}
            {vibeInfo && (
              <View style={[styles.vibeBadge, { backgroundColor: vibeInfo.color + '20', borderColor: vibeInfo.color + '50' }]}>
                <Text style={[styles.vibeBadgeText, { color: vibeInfo.color }]}>{vibeInfo.emoji} {vibeInfo.label}</Text>
              </View>
            )}
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>FREE</Text>
            </View>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.cardMeta}>📅 {formatDate(event.date)} · {formatTime(event.time)}</Text>
        <Text style={styles.cardMeta}>📍 {event.location}</Text>

        {event.interest_tags?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={styles.tagRow}>
              {event.interest_tags.slice(0, 4).map(tag => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {event.looking_for_tags?.length > 0 && (
          <View style={styles.lookingForRow}>
            {event.looking_for_tags.map(key => {
              const info = LOOKING_FOR_OPTIONS.find(l => l.key === key);
              return info ? (
                <View key={key} style={styles.lookingForPill}>
                  <Text style={styles.lookingForText}>{info.emoji} {info.label}</Text>
                </View>
              ) : null;
            })}
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={[styles.spotsText, isFull && { color: '#F43F5E' }]}>
            {isFull
              ? `Full · ${event.waitlist_count} on waitlist`
              : event.is_anonymous_rsvp
              ? `${event.rsvp_count} going · spots available`
              : `${event.rsvp_count} going · ${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`
            }
          </Text>
          {event.safety_score > 0 && (
            <View style={styles.safetyScore}>
              <Text style={styles.safetyScoreText}>🛡️ {event.safety_score}%</Text>
            </View>
          )}
        </View>
        <View style={styles.capBarBg}>
          <View style={[styles.capBarFill, {
            width: `${Math.min(100, (event.rsvp_count / event.cap) * 100)}%` as any,
            backgroundColor: isFull ? '#F43F5E' : G.lavender,
          }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Circle Card ──────────────────────────────────────────────────────────────
function CircleCard({ circle, userId, onRefresh }: {
  circle: GatherCircle; userId?: string; onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (!userId) { router.push('/(auth)/sign-in'); return; }
    setBusy(true);
    try {
      if (circle.is_member) await leaveCircle(circle.id, userId);
      else await joinCircle(circle.id, userId);
      onRefresh();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };
  return (
    <TouchableOpacity
      style={[styles.circleCard, circle.is_member && styles.circleCardJoined]}
      onPress={handle} disabled={busy} activeOpacity={0.8}
    >
      <Text style={styles.circleEmoji}>{circle.emoji}</Text>
      <Text style={styles.circleName} numberOfLines={1}>{circle.name}</Text>
      <Text style={styles.circleCount}>{circle.member_count} members</Text>
      <View style={[styles.circleJoinBtn, circle.is_member && styles.circleJoinBtnJoined]}>
        <Text style={[styles.circleJoinText, circle.is_member && styles.circleJoinTextJoined]}>
          {circle.is_member ? '✓ Joined' : 'Join'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({ visible, currentVibe, currentTag, currentLookingFor, onApply, onClose }: {
  visible: boolean; currentVibe: string | null; currentTag: string | null;
  currentLookingFor: string | null;
  onApply: (v: string | null, t: string | null, l: string | null) => void;
  onClose: () => void;
}) {
  const [vibe,   setVibe]   = useState(currentVibe);
  const [tag,    setTag]    = useState(currentTag);
  const [lf,     setLf]     = useState(currentLookingFor);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mstyle.overlay}>
        <ScrollView style={mstyle.sheet} keyboardShouldPersistTaps="handled">
          <Text style={mstyle.title}>Filter Events</Text>

          <Text style={mstyle.label}>VIBE</Text>
          <View style={mstyle.row}>
            {VIBES.map(v => (
              <TouchableOpacity
                key={v.key}
                style={[mstyle.chip, vibe === v.key && { borderColor: v.color, backgroundColor: v.color + '20' }]}
                onPress={() => setVibe(vibe === v.key ? null : v.key)} activeOpacity={0.7}
              >
                <Text style={mstyle.chipEmoji}>{v.emoji}</Text>
                <Text style={[mstyle.chipText, vibe === v.key && { color: v.color }]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={mstyle.label}>INTEREST TAG</Text>
          <View style={mstyle.tagGrid}>
            {INTEREST_TAGS.map(t => (
              <TouchableOpacity
                key={t}
                style={[mstyle.tagChip, tag === t && mstyle.tagChipActive]}
                onPress={() => setTag(tag === t ? null : t)} activeOpacity={0.7}
              >
                <Text style={[mstyle.tagChipText, tag === t && mstyle.tagChipTextActive]}>#{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={mstyle.label}>LOOKING FOR</Text>
          <View style={mstyle.row}>
            {LOOKING_FOR_OPTIONS.map(l => (
              <TouchableOpacity
                key={l.key}
                style={[mstyle.chip, lf === l.key && mstyle.chipActive]}
                onPress={() => setLf(lf === l.key ? null : l.key)} activeOpacity={0.7}
              >
                <Text style={mstyle.chipEmoji}>{l.emoji}</Text>
                <Text style={[mstyle.chipText, lf === l.key && mstyle.chipTextActive]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={mstyle.btnRow}>
            <TouchableOpacity style={mstyle.cancelBtn} onPress={onClose}>
              <Text style={mstyle.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mstyle.applyBtn} onPress={() => onApply(vibe, tag, lf)}>
              <Text style={mstyle.applyText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Templates Modal ──────────────────────────────────────────────────────────
function TemplatesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mstyle.overlay}>
        <View style={mstyle.sheet}>
          <Text style={mstyle.title}>Quick Host</Text>
          <Text style={mstyle.subtitle}>Pick a template or start from scratch</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            <View style={tstyle.grid}>
              {GATHER_TEMPLATES.map(t => {
                const vibeInfo = VIBES.find(v => v.key === t.vibe);
                return (
                  <TouchableOpacity
                    key={t.key} style={tstyle.card} activeOpacity={0.8}
                    onPress={() => {
                      onClose();
                      router.push({ pathname: '/gather/create', params: { template: t.key } });
                    }}
                  >
                    <Text style={tstyle.emoji}>{t.emoji}</Text>
                    <Text style={tstyle.label}>{t.label}</Text>
                    <Text style={tstyle.cap}>Up to {t.cap}</Text>
                    {vibeInfo && (
                      <View style={[tstyle.vibePill, { backgroundColor: vibeInfo.color + '25' }]}>
                        <Text style={[tstyle.vibeText, { color: vibeInfo.color }]}>{vibeInfo.emoji} {vibeInfo.label}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={tstyle.scratchBtn}
            onPress={() => { onClose(); router.push('/host/create'); }}
            activeOpacity={0.8}
          >
            <Text style={tstyle.scratchBtnText}>✏️ Custom Event (full form)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mstyle.cancelBtn} onPress={onClose}>
            <Text style={mstyle.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── StyleSheets ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: G.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: G.text },
  headerSub:   { fontSize: 12, fontWeight: '500', color: G.sub, marginTop: 2 },
  hostBtn:     { backgroundColor: G.lavender, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
  hostBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  searchRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 8, marginBottom: spacing.sm },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: G.card, borderWidth: 1, borderColor: G.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm,
  },
  searchIcon:  { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 11, color: G.text },
  filterBtn:       { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: G.card, borderWidth: 1, borderColor: G.border, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  filterBtnText:   { fontSize: 18 },

  vibeRow:         { marginBottom: spacing.sm },
  vibeChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  vibeChipActive:  { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  vibeEmoji:       { fontSize: 14 },
  vibeChipText:    { fontSize: 12, fontWeight: '600', color: G.sub },
  vibeChipTextActive: { color: G.lavender },

  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },

  section:       { marginBottom: spacing.lg },
  sectionHeader: { marginBottom: spacing.sm },
  sectionTitle:  { fontSize: 18, fontWeight: '700', color: G.text },
  sectionSub:    { fontSize: 12, color: G.sub, marginTop: 2 },

  circleCard:        { width: 110, backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.md, padding: 12, alignItems: 'center', gap: 5 },
  circleCardJoined:  { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.08)' },
  circleEmoji:       { fontSize: 28, marginBottom: 2 },
  circleName:        { fontSize: 12, fontWeight: '700', color: G.text, textAlign: 'center' },
  circleCount:       { fontSize: 10, color: G.sub },
  circleJoinBtn:       { backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  circleJoinBtnJoined: { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  circleJoinText:      { fontSize: 11, fontWeight: '600', color: G.sub },
  circleJoinTextJoined:{ color: G.lavender },
  newCircleBtn:  { width: 110, backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.md, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  newCircleEmoji:{ fontSize: 24, color: G.sub },
  newCircleText: { fontSize: 11, color: G.sub, fontWeight: '600', textAlign: 'center' },

  activeFiltersRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  activeFilter:      { backgroundColor: 'rgba(155,142,196,0.15)', borderWidth: 1, borderColor: 'rgba(155,142,196,0.3)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  activeFilterText:  { fontSize: 12, color: G.lavender, fontWeight: '600' },
  clearFilters:      { fontSize: 12, color: G.sub, paddingVertical: 4, paddingHorizontal: 4 },
  eventsLabel:       { fontSize: 11, color: G.sub, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },

  card:         { backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  cardAccent:   { height: 3 },
  cardInner:    { padding: spacing.md },
  cardTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCategory: { fontSize: 10, fontWeight: '700', color: G.sub, letterSpacing: 0.8 },
  badgeRow:     { flexDirection: 'row', gap: 5, alignItems: 'center' },
  trustedBadge:     { backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  trustedBadgeText: { fontSize: 9, fontWeight: '700', color: '#34D399' },
  vibeBadge:        { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  vibeBadgeText:    { fontSize: 10, fontWeight: '600' },
  freeBadge:        { backgroundColor: 'rgba(155,142,196,0.1)', borderWidth: 1, borderColor: 'rgba(155,142,196,0.3)', borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  freeBadgeText:    { fontSize: 10, fontWeight: '700', color: G.lavender },
  cardTitle:    { fontSize: 18, fontWeight: '700', color: G.text, marginBottom: 7, lineHeight: 24 },
  cardMeta:     { fontSize: 13, fontWeight: '500', color: G.sub, marginBottom: 3 },
  tagRow:       { flexDirection: 'row', gap: 5 },
  tagPill:      { backgroundColor: 'rgba(155,142,196,0.08)', borderWidth: 1, borderColor: 'rgba(155,142,196,0.2)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagPillText:  { fontSize: 11, color: G.lavender, fontWeight: '500' },
  lookingForRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  lookingForPill: { backgroundColor: 'rgba(125,211,252,0.08)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.2)', borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  lookingForText: { fontSize: 11, color: '#7DD3FC', fontWeight: '500' },
  cardFooter:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 },
  spotsText:       { fontSize: 12, fontWeight: '600', color: G.sub },
  safetyScore:     { backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 1 },
  safetyScoreText: { fontSize: 10, fontWeight: '700', color: '#34D399' },
  capBarBg:   { height: 3, borderRadius: 2, backgroundColor: 'rgba(155,142,196,0.1)', overflow: 'hidden' },
  capBarFill: { height: '100%', borderRadius: 2 },

  empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyEmoji:   { fontSize: 52, marginBottom: spacing.md },
  emptyTitle:   { fontSize: 20, fontWeight: '700', color: G.text, marginBottom: spacing.xs },
  emptySub:     { fontSize: 14, textAlign: 'center', color: G.sub, marginBottom: spacing.lg },
  emptyBtn:     { backgroundColor: G.lavender, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const mstyle = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: '#1A1815', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: '#2A2622', padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '90%' },
  title:    { fontSize: 20, fontWeight: '800', color: G.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: G.sub, marginBottom: spacing.md },
  label:    { fontSize: 10, fontWeight: '700', color: G.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: spacing.md },
  row:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#201D1A', borderWidth: 1, borderColor: '#2A2622', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive:     { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  chipEmoji:      { fontSize: 15 },
  chipText:       { fontSize: 13, fontWeight: '600', color: G.sub },
  chipTextActive: { color: G.lavender },
  tagGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  tagChip:        { backgroundColor: '#201D1A', borderWidth: 1, borderColor: '#2A2622', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  tagChipActive:     { borderColor: G.lavender, backgroundColor: 'rgba(155,142,196,0.15)' },
  tagChipText:       { fontSize: 12, color: G.sub, fontWeight: '500' },
  tagChipTextActive: { color: G.lavender },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  cancelBtn: { flex: 1, paddingVertical: 13, backgroundColor: '#201D1A', borderWidth: 1, borderColor: '#2A2622', borderRadius: radius.md, alignItems: 'center', marginTop: 10 },
  cancelText:{ color: G.sub, fontWeight: '600', fontSize: 15 },
  applyBtn:  { flex: 2, paddingVertical: 13, backgroundColor: G.lavender, borderRadius: radius.md, alignItems: 'center' },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const tstyle = StyleSheet.create({
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  card:        { width: '47%', backgroundColor: '#201D1A', borderWidth: 1, borderColor: '#2A2622', borderRadius: radius.md, padding: 14, alignItems: 'center', gap: 4 },
  emoji:       { fontSize: 32, marginBottom: 4 },
  label:       { fontSize: 13, fontWeight: '700', color: G.text, textAlign: 'center' },
  cap:         { fontSize: 11, color: G.sub },
  vibePill:    { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  vibeText:    { fontSize: 10, fontWeight: '600' },
  scratchBtn:  { backgroundColor: '#201D1A', borderWidth: 1, borderColor: '#2A2622', borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  scratchBtnText: { color: G.text, fontWeight: '600', fontSize: 14 },
});
