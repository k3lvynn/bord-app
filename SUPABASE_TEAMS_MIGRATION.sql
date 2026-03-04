-- ─────────────────────────────────────────────────────────────────────────────
-- BORD FULL MIGRATION  (v3 — Teams + Gather features)
-- Safe to run fresh OR on top of v1/v2. Uses IF NOT EXISTS everywhere.
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- PART A — TEAMS (unchanged from v2, safe to re-run)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  logo_emoji    TEXT NOT NULL DEFAULT '🛡️',
  logo_url      TEXT,
  captain_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  captain_name  TEXT,
  max_size      INT  NOT NULL DEFAULT 10,
  prize_notes   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT NOT NULL,
  user_email  TEXT,
  positions   TEXT[] NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','rejected')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS prize_pool      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS prize_emoji     TEXT DEFAULT '🏆';
ALTER TABLE events ADD COLUMN IF NOT EXISTS teams_enabled   BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_team_size   INT DEFAULT 10;
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_self_team BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS teams_event_id_idx        ON teams(event_id);
CREATE INDEX IF NOT EXISTS team_members_team_id_idx  ON team_members(team_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx  ON team_members(user_id);
CREATE INDEX IF NOT EXISTS team_members_status_idx   ON team_members(status);

ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select"         ON teams;
DROP POLICY IF EXISTS "teams_insert"         ON teams;
DROP POLICY IF EXISTS "teams_update"         ON teams;
DROP POLICY IF EXISTS "teams_delete"         ON teams;
DROP POLICY IF EXISTS "team_members_select"  ON team_members;
DROP POLICY IF EXISTS "team_members_insert"  ON team_members;
DROP POLICY IF EXISTS "team_members_update"  ON team_members;
DROP POLICY IF EXISTS "team_members_delete"  ON team_members;

CREATE POLICY "teams_select"        ON teams        FOR SELECT USING (true);
CREATE POLICY "team_members_select" ON team_members FOR SELECT USING (true);
CREATE POLICY "teams_insert"        ON teams        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team_members_insert" ON team_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "teams_update"        ON teams        FOR UPDATE USING (captain_id = auth.uid());
CREATE POLICY "teams_delete"        ON teams        FOR DELETE USING (captain_id = auth.uid());
CREATE POLICY "team_members_update" ON team_members FOR UPDATE
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND teams.captain_id = auth.uid()
  ));
