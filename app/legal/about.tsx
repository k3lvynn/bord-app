// app/legal/about.tsx
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';

export default function AboutPage() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.iconRing}>
          <Text style={styles.icon}>🎯</Text>
        </View>

        <Text style={styles.headline}>What is Bord?</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why we built it</Text>
          <Text style={styles.sectionBody}>
            Bord was created because we noticed something: group chats are full
            of "we should hang out" that never happen, and ticketing apps make
            casual plans feel like buying concert tickets.{'\n\n'}
            Bord is the middle ground — a place to actually do things with other
            people, whether competing in a weekend tournament or grabbing coffee
            with people nearby.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compete</Text>
          <Text style={styles.sectionBody}>
            Compete mode is built for organized, structured events with buy-ins,
            brackets, scoreboards, and team rosters. Think flag football leagues,
            board game tournaments, poker nights, and anything where there is a winner.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gather</Text>
          <Text style={styles.sectionBody}>
            Gather is for the low-pressure stuff — community events, coffee meetups,
            hikes, study groups, and neighborhood activities. No buy-ins, no pressure.
            Just people doing things together.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Built in San Diego</Text>
          <Text style={styles.sectionBody}>
            Bord started in San Diego, CA. We believe local community still matters,
            and we are building tools to strengthen it.{'\n\n'}
            Version 1.8 {'\u00a9'} 2025 Bord, Inc.
          </Text>
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>Back to Settings</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll:       { paddingHorizontal: spacing.lg, paddingBottom: 80, paddingTop: spacing.lg, alignItems: 'center' },
  iconRing:     {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 2, borderColor: 'rgba(249,115,22,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon:         { fontSize: 36 },
  headline:     { fontSize: 28, fontWeight: '800', color: colors.white, textAlign: 'center', marginBottom: spacing.xl },
  section:      { width: '100%', marginBottom: spacing.lg },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.orange, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm },
  sectionBody:  { fontSize: 14, color: colors.gray1, lineHeight: 22 },
  backBtn:      { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.xl, alignItems: 'center', backgroundColor: colors.card },
  backBtnText:  { color: colors.gray1, fontWeight: '600', fontSize: 15 },
});
