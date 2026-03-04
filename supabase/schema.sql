-- ═══════════════════════════════════════════════════════
-- BORD — Complete Database Schema v9
-- Run this in Supabase: Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════

-- ── PROFILES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name  TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  avatar_emoji  TEXT NOT NULL DEFAULT '⭐',
  bio           TEXT
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"        ON profiles FOR SELECT USING (true);
CREATE POLICY "Own profile update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── EVENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  host_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  location         TEXT NOT NULL,
  date             DATE NOT NULL,
  time             TIME NOT NULL,
  end_time         TIME,
  category         TEXT NOT NULL DEFAULT 'other',
  has_buy_in       BOOLEAN NOT NULL DEFAULT false,
  buy_in_amount    NUMERIC(10,2),
  cap              INTEGER NOT NULL DEFAULT 32,
  rsvp_count       INTEGER NOT NULL DEFAULT 0,
  waitlist_count   INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  slug             TEXT NOT NULL UNIQUE,
  recurrence       TEXT NOT NULL DEFAULT 'none',
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  is_tournament    BOOLEAN NOT NULL DEFAULT false,
  payout_structure TEXT,
  payout_details   TEXT
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active events" ON events FOR SELECT USING (is_active = true);
CREATE POLICY "Host full access"          ON events FOR ALL  USING (auth.uid() = host_id);

-- ── RSVPS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rsvps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT,
  status                TEXT NOT NULL DEFAULT 'confirmed'
                          CHECK (status IN ('confirmed','waitlisted','cancelled')),
  waitlist_position     INTEGER,
  cancellation_deadline TIMESTAMPTZ,
  notified_at           TIMESTAMPTZ
);
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host sees RSVPs"    ON rsvps FOR SELECT USING (
  event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
);
CREATE POLICY "Anyone can insert"  ON rsvps FOR INSERT WITH CHECK (true);
CREATE POLICY "Host can update"    ON rsvps FOR UPDATE USING (
  event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
);

-- ── BRACKET MATCHES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS bracket_matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL,
  match_index   INTEGER NOT NULL,
  player1_name  TEXT,
  player2_name  TEXT,
  winner_name   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','completed'))
);
ALTER TABLE bracket_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public bracket read" ON bracket_matches FOR SELECT USING (true);
CREATE POLICY "Host manages bracket" ON bracket_matches FOR ALL USING (
  event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
);
CREATE POLICY "Bracket insert"      ON bracket_matches FOR INSERT WITH CHECK (
  event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
);

-- ── PAYMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id                 UUID REFERENCES events(id) ON DELETE SET NULL,
  rsvp_id                  UUID REFERENCES rsvps(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents             INTEGER NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'usd',
  attendee_email           TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'succeeded',
  refunded                 BOOLEAN DEFAULT false,
  refunded_at              TIMESTAMPTZ
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host sees payments" ON payments FOR SELECT USING (
  event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
);

-- ── POSTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  caption      TEXT NOT NULL DEFAULT '',
  media_type   TEXT NOT NULL DEFAULT 'text' CHECK (media_type IN ('photo','video','text')),
  media_url    TEXT,
  like_count   INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public post read"   ON posts FOR SELECT USING (true);
CREATE POLICY "Author can post"    ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author can delete"  ON posts FOR DELETE USING (auth.uid() = author_id);

-- ── REALTIME ─────────────────────────────────────────────
-- Enable realtime for bracket updates (live bracket viewer)
ALTER PUBLICATION supabase_realtime ADD TABLE bracket_matches;

-- ── INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_host     ON events (host_id);
CREATE INDEX IF NOT EXISTS idx_events_date     ON events (date);
CREATE INDEX IF NOT EXISTS idx_events_slug     ON events (slug);
CREATE INDEX IF NOT EXISTS idx_events_coords   ON events (latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rsvps_event     ON rsvps (event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_email     ON rsvps (email);
CREATE INDEX IF NOT EXISTS idx_bracket_event   ON bracket_matches (event_id, round, match_index);
