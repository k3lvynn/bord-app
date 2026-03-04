# Getting to TestFlight & Google Play — Step by Step

## ══════════════════════════════════════════════
## PREREQUISITES (do these once)
## ══════════════════════════════════════════════

### 1. Apple Developer Account ($99/year)
- Sign up: https://developer.apple.com/programs/
- Once enrolled, you'll have a Team ID (e.g., ABC123DEFG)

### 2. Google Play Console Account ($25 one-time)
- Sign up: https://play.google.com/console

### 3. EAS CLI
```bash
npm install -g eas-cli
eas login         # login with your Expo account
```

### 4. Run the SQL migration in Supabase
- Go to your Supabase project → SQL Editor
- Paste and run the full contents of: supabase/migrations/v9_tournament.sql

### 5. Set your .env file
```
EXPO_PUBLIC_SUPABASE_URL=https://liqjkhethvfmrqxbeont.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  (pk_live_... for production)
```

### 6. Deploy the Stripe Edge Function
```bash
brew install supabase/tap/supabase   # if not installed
supabase login
supabase link --project-ref liqjkhethvfmrqxbeont
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase functions deploy create-payment-intent
```

---

## ══════════════════════════════════════════════
## OPTION A — EXPO GO (fastest, limited features)
## ══════════════════════════════════════════════
Works for: All screens EXCEPT Map and Stripe payment sheet.
Map shows a placeholder. Stripe shows an error for paid events.

```bash
npm install
npx expo start --clear
# Scan QR with Expo Go app
```

---

## ══════════════════════════════════════════════
## OPTION B — DEV BUILD (all features work)
## ══════════════════════════════════════════════
Needed for: Map, Stripe payment sheet, Apple Pay, Google Pay.

### iOS Dev Build
```bash
npm install
eas build --profile development --platform ios
# Installs on your phone via QR code, no TestFlight needed
# Takes ~10-15 min on EAS servers
```

### Android Dev Build
```bash
eas build --profile development --platform android
# Downloads .apk, install via ADB or email to your device
```

---

## ══════════════════════════════════════════════
## OPTION C — TESTFLIGHT (iOS beta distribution)
## ══════════════════════════════════════════════

### Step 1 — Configure app.json
In app.json → ios section, update:
```json
"bundleIdentifier": "app.bord.host",
"buildNumber": "1"
```

### Step 2 — Configure eas.json
In eas.json → submit → production → ios:
```json
"appleId": "your@email.com",
"ascAppId": "1234567890",   ← from App Store Connect
"appleTeamId": "ABC123DEFG" ← from developer.apple.com
```

### Step 3 — Create app in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. My Apps → + → New App
3. Fill in name: "Bord", bundle ID: app.bord.host, SKU: bord-app
4. Copy the App ID number → paste into eas.json ascAppId

### Step 4 — Build and submit
```bash
# Build production iOS binary
eas build --profile production --platform ios

# Submit to TestFlight (once build is done)
eas submit --platform ios
```

### Step 5 — Invite testers
1. App Store Connect → Your App → TestFlight
2. Add testers by email under "Internal Testing" (up to 100 people)
3. They get an email with a TestFlight link
4. They install TestFlight app, then install Bord

---

## ══════════════════════════════════════════════
## OPTION D — GOOGLE PLAY (Android beta)
## ══════════════════════════════════════════════

### Step 1 — Create app in Play Console
1. Go to https://play.google.com/console
2. Create app → App name: Bord, Default language: English
3. Fill in store listing (description, screenshots — required before upload)

### Step 2 — Get service account key
1. Play Console → Setup → API access → Link to Google Cloud project
2. Create service account → download JSON key
3. Save as: ./google-services-key.json in project root
4. Grant the service account "Release manager" role in Play Console

### Step 3 — Build and submit
```bash
# Build .aab for Play Store
eas build --profile production --platform android

# Submit to internal testing track
eas submit --platform android
```

### Step 4 — Invite testers
Play Console → Testing → Internal testing → Add testers by email

---

## ══════════════════════════════════════════════
## GOOGLE MAPS API KEY (required for map tab)
## ══════════════════════════════════════════════

1. Go to https://console.cloud.google.com
2. Create project → Enable APIs:
   - Maps SDK for Android
   - Maps SDK for iOS  
   - Geocoding API
3. Credentials → Create API Key → copy it
4. Replace in app.json:
   - ios → config → googleMapsApiKey: "YOUR_KEY"
   - android → config → googleMaps → apiKey: "YOUR_KEY"
   - plugins → react-native-maps → googleMapsApiKey: "YOUR_KEY"

---

## ══════════════════════════════════════════════
## AFTER FIRST DISTRIBUTION — UPDATES
## ══════════════════════════════════════════════

### JS-only changes (no native code changed):
```bash
eas update --channel production --message "Bug fixes"
```
This uses Expo's OTA update — users get it automatically, no app store review.

### Native code changes (when you add new packages):
```bash
# Bump buildNumber in app.json first, then:
eas build --profile production --platform ios
eas submit --platform ios
```

---

## ══════════════════════════════════════════════
## COMMON ERRORS & FIXES
## ══════════════════════════════════════════════

**"Network request failed" on signup**
→ Check .env has correct Supabase URL and anon key
→ In Supabase: Authentication → Email → disable "Confirm email"

**Map shows placeholder / crashes**
→ You're in Expo Go. Use a dev build (Option B above)

**Stripe payment fails in app**  
→ Check EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env
→ Check STRIPE_SECRET_KEY is set in Supabase secrets
→ Check Edge Function is deployed: supabase functions list

**Build fails with "Missing Apple credentials"**
→ Run: eas credentials and follow the prompts
→ EAS can auto-generate provisioning profiles

**"Module not found" errors**
→ Run: npm install --legacy-peer-deps
→ Then: npx expo start --clear
