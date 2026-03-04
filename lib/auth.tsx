// lib/auth.tsx
//
// SESSION RESTORE STRATEGY (Supabase v2 + React Native):
//
// We race getSession() against onAuthStateChange's INITIAL_SESSION event.
// Whichever resolves first with definitive data wins — the initializedRef
// guard prevents double-resolution.
//
// Why race instead of using only INITIAL_SESSION:
//   After a new binary install (e.g. TestFlight update), INITIAL_SESSION can
//   fire before AsyncStorage finishes reading the stored session, returning null
//   and incorrectly redirecting to sign-in. getSession() explicitly awaits the
//   AsyncStorage read, so it reliably returns the real session.
//
// Why not use getSession() alone:
//   It doesn't set up the ongoing listener for token refresh, sign-out, etc.
//   We need onAuthStateChange for those events.
//
// Result:
//   - Valid session   → getSession() or INITIAL_SESSION fires with user ✓
//   - Expired token   → Supabase refreshes → whichever fires first with user ✓
//   - Truly logged out → both fire with null → show sign-in ✓
//   - Offline, no session → 5s fallback → show sign-in ✓

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
export type Profile = {
  id: string;
  display_name: string;
  username: string;
  avatar_emoji: string;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  email_hidden?: boolean;
  events_hosted?: number;
  events_attended?: number;
  created_at?: string;
  public_badges?: string[];
  reliability_attended?: number;
  reliability_total?: number;
  interest_tags?: string[];
  vibe?: string | null;
  looking_for?: string[];
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  age_range?: string | null;
  preferred_modes?: string[];
  instagram_handle?: string | null;
  twitter_handle?: string | null;
  threads_handle?: string | null;
  is_private_account?: boolean;
};

export type UserSettings = {
  preferred_mode: 'compete' | 'gather' | 'both';
  notif_event_reminders: boolean;
  notif_new_nearby: boolean;
  notif_host_announcements: boolean;
  share_checkin_status: boolean;
};

type AuthContextValue = {
  user:           any | null;
  profile:        Profile | null;
  loading:        boolean;
  signIn:         (email: string, password: string) => Promise<void>;
  signUp:         (email: string, password: string, displayName: string, username: string) => Promise<void>;
  signOut:        () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile:  (updates: Partial<Omit<Profile, 'id'>>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef    = useRef(true);
  const initializedRef = useRef(false); // guard: only resolve once

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (data && mountedRef.current) setProfile(data as Profile);
    } catch (e) {
      console.warn('fetchProfile error:', e);
    }
  };

  const resolveAuth = (u: any | null) => {
    // Only called once — the first time we know the real auth state.
    if (!mountedRef.current) return;
    initializedRef.current = true;
    setUser(u);
    setLoading(false);
    if (u) fetchProfile(u.id);
  };

  useEffect(() => {
    mountedRef.current    = true;
    initializedRef.current = false;

    // 5-second safety net in case INITIAL_SESSION never fires (fully offline,
    // no stored session). Without this the app would show a blank loading screen.
    const fallback = setTimeout(() => {
      if (mountedRef.current && !initializedRef.current) {
        resolveAuth(null);
      }
    }, 5000);

    // Race getSession() against INITIAL_SESSION — whichever resolves first wins.
    // getSession() explicitly awaits the AsyncStorage read, making it reliable
    // after binary updates (e.g. TestFlight) where INITIAL_SESSION can fire
    // before AsyncStorage finishes loading, returning null and wrongly
    // redirecting to sign-in. The initializedRef guard prevents double-resolution.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initializedRef.current && mountedRef.current) {
        clearTimeout(fallback);
        resolveAuth(session?.user ?? null);
      }
    }).catch(() => { /* swallow — fallback timer handles this */ });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      if (event === 'INITIAL_SESSION') {
        // May arrive before or after getSession() — initializedRef prevents
        // double-resolution. Whichever fires first with real data wins.
        if (!initializedRef.current) {
          clearTimeout(fallback);
          resolveAuth(session?.user ?? null);
        }

      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const u = session?.user ?? null;
        setUser(u);
        if (u) fetchProfile(u.id);
        // If neither getSession nor INITIAL_SESSION resolved yet, do it now.
        if (!initializedRef.current) {
          clearTimeout(fallback);
          resolveAuth(u);
        }

      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        if (!initializedRef.current) {
          clearTimeout(fallback);
          resolveAuth(null);
        }
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const u = data.user ?? null;
    setUser(u);
    if (u) fetchProfile(u.id);
  };

  const signUp = async (
    email: string, password: string,
    displayName: string, username: string,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName, username } },
    });
    if (error) throw error;
    const newUser = data.user;
    if (!newUser) throw new Error('No user returned from sign up');

    const { error: profileError } = await supabase.from('profiles').insert({
      id: newUser.id,
      display_name: displayName,
      username,
      avatar_emoji: '⭐',
    });
    if (profileError) throw profileError;

    setUser(newUser);
    await fetchProfile(newUser.id);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfile = async (updates: Partial<Omit<Profile, 'id'>>) => {
    if (!user) throw new Error('Not signed in');
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