CREATE POLICY "team_members_delete" ON team_members FOR DELETE
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND teams.captain_id = auth.uid()
  ));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('team-assets','team-assets',true,5242880,
        ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "team_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "team_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "team_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "team_assets_delete" ON storage.objects;

CREATE POLICY "team_assets_select" ON storage.objects FOR SELECT USING (bucket_id = 'team-assets');
CREATE POLICY "team_assets_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'team-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "team_assets_update" ON storage.objects FOR UPDATE USING (bucket_id = 'team-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "team_assets_delete" ON storage.objects FOR DELETE USING (bucket_id = 'team-assets' AND auth.uid() IS NOT NULL);


-- ══════════════════════════════════════════════════════════════════════════════
-- PART B — GATHER FEATURES (new in v3)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── B1. Gather columns on events ─────────────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS vibe              TEXT DEFAULT 'social';
  -- values: chill | social | mindful | outdoorsy | creative
ALTER TABLE events ADD COLUMN IF NOT EXISTS interest_tags     TEXT[] DEFAULT '{}';
  -- e.g. {fitness, hiking, coffee, board-games, photography}
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_anonymous_rsvp BOOLEAN DEFAULT FALSE;
  -- hide attendee names until 24h before
ALTER TABLE events ADD COLUMN IF NOT EXISTS bring_options     TEXT[] DEFAULT '{}';
  -- e.g. {drinks, snacks, games, extras}
ALTER TABLE events ADD COLUMN IF NOT EXISTS meet_pin_lat      DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meet_pin_lng      DOUBLE PRECISION;
  -- host drops a precise "meet here" pin separate from venue
ALTER TABLE events ADD COLUMN IF NOT EXISTS template_type     TEXT;
  -- coffee | walk | game-night | sunset | gym | parents | study
ALTER TABLE events ADD COLUMN IF NOT EXISTS looking_for_tags  TEXT[] DEFAULT '{}';
  -- new-friends | activity-buddies | peaceful | game-group
ALTER TABLE events ADD COLUMN IF NOT EXISTS safety_score      INT DEFAULT 0;
  -- computed 0-100, updated by trigger or app logic
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_trusted_host   BOOLEAN DEFAULT FALSE;

-- ── B2. Event check-ins (attendee taps "I'm here") ───────────────────────────
CREATE TABLE IF NOT EXISTS event_checkins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name    TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS checkins_event_id_idx ON event_checkins(event_id);
CREATE INDEX IF NOT EXISTS checkins_user_id_idx  ON event_checkins(user_id);

ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checkins_select" ON event_checkins;
DROP POLICY IF EXISTS "checkins_insert" ON event_checkins;
CREATE POLICY "checkins_select" ON event_checkins FOR SELECT USING (true);
CREATE POLICY "checkins_insert" ON event_checkins FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── B3. RSVP contributions (bring something) ─────────────────────────────────
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS bringing TEXT;
  -- null | drinks | snacks | games | extras

-- ── B4. Event polls ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  options    TEXT[] NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS event_poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES event_polls(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_idx INT NOT NULL,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS polls_event_id_idx ON event_polls(event_id);

ALTER TABLE event_polls      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "polls_select"      ON event_polls;
DROP POLICY IF EXISTS "polls_insert"      ON event_polls;
DROP POLICY IF EXISTS "votes_select"      ON event_poll_votes;
DROP POLICY IF EXISTS "votes_insert"      ON event_poll_votes;
CREATE POLICY "polls_select" ON event_polls      FOR SELECT USING (true);
CREATE POLICY "polls_insert" ON event_polls      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "votes_select" ON event_poll_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON event_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── B5. Gather Circles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gather_circles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '⭕',
  description  TEXT,
  interest_tag TEXT,              -- primary tag this circle is about
  creator_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_count INT NOT NULL DEFAULT 1,
  is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circle_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id  UUID NOT NULL REFERENCES gather_circles(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS circles_interest_idx ON gather_circles(interest_tag);
CREATE INDEX IF NOT EXISTS circle_members_user_idx ON circle_members(user_id);

ALTER TABLE gather_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "circles_select" ON gather_circles;
DROP POLICY IF EXISTS "circles_insert" ON gather_circles;
DROP POLICY IF EXISTS "circles_update" ON gather_circles;
DROP POLICY IF EXISTS "cmembers_select" ON circle_members;
DROP POLICY IF EXISTS "cmembers_insert" ON circle_members;
DROP POLICY IF EXISTS "cmembers_delete" ON circle_members;
CREATE POLICY "circles_select"  ON gather_circles FOR SELECT USING (true);
CREATE POLICY "circles_insert"  ON gather_circles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "circles_update"  ON gather_circles FOR UPDATE USING (creator_id = auth.uid());
CREATE POLICY "cmembers_select" ON circle_members FOR SELECT USING (true);
CREATE POLICY "cmembers_insert" ON circle_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cmembers_delete" ON circle_members FOR DELETE USING (auth.uid() = user_id);

-- ── B6. Profile additions ─────────────────────────────────────────────────────
-- (profiles table must already exist — created by auth setup)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interest_tags   TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe            TEXT DEFAULT 'social';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for     TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_badges   TEXT[] DEFAULT '{}';
  -- e.g. {friendly, on-time, repeat-attender, helpful}
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reliability_attended INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reliability_total    INT DEFAULT 0;
  -- shown as "Attended X of Y events" — private reliability score

-- ── Done ─────────────────────────────────────────────────────────────────────
SELECT 'Migration v3 complete ✅' AS status;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART C — 5 DEFERRED FEATURES (v3.1 — appended, safe to re-run)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── C1. Running Late flag on RSVPs ───────────────────────────────────────────
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS is_running_late  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS running_late_at  TIMESTAMPTZ;
-- Host sees a 🕐 badge on the RSVP row in their management screen

-- ── C2. Host Thank-You Notes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thank_you_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS thank_you_notes_to_user_idx   ON thank_you_notes(to_user_id);
CREATE INDEX IF NOT EXISTS thank_you_notes_from_user_idx ON thank_you_notes(from_user_id);
CREATE INDEX IF NOT EXISTS thank_you_notes_event_idx     ON thank_you_notes(event_id);

ALTER TABLE thank_you_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes_select" ON thank_you_notes;
DROP POLICY IF EXISTS "notes_insert" ON thank_you_notes;
DROP POLICY IF EXISTS "notes_update" ON thank_you_notes;
CREATE POLICY "notes_select" ON thank_you_notes FOR SELECT
  USING (to_user_id = auth.uid() OR from_user_id = auth.uid());
CREATE POLICY "notes_insert" ON thank_you_notes FOR INSERT
  WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "notes_update" ON thank_you_notes FOR UPDATE
  USING (to_user_id = auth.uid());  -- only recipient can mark as read

-- ── C3. Emergency contact on profiles ────────────────────────────────────────
-- Stored so the "I'm safe" share can use it without the user typing it each time
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- ── Done ─────────────────────────────────────────────────────────────────────
SELECT 'Migration v3.1 (deferred features) complete ✅' AS status;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART D — Settings & Extended Profile (v3.2 — appended, safe to re-run)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Extended profile fields ────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_range          TEXT;
  -- values: under-18 | 18-24 | 25-34 | 35-44 | 45-54 | 55-plus
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_modes    TEXT[]  DEFAULT '{}';
  -- values: compete | gather (array)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter_handle     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS threads_handle     TEXT;

-- ── App settings per user ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_mode              TEXT NOT NULL DEFAULT 'both',
    -- values: compete | gather | both
  notif_event_reminders       BOOLEAN NOT NULL DEFAULT TRUE,
  notif_new_nearby            BOOLEAN NOT NULL DEFAULT TRUE,
  notif_host_announcements    BOOLEAN NOT NULL DEFAULT TRUE,
  share_checkin_status        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_owner" ON user_settings;
CREATE POLICY "settings_owner" ON user_settings
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Account deletion requests ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deletion_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'pending'
    -- values: pending | processing | completed
);

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deletion_insert" ON deletion_requests;
DROP POLICY IF EXISTS "deletion_select" ON deletion_requests;
CREATE POLICY "deletion_insert" ON deletion_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "deletion_select" ON deletion_requests FOR SELECT USING (user_id = auth.uid());

SELECT 'Migration v3.2 (settings + extended profile) complete ✅' AS status;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART E — Community Tags + Posts with Media (v3.3)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Community tag registry ───────────────────────────────────────────────────
-- Every tag ever used by any user lives here so others can discover and reuse.
CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,   -- lowercase, no spaces (e.g. 'san-diego-sunsets')
  use_count  INT  NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tags_name_idx ON tags(name);
CREATE INDEX IF NOT EXISTS tags_use_count_idx ON tags(use_count DESC);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_read"   ON tags;
DROP POLICY IF EXISTS "tags_insert" ON tags;
DROP POLICY IF EXISTS "tags_update" ON tags;
CREATE POLICY "tags_read"   ON tags FOR SELECT  USING (TRUE);
CREATE POLICY "tags_insert" ON tags FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tags_update" ON tags FOR UPDATE  USING (auth.uid() IS NOT NULL);

-- Seed the existing preset tags so they show up in search
INSERT INTO tags (name) VALUES
  ('fitness'),('hiking'),('board-games'),('coffee'),('photography'),('brunch'),
  ('music'),('cooking'),('reading'),('yoga'),('cycling'),('running'),('art'),('film'),
  ('gaming'),('plants'),('travel'),('volunteering'),('parenting'),('gym-buddy'),
  ('study'),('language'),('tech'),('entrepreneurship'),('pets'),
  ('basketball'),('flag-football'),('soccer'),('tennis'),('pickleball'),
  ('trivia'),('karaoke'),('poetry'),('comedy'),('dance'),('pottery'),
  ('rock-climbing'),('surfing'),('skateboarding'),('cooking-club'),('book-club')
ON CONFLICT (name) DO NOTHING;

-- ── Profile tags junction (replaces the TEXT[] column) ───────────────────────
-- We keep the TEXT[] column for quick reads but also write to this table.
-- For v1 simplicity we keep TEXT[]; this table is for future indexing.
CREATE TABLE IF NOT EXISTS profile_tags (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_name   TEXT NOT NULL,
  PRIMARY KEY (profile_id, tag_name)
);
ALTER TABLE profile_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_tags_owner" ON profile_tags;
DROP POLICY IF EXISTS "profile_tags_read"  ON profile_tags;
CREATE POLICY "profile_tags_owner" ON profile_tags
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "profile_tags_read" ON profile_tags FOR SELECT USING (TRUE);

-- ── Posts table (upgrade from stub) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  caption      TEXT,
  media_url    TEXT,              -- Supabase Storage URL
  media_type   TEXT NOT NULL DEFAULT 'photo',  -- photo | video | text
  hashtags     TEXT[] NOT NULL DEFAULT '{}',   -- extracted from caption
  like_count   INT  NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_author_idx  ON posts(author_id);
CREATE INDEX IF NOT EXISTS posts_event_idx   ON posts(event_id);
CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at DESC);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_read"   ON posts;
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_read"   ON posts FOR SELECT  USING (TRUE);
CREATE POLICY "posts_insert" ON posts FOR INSERT  WITH CHECK (author_id = auth.uid());
CREATE POLICY "posts_delete" ON posts FOR DELETE  USING (author_id = auth.uid());

-- ── Post tags junction ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_tags (
  post_id  UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  PRIMARY KEY (post_id, tag_name)
);
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_tags_read"   ON post_tags;
DROP POLICY IF EXISTS "post_tags_insert" ON post_tags;
CREATE POLICY "post_tags_read"   ON post_tags FOR SELECT USING (TRUE);
CREATE POLICY "post_tags_insert" ON post_tags FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

-- ── Post likes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_likes_owner" ON post_likes;
DROP POLICY IF EXISTS "post_likes_read"  ON post_likes;
CREATE POLICY "post_likes_read"  ON post_likes FOR SELECT  USING (TRUE);
CREATE POLICY "post_likes_owner" ON post_likes FOR ALL     USING (user_id = auth.uid());

SELECT 'Migration v3.3 (community tags + posts) complete ✅' AS status;
