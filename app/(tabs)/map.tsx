// app/(tabs)/map.tsx
// react-native-maps requires a custom dev build — AIRMap native component
// is NOT available in Expo Go. We detect this BEFORE rendering and show a
// placeholder, since the try/catch on require() doesn't catch native errors.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../lib/theme';
import { supabase, formatDate, formatTime, Event } from '../../lib/supabase';

// Detect Expo Go — AIRMap native component doesn't exist there
// executionEnvironment === 'storeClient' means Expo Go
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// Only require the map if NOT in Expo Go — avoids the UIManager crash entirely
let MapView: any = null;
let Marker:  any = null;
let PROVIDER_GOOGLE: any = undefined;
if (!IS_EXPO_GO) {
  try {
    const Maps   = require('react-native-maps');
    MapView        = Maps.default;
    Marker         = Maps.Marker;
    PROVIDER_GOOGLE= Maps.PROVIDER_GOOGLE;
  } catch (_) {}
}

// expo-location
let Location: any = null;
try { Location = require('expo-location'); } catch (_) {}

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HIDDEN  = SCREEN_H;
const SHEET_PARTIAL = SCREEN_H * 0.42;
const SD_REGION = { latitude: 32.7157, longitude: -117.1611, latitudeDelta: 0.12, longitudeDelta: 0.12 };

export default function MapTab() {
  const mapRef = useRef<any>(null);
  const sheetY = useRef(new Animated.Value(SHEET_HIDDEN)).current;

  const [events,   setEvents]   = useState<Event[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Event | null>(null);
  const [userLoc,  setUserLoc]  = useState<{ latitude: number; longitude: number } | null>(null);
  const [filter,   setFilter]   = useState<'all' | 'compete' | 'gather'>('all');

  const load = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .eq('is_private', false)
        .gte('date', today)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('date')
        .limit(100);
      setEvents((data ?? []) as Event[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    if (!Location || IS_EXPO_GO) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced ?? 3 });
          setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          mapRef.current?.animateToRegion({
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
            latitudeDelta: 0.10, longitudeDelta: 0.10,
          }, 800);
        }
      } catch (_) {}
    })();
  }, []);

  // ── Expo Go / no native module: show placeholder ──────────────────────────
  if (IS_EXPO_GO || !MapView) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>🗺️</Text>
          <Text style={styles.placeholderTitle}>Map needs a Dev Build</Text>
          <Text style={styles.placeholderBody}>
            The map uses <Text style={styles.code}>react-native-maps</Text> which requires
            native code not included in Expo Go.{'\n\n'}
            To use the map, build a development client:{'\n\n'}
            <Text style={styles.code}>npx expo run:ios</Text>
            {'  '}or{'  '}
            <Text style={styles.code}>eas build --profile development</Text>
          </Text>
          <View style={styles.eventCountPill}>
            <Text style={styles.eventCountText}>
              {loading ? 'Loading...' : `${events.length} upcoming event${events.length !== 1 ? 's' : ''} will appear here`}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Full map (dev build only) ─────────────────────────────────────────────
  const filtered = events.filter(e => {
    if (filter === 'compete') return e.has_buy_in;
    if (filter === 'gather')  return !e.has_buy_in;
    return true;
  });

  const selectEvent = (event: Event) => {
    setSelected(event);
    if (event.latitude && event.longitude) {
      mapRef.current?.animateToRegion({
        latitude: event.latitude - 0.015, longitude: event.longitude,
        latitudeDelta: 0.05, longitudeDelta: 0.05,
      }, 500);
    }
    Animated.spring(sheetY, { toValue: SHEET_PARTIAL, useNativeDriver: false, tension: 60, friction: 10 }).start();
  };

  const dismissSheet = () => {
    setSelected(null);
    Animated.spring(sheetY, { toValue: SHEET_HIDDEN, useNativeDriver: false, tension: 80, friction: 12 }).start();
  };

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={SD_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={DARK_MAP_STYLE}
        onPress={dismissSheet}
      >
        {filtered.map(event => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.latitude!, longitude: event.longitude! }}
            onPress={() => selectEvent(event)}
          >
            <View style={[
              styles.pin,
              event.has_buy_in ? styles.pinCompete : styles.pinGather,
              event.is_tournament && styles.pinTournament,
              selected?.id === event.id && styles.pinSelected,
            ]}>
              <Text style={styles.pinText}>
                {event.is_tournament ? '🏆' : event.has_buy_in ? '💰' : '🤝'}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.filterRow}>
          {(['all','compete','gather'] as const).map(f => (
            <TouchableOpacity key={f}
              style={[styles.filterChip, filter===f && styles.filterChipActive]}
              onPress={() => setFilter(f)} activeOpacity={0.85}>
              <Text style={[styles.filterText, filter===f && styles.filterTextActive]}>
                {f==='all' ? '🗺 All' : f==='compete' ? '🏆 Compete' : '🤝 Gather'}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.countPill}>
            <Text style={styles.countText}>{filtered.length}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.locBtn} onPress={() => {
          if (userLoc) mapRef.current?.animateToRegion({ ...userLoc, latitudeDelta:0.06, longitudeDelta:0.06 }, 600);
        }} activeOpacity={0.85}>
          <Text style={styles.locBtnText}>📍</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.View style={[styles.sheet, { top: sheetY }]} pointerEvents={selected ? 'box-none' : 'none'}>
        {selected && <EventSheet event={selected} onClose={dismissSheet}/>}
      </Animated.View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.orange} size="large"/>
        </View>
      )}
    </View>
  );
}

