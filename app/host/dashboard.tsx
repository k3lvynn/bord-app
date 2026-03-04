import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
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

export default function HostDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('host_id', user.id)
        .order('date', { ascending: true });
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
    }, [user]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderEvent = ({ item }: { item: Event }) => {
    const spotsLeft = item.cap - item.rsvp_count;
    const isFull = spotsLeft <= 0;
    const isPast = new Date(item.date) < new Date();

    return (
      <TouchableOpacity
        style={[styles.eventCard, isPast && styles.eventCardPast]}
        onPress={() => router.push(`/host/event/${item.id}`)}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.accentBar,
            { backgroundColor: item.has_buy_in ? colors.orange : colors.lavender },
          ]}
        />
        <View style={styles.eventCardInner}>
          <View style={styles.eventCardHeader}>
            <Text style={styles.eventCategory}>
              {getCategoryEmoji(item.category)}{' '}
              {formatCategoryLabel(item.category).toUpperCase()}
            </Text>
            {item.has_buy_in && (
              <View style={styles.buyInBadge}>
                <Text style={styles.buyInBadgeText}>
                  ${item.buy_in_amount} BUY-IN
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.eventMeta}>
            <Text style={styles.metaText}>
              📅 {formatDate(item.date)} · {formatTime(item.time)}
            </Text>
            <Text style={styles.metaText}>📍 {item.location}</Text>
          </View>
          <View style={styles.capWrap}>
            <View style={styles.capBarBg}>
              <View
                style={[
                  styles.capBarFill,
                  {
                    width: `${Math.min(
                      100,
                      (item.rsvp_count / item.cap) * 100,
                    )}%` as any,
                  },
                  isFull && styles.capBarFull,
                ]}
              />
            </View>
            <Text
              style={[styles.capText, isFull && { color: colors.rose }]}
            >
              {isFull
                ? `FULL · ${item.waitlist_count} waitlisted`
                : `${item.rsvp_count}/${item.cap} registered`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🏈</Text>
      <Text style={styles.emptyTitle}>No events yet</Text>
      <Text style={styles.emptySub}>
        Create your first event and share the RSVP link with your community.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loading ? null : <EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.orange}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Events</Text>
            <Text style={styles.headerSub}>
              {events.length} event{events.length !== 1 ? 's' : ''} hosted
            </Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/host/create')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+ Create Event</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  header: { paddingVertical: spacing.xl },
  headerTitle: { fontSize: 30, fontWeight: '800', color: colors.white },
  headerSub: {
    fontSize: 13,
    color: colors.gray1,
    marginTop: 4,
    fontWeight: '500',
  },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.sm,
  },
  eventCardPast: { opacity: 0.55 },
  accentBar: { height: 3 },
  eventCardInner: { padding: spacing.md },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  eventCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray2,
    letterSpacing: 1,
  },
  buyInBadge: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  buyInBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.orange,
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  eventMeta: { gap: 4, marginBottom: spacing.md },
  metaText: { fontSize: 13, color: colors.gray1, fontWeight: '500' },
  capWrap: { gap: 6 },
  capBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  capBarFill: {
    height: '100%',
    backgroundColor: colors.orange,
    borderRadius: 2,
  },
  capBarFull: { backgroundColor: colors.rose },
  capText: {
    fontSize: 11,
    color: colors.gray2,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontSize: 15,
    color: colors.gray1,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.md,
  },
  fabText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});