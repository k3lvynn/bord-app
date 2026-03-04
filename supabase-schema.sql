-- ============================================================
-- BORD DATABASE SCHEMA v2
-- Run this entire file in Supabase SQL Editor
-- Project: supabase.com → your project → SQL Editor → New Query
-- ============================================================

-- PROFILES table (linked to Supabase Auth users)
CREATE TABLE profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  display_name     TEXT NOT NULL,
  username         TEXT NOT NULL UNIQUE,
  bio              TEXT,
  avatar_emoji     TEXT NOT NULL DEFAULT '⭐',
  location         TEXT,
  events_hosted    INTEGER NOT NULL DEFAULT 0,
  events_attended  INTEGER NOT NULL DEFAULT 0
);

-- Enforce lowercase usernames and no spaces
ALTER TABLE profiles ADD CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,30}$');

-- EVENTS table
CREATE TABLE events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  host_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  location        TEXT NOT NULL,
  date            DATE NOT NULL,
  time            TIME NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  has_buy_in      BOOLEAN NOT NULL DEFAULT false,
  buy_in_amount   NUMERIC(10,2),
  cap             INTEGER NOT NULL DEFAULT 32,
  rsvp_count      INTEGER NOT NULL DEFAULT 0,
  waitlist_count  INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  slug            TEXT NOT NULL UNIQUE,
  recurrence      TEXT NOT NULL DEFAULT 'none'   -- none | daily | weekly | biweekly | monthly
);

-- RSVPS table
CREATE TABLE rsvps (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  email                   TEXT NOT NULL,
  phone                   TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('confirmed','waitlisted','cancelled')),
  waitlist_position       INTEGER,
  cancellation_deadline   TIMESTAMPTZ,
  notified_at             TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_events_slug      ON events(slug);
CREATE INDEX idx_events_host      ON events(host_id);
CREATE INDEX idx_events_buy_in    ON events(has_buy_in, is_active, date);
CREATE INDEX idx_rsvps_event      ON rsvps(event_id);
CREATE INDEX idx_rsvps_email      ON rsvps(event_id, email);
CREATE INDEX idx_rsvps_status     ON rsvps(event_id, status);
CREATE INDEX idx_rsvps_waitlist   ON rsvps(event_id, waitlist_position) WHERE status = 'waitlisted';
CREATE INDEX idx_profiles_username ON profiles(username);

-- ============================================================
-- FUNCTION: reorder_waitlist
-- ============================================================
CREATE OR REPLACE FUNCTION reorder_waitlist(p_event_id UUID)
RETURNS void AS $$
BEGIN
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS new_pos
    FROM rsvps
    WHERE event_id = p_event_id AND status = 'waitlisted'
  )
  UPDATE rsvps r
  SET waitlist_position = o.new_pos
  FROM ordered o
  WHERE r.id = o.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: increment_events_hosted
-- Auto-increments the host's profile counter when they create an event
-- ============================================================
CREATE OR REPLACE FUNCTION increment_events_hosted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET events_hosted = events_hosted + 1 WHERE id = NEW.host_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_event_created
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION increment_events_hosted();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps    ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Public profiles are readable"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- EVENTS
CREATE POLICY "Public can read active events"
  ON events FOR SELECT
  USING (is_active = true);

CREATE POLICY "Host reads own events"
  ON events FOR SELECT
  USING (host_id = auth.uid());

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND host_id = auth.uid());

CREATE POLICY "Host can update own events"
  ON events FOR UPDATE
  USING (host_id = auth.uid());

CREATE POLICY "Host can delete own events"
  ON events FOR DELETE
  USING (host_id = auth.uid());

-- RSVPS
CREATE POLICY "Anyone can RSVP"
  ON rsvps FOR INSERT WITH CHECK (true);

CREATE POLICY "Host can read event RSVPs"
  ON rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = rsvps.event_id
        AND events.host_id = auth.uid()
    )
  );

CREATE POLICY "Public can read RSVPs"
  ON rsvps FOR SELECT USING (true);

CREATE POLICY "Anyone can update RSVP status"
  ON rsvps FOR UPDATE USING (true);

