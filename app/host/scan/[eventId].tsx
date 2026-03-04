// app/host/scan/[eventId].tsx
// Door scanner for hosts and designated door staff.
// Uses expo-camera to read QR codes, looks up the ticket in Supabase,
// and marks the attendee as checked in.
//
// Also shows a manual name-search list for events without QR scanning
// or when camera is unavailable.

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, TextInput, ActivityIndicator, Alert,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, radius } from '../../../lib/theme';
import {
  getRsvpByTicketCode, markCheckedIn, getEventRsvpsForDoor, RSVP,
} from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';

// Safe-require camera — only available in custom builds
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch (_) {}

const IS_EXPO_GO = !CameraView;

export default function DoorScanner() {
  const { eventId, eventTitle } = useLocalSearchParams<{ eventId: string; eventTitle: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Camera
  const [permission, requestPermission] = useCameraPermissions
    ? useCameraPermissions()
    : [null, async () => {}];
  const [scanning,    setScanning]    = useState(false);
  const [scanResult,  setScanResult]  = useState<{ rsvp: RSVP; status: 'ok' | 'already' | 'not_found' } | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const lastScanRef = useRef<string>('');
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual list
  const [mode,    setMode]    = useState<'scanner' | 'list'>(IS_EXPO_GO ? 'list' : 'scanner');
  const [rsvps,   setRsvps]   = useState<RSVP[]>([]);
  const [search,  setSearch]  = useState('');
  const [listLoading, setListLoading] = useState(false);

  // Load RSVP list for manual mode
  useEffect(() => {
    if (!eventId) return;
    setListLoading(true);
    getEventRsvpsForDoor(eventId)
      .then(setRsvps)
      .catch(e => Alert.alert('Error', e.message))
      .finally(() => setListLoading(false));
  }, [eventId]);

  // Start camera when switching to scanner mode
  useEffect(() => {
    if (mode === 'scanner' && !IS_EXPO_GO) {
      if (!permission?.granted) requestPermission();
      setScanning(true);
    } else {
      setScanning(false);
    }
  }, [mode]);

  // QR code scanned
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    // Debounce — ignore repeat scans of same code within 3 seconds
    if (data === lastScanRef.current || scanLoading) return;
    lastScanRef.current = data;
    setScanLoading(true);

    try {
      // QR value format: bord://checkin/<ticketCode>
      const ticketCode = data.startsWith('bord://checkin/')
        ? data.replace('bord://checkin/', '')
        : data;

      const rsvp = await getRsvpByTicketCode(ticketCode);

      if (!rsvp) {
        Vibration.vibrate([0, 100, 100, 100]); // error pattern
        setScanResult({ rsvp: null as any, status: 'not_found' });
      } else if ((rsvp as any).checked_in) {
        Vibration.vibrate([0, 200]); // short buzz — already checked in
        setScanResult({ rsvp, status: 'already' });
      } else {
        await markCheckedIn(rsvp.id);
        // Update local list
        setRsvps(prev => prev.map(r =>
          r.id === rsvp.id ? { ...r, checked_in: true, checked_in_at: new Date().toISOString() } : r
        ));
        Vibration.vibrate(500); // long buzz — success
        setScanResult({ rsvp: { ...rsvp, checked_in: true } as RSVP, status: 'ok' });
      }
    } catch (e: any) {
      Vibration.vibrate([0, 100, 100, 100]);
      Alert.alert('Scan error', e.message ?? 'Could not verify ticket');
    } finally {
      setScanLoading(false);
      // Clear result overlay after 3 seconds, allow re-scanning
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => {
        setScanResult(null);
        lastScanRef.current = '';
      }, 3000);
    }
  };

  // Manual check-in from list
  const handleManualCheckIn = async (rsvp: RSVP) => {
    if ((rsvp as any).checked_in) {
      Alert.alert('Already checked in', `${rsvp.name} was already checked in.`);
      return;
    }
    Alert.alert(
      'Check in?',
      `Confirm entry for ${rsvp.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check In ✓',
          onPress: async () => {
            try {
              await markCheckedIn(rsvp.id);
              setRsvps(prev => prev.map(r =>
                r.id === rsvp.id
                  ? { ...r, checked_in: true, checked_in_at: new Date().toISOString() }
                  : r
              ));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const filteredRsvps = rsvps.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  );
  const checkedInCount = rsvps.filter(r => (r as any).checked_in).length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Done</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Door Scanner</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{eventTitle}</Text>
        </View>
        <View style={styles.headerCount}>
          <Text style={styles.headerCountNum}>{checkedInCount}/{rsvps.length}</Text>
          <Text style={styles.headerCountLabel}>in</Text>
        </View>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'scanner' && styles.modeBtnActive]}
          onPress={() => setMode('scanner')}
        >
          <Text style={[styles.modeBtnText, mode === 'scanner' && styles.modeBtnTextActive]}>
            📷 Scan QR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'list' && styles.modeBtnActive]}
          onPress={() => setMode('list')}
        >
          <Text style={[styles.modeBtnText, mode === 'list' && styles.modeBtnTextActive]}>
            📋 Name List
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── SCANNER MODE ── */}
      {mode === 'scanner' && (
        <View style={styles.cameraContainer}>
          {IS_EXPO_GO ? (
            <View style={styles.expoGoFallback}>
              <Text style={styles.expoGoIcon}>📷</Text>
              <Text style={styles.expoGoText}>
                Camera scanning requires a custom build.{'\n'}
                Use the Name List tab to check people in manually.
              </Text>
              <TouchableOpacity
                style={styles.switchToListBtn}
                onPress={() => setMode('list')}
              >
                <Text style={styles.switchToListText}>Switch to Name List →</Text>
              </TouchableOpacity>
            </View>
          ) : !permission?.granted ? (
            <View style={styles.expoGoFallback}>
              <Text style={styles.expoGoIcon}>🔒</Text>
              <Text style={styles.expoGoText}>Camera permission required to scan tickets.</Text>
              <TouchableOpacity style={styles.switchToListBtn} onPress={requestPermission}>
                <Text style={styles.switchToListText}>Grant Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanning && !scanLoading ? handleBarCodeScanned : undefined}
              />

              {/* Scan frame overlay */}
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>{'Point at attendee\'s QR code'}</Text>
              </View>

              {/* Scan loading */}
              {scanLoading && (
                <View style={styles.scanLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.white} />
                  <Text style={styles.scanLoadingText}>Verifying…</Text>
                </View>
              )}

              {/* Scan result overlay */}
              {scanResult && (
                <View style={[
                  styles.scanResultOverlay,
                  scanResult.status === 'ok'      && styles.scanResultOk,
                  scanResult.status === 'already' && styles.scanResultAlready,
                  scanResult.status === 'not_found' && styles.scanResultError,
                ]}>
                  <Text style={styles.scanResultIcon}>
                    {scanResult.status === 'ok'       ? '✅' :
                     scanResult.status === 'already'  ? '⚠️' : '❌'}
                  </Text>
                  <Text style={styles.scanResultTitle}>
                    {scanResult.status === 'ok'       ? 'Checked In!' :
                     scanResult.status === 'already'  ? 'Already In' : 'Not Found'}
                  </Text>
                  {scanResult.rsvp && (
                    <Text style={styles.scanResultName}>{scanResult.rsvp.name}</Text>
                  )}
                  {scanResult.status === 'not_found' && (
                    <Text style={styles.scanResultSub}>{'This QR code isn\'t on the list'}</Text>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* ── LIST MODE ── */}
      {mode === 'list' && (
        <View style={styles.listContainer}>
          {/* Search bar */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or email…"
              placeholderTextColor={colors.gray2}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          {listLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.orange} />
          ) : (
            <FlatList
              data={filteredRsvps}
              keyExtractor={r => r.id}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {search ? 'No matches found.' : 'No confirmed RSVPs yet.'}
                </Text>
              }
              renderItem={({ item: r }) => {
                const isIn = !!(r as any).checked_in;
                return (
                  <TouchableOpacity
                    style={[styles.rsvpRow, isIn && styles.rsvpRowCheckedIn]}
                    onPress={() => handleManualCheckIn(r)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.rsvpDot, { backgroundColor: isIn ? colors.green : colors.border }]} />
                    <View style={styles.rsvpInfo}>
                      <Text style={[styles.rsvpName, isIn && { color: colors.gray2 }]}>
                        {r.name}
                        {isIn && <Text style={styles.rsvpCheckedTag}> · ✓ In</Text>}
                      </Text>
                      <Text style={styles.rsvpEmail}>{r.email}</Text>
                    </View>
                    {!isIn && (
                      <View style={styles.checkInBtn}>
                        <Text style={styles.checkInBtnText}>Check In</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:       { paddingRight: spacing.sm },
  backText:      { color: colors.orange, fontSize: 17, fontWeight: '600' },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 16, fontWeight: '700', color: colors.white },
  headerSub:     { fontSize: 12, color: colors.gray2, marginTop: 1 },
  headerCount:   { alignItems: 'center' },
  headerCountNum:{ fontSize: 18, fontWeight: '800', color: colors.orange },
  headerCountLabel: { fontSize: 10, color: colors.gray2, fontWeight: '600' },

  modeToggle: {
    flexDirection: 'row', padding: spacing.sm, gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modeBtnActive:      { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.1)' },
  modeBtnText:        { fontSize: 14, fontWeight: '600', color: colors.gray1 },
  modeBtnTextActive:  { color: colors.orange },

  // Camera
  cameraContainer: { flex: 1, position: 'relative' },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  scanFrame: {
    width: 260, height: 260,
    position: 'relative', marginBottom: spacing.lg,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: colors.orange,
  },
  cornerTL: { top: 0, left: 0,  borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: 0, left: 0,  borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  scanHint: {
    color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600',
    textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },

  scanLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  scanLoadingText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  scanResultOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.md,
    alignItems: 'center', gap: 6,
  },
  scanResultOk:      { backgroundColor: 'rgba(52,211,153,0.95)' },
  scanResultAlready: { backgroundColor: 'rgba(249,115,22,0.95)' },
  scanResultError:   { backgroundColor: 'rgba(244,63,94,0.95)' },
  scanResultIcon:    { fontSize: 40 },
  scanResultTitle:   { fontSize: 24, fontWeight: '900', color: colors.white },
  scanResultName:    { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  scanResultSub:     { fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  // Fallbacks
  expoGoFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, paddingHorizontal: spacing.xl,
  },
  expoGoIcon: { fontSize: 48 },
  expoGoText: {
    fontSize: 15, color: colors.gray1, textAlign: 'center', lineHeight: 22,
  },
  switchToListBtn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.lg, marginTop: spacing.sm,
  },
  switchToListText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  // List
  listContainer: { flex: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: {
    flex: 1, color: colors.white, fontSize: 15, fontWeight: '500',
    paddingVertical: 13,
  },

  rsvpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rsvpRowCheckedIn: { opacity: 0.6 },
  rsvpDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  rsvpInfo:  { flex: 1 },
  rsvpName:  { fontSize: 15, fontWeight: '700', color: colors.white },
  rsvpCheckedTag: { fontSize: 13, color: colors.green, fontWeight: '500' },
  rsvpEmail: { fontSize: 12, color: colors.gray2, marginTop: 2 },
  checkInBtn: {
    backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: radius.sm,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    paddingVertical: 7, paddingHorizontal: 12,
  },
  checkInBtnText: { fontSize: 13, fontWeight: '700', color: colors.orange },

  emptyText: {
    textAlign: 'center', color: colors.gray2, fontSize: 15, marginTop: 48,
  },
});
