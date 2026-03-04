# Bord App — Complete Setup Guide
### From zero accounts to TestFlight + Google Play internal testing

---

## What you're setting up

| Service | Cost | What it does |
|---------|------|-------------|
| Supabase | Free | Database — events, RSVPs, waitlist |
| Expo | Free | Builds the app for both stores |
| Apple Developer | $99/yr | Required to publish on iOS / TestFlight |
| Google Play Console | $25 one-time | Required to publish on Android |
| Node.js | Free | Runs the build tools on your computer |

**Total time: ~3-4 hours, mostly waiting for Apple to approve your developer account**

---

## STEP 1 — Install tools on your computer

You need Node.js and the Expo CLI.

```bash
# Install Node.js from nodejs.org (download the LTS version)
# Then open Terminal and run:

npm install -g eas-cli
npm install -g expo-cli

# Verify:
node --version    # should show v18 or higher
eas --version     # should show a version number
```

---

## STEP 2 — Supabase setup (~15 minutes)

**2a. Create your project**
1. Go to supabase.com → Sign Up
2. Click **New Project**
3. Name: `bord` | Password: save this somewhere | Region: US West
4. Wait ~2 minutes for it to spin up

**2b. Run the database schema**
1. In your Supabase project → click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the file `supabase-schema.sql` from this folder
4. Copy everything and paste it into the SQL editor
5. Click **Run** — you should see "Success"

**2c. Get your keys**
1. In Supabase → **Settings** → **API**
2. Copy these two values — you'll need them in the next step:
   - `Project URL` (looks like `https://xxxx.supabase.co`)
   - `anon public` key (long string starting with `eyJ...`)

**2d. Paste keys into app.json**

Open `app.json` and replace:
```json
"supabaseUrl": "YOUR_SUPABASE_URL",
"supabaseAnonKey": "YOUR_SUPABASE_ANON_KEY"
```
with your actual values.

---

## STEP 3 — Expo account setup (~5 minutes)

1. Go to expo.dev → Sign Up → remember your username
2. Open Terminal in the `bord-app` folder
3. Run:
```bash
npx eas login
# Enter your Expo username and password
```
4. Run:
```bash
npx eas init
# This creates your EAS project and gives you a Project ID
```
5. Copy the Project ID it prints, open `app.json`, replace:
```json
"projectId": "YOUR_EAS_PROJECT_ID",
"owner": "YOUR_EXPO_USERNAME"
```

---

## STEP 4 — Install app dependencies (~2 minutes)

```bash
cd bord-app
npm install
```

---

## STEP 5 — Test it locally first (~5 minutes)

```bash
npx expo start
```

This opens a QR code. Download the **Expo Go** app on your iPhone, scan the code, and the app runs on your phone immediately. Test everything works before building for the stores.

---

## STEP 6 — Apple Developer + TestFlight (~48 hours, mostly waiting)

**6a. Enroll in Apple Developer Program**
1. developer.apple.com → Account → Sign in with your Apple ID
2. Click **Enroll** → Individual → fill in your info → pay $99
3. Apple takes up to **48 hours** to approve (usually faster on weekdays)

**6b. Once approved — configure your app**
1. developer.apple.com → Certificates, IDs & Profiles → **App IDs**
2. Register New → App ID → Explicit → Bundle ID: `app.bord.host` → Continue
3. No special capabilities needed for now → Register

**6c. Build and submit to TestFlight**
```bash
# In your bord-app folder:

# First build (takes ~15 minutes — EAS builds in the cloud):
npx eas build --platform ios --profile production

# When prompted "Generate new Apple Distribution Certificate?" → Yes
# When prompted "Generate new Apple Provisioning Profile?" → Yes
# EAS handles all the certificate stuff for you automatically.

# After build completes, submit to App Store Connect:
npx eas submit --platform ios

# You'll be prompted for:
# - Apple ID email
# - App-specific password (create at appleid.apple.com → App-Specific Passwords)
```

