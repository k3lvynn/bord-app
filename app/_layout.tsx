// app/_layout.tsx
// Root layout — controls splash screen timing and auth gating.
//
// STARTUP SEQUENCE:
//   1. Native splash screen is held open by SplashScreen.preventAutoHideAsync()
//   2. Auth check runs with a 6-second hard timeout
//   3. Splash hides as soon as we know auth state (even if profile isn't loaded yet)
//   4. Profile fetches in the background — UI renders optimistically
//
// This guarantees the app is interactive within ~3s on good network,
// and within 6s on slow/offline network (falls through to sign-in).

import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

// Hold the splash screen — must be called before any async work
SplashScreen.preventAutoHideAsync();

// Lazy-load Stripe — don't parse it until RootLayout renders
let StripeProvider: any = null;
try { StripeProvider = require('@stripe/stripe-react-native').StripeProvider; } catch (_) {}
const SafeStripeProvider = StripeProvider
  ?? (({ children }: { children: React.ReactNode }) => <>{children}</>);

const sharedHeader = {
  headerStyle:            { backgroundColor: colors.black },
  headerTintColor:        colors.white,
  headerTitleStyle:       { fontWeight: '700' as const, fontSize: 17 },
  headerShadowVisible:    false,
  headerBackTitle:        '',
  headerBackButtonDisplayMode: 'minimal' as const,
};

// ── Navigator ─────────────────────────────────────────────────────────────────
function RootNavigator() {
  const { user, loading } = useAuth();

  // Hide splash as soon as auth state is resolved (loading = false)
  useEffect(() => {
    if (!loading) {
      // Small delay lets the JS thread breathe before hiding
      // so the first frame renders cleanly instead of showing a flash
      requestAnimationFrame(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
    }
  }, [loading]);

  if (loading) {
    // Keep splash visible — this view is underneath the native splash.
    // We return null so React doesn't try to render routes before auth resolves.
    return null;
  }

  if (!user) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)/welcome" />
        <Stack.Screen name="(auth)/sign-in"  options={{ ...sharedHeader, headerShown: true, title: 'Sign In' }} />
        <Stack.Screen name="(auth)/sign-up"  options={{ ...sharedHeader, headerShown: true, title: 'Create Account' }} />
      </Stack>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)"             options={{ headerBackTitle: '' }} />
      <Stack.Screen name="host/create"        options={{ ...sharedHeader, headerShown: true, title: 'Create Event',     presentation: 'modal' }} />
      <Stack.Screen name="host/event/[id]"    options={{ ...sharedHeader, headerShown: true, title: 'Event Details' }} />
      <Stack.Screen name="host/scan/[eventId]" options={{ headerShown: false }} />
      <Stack.Screen name="ticket/[rsvpId]"    options={{ headerShown: false }} />
      <Stack.Screen name="event/[slug]"       options={{ ...sharedHeader, headerShown: true, title: '' }} />
      <Stack.Screen name="rsvp/[slug]"        options={{ ...sharedHeader, headerShown: true, title: 'RSVP',             presentation: 'modal' }} />
      <Stack.Screen name="rsvp/confirmation"  options={{ ...sharedHeader, headerShown: true, title: "You're In!",       headerBackVisible: false }} />
      <Stack.Screen name="profile/edit"       options={{ ...sharedHeader, headerShown: true, title: 'Edit Profile',     presentation: 'modal' }} />
      <Stack.Screen name="tournament/bracket" options={{ ...sharedHeader, headerShown: true, title: 'Live Bracket' }} />
      <Stack.Screen name="tournament/manage"  options={{ ...sharedHeader, headerShown: true, title: 'Manage Bracket' }} />
      <Stack.Screen name="team/[id]"          options={{ ...sharedHeader, headerShown: true, title: 'Team' }} />
      <Stack.Screen name="team/create"        options={{ ...sharedHeader, headerShown: true, title: 'Create Team',      presentation: 'modal' }} />
      <Stack.Screen name="gather/create"      options={{ ...sharedHeader, headerShown: true, title: 'Host a Meetup',    presentation: 'modal' }} />
      <Stack.Screen name="gather/circle/new"  options={{ ...sharedHeader, headerShown: true, title: 'New Circle',       presentation: 'modal' }} />
      <Stack.Screen name="settings"           options={{ ...sharedHeader, headerShown: true, title: 'Settings' }} />
      <Stack.Screen name="legal/about"        options={{ ...sharedHeader, headerShown: true, title: 'About Bord' }} />
      <Stack.Screen name="legal/terms"        options={{ ...sharedHeader, headerShown: true, title: 'Terms of Service' }} />
      <Stack.Screen name="legal/privacy"      options={{ ...sharedHeader, headerShown: true, title: 'Privacy Policy' }} />
      <Stack.Screen name="post/create"        options={{ ...sharedHeader, headerShown: true, title: 'New Post',         presentation: 'modal' }} />
      <Stack.Screen name="ticket/scan"         options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="ticket/verified"     options={{ headerShown: false }} />
      <Stack.Screen name="ticket/door/[slug]"  options={{ headerShown: false }} />
      <Stack.Screen name="inbox/index"         options={{ headerShown: false }} />
      <Stack.Screen name="inbox/dm/[userId]"   options={{ headerShown: false }} />
      <Stack.Screen name="user/[id]"            options={{ ...sharedHeader, headerShown: true, title: 'Profile' }} />
    </Stack>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  const stripeKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    Constants.expoConfig?.extra?.stripePublishableKey ?? '';

  return (
    <SafeStripeProvider
      publishableKey={stripeKey}
      merchantIdentifier="merchant.app.bord"
      urlScheme="bord"
    >
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </SafeStripeProvider>
  );
}
