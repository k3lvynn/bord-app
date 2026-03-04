// lib/stripe.ts
// Stripe payment helpers for Bord buy-in events.
//
// Architecture:
//   1. Client calls createPaymentIntent() → Supabase Edge Function
//   2. Edge Function uses Stripe SECRET key (never on client) to create PaymentIntent
//   3. Client gets back clientSecret + amount
//   4. @stripe/stripe-react-native presentPaymentSheet() handles all card UI
//   5. On success, RSVP is confirmed in DB
//
// The Edge Function code is in /supabase/functions/create-payment-intent/index.ts
// Deploy with: supabase functions deploy create-payment-intent

import { supabase } from './supabase';
import Constants from 'expo-constants';

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
  Constants.expoConfig?.extra?.stripePublishableKey ??
  '';

export const PLATFORM_FEE_PCT = 0.10; // 10% platform fee

// Called before presenting the payment sheet.
// Returns the clientSecret from Stripe and the total amount in cents.
export async function createPaymentIntent(params: {
  eventId: string;
  eventTitle: string;
  buyInAmount: number;   // dollars
  attendeeName: string;
  attendeeEmail: string;
}): Promise<{ clientSecret: string; amountCents: number }> {
  const totalDollars = params.buyInAmount * (1 + PLATFORM_FEE_PCT);
  const amountCents  = Math.round(totalDollars * 100);

  // Use raw fetch so we always get the real response body, not a generic "non-2xx"
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  // Always use the anon key for this endpoint — it's a server-side payment
  // function that doesn't need user-level auth, and user JWTs can expire
  // or be unavailable during the payment flow causing "Invalid JWT" errors.
  const { data: sessionData } = await supabase.auth.getSession();
  const authToken = sessionData?.session?.access_token ?? supabaseKey;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey':         supabaseKey,
    },
    body: JSON.stringify({
      eventId:       params.eventId,
      eventTitle:    params.eventTitle,
      amountCents,
      customerEmail: params.attendeeEmail,
      customerName:  params.attendeeName,
    }),
  });

  let json: any = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    // json.error will be set by the edge function, or fall back to HTTP status
    const msg = json?.error ?? json?.message ?? `Server error ${res.status}`;
    console.error('create-payment-intent failed:', res.status, json);
    throw new Error(msg);
  }

  if (!json?.clientSecret) throw new Error('No client secret returned from server');
  return { clientSecret: json.clientSecret, amountCents };
}

// Format cents → "$25.00"
export function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
