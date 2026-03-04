# Stripe + Maps Setup Guide

## ─────────────────────────────────────────────────
## PART 1 — STRIPE
## ─────────────────────────────────────────────────

### Step 1 — Get your Stripe keys
1. Go to https://dashboard.stripe.com → Developers → API keys
2. Copy your **Publishable key** (pk_live_... or pk_test_... for testing)
3. Copy your **Secret key** (sk_live_... or sk_test_...)

### Step 2 — Add publishable key to .env
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Step 3 — Deploy the Edge Function
```bash
# Install Supabase CLI if you haven't
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project (find project ref in Supabase dashboard URL)
supabase link --project-ref liqjkhethvfmrqxbeont

# Set your Stripe secret key as a secret (NEVER put this in .env or code)
supabase secrets set STRIPE_SECRET_KEY=sk_test_...

# Deploy the Edge Function
supabase functions deploy create-payment-intent
```

### Step 4 — Test with Stripe test cards
- ✅ Success:       4242 4242 4242 4242 (any future date, any CVC)
- ❌ Decline:       4000 0000 0000 0002
- 🔐 Auth required: 4000 0025 0000 3155

### Step 5 — Go live
- Replace pk_test_ with pk_live_ in .env
- Replace sk_test_ with sk_live_ in: `supabase secrets set STRIPE_SECRET_KEY=sk_live_...`
- Re-deploy the function: `supabase functions deploy create-payment-intent`

---

## ─────────────────────────────────────────────────
## PART 2 — GOOGLE MAPS
## ─────────────────────────────────────────────────

### Step 1 — Create a Google Maps API key
1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Geocoding API  ← needed for address → pin
4. Create credentials → API key → copy it

### Step 2 — Add to app.json
Replace `YOUR_GOOGLE_MAPS_IOS_KEY` and `YOUR_GOOGLE_MAPS_ANDROID_KEY` in app.json
with your actual API key. You can use the same key for both.

### Step 3 — Rebuild the dev client
Since react-native-maps requires native code, you need a custom dev client build:
```bash
npm install
npx expo install react-native-maps expo-location @stripe/stripe-react-native
eas build --profile development --platform ios
```
Or for local builds:
```bash
npx expo run:ios
npx expo run:android
```

> ⚠️ react-native-maps and @stripe/stripe-react-native both require a custom
> dev client — they will NOT work in Expo Go. You need eas build or expo run.

---

## ─────────────────────────────────────────────────
## PART 3 — DATABASE CHANGES (run in Supabase SQL editor)
## ─────────────────────────────────────────────────

```sql
-- Add coordinates to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add index for geo queries
CREATE INDEX IF NOT EXISTS idx_events_coords
  ON events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add payments table to track Stripe transactions
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  rsvp_id             UUID REFERENCES rsvps(id) ON DELETE SET NULL,
  event_id            UUID REFERENCES events(id) ON DELETE SET NULL,
  attendee_email      TEXT NOT NULL,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents        INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL DEFAULT 'succeeded',
  refunded            BOOLEAN DEFAULT false,
  refunded_at         TIMESTAMPTZ
);

-- RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view payments for their events"
  ON payments FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE host_id = auth.uid()
    )
  );
```

---

## ─────────────────────────────────────────────────
## QUICK REFERENCE — How it all works
## ─────────────────────────────────────────────────

### Payment flow
1. Attendee fills RSVP form → taps "Pay $X & Register"
2. App calls Supabase Edge Function → Edge Function calls Stripe API
3. Stripe returns a clientSecret (temporary, single-use token)
4. @stripe/stripe-react-native shows native payment sheet (Apple Pay / card)
5. On success → RSVP record saved → confirmation screen shown
6. Stripe deposits to your connected account (minus Bord's 10% fee)

### Map flow  
1. Host creates event → types location → app geocodes address to lat/lng
2. lat/lng saved to `events` table
3. Map tab loads all upcoming events with coordinates
4. Dark-styled map shows 🏆 orange pins (compete) and 🤝 lavender pins (gather)
5. Tapping a pin slides up a bottom sheet with event details + RSVP button
