// app/(auth)/sign-in.tsx
import { useState } from 'react';
import {
  Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

export default function SignIn() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [focused,  setFocused]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const input = (field: string) => [styles.input, focused === field && styles.inputFocused];

  const validate = () => {
    if (!email.trim() || !email.includes('@')) return 'Enter a valid email address.';
    if (!password) return 'Enter your password.';
    return null;
  };

  const handleSignIn = async () => {
    const err = validate();
    if (err) { Alert.alert('Check your info', err); return; }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? 'Something went wrong. Please try again.');
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
          Welcome back{'\n'}
          <Text style={{ color: colors.orange }}>Sign in to Bord</Text>
        </Text>
        <Text style={styles.sub}>Manage your events and RSVPs from one place.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={input('email')} value={email} onChangeText={setEmail}
          placeholder="you@example.com" placeholderTextColor={colors.gray2}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
        <TextInput
          style={input('password')} value={password} onChangeText={setPassword}
          placeholder="Your password" placeholderTextColor={colors.gray2}
          secureTextEntry
          onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
        />

        <TouchableOpacity
          style={[styles.btn, { marginTop: spacing.xl }, loading && { opacity: 0.6 }]}
          onPress={handleSignIn} disabled={loading} activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>Sign In →</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')} style={styles.switchLink}>
          <Text style={styles.switchText}>
            New to Bord?{' '}
            <Text style={{ color: colors.orange }}>Create an account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  headline: { fontSize: 34, fontWeight: '800', color: colors.white, lineHeight: 40, marginBottom: spacing.sm },
  sub: { fontSize: 15, color: colors.gray1, marginBottom: spacing.xl, lineHeight: 22 },
  label: { fontSize: 11, fontWeight: '700', color: colors.gray2, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 13,
    color: colors.white, fontSize: 15, fontWeight: '500',
  },
  inputFocused: { borderColor: 'rgba(249,115,22,0.5)' },
  btn: { backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginBottom: spacing.md },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  switchLink: { alignItems: 'center', paddingVertical: spacing.sm },
  switchText: { fontSize: 14, color: colors.gray1 },
});
