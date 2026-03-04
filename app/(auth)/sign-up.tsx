// app/(auth)/sign-up.tsx
import { useState } from 'react';
import {
  Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

export default function SignUp() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayName,     setDisplayName]     = useState('');
  const [username,        setUsername]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted,   setTermsAccepted]   = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [focused,         setFocused]         = useState<string | null>(null);

  const input = (field: string) => [styles.input, focused === field && styles.inputFocused];

  const validate = () => {
    if (!displayName.trim()) return 'Enter your name.';
    if (!username.trim() || username.length < 3) return 'Username must be at least 3 characters.';
    if (!/^[a-z0-9_]+$/.test(username.toLowerCase())) return 'Username can only contain letters, numbers, and underscores.';
    if (!email.includes('@')) return 'Enter a valid email.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return "Passwords don't match.";
    if (!termsAccepted) return 'You must accept the Terms of Service to create an account.';
    return null;
  };

  const handleSignUp = async () => {
    const err = validate();
    if (err) { Alert.alert('Check your info', err); return; }
    setLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim(), username.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      if (e.message?.includes('already registered')) {
        Alert.alert('Account exists', 'That email is already registered. Try signing in.');
      } else if (e.message?.includes('duplicate') || e.message?.includes('profiles_username')) {
        Alert.alert('Username taken', 'That username is already in use. Try another.');
      } else {
        Alert.alert('Sign up failed', e.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.black }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.headline}>
          Create your{'\n'}<Text style={{ color: colors.orange }}>Bord account</Text>
        </Text>
        <Text style={styles.sub}>Join events, RSVP instantly, and connect with your community.</Text>

        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={input('name')} value={displayName} onChangeText={setDisplayName}
          placeholder="Marcus T." placeholderTextColor={colors.gray2} autoCapitalize="words"
          onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Username</Text>
        <View style={styles.usernameWrap}>
          <Text style={styles.usernamePrefix}>@</Text>
          <TextInput
            style={[input('username'), styles.usernameInput]}
            value={username}
            onChangeText={v => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="marcus_t" placeholderTextColor={colors.gray2}
            autoCapitalize="none" autoCorrect={false}
            onFocus={() => setFocused('username')} onBlur={() => setFocused(null)}
          />
        </View>
        <Text style={styles.hint}>Letters, numbers, underscores only. This is your public handle.</Text>

        <Text style={[styles.label, { marginTop: spacing.md }]}>Email</Text>
        <TextInput
          style={input('email')} value={email} onChangeText={setEmail}
          placeholder="you@example.com" placeholderTextColor={colors.gray2}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
        <TextInput
          style={input('password')} value={password} onChangeText={setPassword}
          placeholder="8+ characters" placeholderTextColor={colors.gray2} secureTextEntry
          onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Confirm Password</Text>
        <TextInput
          style={input('confirm')} value={confirmPassword} onChangeText={setConfirmPassword}
          placeholder="Same password again" placeholderTextColor={colors.gray2} secureTextEntry
          onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)}
        />

        {/* Terms of Service checkbox */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setTermsAccepted(v => !v)}
          activeOpacity={0.75}
        >
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.termsText}>
            I have read and agree to the{' '}
            <Text
              style={styles.termsLink}
              onPress={() => router.push('/legal/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.termsLink}
              onPress={() => router.push('/legal/privacy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.btn,
            { marginTop: spacing.md },
            (!termsAccepted || loading) && styles.btnDisabled,
          ]}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>Create Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} style={styles.switchLink}>
          <Text style={styles.switchText}>
            Already have an account?{' '}<Text style={{ color: colors.orange }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:    { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  headline:  { fontSize: 34, fontWeight: '800', color: colors.white, lineHeight: 40, marginBottom: spacing.sm },
  sub:       { fontSize: 15, color: colors.gray1, marginBottom: spacing.xl, lineHeight: 22 },
  label:     { fontSize: 11, fontWeight: '700', color: colors.gray2, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 13,
    color: colors.white, fontSize: 15, fontWeight: '500',
  },
  inputFocused: { borderColor: 'rgba(249,115,22,0.5)' },
  usernameWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.sm,
  },
  usernamePrefix: { paddingLeft: spacing.md, fontSize: 17, color: colors.orange, fontWeight: '700' },
  usernameInput:  { flex: 1, borderWidth: 0, backgroundColor: 'transparent', paddingLeft: 4 },
  hint: { fontSize: 11, color: colors.gray2, marginTop: 4 },

  // T&C checkbox row
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.gray2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: '800' },
  termsText: { flex: 1, fontSize: 13, color: colors.gray1, lineHeight: 20 },
  termsLink: { color: colors.orange, fontWeight: '600', textDecorationLine: 'underline' },

  btn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginBottom: spacing.md,
  },
  btnDisabled: { backgroundColor: 'rgba(249,115,22,0.35)' },
  btnText:     { color: colors.white, fontSize: 17, fontWeight: '700' },
  switchLink:  { alignItems: 'center', paddingVertical: spacing.sm },
  switchText:  { fontSize: 14, color: colors.gray1 },
});
