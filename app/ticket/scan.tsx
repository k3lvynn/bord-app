// app/ticket/scan.tsx
// Attendee scans the host's door QR to verify their ticket.
//
// The host displays bord://entry/{eventSlug} as a QR at the venue entrance.
// This screen opens the camera, reads that QR, then navigates to /ticket/verified
// with the slug — where we check the user's RSVP against the database.

import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';

// Lazy-load CameraView — not available in Expo Go
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch (_) {}

const BORD_SCHEMES = ['bord://entry/', 'https://bord.app/entry/'];

function extractSlug(raw: string): string | null {
  for (const scheme of BORD_SCHEMES) {
    if (raw.startsWith(scheme)) return raw.slice(scheme.length).split('?')[0].trim();
  }
  return null;
}

export default function ScanTicket() {
  const insets = useSafeAreaInsets();
  const [scanned, setScanned] = useState(false);
  const [permissions, requestPermission] = useCameraPermissions
    ? useCameraPermissions()
    : [null, async () => {}];

  // No camera available (Expo Go)
  if (!CameraView) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Scan to Enter</Text>
        <View style={styles.noCamera}>
          <Text style={styles.noCameraEmoji}>📷</Text>
          <Text style={styles.noCameraTitle}>Camera not available</Text>
          <Text style={styles.noCameraBody}>
            Scanning requires a custom build.{'\n'}
            Run <Text style={{ color: colors.orange }}>eas build --profile development</Text> to enable it.
          </Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Permission not yet determined
  if (!permissions) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Scan to Enter</Text>
        <View style={styles.noCamera}>
          <Text style={styles.noCameraEmoji}>🔒</Text>
          <Text style={styles.noCameraTitle}>Camera Permission Needed</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Allow Camera Access</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!permissions.granted) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Scan to Enter</Text>
        <View style={styles.noCamera}>
          <Text style={styles.noCameraEmoji}>🔒</Text>
          <Text style={styles.noCameraTitle}>Camera Access Denied</Text>
          <Text style={styles.noCameraBody}>
            Go to Settings → Bord → Camera and enable access, then come back.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const slug = extractSlug(data);
    if (!slug) {
      Alert.alert(
        'Not a Bord ticket',
        'This QR code is not a Bord event entry code. Ask the host to show the door QR from their event page.',
        [{ text: 'Try Again', onPress: () => setScanned(false) }],
      );
      return;
    }

    // Navigate to verification screen with the event slug
    router.replace({ pathname: '/ticket/verified', params: { slug } });
  };

  return (
    <View style={styles.screen}>
      {/* Full-screen camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark overlay with cut-out window */}
      <View style={styles.overlay}>
        {/* Top dark bar */}
        <View style={[styles.darkBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Scan to Enter</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Viewfinder row */}
        <View style={styles.viewfinderRow}>
          <View style={styles.darkSide} />
          <View style={styles.viewfinder}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <View style={styles.darkSide} />
        </View>

        {/* Bottom dark bar */}
        <View style={[styles.darkBar, styles.bottomBar, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.hint}>
            Point your camera at the{'\n'}
            <Text style={{ color: colors.orange, fontWeight: '700' }}>door QR code</Text>
            {' '}shown by your host
          </Text>
          {scanned && (
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
              <Text style={styles.rescanBtnText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const VF_SIZE = 260;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  // Overlay
  overlay: { flex: 1, flexDirection: 'column' },
  darkBar: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  bottomBar: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.xl },
  overlayTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: colors.white, fontSize: 18, fontWeight: '600' },

  // Viewfinder row
  viewfinderRow: { flexDirection: 'row', height: VF_SIZE },
  darkSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  viewfinder: {
    width: VF_SIZE, height: VF_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },

  // Corner brackets
  corner: {
    position: 'absolute', width: 28, height: 28,
    borderColor: colors.orange, borderRadius: 4,
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  hint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15, textAlign: 'center', lineHeight: 22,
  },

  rescanBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: 13, paddingHorizontal: spacing.xl,
  },
  rescanBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  // No-camera fallback
  title: {
    fontSize: 28, fontWeight: '800', color: colors.white,
    textAlign: 'center', marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  noCamera: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.md,
  },
  noCameraEmoji:  { fontSize: 56 },
  noCameraTitle:  { fontSize: 20, fontWeight: '700', color: colors.white, textAlign: 'center' },
  noCameraBody:   { fontSize: 14, color: colors.gray1, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.xl, marginTop: spacing.sm,
  },
  permBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  backBtn: {
    margin: spacing.lg,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 14, alignItems: 'center',
  },
  backBtnText: { color: colors.gray1, fontSize: 15, fontWeight: '600' },
});
