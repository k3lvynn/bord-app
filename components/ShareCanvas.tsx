import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import ViewShot from 'react-native-view-shot';

// ─── Instagram dimension presets (in pixels) ────────────────────────────────
export type ShareFormat = 'story' | 'reel' | 'postSquare' | 'postPortrait';

export const SHARE_FORMATS: Record<
  ShareFormat,
  { width: number; height: number; label: string; subtitle: string; ratio: string }
> = {
  story: {
    width: 1080,
    height: 1920,
    label: 'Story',
    subtitle: '9:16 · Full screen',
    ratio: '9:16',
  },
  reel: {
    width: 1080,
    height: 1920,
    label: 'Reel',
    subtitle: '9:16 · Full screen',
    ratio: '9:16',
  },
  postSquare: {
    width: 1080,
    height: 1080,
    label: 'Post · Square',
    subtitle: '1:1 · Grid friendly',
    ratio: '1:1',
  },
  postPortrait: {
    width: 1080,
    height: 1350,
    label: 'Post · Portrait',
    subtitle: '4:5 · More feed space',
    ratio: '4:5',
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ShareCanvasEvent {
  title: string;
  date: string;          // e.g. "Fri, Mar 6"
  time: string;          // e.g. "7:30 AM"
  price: number | null;  // null = free
  spotsLeft: number;
  totalSpots: number;
  category: string;      // e.g. "COMPETE"
  coverImageUrl: string | null;
  eventUrl: string;      // full bordevents.com URL
}

export interface ShareCanvasHandle {
  capture: () => Promise<string>; // returns local file URI
}

interface ShareCanvasProps {
  event: ShareCanvasEvent;
  format: ShareFormat;
}

// ─── Component ───────────────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;

const ShareCanvas = forwardRef<ShareCanvasHandle, ShareCanvasProps>(
  ({ event, format }, ref) => {
    const shotRef = useRef<ViewShot>(null);
    const dim = SHARE_FORMATS[format];

    // Scale factor so the canvas fits inside the current screen for rendering,
    // but ViewShot will capture at the full pixel resolution.
    const scale = SCREEN_W / dim.width;
    const scaledH = dim.height * scale;

    useImperativeHandle(ref, () => ({
      capture: async () => {
        if (!shotRef.current?.capture) throw new Error('ViewShot not ready');
        const uri = await shotRef.current.capture();
        return uri;
      },
    }));

    const priceLabel = event.price == null || event.price === 0
      ? 'Free'
      : `$${event.price}`;

    const spotsLabel = event.totalSpots === 0
      ? 'Open registration'
      : `${event.spotsLeft} of ${event.totalSpots} spots left`;

    return (
      // Render offscreen so it never affects layout
      <View style={styles.offscreen}>
        <ViewShot
          ref={shotRef}
          options={{
            format: 'jpg',
            quality: 1.0,
            // Output at full Instagram resolution regardless of screen size
            width: dim.width,
            height: dim.height,
          }}
        >
          {/* ── Outer canvas at scaled size (ViewShot captures at full res) ── */}
          <View style={[styles.canvas, { width: SCREEN_W, height: scaledH }]}>

            {/* ── Background: blurred cover or solid brand color ── */}
            {event.coverImageUrl ? (
              <>
                <Image
                  source={{ uri: event.coverImageUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  blurRadius={22}
                />
                {/* Dark overlay for legibility */}
                <View style={[StyleSheet.absoluteFill, styles.overlay]} />
              </>
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.solidBackground]} />
            )}

            {/* ── Decorative circle (matches Bord brand) ── */}
            <View style={[styles.decorCircle, { right: -SCREEN_W * 0.15, top: SCREEN_W * 0.05 }]} />

            {/* ── Content: centered event card ── */}
            <View style={styles.content}>

              {/* Bord wordmark + tagline */}
              <View style={styles.wordmarkRow}>
                <Text style={styles.wordmarkBord}>
                  <Text style={styles.wordmarkB}>B</Text>ord
                </Text>
                <Text style={styles.wordmarkTagline}>  ·  are you bored?</Text>
              </View>

              {/* Category badge */}
              <View style={styles.badge}>
                <Text style={styles.badgeStar}>★</Text>
                <Text style={styles.badgeText}>{event.category.toUpperCase()}</Text>
              </View>

              {/* Event title */}
              <Text style={styles.title} numberOfLines={4} adjustsFontSizeToFit>
                {event.title.toUpperCase()}
              </Text>

              {/* 🔥 emoji accent */}
              <Text style={styles.fireEmoji}>🔥</Text>

              {/* Date / time / price rows */}
              <View style={styles.metaRow}>
                <Text style={styles.metaEmoji}>📅</Text>
                <Text style={styles.metaText}>{event.date}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaEmoji}>🕐</Text>
                <Text style={styles.metaText}>{event.time}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaEmoji}>🎟️</Text>
                <Text style={[styles.metaText, styles.priceText]}>{priceLabel}</Text>
              </View>

              {/* Spots pill */}
              <View style={styles.spotsPill}>
                <Text style={styles.spotsText}>{spotsLabel}</Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* CTA */}
              <Text style={styles.ctaLabel}>TAP THE LINK TO REGISTER →</Text>
              <Text style={styles.ctaUrl}>{event.eventUrl}</Text>
              <Text style={styles.ctaFooter}>
                Opens in Bord app · or bordevents.com
              </Text>
            </View>

            {/* ── Bottom branding ── */}
            <View style={styles.bottomBrand}>
              <Text style={styles.bottomBrandText}>
                <Text style={styles.bottomBrandOrange}>Bord</Text>
                {'  ·  bordevents.com'}
              </Text>
            </View>

          </View>
        </ViewShot>
      </View>
    );
  }
);

