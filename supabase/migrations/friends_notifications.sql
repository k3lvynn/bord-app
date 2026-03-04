-- ============================================================
-- Bord Friends + Notifications System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add private account flag to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_private_account boolean NOT NULL DEFAULT false;

-- 2. Friendships table
-- status: 'pending' | 'accepted' | 'rejected'
CREATE TABLE IF NOT EXISTS friendships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

-- 3. In-app notifications table
-- type: 'friend_request' | 'friend_accepted' | 'friend_auto_accepted'
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- recipient
  actor_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- who caused it
  type        text NOT NULL CHECK (type IN ('friend_request', 'friend_accepted', 'friend_auto_accepted')),
  data        jsonb,          -- optional extra payload
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- 4. RLS Policies

-- Friendships: users can see rows where they are requester or addressee
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can create friend requests"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee can update status"
  ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

CREATE POLICY "Users can delete their own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Notifications: only the recipient can read; any auth user can insert
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Users can mark their own notifications read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
