// app/(tabs)/search.tsx
// Search & Discover — Events and People tabs.
// Events: list + map view, category/radius filters.
// People: search by name or @username.

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView,
  TextInput, ActivityIndicator, Animated, Dimensions, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../lib/theme';
import {
  supabase, formatDate, formatTime, Event,
  getCategoryEmoji, formatCategoryLabel, searchBordUsers,
} from '../../lib/supabase';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Map deps (custom build only) ──────────────────────────────────────────────
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
let MapView: any = null;
let Marker: any  = null;
let PROVIDER_GOOGLE: any = undefined;
let Location: any = null;
if (!IS_EXPO_GO) {
  try { const M = require('react-native-maps'); MapView = M.default; Marker = M.Marker; PROVIDER_GOOGLE = M.PROVIDER_GOOGLE; } catch (_) {}
  try { Location = require('expo-location'); } catch (_) {}
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SPORT_CATS = new Set([
  'flag_football','basketball','soccer','volleyball','softball','tennis',
  'pickleball','golf','cornhole','dodgeball','kickball','ultimate_frisbee',
]);

const CATEGORY_FILTERS = [
  { key: 'all',           label: 'All'             },
  { key: 'compete',       label: '🏆 Compete'      },
  { key: 'gather',        label: '🤝 Gather'       },
  { key: 'flag_football', label: '🏈 Flag Football' },
  { key: 'basketball',    label: '🏀 Basketball'   },
  { key: 'soccer',        label: '⚽ Soccer'       },
  { key: 'volleyball',    label: '🏐 Volleyball'   },
  { key: 'softball',      label: '🥎 Softball'     },
  { key: 'tennis',        label: '🎾 Tennis'       },
  { key: 'pickleball',    label: '🏓 Pickleball'   },
  { key: 'golf',          label: '⛳ Golf'          },
  { key: 'cornhole',      label: '🌽 Cornhole'     },
  { key: 'dodgeball',     label: '🔴 Dodgeball'    },
  { key: 'kickball',      label: '👟 Kickball'     },
  { key: 'ultimate_frisbee', label: '🥏 Frisbee'   },
  { key: 'food',          label: '🍲 Food & Drink' },
  { key: 'music',         label: '🎵 Music'        },
  { key: 'arts',          label: '🎨 Arts'         },
  { key: 'games',         label: '🎲 Games'        },
  { key: 'fitness',       label: '🏃 Fitness'      },
  { key: 'social',        label: '🤝 Social'       },
];

const RADIUS_OPTIONS = [
  { key: 'any', label: 'Any distance', miles: null },
  { key: '5',   label: '5 mi',  miles: 5   },
  { key: '10',  label: '10 mi', miles: 10  },
  { key: '25',  label: '25 mi', miles: 25  },
  { key: '50',  label: '50 mi', miles: 50  },
];

const SD_REGION = { latitude: 32.7157, longitude: -117.1611, latitudeDelta: 0.18, longitudeDelta: 0.18 };

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchTab() {
  const [searchMode,    setSearchMode]    = useState<'events' | 'people'>('events');
  const [viewMode,      setViewMode]      = useState<'list' | 'map'>('list');
  const [query,         setQuery]         = useState('');
  const [catFilter,     setCatFilter]     = useState('all');
  const [radiusKey,     setRadiusKey]     = useState('any');
  const [showFilters,   setShowFilters]   = useState(false);
  const [results,       setResults]       = useState<Event[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [userLoc,       setUserLoc]       = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  const mapRef       = useRef<any>(null);
  const slideAnim    = useRef(new Animated.Value(SCREEN_H)).current;

  // ── Location (best-effort) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!Location) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch (_) {}
    })();
  }, []);

  // ── Event search ────────────────────────────────────────────────────────────
  const doSearch = async (q: string, cat: string, radKey: string, loc: typeof userLoc) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let base = supabase
        .from('events').select('*')
        .eq('is_active', true).eq('is_private', false)
        .gte('date', today).order('date').limit(80);

      if (cat === 'compete')     base = base.in('category', Array.from(SPORT_CATS));
      else if (cat === 'gather') base = base.not('category', 'in', `(${Array.from(SPORT_CATS).map(c => `"${c}"`).join(',')})`);
      else if (cat !== 'all')    base = base.eq('category', cat);

      const { data } = await base;
      let all = (data ?? []) as Event[];

      const trimmed = q.trim().toLowerCase();
      if (trimmed) {
        all = all.filter(e =>
          e.title.toLowerCase().includes(trimmed) ||
          e.location.toLowerCase().includes(trimmed) ||
          (e.description ?? '').toLowerCase().includes(trimmed),
        );
      }

      const radMiles = RADIUS_OPTIONS.find(r => r.key === radKey)?.miles ?? null;
      if (radMiles !== null && loc) {
        all = all.filter(e => {
          if (!e.latitude || !e.longitude) return true;
          return haversineMiles(loc.latitude, loc.longitude, e.latitude, e.longitude) <= radMiles;
        });
      }

      setResults(all);
    } catch (e) { console.error('search error:', e); }
    finally { setLoading(false); }
  };

  // Initial load: fire once on mount
  useEffect(() => {
    doSearch('', 'all', 'any', null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // People search
  useEffect(() => {
    if (searchMode !== 'people') return;
    if (query.trim().length < 2) { setPeopleResults([]); return; }
    let active = true;
    setPeopleLoading(true);
    searchBordUsers(query)
      .then(r  => { if (active) setPeopleResults(r); })
      .catch(() => {})
      .finally(() => { if (active) setPeopleLoading(false); });
    return () => { active = false; };
  }, [query, searchMode]);

  // Slide animation for map popup
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedEvent ? 0 : SCREEN_H,
      useNativeDriver: true,
    }).start();
  }, [selectedEvent]);

  const selectedRadius = RADIUS_OPTIONS.find(r => r.key === radiusKey)?.miles ?? null;

  const applyFilter = (cat: string, rad: string) => {
    setCatFilter(cat);
    setRadiusKey(rad);
    doSearch(query, cat, rad, userLoc);
  };

  const hasActiveFilters = catFilter !== 'all' || radiusKey !== 'any';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>

      {/* Events / People toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, searchMode === 'events' && styles.modeBtnActive]}
          onPress={() => { setSearchMode('events'); setQuery(''); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.modeBtnText, searchMode === 'events' && styles.modeBtnTextActive]}>
            {'🗓️  Events'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, searchMode === 'people' && styles.modeBtnActive]}
          onPress={() => { setSearchMode('people'); setQuery(''); setPeopleResults([]); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.modeBtnText, searchMode === 'people' && styles.modeBtnTextActive]}>
            {'👥  People'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.topRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>{'🔍'}</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={searchMode === 'people' ? 'Search by name or @username...' : 'Search events, locations...'}
            placeholderTextColor={colors.gray2}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchMode === 'events') doSearch(query, catFilter, radiusKey, userLoc);
            }}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => {
              setQuery('');
              setPeopleResults([]);
              if (searchMode === 'events') doSearch('', catFilter, radiusKey, userLoc);
            }}>
              <Text style={styles.clearBtn}>{'✕'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {searchMode === 'events' && (
          <TouchableOpacity
            style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.filterBtnIcon}>{'⚙️'}</Text>
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        )}
      </View>

      {/* ── PEOPLE MODE ── */}
      {searchMode === 'people' && (
        peopleLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.orange} /></View>
        ) : query.trim().length < 2 ? (
          <View style={styles.center}>
            <Text style={styles.hintEmoji}>{'👥'}</Text>
            <Text style={styles.hintText}>{'Type a name or @username to find people'}</Text>
          </View>
        ) : peopleResults.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.hintEmoji}>{'😶'}</Text>
            <Text style={styles.hintText}>{'No users found'}</Text>
          </View>
        ) : (
          <FlatList
            data={peopleResults}
            keyExtractor={u => u.id}
            contentContainerStyle={styles.peopleList}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            renderItem={({ item: u }) => (
              <TouchableOpacity
                style={styles.personRow}
                onPress={() => router.push(`/user/${u.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.personAvatar}>
                  {u.avatar_url
                    ? <Image source={{ uri: u.avatar_url }} style={styles.personAvatarImg} />
                    : <Text style={styles.personAvatarEmoji}>{u.avatar_emoji}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName}>{u.display_name}</Text>
                  <Text style={styles.personUsername}>{'@'}{u.username}</Text>
                </View>
                <Text style={styles.personArrow}>{'›'}</Text>
              </TouchableOpacity>
            )}
          />
        )
      )}

      {/* ── EVENTS MODE ── */}
      {searchMode === 'events' && (
        <View style={{ flex: 1 }}>

          {/* Category chip strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            {CATEGORY_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, catFilter === f.key && styles.chipActive]}
                onPress={() => applyFilter(f.key, radiusKey)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, catFilter === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* List / Map toggle */}
          <View style={styles.viewToggleRow}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>
                {'📋  List'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('map')}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}>
                {'🗺️  Map'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.orange} size="large" />
              </View>
            ) : results.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.hintEmoji}>{'😶'}</Text>
                <Text style={styles.hintText}>{'No events found. Try adjusting your filters.'}</Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={e => e.id}
                renderItem={({ item }) => <SearchCard event={item} />}
                contentContainerStyle={styles.list}
              />
            )
          )}

          {/* MAP VIEW */}
          {viewMode === 'map' && (
            <View style={{ flex: 1 }}>
              {IS_EXPO_GO || !MapView ? (
                <View style={styles.center}>
                  <Text style={styles.hintEmoji}>{'🗺️'}</Text>
                  <Text style={styles.hintText}>
                    {'Map requires a custom dev build.\nRun '}
                    <Text style={{ color: colors.orange }}>{'eas build --profile development'}</Text>
                    {' to enable it.'}
                  </Text>
                </View>
              ) : (
                <>
                  <MapView
                    ref={mapRef}
                    style={{ flex: 1 }}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={userLoc ? { ...userLoc, latitudeDelta: 0.12, longitudeDelta: 0.12 } : SD_REGION}
                    showsUserLocation
                    showsMyLocationButton
                    customMapStyle={darkMapStyle}
                    onPress={() => setSelectedEvent(null)}
                  >
                    {results.map(e => {
                      if (!e.latitude || !e.longitude) return null;
                      const accent = SPORT_CATS.has(e.category ?? '') ? colors.orange : '#9B8EC4';
                      return (
                        <Marker key={e.id} coordinate={{ latitude: e.latitude, longitude: e.longitude }} onPress={() => setSelectedEvent(e)}>
                          <View style={[styles.pin, selectedEvent?.id === e.id && styles.pinSelected, { backgroundColor: accent }]}>
                            <Text style={styles.pinEmoji}>{getCategoryEmoji(e.category)}</Text>
                          </View>
                        </Marker>
                      );
                    })}
                  </MapView>

                  {results.length > 0 && (
                    <View style={styles.mapBadge}>
                      <Text style={styles.mapBadgeText}>
                        {results.length}{' event'}{results.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}

                  {selectedEvent && (
                    <Animated.View style={[styles.eventPopup, { transform: [{ translateY: slideAnim }] }]}>
                      <View style={styles.popupHandle} />
                      <TouchableOpacity style={styles.popupClose} onPress={() => setSelectedEvent(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Text style={{ color: colors.gray2, fontSize: 18 }}>{'✕'}</Text>
                      </TouchableOpacity>
                      <Text style={styles.popupTitle} numberOfLines={2}>{selectedEvent.title}</Text>
                      <Text style={styles.popupMeta}>{'📅 '}{formatDate(selectedEvent.date)}{' · '}{formatTime(selectedEvent.time)}</Text>
                      <Text style={styles.popupMeta} numberOfLines={1}>{'📍 '}{selectedEvent.location}</Text>
                      <View style={styles.popupFooter}>
                        <Text style={styles.popupSpots}>
                          {selectedEvent.cap - selectedEvent.rsvp_count > 0
                            ? (selectedEvent.cap - selectedEvent.rsvp_count) + ' spots left'
                            : 'Full'}
                        </Text>
                        <TouchableOpacity
                          style={styles.popupBtn}
                          onPress={() => { setSelectedEvent(null); router.push('/event/' + selectedEvent.slug); }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.popupBtnText}>{'View Event'}</Text>
                        </TouchableOpacity>
                      </View>
                    </Animated.View>
                  )}
                </>
              )}
            </View>
          )}

        </View>
      )}

      {/* Filter modal */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilters(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.filterSheet}>
            <View style={styles.filterHandle} />
            <Text style={styles.filterTitle}>{'Filters'}</Text>

            <Text style={styles.filterLabel}>{'TYPE'}</Text>
            <View style={styles.filterChipRow}>
              {[{ key: 'all', label: 'All' }, { key: 'compete', label: '🏆 Compete' }, { key: 'gather', label: '🤝 Gather' }].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterChip, catFilter === opt.key && styles.filterChipActive]}
                  onPress={() => setCatFilter(opt.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterChipText, catFilter === opt.key && styles.filterChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>{'DISTANCE'}</Text>
            {!userLoc && <Text style={styles.filterNote}>{'📍 Enable location to filter by distance'}</Text>}
            <View style={styles.filterChipRow}>
              {RADIUS_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterChip, radiusKey === opt.key && styles.filterChipActive, !userLoc && opt.key !== 'any' && { opacity: 0.35 }]}
                  onPress={() => { if (userLoc || opt.key === 'any') setRadiusKey(opt.key); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterChipText, radiusKey === opt.key && styles.filterChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterResetBtn} onPress={() => { setCatFilter('all'); setRadiusKey('any'); }} activeOpacity={0.8}>
                <Text style={styles.filterResetText}>{'Reset'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => { setShowFilters(false); doSearch(query, catFilter, radiusKey, userLoc); }}
                activeOpacity={0.85}
              >
                <Text style={styles.filterApplyText}>{'Apply Filters'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

// ── Search Card ───────────────────────────────────────────────────────────────
function SearchCard({ event }: { event: Event }) {
  const isCompete = SPORT_CATS.has(event.category ?? '');
  const accent    = isCompete ? colors.orange : '#9B8EC4';
  const spotsLeft = event.cap - event.rsvp_count;
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push('/event/' + event.slug)} activeOpacity={0.82}>
      <View style={[styles.cardBar, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardCat}>{getCategoryEmoji(event.category)}{' '}{formatCategoryLabel(event.category).toUpperCase()}</Text>
          <View style={[styles.modePill, { borderColor: accent + '55', backgroundColor: accent + '18' }]}>
            <Text style={[styles.modePillText, { color: accent }]}>{isCompete ? '🏆 Compete' : '🤝 Gather'}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.cardMeta}>{'📅 '}{formatDate(event.date)}{' · '}{formatTime(event.time)}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{'📍 '}{event.location}</Text>
        <View style={styles.cardFootRow}>
          {event.buy_in_amount
            ? <Text style={[styles.buyIn, { color: accent }]}>{isCompete ? '$' : '🎟️ $'}{event.buy_in_amount}{isCompete ? ' buy-in' : ' / ticket'}</Text>
            : <Text style={styles.free}>{'Free'}</Text>}
          <Text style={[styles.spots, spotsLeft <= 0 && { color: colors.rose }]}>
            {spotsLeft > 0 ? spotsLeft + ' spots left' : 'Full · ' + event.waitlist_count + ' waiting'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Dark Map Style ─────────────────────────────────────────────────────────────
const darkMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8a8a9a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111' }] },
  { featureType: 'road',    elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'water',   elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  modeRow: {
    flexDirection: 'row', margin: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.panel, borderRadius: radius.lg,
    padding: 3, borderWidth: 1, borderColor: colors.border,
  },
  modeBtn:         { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.md },
  modeBtnActive:   { backgroundColor: colors.black, borderWidth: 1, borderColor: colors.orange },
  modeBtnText:     { color: colors.gray1, fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: colors.orange },

  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 10, gap: spacing.xs,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '500' },
  clearBtn:    { color: colors.gray2, fontSize: 15, paddingHorizontal: 4 },

  filterBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.1)' },
  filterBtnIcon:   { fontSize: 18 },
  filterDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.orange, borderWidth: 1.5, borderColor: colors.black,
  },

  chipScroll: { flexGrow: 0 },
  chipRow:    { paddingHorizontal: spacing.md, paddingBottom: spacing.xs, paddingTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip:       { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.card },
  chipActive: { backgroundColor: 'rgba(249,115,22,0.13)', borderColor: colors.orange },
  chipText:   { fontSize: 12, color: colors.gray1, fontWeight: '600' },
  chipTextActive: { color: colors.orange },

  viewToggleRow: {
    flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.panel, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  viewToggleBtn:        { flex: 1, paddingVertical: 10, alignItems: 'center' },
  viewToggleBtnActive:  { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.orange, borderRadius: radius.md - 1 },
  viewToggleText:       { fontSize: 13, fontWeight: '600', color: colors.gray1 },
  viewToggleTextActive: { color: colors.white, fontWeight: '800' },

  list:      { paddingHorizontal: spacing.md, paddingBottom: 20 },
  peopleList:{ padding: spacing.md },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  hintEmoji: { fontSize: 44, marginBottom: spacing.md },
  hintText:  { fontSize: 14, color: colors.gray1, textAlign: 'center', lineHeight: 21 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm, flexDirection: 'row', overflow: 'hidden', ...shadow.sm,
  },
  cardBar:     { width: 4 },
  cardBody:    { flex: 1, padding: spacing.md, gap: 3 },
  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardCat:     { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 0.6 },
  modePill:    { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  modePillText:{ fontSize: 10, fontWeight: '700' },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 2 },
  cardMeta:    { fontSize: 12, color: colors.gray1, fontWeight: '500' },
  cardFootRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  buyIn:       { fontSize: 11, fontWeight: '700' },
  free:        { fontSize: 11, fontWeight: '700', color: '#9B8EC4' },
  spots:       { fontSize: 11, fontWeight: '600', color: colors.gray1 },

  pin:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, elevation: 6 },
  pinSelected: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  pinEmoji:    { fontSize: 18 },
  mapBadge:    { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  mapBadgeText:{ fontSize: 12, color: colors.white, fontWeight: '700' },

  eventPopup: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: 32 },
  popupHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  popupClose:  { position: 'absolute', top: spacing.md, right: spacing.md },
  popupTitle:  { fontSize: 18, fontWeight: '800', color: colors.white, marginBottom: 6 },
  popupMeta:   { fontSize: 12, color: colors.gray1, marginBottom: 2 },
  popupFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  popupSpots:  { fontSize: 13, color: colors.gray1 },
  popupBtn:    { backgroundColor: colors.orange, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  popupBtnText:{ color: colors.white, fontWeight: '700', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  filterSheet:  { backgroundColor: colors.panel, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: 40 },
  filterHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  filterTitle:  { fontSize: 20, fontWeight: '800', color: colors.white, marginBottom: spacing.md },
  filterLabel:  { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 1.5, marginBottom: spacing.xs, marginTop: spacing.sm },
  filterNote:   { fontSize: 12, color: colors.gray2, marginBottom: spacing.xs, fontStyle: 'italic' },
  filterChipRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.xs },
  filterChip:   { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  filterChipActive:  { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.12)' },
  filterChipText:    { fontSize: 13, color: colors.gray1, fontWeight: '600' },
  filterChipTextActive: { color: colors.orange, fontWeight: '700' },
  filterActions:  { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  filterResetBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  filterResetText:{ fontSize: 14, color: colors.gray1, fontWeight: '700' },
  filterApplyBtn: { flex: 2, paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.orange, alignItems: 'center' },
  filterApplyText:{ fontSize: 14, color: colors.white, fontWeight: '700' },

  personRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  personAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, overflow: 'hidden' },
  personAvatarImg:  { width: 48, height: 48, borderRadius: 24 },
  personAvatarEmoji:{ fontSize: 26 },
  personName:       { fontSize: 15, fontWeight: '700', color: colors.white },
  personUsername:   { fontSize: 13, color: colors.orange, marginTop: 2 },
  personArrow:      { fontSize: 22, color: colors.gray2 },
});
