// app/legal/privacy.tsx
// Placeholder — replace body text with your real Privacy Policy before submission.
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';

export default function PrivacyPage() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.iconRing}>
          <Text style={styles.icon}>🔒</Text>
        </View>

        <Text style={styles.headline}>Privacy Policy</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Updated</Text>
          <Text style={styles.sectionBody}>January 1, 2025</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Collect</Text>
          <Text style={styles.sectionBody}>
            Account information (email, display name, username); profile details
            you voluntarily provide (bio, location, interests); event and RSVP
            data; usage data (events viewed, features used); device information
            for crash reporting.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How We Use It</Text>
          <Text style={styles.sectionBody}>
            To operate and improve the app; to match you with relevant events;
            to send event reminders and updates you opt into; to process
            payments; to investigate abuse and ensure safety.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Share</Text>
          <Text style={styles.sectionBody}>
            We do not sell your personal data. We share data only with: payment
            processors (Stripe) to handle transactions; infrastructure providers
            (Supabase) to operate the service; law enforcement when legally required.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rights</Text>
          <Text style={styles.sectionBody}>
            You can: view and edit your profile at any time; delete your account
            and all associated data via Settings then Data and Privacy; opt out
            of notifications in Settings; request a copy of your data by emailing
            privacy@bord.app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Retention</Text>
          <Text style={styles.sectionBody}>
            Your data is kept as long as your account is active. On account
            deletion, your data is removed within 30 days except where retention
            is required by law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <Text style={styles.sectionBody}>
            We use industry-standard encryption and security practices. We use
            Supabase with Row Level Security to ensure users can only access
            their own data.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.sectionBody}>Privacy questions: privacy@bord.app</Text>
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
