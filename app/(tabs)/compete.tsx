import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../lib/theme';
import {
  supabase,
  formatDate,
  formatTime,
  Event,
  getCategoryEmoji,
  formatCategoryLabel,
} from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const CATEGORIES: { label: string; key: string }[] = [
  { label: 'All',          key: 'all'             },
  { label: '🏈 Football',  key: 'flag_football'   },
  { label: '🏀 Basketball',key: 'basketball'      },
  { label: '⚽ Soccer',    key: 'soccer'           },
  { label: '🏐 Volleyball',key: 'volleyball'      },
  { label: '🥎 Softball',  key: 'softball'        },
  { label: '🎾 Tennis',    key: 'tennis'          },
  { label: '🏓 Pickleball',key: 'pickleball'      },
  { label: '🌽 Cornhole',  key: 'cornhole'        },
  { label: '🎲 Games',     key: 'games'           },
  { label: '⭐ Other',     key: 'other'           },
];

export default function CompeteTab() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');

  const load = async () => {
    try {
      let query = supabase
        .from('events')
        .select('*')
        .eq('has_buy_in', true)
        .eq('is_active', true)
        .eq('is_private', false)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (cat !== 'all') {
        query = query.eq('category', cat);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [cat]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = search.trim()
    ? events.filter(
        (e) =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.location.toLowerCase().includes(search.toLowerCase()),
      )
    : events;

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🏆 Compete</Text>
          <Text style={styles.headerSub}>Buy-ins · Prize pools · Real stakes</Text>
        </View>
        <TouchableOpacity
          style={styles.hostBtn}
          onPress={() => router.push('/host/create')}
          activeOpacity={0.85}
        >
          <Text style={styles.hostBtnText}>+ Host</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search events..."
          placeholderTextColor={colors.gray2}
        />
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.catRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catChip, cat === c.key && styles.catChipActive]}
              onPress={() => setCat(c.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.catChipText, cat === c.key && styles.catChipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <CompeteCard event={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.orange}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptySub}>
                Be the first to host a competitive event.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/host/create')}
              >
                <Text style={styles.emptyBtnText}>+ Create Event</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function CompeteCard({ event }: { event: Event }) {
  const spotsLeft = event.cap - event.rsvp_count;
  const isFull = spotsLeft <= 0;
  const prizePool = (event.buy_in_amount ?? 0) * event.cap;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/event/${event.slug}`)}
      activeOpacity={0.82}
    >
      {/* Orange top bar */}
      <View style={styles.cardAccentOrange} />

      <View style={styles.cardInner}>
        {/* Title row */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardCategory}>
            {getCategoryEmoji(event.category)}{' '}
            {formatCategoryLabel(event.category).toUpperCase()}
          </Text>
          <View style={styles.prizeTag}>
            <Text style={styles.prizeTagText}>
              💰 ${prizePool.toLocaleString()} pool
            </Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>

        <Text style={styles.cardMeta}>
          📅 {formatDate(event.date)} · {formatTime(event.time)}
        </Text>
        <Text style={styles.cardMeta}>📍 {event.location}</Text>

        {/* Buy-in + spots row */}
        <View style={styles.cardFooter}>
          <View style={styles.buyInPill}>
            <Text style={styles.buyInText}>${event.buy_in_amount} / person</Text>
          </View>
          <Text style={[styles.spotsText, isFull && { color: colors.rose }]}>
            {isFull
              ? `FULL · ${event.waitlist_count} waiting`
              : `${spotsLeft} spots left`}
          </Text>
        </View>

        {/* Cap bar */}
        <View style={styles.capBarBg}>
          <View
            style={[
              styles.capBarFill,
              {
                width: `${Math.min(
                  100,
                  (event.rsvp_count / event.cap) * 100,
                )}%`,
              },
              isFull && { backgroundColor: colors.rose },
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.white },
  headerSub: {
    fontSize: 12,
    color: colors.gray2,
    fontWeight: '500',
    marginTop: 2,
  },

  hostBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  hostBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: { fontSize: 15, marginRight: 6 },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    paddingVertical: 11,
  },

  catRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: colors.orange,
  },
  catChipText: { fontSize: 12, fontWeight: '600', color: colors.gray1 },
  catChipTextActive: { color: colors.orange },

  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardAccentOrange: { height: 3, backgroundColor: colors.orange },
  cardInner: { padding: spacing.md },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray2,
    letterSpacing: 0.8,
  },

  prizeTag: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  prizeTagText: { fontSize: 11, fontWeight: '700', color: colors.green },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.gray1,
    fontWeight: '500',
    marginBottom: 3,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  buyInPill: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  buyInText: { fontSize: 12, fontWeight: '700', color: colors.orange },

  spotsText: { fontSize: 12, fontWeight: '600', color: colors.gray1 },

  capBarBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  capBarFill: { height: '100%', backgroundColor: colors.orange, borderRadius: 2 },

  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  emptySub: {
    fontSize: 14,
    color: colors.gray1,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  emptyBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});