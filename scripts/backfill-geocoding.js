#!/usr/bin/env node
/**
 * backfill-geocoding.js
 * Finds all events with null lat/lng and geocodes them via Google.
 *
 * Run from your project root:
 *   node scripts/backfill-geocoding.js
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_MAPS_API_KEY in .env
 * (Uses service key so RLS is bypassed — safe for a one-time admin script)
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL    = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY; // service role key, not anon
const GOOGLE_MAPS_KEY = 'AIzaSyBedJGG9UR-vbUZKa_8z7ud8g4P5JI3iQ8';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY in .env');
  console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

// ── Tiny fetch wrappers ───────────────────────────────────────────────────────

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function supabase(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  // New Supabase secret keys (sb_secret_...) use apikey header only.
  // Legacy keys (eyJ...) also need Authorization: Bearer.
  const isLegacy = SUPABASE_KEY.startsWith('eyJ');
  return fetchJson(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      ...(isLegacy ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
}

async function geocode(address) {
  const encoded = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_KEY}`;
  const { body } = await fetchJson(url);
  if (body.status === 'OK' && body.results.length > 0) {
    const loc = body.results[0].geometry.location;
    return { latitude: loc.lat, longitude: loc.lng, formatted: body.results[0].formatted_address };
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🗺️  Bord geocoding backfill\n');

  // Fetch events missing coordinates
  const { body: events, status } = await supabase(
    'events?select=id,title,location&latitude=is.null&limit=500',
  );

  if (status !== 200 || !Array.isArray(events)) {
    console.error('❌ Failed to fetch events:', events);
    process.exit(1);
  }

  if (events.length === 0) {
    console.log('✅ All events already have coordinates. Nothing to do.');
    return;
  }

  console.log(`Found ${events.length} events missing coordinates.\n`);

  let success = 0, failed = 0, skipped = 0;

  for (const event of events) {
    if (!event.location || event.location.trim() === '') {
      console.log(`  ⚠️  SKIP  "${event.title}" — no location text`);
      skipped++;
      continue;
    }

    process.stdout.write(`  📍 "${event.title}" (${event.location}) ... `);

    const geo = await geocode(event.location);

    if (!geo) {
      console.log('❌ not found');
      failed++;
      continue;
    }

    // Update the event
    const { status: updateStatus } = await supabase(
      `events?id=eq.${event.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: { latitude: geo.latitude, longitude: geo.longitude },
      }
    );

    if (updateStatus === 200 || updateStatus === 204) {
      console.log(`✅ ${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`);
      success++;
    } else {
      console.log(`❌ update failed (status ${updateStatus})`);
      failed++;
    }

    // Respect Google's rate limit — 50 req/s max, we use 5/s to be safe
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n── Results ──────────────────────────────────`);
  console.log(`  ✅ Geocoded:  ${success}`);
  console.log(`  ❌ Failed:    ${failed}`);
  console.log(`  ⚠️  Skipped:  ${skipped}`);
  console.log(`────────────────────────────────────────────`);

  if (failed > 0) {
    console.log('\n  Failed events likely have vague addresses ("Field 3", "TBD").');
    console.log('  Hosts can fix by editing the event location in the app.\n');
  } else {
    console.log('\n  🎉 All done! Open the map tab to see your pins.\n');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
