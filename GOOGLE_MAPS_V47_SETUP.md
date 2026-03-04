# Google Maps Setup for v47 — Map Pins

## Why Pins Weren't Showing
The map query correctly filters `.not('latitude', 'is', null)` — so pins
only render for events that have coordinates. The problem is that
`host/create.tsx` was saving `latitude: null, longitude: null` because
the geocoding call was failing silently.

## v47 Fix (Already Applied)
`host/create.tsx` now geocodes the address via `expo-location` on event create.
`host/event/[id].tsx` now re-geocodes whenever the location field is edited.

## What You Need in Google Cloud Console

### 1. Enable These APIs (if not already on)
Go to: console.cloud.google.com → APIs & Services → Library

Enable:
- **Maps SDK for iOS** ← renders the map
- **Maps SDK for Android** ← renders the map  
- **Geocoding API** ← converts "Balboa Park, San Diego" → lat/lng

All three must be enabled for the same project.

### 2. Restrict Your API Key
Your key `AIzaSyBedJGG9UR-vbUZKa_8z7ud8g4P5JI3iQ8` is currently unrestricted.
Go to: APIs & Services → Credentials → click the key

**Application restrictions:**
- Select "iOS apps" → add bundle ID: `app.bord.host`
- OR select "Android apps" → add package: `app.bord.host`

Note: You may need separate keys for iOS and Android since they take
different restriction types. Or use one unrestricted key in .env (not app.json)
and restrict by IP for server-side calls only.

**API restrictions:**
- Select "Restrict key"
- Check: Maps SDK for iOS, Maps SDK for Android, Geocoding API

### 3. Move Key Out of app.json (Security)
Your key is currently hardcoded in app.json AND in .env. The .env version
is correct — app.json gets bundled into the binary.

In app.json, replace the hardcoded key:
```json
"config": {
  "googleMapsApiKey": "$(GOOGLE_MAPS_API_KEY)"
}
```

Then in eas.json, add to each build profile's env:
```json
"env": {
  "GOOGLE_MAPS_API_KEY": "AIzaSyBedJGG9UR-vbUZKa_8z7ud8g4P5JI3iQ8"
}
```

Or set it as an EAS Secret:
```bash
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value AIzaSy...
```

### 4. Test Geocoding is Working
After building v47, create a test event with a real San Diego address like:
"Balboa Park, San Diego, CA"

Then check Supabase → Table Editor → events → find the event and confirm
`latitude` and `longitude` are populated (should be ~32.73, -117.14).

Then open the Map tab — the pin should appear.

### 5. Existing Events Have No Coordinates
All events created before v47 will still have null lat/lng. To backfill:
Option A — Host edits and re-saves each event location (triggers re-geocode)
Option B — Run a one-time SQL + Geocoding API backfill script (ask if needed)