ShareCanvas.displayName = 'ShareCanvas';
export default ShareCanvas;

// ─── Styles ──────────────────────────────────────────────────────────────────
const ORANGE = '#e87c2f';
const GREEN  = '#1db954';
const WHITE  = '#ffffff';

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -99999,
    left: -99999,
    opacity: 0, // hide from user but still renders
  },
  canvas: {
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  solidBackground: {
    backgroundColor: '#0a0a0a',
  },
  decorCircle: {
    position: 'absolute',
    width: SCREEN_W * 0.6,
    height: SCREEN_W * 0.6,
    borderRadius: SCREEN_W * 0.3,
    backgroundColor: 'rgba(100,40,10,0.55)',
  },
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_W * 0.07,
    paddingTop: SCREEN_W * 0.1,
    paddingBottom: SCREEN_W * 0.06,
    justifyContent: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SCREEN_W * 0.04,
  },
  wordmarkBord: {
    color: WHITE,
    fontSize: SCREEN_W * 0.048,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  wordmarkB: {
    color: ORANGE,
  },
  wordmarkTagline: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: SCREEN_W * 0.033,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232,124,47,0.18)',
    borderColor: ORANGE,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: SCREEN_W * 0.035,
    paddingVertical: SCREEN_W * 0.012,
    alignSelf: 'flex-start',
    marginBottom: SCREEN_W * 0.05,
  },
  badgeStar: {
    color: ORANGE,
    fontSize: SCREEN_W * 0.032,
    marginRight: 5,
  },
  badgeText: {
    color: ORANGE,
    fontSize: SCREEN_W * 0.03,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: WHITE,
    fontSize: SCREEN_W * 0.096,
    fontWeight: '900',
    lineHeight: SCREEN_W * 0.1,
    letterSpacing: -0.5,
    marginBottom: SCREEN_W * 0.03,
  },
  fireEmoji: {
    fontSize: SCREEN_W * 0.07,
    marginBottom: SCREEN_W * 0.05,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_W * 0.02,
  },
  metaEmoji: {
    fontSize: SCREEN_W * 0.046,
    marginRight: SCREEN_W * 0.025,
  },
  metaText: {
    color: WHITE,
    fontSize: SCREEN_W * 0.046,
    fontWeight: '500',
  },
  priceText: {
    color: ORANGE,
    fontWeight: '700',
  },
  spotsPill: {
    backgroundColor: GREEN,
    borderRadius: 20,
    paddingHorizontal: SCREEN_W * 0.04,
    paddingVertical: SCREEN_W * 0.015,
    alignSelf: 'flex-start',
    marginTop: SCREEN_W * 0.03,
    marginBottom: SCREEN_W * 0.05,
  },
  spotsText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: SCREEN_W * 0.033,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: SCREEN_W * 0.04,
  },
  ctaLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: SCREEN_W * 0.028,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: SCREEN_W * 0.015,
  },
  ctaUrl: {
    color: ORANGE,
    fontSize: SCREEN_W * 0.033,
    fontWeight: '600',
    marginBottom: SCREEN_W * 0.01,
  },
  ctaFooter: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: SCREEN_W * 0.026,
  },
  bottomBrand: {
    position: 'absolute',
    bottom: SCREEN_W * 0.06,
    alignSelf: 'center',
  },
  bottomBrandText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: SCREEN_W * 0.028,
    letterSpacing: 2,
    fontWeight: '600',
  },
  bottomBrandOrange: {
    color: ORANGE,
  },
});
