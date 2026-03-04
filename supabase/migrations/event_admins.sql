-- ── Event Admins / Co-Hosts Migration ────────────────────────────────────────
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS event_admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  host_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- who appointed them
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- the admin
  role          text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'captain')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS event_admins_event_id_idx ON event_admins(event_id);
CREATE INDEX IF NOT EXISTS event_admins_user_id_idx  ON event_admins(user_id);

-- RLS
ALTER TABLE event_admins ENABLE ROW LEVEL SECURITY;

-- Anyone can read admins for a given event (needed for event detail page to check)
CREATE POLICY "event_admins_read" ON event_admins
  FOR SELECT USING (true);

-- Only the event host can insert/delete admins
CREATE POLICY "event_admins_insert" ON event_admins
  FOR INSERT WITH CHECK (
    host_id = auth.uid() AND
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND host_id = auth.uid())
  );

CREATE POLICY "event_admins_delete" ON event_admins
  FOR DELETE USING (
    host_id = auth.uid()
  );
