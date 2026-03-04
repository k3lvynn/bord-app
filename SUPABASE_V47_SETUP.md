# Supabase Setup for v47

## ✅ Friend Requests — Already Done
The migration in `supabase/migrations/friends_notifications.sql` contains
everything needed. If you've already run it, you're good. Verify by checking
the Supabase dashboard → Table Editor for these tables:

- `friendships` (requester_id, addressee_id, status)
- `notifications` (user_id, actor_id, type, data, is_read)

If either table is missing, run the migration now:
1. Go to Supabase Dashboard → SQL Editor
2. Paste the full contents of `supabase/migrations/friends_notifications.sql`
3. Click Run

## ✅ RLS Policies — Check These Exist
Go to Authentication → Policies and confirm:

**friendships table:**
- "Users can view their own friendships" (SELECT)
- "Users can create friend requests" (INSERT, WITH CHECK: auth.uid() = requester_id)
- "Addressee can update status" (UPDATE)
- "Users can delete their own friendships" (DELETE)

**notifications table:**
- "Users can read their own notifications" (SELECT)
- "Authenticated users can create notifications" (INSERT, WITH CHECK: auth.uid() = actor_id)
- "Users can mark their own notifications read" (UPDATE)

## ⚠️ Why Friend Requests Were Failing
The INSERT policy on notifications requires `auth.uid() = actor_id`.
When a user sends a friend request, the app inserts a notification with
`actor_id: requesterId`. If the session wasn't fully restored yet
(the sign-out bug), `auth.uid()` returned null → RLS violation.

The v47 auth.tsx fix ensures the session is fully loaded before any
Supabase calls execute, so `auth.uid()` will always return the correct
user ID when `sendFriendRequest` runs.

## No Other Supabase Changes Needed for v47
All other features (map pins geocoding, compete filter, etc.) are
client-side fixes only.

