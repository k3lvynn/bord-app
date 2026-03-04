# UNIVERSAL LINKS SETUP — bordevents.com
# Run these commands AFTER your EAS build completes

# ── STEP 1: Get your Apple Team ID ──────────────────────────────────────────
# 1. Go to: https://developer.apple.com/account
# 2. Click your name top-right → Membership
# 3. Copy the "Team ID" (10-character string like A1B2C3D4E5)
# 4. Open web/.well-known/apple-app-site-association
# 5. Replace YOURTEAMID with your actual Team ID
#    e.g. "A1B2C3D4E5.app.bord.host"

# ── STEP 2: Get your Android SHA256 fingerprint ─────────────────────────────
# Run this after your first Android EAS build:
#   eas credentials --platform android
# Or get it from the EAS dashboard:
#   https://expo.dev/accounts/[your-account]/projects/bord/credentials
# Copy the SHA-256 fingerprint and paste into:
#   web/.well-known/assetlinks.json → sha256_cert_fingerprints

# ── STEP 3: Deploy updated web/ folder to Netlify ───────────────────────────
# Drag the web/ folder onto Netlify Drop again
# The .well-known files will be served at:
#   https://bordevents.com/.well-known/apple-app-site-association
#   https://bordevents.com/.well-known/assetlinks.json

# ── STEP 4: Build and submit the app ────────────────────────────────────────
# cd ~/Desktop/bord-app
# npm install
# eas build --platform all --profile production
# eas submit --platform all

# ── HOW IT WORKS AFTER SETUP ────────────────────────────────────────────────
# When someone taps bordevents.com/events/aircrew-ultimate-frisbee-tournament
# iOS/Android checks the .well-known files, sees app.bord.host is registered,
# and opens the Bord app directly to that event.
# If the app is NOT installed, it falls back to the website automatically.
# No app store redirect needed — it just works.
