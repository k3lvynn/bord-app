// app/(auth)/welcome.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glow} />

      <View style={styles.container}>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>
            <Text style={{ color: colors.white }}>B</Text>
            <Text style={{ color: colors.orange }}>ord</Text>
          </Text>
          <Text style={styles.logoTag}>are you bored?</Text>
        </View>

        {/* Hero copy — speaks to ALL users */}
        <View style={styles.heroWrap}>
          <Text style={styles.heroHeadline}>
            {'Find your\nnext move.'}
          </Text>
          <Text style={styles.heroSub}>
            Join pickup games, community events, and everything in between —
            or host your own.
          </Text>

          {/* Mode pills — shows what the app is about without implying you must host */}
          <View style={styles.modePills}>
            <View style={styles.pill}>
              <Text style={styles.pillEmoji}>🏆</Text>
              <Text style={styles.pillText}>Compete</Text>
            </View>
            <View style={styles.pillDivider} />
            <View style={styles.pill}>
              <Text style={styles.pillEmoji}>🤝</Text>
              <Text style={[styles.pillText, { color: colors.lavender }]}>Gather</Text>
            </View>
            <View style={styles.pillDivider} />
            <View style={styles.pill}>
              <Text style={styles.pillEmoji}>📍</Text>
              <Text style={styles.pillText}>San Diego</Text>
            </View>
          </View>
        </View>

        {/* Auth buttons */}
        <View style={styles.btnGroup}>

          {/* Primary — neutral, open to everyone */}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push('/(auth)/sign-up')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>Get Started</Text>
            <Text style={styles.btnPrimaryArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.push('/(auth)/sign-in')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>Already have an account? Sign In</Text>
          </TouchableOpacity>

          {/* Guest / event link */}
          <TouchableOpacity
            style={styles.btnGuest}
            onPress={() => router.push('/(auth)/sign-up')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnGuestEmoji}>🔗</Text>
            <View>
              <Text style={styles.btnGuestTitle}>I have an event link</Text>
              <Text style={styles.btnGuestSub}>Create a free account to RSVP</Text>
            </View>
            <Text style={styles.btnGuestArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>San Diego · bord.app</Text>
      </View>

      <View style={styles.gradBar} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  glow: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: colors.orange,
    opacity: 0.055,
    top: -100,
    right: -120,
  },

  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
  },

  // Logo
  logoWrap: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  logo:     { fontSize: 56, fontWeight: '900', letterSpacing: 2 },
  logoTag:  { fontSize: 13, color: colors.gray2, fontStyle: 'italic' },

  // Hero
  heroWrap: { gap: spacing.md },
  heroHeadline: {
    fontSize: 46,
    fontWeight: '900',
    color: colors.white,
    lineHeight: 52,
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 16,
    color: colors.gray1,
    lineHeight: 24,
    fontWeight: '400',
    maxWidth: 320,
  },

  // Mode pills
  modePills: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pill:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pillEmoji:   { fontSize: 16 },
  pillText:    { fontSize: 13, fontWeight: '700', color: colors.orange },
  pillDivider: { width: 1, height: 18, backgroundColor: colors.border },

  // Buttons
  btnGroup: { gap: spacing.sm },

  btnPrimary: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: 17,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimaryText:  { color: colors.white, fontSize: 17, fontWeight: '700' },
  btnPrimaryArrow: { color: colors.white, fontSize: 18, fontWeight: '700' },

  btnSecondary: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.white, fontSize: 15, fontWeight: '600' },

  btnGuest: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btnGuestEmoji: { fontSize: 22 },
  btnGuestTitle: { fontSize: 14, fontWeight: '700', color: colors.white },
  btnGuestSub:   { fontSize: 11, color: colors.gray2, marginTop: 1 },
  btnGuestArrow: { marginLeft: 'auto', color: colors.gray2, fontSize: 16 },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.gray2,
  },

  gradBar: { height: 3, backgroundColor: colors.orange },
});