**6d. Set up TestFlight**
1. appstoreconnect.apple.com → Your App → TestFlight
2. Click the build that was just uploaded
3. Add a test note: "Internal demo for host partners"
4. Under **Internal Testing** → Add testers → enter host email addresses
5. They get an email with a TestFlight link — one tap install

---

## STEP 7 — Google Play internal testing (~30 minutes)

**7a. Create Play Console account**
1. play.google.com/console → Get Started → pay $25
2. Accept developer agreement → account ready immediately

**7b. Create the app**
1. Play Console → **Create app**
2. App name: `Bord`
3. App or game: App | Free or paid: Free
4. Declarations: check all boxes → Create

**7c. Build and submit Android**
```bash
# Build Android app bundle:
npx eas build --platform android --profile production
# EAS builds in the cloud (~10 minutes)

# You'll need a Google service account for automated submission.
# For manual upload (easier for internal testing):
# 1. Download the .aab file from expo.dev → your project → builds
# 2. Play Console → your app → Testing → Internal testing → Create new release
# 3. Upload the .aab file → Save → Review release → Start rollout
```

**7d. Add internal testers**
1. Play Console → your app → Testing → Internal testing → **Testers** tab
2. Create a list → add host email addresses
3. They get a link to install directly from Play Store (no public listing)

---

## STEP 8 — The shareable RSVP link

When a host creates an event, the app generates a link like:
```
https://bord.app/rsvp/ab3k9mz1
```

For the demo, this URL needs to point somewhere. You have two options:

**Option A (easiest for demo) — Use Expo's hosted preview**
The app running in Expo Go can deep-link via:
```
exp://your-expo-username.bord.exp.direct/--/event/ab3k9mz1
```
Share this link with participants — it opens in Expo Go.

**Option B (most professional) — Buy bord.app domain**
1. Buy `bord.app` on Namecheap or Cloudflare (~$15/yr)
2. Set up a simple redirect or Vercel deployment
3. Links look like: `bord.app/rsvp/ab3k9mz1`

---

## STEP 9 — Send links to your first hosts

Once TestFlight is set up, hosts get:

**Text/email template:**
```
Hey [Name] — I'm building Bord, an app for hosting community events 
with built-in RSVPs and waitlists. I'd love your feedback.

Download the beta: [TestFlight link]

Once you're in, create your event and share your RSVP link with 
your community. Takes about 2 minutes.

— [Your name]
```

---

## File structure reference

```
bord-app/
├── app.json              ← Add your Supabase keys + Expo project ID here
├── eas.json              ← Build config for iOS + Android
├── supabase-schema.sql   ← Run this in Supabase SQL Editor
├── lib/
│   ├── supabase.ts       ← All database logic
│   └── theme.ts          ← Colors, spacing, shared styles
└── app/
    ├── index.tsx          ← Home screen (host vs participant split)
    ├── host/
    │   ├── dashboard.tsx  ← Host sees all their events
    │   ├── create.tsx     ← Create event form
    │   └── event/[id].tsx ← RSVP list, waitlist, share link
    ├── event/[slug].tsx   ← Public event page (what participants see)
    └── rsvp/
        ├── [slug].tsx     ← RSVP form (participant)
        └── confirmation.tsx ← You're in! / Waitlist confirmation
```

---

## Common issues

**"Bundle identifier already taken" on iOS**
→ Change `app.bord.host` to `app.bord.host2` or use your own domain reversed

**Build fails with "no Expo account"**
→ Run `npx eas login` again and make sure you're logged in

**Supabase "permission denied" errors**
→ Check that you ran the full schema SQL including the RLS policies section

**TestFlight invitation not arriving**
→ Check spam folder; also make sure tester accepted the TestFlight app invitation email from Apple first

---

## What's NOT in this version (next steps after demo)

- **Auth for hosts** — right now host_id is hardcoded `demo-host-001`. Add Supabase Auth (email/password login) for real hosts
- **Stripe payments** — buy-in collection is UI only; wire up Stripe Connect for real money
- **Push notifications** — waitlist promotion alerts need Expo Push Notifications setup
- **Email confirmations** — connect Resend or SendGrid via Supabase Edge Functions

All of these are straightforward additions once the demo is validated.
