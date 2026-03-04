// app/legal/terms.tsx
// Placeholder — replace body text with your real Terms before submission.
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';

export default function TermsPage() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.iconRing}>
          <Text style={styles.icon}>📄</Text>
        </View>

        <Text style={styles.headline}>Terms of Service</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Updated</Text>
          <Text style={styles.sectionBody}>January 1, 2025</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acceptance</Text>
          <Text style={styles.sectionBody}>
            By creating an account or using Bord, you agree to these Terms of
            Service. If you do not agree, please do not use the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Account</Text>
          <Text style={styles.sectionBody}>
            You are responsible for maintaining the security of your account.
            You must provide accurate information and keep it up to date. You
            may not use another person account or create an account for anyone
            other than yourself.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conduct</Text>
          <Text style={styles.sectionBody}>
            You agree not to use Bord to harass, threaten, or harm others; post
            false, misleading, or fraudulent event listings; collect personal
            information from other users without consent; or engage in any
            activity that violates applicable law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Events and Payments</Text>
          <Text style={styles.sectionBody}>
            Bord facilitates connections between event hosts and attendees. Event
            hosts are solely responsible for the events they create. Bord charges
            a platform fee on buy-in events. All sales are final unless the host
            cancels the event.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cancellation Policy</Text>
          <Text style={styles.sectionBody}>
            Attendees may cancel within 72 hours of registering for a full refund.
            After this window, buy-ins are non-refundable. Gather (free) event
            RSVPs can be cancelled at any time.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Termination</Text>
          <Text style={styles.sectionBody}>
            We may suspend or terminate your account for violations of these terms.
            You may delete your account at any time via Settings then Data and Privacy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes</Text>
          <Text style={styles.sectionBody}>
            We may update these terms. We will notify you of significant changes.
            Continued use after changes constitutes acceptance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.sectionBody}>Questions? Email us at legal@bord.app</Text>
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
