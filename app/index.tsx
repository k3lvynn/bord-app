// app/index.tsx
// Landing page for signed-out users.
// "I have an event link" → no account needed, goes straight to event page.

import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function Landing() {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue,     setLinkValue]     = useState('');
  const [checking,      setChecking]      = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const extractSlug = (raw: string): string => {
    const clean = raw.trim();
    const match = clean.match(/\/(?:rsvp|event)\/([a-z0-9_-]+)\/?$/i);
    if (match) return match[1];
    return clean.replace(/[^a-z0-9_-]/gi, '');
  };

  const handleLinkGo = async () => {
    const slug = extractSlug(linkValue);
    if (!slug) { Alert.alert('Paste your link', 'Enter the RSVP link or event code you received.'); return; }
    setChecking(true);
    try {
      const { data } = await supabase.from('events').select('slug').eq('slug', slug).maybeSingle();
      if (data) {
        router.push(`/rsvp/${slug}`);   // go straight to RSVP — no account needed
      } else {
        Alert.alert('Event not found', 'Check the link and try again. Make sure you copied the full URL.');
      }
    } catch {
      Alert.alert('Connection error', 'Check your internet and try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleShowInput = () => {
    setShowLinkInput(true);
    // After state update + render, scroll to bottom so input is above keyboard
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Text style={styles.logo}>
              <Text style={{ color: colors.white }}>B</Text>
              <Text style={{ color: colors.orange }}>ord</Text>
            </Text>
            <Text style={styles.tagline}>are you bored?</Text>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Host events.{'\n'}Build community.</Text>
            <Text style={styles.heroSub}>
              Create an event, share the link, and let Bord handle RSVPs, waitlists, and everything else.
            </Text>
          </View>

          {/* CTAs */}
          <View style={styles.btnGroup}>
            <TouchableOpacity
              style={styles.btnHost}
              onPress={() => router.push('/(auth)/sign-up')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnHostEmoji}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.btnHostTitle}>Create an Account</Text>
                <Text style={styles.btnHostSub}>Host events & manage RSVPs</Text>
              </View>
              <Text style={{ color: colors.white, fontSize: 18 }}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSignIn}
              onPress={() => router.push('/(auth)/sign-in')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnSignInText}>Already have an account? Sign In</Text>
            </TouchableOpacity>

            {/* RSVP link — no account needed */}
            {!showLinkInput ? (
              <TouchableOpacity
                style={styles.btnGuest}
                onPress={handleShowInput}
                activeOpacity={0.85}
              >
                <Text style={styles.btnGuestEmoji}>🤝</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.btnGuestTitle}>I have an event link</Text>
                  <Text style={styles.btnGuestSub}>RSVP without an account</Text>
                </View>
                <Text style={{ color: colors.gray1, fontSize: 18 }}>→</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.linkBox}>
                <Text style={styles.linkBoxLabel}>Paste your RSVP link or event code</Text>
                <Text style={styles.linkBoxNote}>
                  No account needed — you'll go straight to the event.
                </Text>
                <TextInput
                  style={styles.linkInput}
                  value={linkValue}
                  onChangeText={setLinkValue}
                  placeholder="https://bordevents.com/events/abc123 or just abc123"
                  placeholderTextColor={colors.gray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={handleLinkGo}
                />
                <View style={styles.linkBtnRow}>
                  <TouchableOpacity
                    style={styles.linkCancelBtn}
                    onPress={() => { setShowLinkInput(false); setLinkValue(''); }}
                  >
                    <Text style={styles.linkCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.linkGoBtn, checking && { opacity: 0.6 }]}
                    onPress={handleLinkGo}
                    disabled={checking}
                  >
                    <Text style={styles.linkGoText}>{checking ? 'Looking up...' : 'Open Event →'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <Text style={styles.footer}>San Diego · bord.app</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.gradBar} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  logoWrap: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  logo:     { fontSize: 52, fontWeight: '900', letterSpacing: 2 },
  tagline:  { fontSize: 13, color: colors.gray2, fontStyle: 'italic' },
  hero:     { flex: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  heroTitle:{ fontSize: 38, fontWeight: '800', color: colors.white, lineHeight: 44, marginBottom: spacing.md },
  heroSub:  { fontSize: 16, color: colors.gray1, lineHeight: 24 },
  btnGroup: { gap: spacing.sm, marginBottom: spacing.md },

  btnHost: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  btnHostEmoji: { fontSize: 28 },
  btnHostTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginBottom: 2 },
  btnHostSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  btnSignIn: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 14, alignItems: 'center',
  },
  btnSignInText: { fontSize: 15, color: colors.white, fontWeight: '600' },

  btnGuest: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  btnGuestEmoji: { fontSize: 28 },
  btnGuestTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginBottom: 2 },
  btnGuestSub:   { fontSize: 12, color: colors.gray1, fontWeight: '500' },

  linkBox: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    padding: spacing.md, gap: spacing.sm,
  },
  linkBoxLabel: { fontSize: 11, fontWeight: '700', color: colors.gray2, textTransform: 'uppercase', letterSpacing: 0.8 },
  linkBoxNote:  { fontSize: 12, color: colors.green, fontWeight: '500', marginTop: -2 },
  linkInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 13,
    color: colors.white, fontSize: 14,
  },
  linkBtnRow:    { flexDirection: 'row', gap: spacing.sm },
  linkCancelBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  linkCancelText:{ color: colors.gray1, fontWeight: '600', fontSize: 14 },
  linkGoBtn:     { flex: 2, backgroundColor: colors.orange, paddingVertical: 11, alignItems: 'center', borderRadius: radius.sm },
  linkGoText:    { color: colors.white, fontWeight: '700', fontSize: 14 },

  footer:  { textAlign: 'center', fontSize: 12, color: colors.gray2, paddingTop: spacing.sm },
  gradBar: { height: 3, backgroundColor: colors.orange },
});
