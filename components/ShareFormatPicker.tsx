import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SHARE_FORMATS, ShareFormat } from './ShareCanvas';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ShareFormatPickerProps {
  visible: boolean;
  onSelect: (format: ShareFormat) => void;
  onDismiss: () => void;
  isCapturing?: boolean; // shows loading state while ViewShot captures
}

// ─── Format entries to display ───────────────────────────────────────────────
const FORMAT_ORDER: ShareFormat[] = ['story', 'reel', 'postSquare', 'postPortrait'];

const FORMAT_ICONS: Record<ShareFormat, string> = {
  story:        '📱',
  reel:         '🎬',
  postSquare:   '⬜',
  postPortrait: '🖼️',
};

const FORMAT_TIPS: Record<ShareFormat, string> = {
  story:        'Full screen vertical. Perfect for Stories on Instagram, Snapchat, Facebook, and TikTok.',
  reel:         'Same vertical canvas as Story — works for Reels, TikTok, YouTube Shorts, etc.',
  postSquare:   'Classic square. Posts cleanly to any platform: Instagram, Twitter/X, Facebook, Reddit.',
  postPortrait: 'Taller format dominates the feed scroll on Instagram, Threads, and Facebook.',
};

// ─── Mini aspect ratio preview box ───────────────────────────────────────────
const AspectPreview = ({ ratio }: { ratio: string }) => {
  const [w, h] = ratio.split(':').map(Number);
  const previewW = 28;
  const previewH = Math.round((previewW / w) * h);
  const MAX_H = 50;
  const cappedH = Math.min(previewH, MAX_H);
  const cappedW = Math.round((cappedH / previewH) * previewW);

  return (
    <View style={[styles.aspectBox, { width: cappedW, height: cappedH }]}>
      <View style={styles.aspectBoxInner} />
    </View>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────
const ShareFormatPicker: React.FC<ShareFormatPickerProps> = ({
  visible,
  onSelect,
  onDismiss,
  isCapturing = false,
}) => {
  const handleSelect = useCallback(
    (format: ShareFormat) => {
      if (!isCapturing) onSelect(format);
    },
    [isCapturing, onSelect]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      {/* Scrim */}
      <TouchableOpacity
        style={styles.scrim}
        activeOpacity={1}
        onPress={onDismiss}
      />

      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📤 Share Event</Text>
          <Text style={styles.headerSubtitle}>
            Pick a size, then choose your app — Instagram, Snapchat, Threads, Facebook, Reddit, or anywhere else.
          </Text>
        </View>

        {/* Format options */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {FORMAT_ORDER.map((format) => {
            const meta = SHARE_FORMATS[format];
            return (
              <TouchableOpacity
                key={format}
                style={[
                  styles.option,
                  isCapturing && styles.optionDisabled,
                ]}
                onPress={() => handleSelect(format)}
                activeOpacity={0.75}
                disabled={isCapturing}
              >
                {/* Left: icon + ratio preview */}
                <View style={styles.optionLeft}>
                  <Text style={styles.optionIcon}>{FORMAT_ICONS[format]}</Text>
                  <AspectPreview ratio={meta.ratio} />
                </View>

                {/* Center: label + tip */}
                <View style={styles.optionCenter}>
                  <Text style={styles.optionLabel}>{meta.label}</Text>
                  <Text style={styles.optionSubtitle}>{meta.subtitle}</Text>
                  <Text style={styles.optionTip}>{FORMAT_TIPS[format]}</Text>
                </View>

                {/* Right: chevron */}
                <Text style={styles.optionChevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Loading overlay */}
        {isCapturing && (
          <View style={styles.capturingOverlay}>
            <Text style={styles.capturingText}>Preparing image…</Text>
          </View>
        )}

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onDismiss}
          disabled={isCapturing}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default ShareFormatPicker;

// ─── Styles ──────────────────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get('window').height;
const ORANGE = '#e87c2f';

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    maxHeight: SCREEN_H * 0.82,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  optionDisabled: {
    opacity: 0.4,
  },
  optionLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    gap: 6,
  },
  optionIcon: {
    fontSize: 22,
  },
  optionCenter: {
    flex: 1,
    marginLeft: 14,
    gap: 2,
  },
  optionLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  optionSubtitle: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '600',
  },
  optionTip: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  optionChevron: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 24,
    marginLeft: 8,
  },
  aspectBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aspectBoxInner: {
    width: '60%',
    height: '60%',
    backgroundColor: 'rgba(232,124,47,0.25)',
    borderRadius: 2,
  },
  capturingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  capturingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
  },
});
