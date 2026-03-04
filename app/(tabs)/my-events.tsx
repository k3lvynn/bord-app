import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../lib/theme';
import { supabase, formatDate, formatTime, Event } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

export default function MyEventsTab() {
  const { user, profile } = useAuth();
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

  useFocusEffect(useCallback(() => { load(); }, [user]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleManage = (event: Event) => {
    router.push(`/host/event/${event.id}`);
  };

  const handleDelete = (event: Event) => {
    const doDelete = async () => {
      try {
        const { error } = await supabase.from('events').delete().eq('id', event.id);
        if (error) throw error;
        setEvents(prev => prev.filter(e => e.id !== event.id));
        Alert.alert('Deleted', `"${event.title}" has been removed.`);
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Could not delete event.');
      }
    };
    Alert.alert(
      'Delete Event',
      'Delete "' + event.title + '"? This removes all RSVPs and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const showOptions = (event: Event) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Manage Event', 'Delete Event'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
          title: event.title,
        },
        (idx) => {
          if (idx === 1) handleManage(event);
          if (idx === 2) handleDelete(event);
        }
      );
    } else {
      Alert.alert(event.title, 'What would you like to do?', [
        { text: 'Manage Event', onPress: () => handleManage(event) },
        { text: 'Delete Event', style: 'destructive', onPress: () => handleDelete(event) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(e => e.date >= today);
  const past = events.filter(e => e.date < today);

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => ''}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
        ListHeaderComponent={
          <View>
            <View style={styles.greeting}>
              <Text style={styles.greetingText}>
                {'Hey '}
                <Text style={{ color: colors.orange }}>{profile?.display_name?.split(' ')[0] ?? 'there'}</Text>
                {' '}
              </Text>
              <Text style={styles.greetingSub}>
                {events.length} event{events.length !== 1 ? 's' : ''} hosted
                {' \u00b7 '}
                {events.reduce((n, e) => n + e.rsvp_count, 0)} total RSVPs
              </Text>
            </View>

            <TouchableOpacity
              style={styles.createCard}
              onPress={() => router.push('/host/create')}
              activeOpacity={0.85}
            >
              <View>
                <Text style={styles.createTitle}>+ Create New Event</Text>
                <Text style={styles.createSub}>Set a cap, get a shareable RSVP link</Text>
              </View>
              <Text style={{ fontSize: 24, color: colors.white }}>{'\u2192'}</Text>
            </TouchableOpacity>

            {upcoming.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>UPCOMING</Text>
                {upcoming.map(e => (
                  <EventRow
                    key={e.id}
                    event={e}
                    onPress={() => handleManage(e)}
                    onOptions={() => showOptions(e)}
                  />
                ))}
              </>
            )}

            {past.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>PAST</Text>
                {past.map(e => (
                  <EventRow
                    key={e.id}
                    event={e}
                    past
                    onPress={() => handleManage(e)}
                    onOptions={() => showOptions(e)}
                  />
                ))}
              </>
            )}

            {events.length === 0 && !loading && (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>{'📋'}</Text>
                <Text style={styles.emptyTitle}>No events yet</Text>
                <Text style={styles.emptySub}>Create your first event and share the RSVP link with your community.</Text>
              </View>
            )}
          </View>
        }
        contentContainerStyle={styles.scroll}
      />
    </SafeAreaView>
  );
}

const SPORT_CATS = new Set([
  'flag_football','basketball','soccer','volleyball','softball','tennis',
  'pickleball','golf','cornhole','dodgeball','kickball','ultimate_frisbee',
]);

function EventRow({
  event,
  past = false,
  onPress,
  onOptions,
}: {
  event: Event;
  past?: boolean;
  onPress: () => void;
  onOptions: () => void;
}) {
  const spotsLeft = event.cap - event.rsvp_count;
  const isFull = spotsLeft <= 0;
  const accentColor = SPORT_CATS.has(event.category ?? '') ? colors.orange : '#9B8EC4';

  return (
    <TouchableOpacity
      style={[styles.row, past && styles.rowPast]}
      onPress={onPress}
      onLongPress={onOptions}
      activeOpacity={0.8}
    >
      <View style={[styles.rowAccent, { backgroundColor: accentColor }]} />
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.rowMeta}>{'📅 '}{formatDate(event.date)}{' \u00b7 '}{formatTime(event.time)}</Text>
        <View style={styles.rowFooter}>
          <Text style={[styles.rowSpots, isFull && { color: colors.rose }]}>
            {isFull ? 'FULL \u00b7 ' + event.waitlist_count + ' waitlisted' : event.rsvp_count + '/' + event.cap + ' registered'}
          </Text>
          {event.has_buy_in && (
            <Text style={styles.rowBuyIn}>{'$'}{event.buy_in_amount}{' buy-in'}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.moreBtn}
        onPress={onOptions}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      >
        <Text style={styles.moreDots}>{'\u22EE'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 100, paddingTop: spacing.md },
  greeting: { marginBottom: spacing.md },
  greetingText: { fontSize: 26, fontWeight: '800', color: colors.white },
  greetingSub: { fontSize: 13, color: colors.gray1, marginTop: 4 },
  createCard: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  createTitle: { fontSize: 16, fontWeight: '700', color: colors.white },
  createSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.gray2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  rowPast: { opacity: 0.5 },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowContent: { flex: 1, padding: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 3 },
  rowMeta: { fontSize: 12, color: colors.gray1, marginBottom: 4 },
  rowFooter: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  rowSpots: { fontSize: 11, fontWeight: '600', color: colors.gray2 },
  rowBuyIn: { fontSize: 11, fontWeight: '600', color: colors.orange },
  moreBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  moreDots: { fontSize: 22, color: colors.gray2, lineHeight: 22 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  emptySub: { fontSize: 14, color: colors.gray1, textAlign: 'center', lineHeight: 21 },
});
