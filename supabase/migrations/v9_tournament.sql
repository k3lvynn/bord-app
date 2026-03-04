-- BORD v9 — Run this entire file in Supabase SQL Editor

-- 1. Add new columns to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS end_time          TIME,
  ADD COLUMN IF NOT EXISTS is_tournament     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bracket_format    TEXT,
  ADD COLUMN IF NOT EXISTS payout_structure  TEXT,
  ADD COLUMN IF NOT EXISTS payout_splits     INTEGER[],
  ADD COLUMN IF NOT EXISTS team_size         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS latitude          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude         DOUBLE PRECISION;

-- 2. Tournament teams first (no deps)
CREATE TABLE IF NOT EXISTS tournament_teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  tournament_id   UUID NOT NULL,
  name            TEXT NOT NULL,
  seed            INTEGER NOT NULL DEFAULT 0,
  members         TEXT[] NOT NULL DEFAULT '{}',
  eliminated      BOOLEAN NOT NULL DEFAULT false,
  placement       INTEGER
);

-- 3. Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id         UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  format           TEXT NOT NULL DEFAULT 'single_elimination',
  payout_structure TEXT,
  payout_splits    INTEGER[],
  team_size        INTEGER NOT NULL DEFAULT 1,
  seeding          TEXT NOT NULL DEFAULT 'random',
  status           TEXT NOT NULL DEFAULT 'draft',
  rounds_total     INTEGER NOT NULL DEFAULT 0,
  current_round    INTEGER NOT NULL DEFAULT 1,
  winner_id        UUID REFERENCES tournament_teams(id) ON DELETE SET NULL
);

-- 4. Add FK from teams to tournaments now that tournaments exists
ALTER TABLE tournament_teams
  ADD CONSTRAINT fk_teams_tournament
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;

-- 5. Bracket matches
CREATE TABLE IF NOT EXISTS bracket_matches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  tournament_id    UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round            INTEGER NOT NULL,
  match_number     INTEGER NOT NULL,
  team_a_id        UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  team_b_id        UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  team_a_score     INTEGER,
  team_b_score     INTEGER,
  winner_id        UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  next_match_id    UUID REFERENCES bracket_matches(id) ON DELETE SET NULL,
  is_loser_bracket BOOLEAN NOT NULL DEFAULT false
);

-- 6. Payments
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  rsvp_id                  UUID REFERENCES rsvps(id) ON DELETE SET NULL,
  event_id                 UUID REFERENCES events(id) ON DELETE SET NULL,
  attendee_email           TEXT NOT NULL,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents             INTEGER NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'usd',
  status                   TEXT NOT NULL DEFAULT 'succeeded',
  refunded                 BOOLEAN DEFAULT false,
  refunded_at              TIMESTAMPTZ
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_events_coords ON events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bracket_matches_tournament ON bracket_matches (tournament_id, round);

-- 8. RLS
ALTER TABLE tournaments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tournaments"  ON tournaments     FOR SELECT USING (true);
CREATE POLICY "Public read teams"        ON tournament_teams FOR SELECT USING (true);
CREATE POLICY "Public read matches"      ON bracket_matches  FOR SELECT USING (true);

CREATE POLICY "Host manage tournaments"  ON tournaments     FOR ALL
  USING (event_id IN (SELECT id FROM events WHERE host_id = auth.uid()));
CREATE POLICY "Host manage teams"        ON tournament_teams FOR ALL
  USING (tournament_id IN (SELECT t.id FROM tournaments t JOIN events e ON t.event_id=e.id WHERE e.host_id=auth.uid()));
CREATE POLICY "Host manage matches"      ON bracket_matches  FOR ALL
  USING (tournament_id IN (SELECT t.id FROM tournaments t JOIN events e ON t.event_id=e.id WHERE e.host_id=auth.uid()));
CREATE POLICY "Hosts view payments"      ON payments         FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE host_id=auth.uid()));

-- 9. Auto-create tournament row
CREATE OR REPLACE FUNCTION create_tournament_for_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_tournament = true AND (OLD IS NULL OR OLD.is_tournament = false) THEN
    INSERT INTO tournaments (event_id, format, payout_structure, payout_splits, team_size)
    VALUES (NEW.id, COALESCE(NEW.bracket_format,'single_elimination'), NEW.payout_structure, NEW.payout_splits, COALESCE(NEW.team_size,1))
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tournament_event ON events;
CREATE TRIGGER on_tournament_event
  AFTER INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION create_tournament_for_event();

-- v11: Add privacy field to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Index so public feed queries are fast
CREATE INDEX IF NOT EXISTS idx_events_public
  ON events (is_active, is_private, date)
  WHERE is_active = true AND is_private = false;