function EventSheet({ event, onClose }: { event: Event; onClose: () => void }) {
  const spotsLeft = event.cap - event.rsvp_count;
  const isFull    = spotsLeft <= 0;
  const pct       = Math.min(100, (event.rsvp_count / event.cap) * 100);
  const accent    = event.has_buy_in ? colors.orange : colors.lavender;

  return (
    <View style={sheet.container}>
      <TouchableOpacity style={sheet.handleWrap} onPress={onClose} activeOpacity={0.7}>
        <View style={sheet.handle}/>
      </TouchableOpacity>
      <View style={sheet.header}>
        <View style={[sheet.modeBadge, { borderColor:`${accent}55`, backgroundColor:`${accent}18` }]}>
          <Text style={[sheet.modeBadgeText, { color: accent }]}>
            {event.is_tournament ? '🏆 Tournament' : event.has_buy_in ? `💰 Compete · $${event.buy_in_amount}` : '🤝 Gather · Free'}
          </Text>
        </View>
      </View>
      <Text style={sheet.title} numberOfLines={2}>{event.title}</Text>
      <Text style={sheet.meta}>📅 {formatDate(event.date)} · ⏰ {formatTime(event.time)}</Text>
      <Text style={sheet.meta}>📍 {event.location}</Text>
      <View style={sheet.capRow}>
        <Text style={[sheet.capText, isFull && { color: colors.rose }]}>
          {isFull ? `Full · ${event.waitlist_count} on waitlist` : `${spotsLeft} spot${spotsLeft!==1?'s':''} left`}
        </Text>
        <Text style={sheet.capFrac}>{event.rsvp_count}/{event.cap}</Text>
      </View>
      <View style={sheet.barBg}>
        <View style={[sheet.barFill, { width:`${pct}%` as any, backgroundColor: isFull ? colors.rose : accent }]}/>
      </View>
      <View style={sheet.cta}>
        <TouchableOpacity style={[sheet.ctaBtn, isFull && sheet.ctaBtnWaitlist]}
          onPress={() => router.push(`/event/${event.slug}`)} activeOpacity={0.85}>
          <Text style={sheet.ctaBtnText}>
            {isFull ? 'Join Waitlist →' : event.has_buy_in ? `Register & Pay $${event.buy_in_amount} →` : 'RSVP Free →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex:1, backgroundColor:colors.black },
  overlay: { position:'absolute', top:0, left:0, right:0, zIndex:10 },
  filterRow: { flexDirection:'row', gap:8, alignItems:'center', paddingHorizontal:spacing.md, paddingTop:spacing.sm },
  filterChip:       { paddingHorizontal:14, paddingVertical:8, borderRadius:radius.full, backgroundColor:'rgba(20,20,20,0.88)', borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  filterChipActive: { backgroundColor:colors.orange, borderColor:colors.orange },
  filterText:       { fontSize:13, fontWeight:'600', color:colors.gray1 },
  filterTextActive: { color:colors.white, fontWeight:'700' },
  countPill: { marginLeft:'auto' as any, backgroundColor:'rgba(20,20,20,0.88)', borderRadius:radius.full, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  countText: { fontSize:12, fontWeight:'700', color:colors.gray1 },
  locBtn:    { position:'absolute', right:spacing.md, top:52, backgroundColor:'rgba(20,20,20,0.9)', width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.12)', ...shadow.sm },
  locBtnText:{ fontSize:20 },
  pin:          { width:44, height:44, borderRadius:22, backgroundColor:colors.card, borderWidth:2, borderColor:colors.border, alignItems:'center', justifyContent:'center', ...shadow.sm },
  pinCompete:   { borderColor:colors.orange, backgroundColor:'rgba(249,115,22,0.15)' },
  pinGather:    { borderColor:colors.lavender, backgroundColor:'rgba(155,142,196,0.15)' },
  pinTournament:{ borderColor:colors.green },
  pinSelected:  { transform:[{scale:1.25}], ...shadow.md },
  pinText:      { fontSize:20 },
  sheet:        { position:'absolute', left:0, right:0, bottom:0, backgroundColor:colors.panel, borderTopLeftRadius:radius.xl, borderTopRightRadius:radius.xl, borderWidth:1, borderColor:colors.border, zIndex:20, ...shadow.md },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(8,8,8,0.6)', alignItems:'center', justifyContent:'center', zIndex:30 },

  // Expo Go placeholder
  placeholder:      { flex:1, alignItems:'center', justifyContent:'center', padding:spacing.xl },
  placeholderEmoji: { fontSize:52, marginBottom:spacing.lg },
  placeholderTitle: { fontSize:22, fontWeight:'800', color:colors.white, marginBottom:spacing.sm, textAlign:'center' },
  placeholderBody:  { fontSize:14, color:colors.gray1, textAlign:'center', lineHeight:22, marginBottom:spacing.md },
  code:             { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color:colors.orange, fontSize:12 },
  eventCountPill:   { backgroundColor:'rgba(249,115,22,0.1)', borderWidth:1, borderColor:'rgba(249,115,22,0.25)', borderRadius:radius.full, paddingHorizontal:spacing.md, paddingVertical:8 },
  eventCountText:   { fontSize:13, color:colors.orange, fontWeight:'600' },
});

const sheet = StyleSheet.create({
  container:  { padding:spacing.md, paddingBottom:spacing.xl },
  handleWrap: { alignItems:'center', paddingBottom:spacing.sm },
  handle:     { width:40, height:4, borderRadius:2, backgroundColor:colors.border },
  header:     { flexDirection:'row', justifyContent:'space-between', marginBottom:spacing.xs },
  modeBadge:  { borderWidth:1, borderRadius:radius.sm, paddingHorizontal:10, paddingVertical:3 },
  modeBadgeText: { fontSize:11, fontWeight:'700' },
  title:      { fontSize:22, fontWeight:'800', color:colors.white, lineHeight:28, marginBottom:spacing.xs },
  meta:       { fontSize:13, color:colors.gray1, fontWeight:'500', marginBottom:2 },
  capRow:     { flexDirection:'row', justifyContent:'space-between', marginTop:spacing.sm, marginBottom:5 },
  capText:    { fontSize:11, fontWeight:'700', color:colors.gray1 },
  capFrac:    { fontSize:11, fontWeight:'700', color:colors.gray2 },
  barBg:      { height:3, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden', marginBottom:spacing.sm },
  barFill:    { height:'100%', borderRadius:2 },
  cta:        { marginTop:spacing.sm },
  ctaBtn:     { backgroundColor:colors.orange, borderRadius:radius.md, paddingVertical:15, alignItems:'center' },
  ctaBtnWaitlist: { backgroundColor:colors.rose },
  ctaBtnText: { color:colors.white, fontSize:16, fontWeight:'700' },
});

const DARK_MAP_STYLE = [
  { elementType:'geometry',          stylers:[{color:'#141414'}] },
  { elementType:'labels.text.fill',  stylers:[{color:'#5C5654'}] },
  { elementType:'labels.text.stroke',stylers:[{color:'#080808'}] },
  { featureType:'road',              elementType:'geometry',        stylers:[{color:'#1E1E1E'}] },
  { featureType:'road',              elementType:'geometry.stroke', stylers:[{color:'#2C2C2C'}] },
  { featureType:'road',              elementType:'labels.text.fill',stylers:[{color:'#A8A29E'}] },
  { featureType:'road.highway',      elementType:'geometry',        stylers:[{color:'#2C2C2C'}] },
  { featureType:'water',             elementType:'geometry',        stylers:[{color:'#0a1628'}] },
  { featureType:'water',             elementType:'labels.text.fill',stylers:[{color:'#1a3a5c'}] },
  { featureType:'poi',               elementType:'geometry',        stylers:[{color:'#181818'}] },
  { featureType:'poi.park',          elementType:'geometry',        stylers:[{color:'#111a11'}] },
  { featureType:'transit',           elementType:'geometry',        stylers:[{color:'#1E1E1E'}] },
  { featureType:'administrative',    elementType:'geometry',        stylers:[{color:'#2C2C2C'}] },
  { featureType:'administrative.locality', elementType:'labels.text.fill', stylers:[{color:'#A8A29E'}] },
];
