// app/(tabs)/posts.tsx
// Community photo feed — real posts with captions, #hashtag highlights,
// event links, image previews, and like buttons.

import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../lib/theme';
import { getPosts, getMyPostLikes, togglePostLike, Post } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

// ─── Hashtag renderer ────────────────────────────────────────────────────────
function RichCaption({ text }: { text: string }) {
  const parts = text.split(/(#[a-zA-Z0-9_-]+)/g);
  return (
    <Text style={styles.caption}>
      {parts.map((part, i) =>
        part.startsWith('#')
          ? <Text key={i} style={styles.captionTag}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

// ─── Tab component ───────────────────────────────────────────────────────────
export default function PostsTab() {
  const { user } = useAuth();
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [likedIds,   setLikedIds]   = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const likingRef = useRef<Set<string>>(new Set()); // debounce

  const load = async () => {
    try {
      const data = await getPosts({ limit: 40 });
      setPosts(data);
      if (user && data.length) {
        const liked = await getMyPostLikes(user.id, data.map(p => p.id));
        setLikedIds(new Set(liked));
      }
    } catch (e: any) {
      // Posts table may not exist yet — swallow gracefully
      if (!String(e?.message).includes('42P01')) console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleLike = async (post: Post) => {
    if (!user) { Alert.alert('Sign in to like posts'); return; }
    if (likingRef.current.has(post.id)) return;
    likingRef.current.add(post.id);

    const wasLiked = likedIds.has(post.id);
    // Optimistic update
    setLikedIds(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === post.id
        ? { ...p, like_count: wasLiked ? p.like_count - 1 : p.like_count + 1 }
        : p
    ));

    try {
      await togglePostLike(post.id, user.id, wasLiked);
    } catch {
      // Revert on failure
      setLikedIds(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(post.id) : next.delete(post.id);
        return next;
      });
      setPosts(prev => prev.map(p =>
        p.id === post.id
          ? { ...p, like_count: wasLiked ? p.like_count + 1 : p.like_count - 1 }
          : p
      ));
    } finally {
      likingRef.current.delete(post.id);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📸 Posts</Text>
        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => router.push('/post/create')}
          activeOpacity={0.85}
        >
          <Text style={styles.composeBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            liked={likedIds.has(item.id)}
            onLike={() => handleLike(item)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />
        }
        ListEmptyComponent={loading ? null : <PostsEmptyState />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Post Card ───────────────────────────────────────────────────────────────
function PostCard({ post, liked, onLike }: { post: Post; liked: boolean; onLike: () => void }) {
  return (
    <View style={styles.card}>

      {/* Media */}
      {post.media_url && (
        <Image
          source={{ uri: post.media_url }}
          style={styles.media}
          resizeMode="cover"
        />
      )}

      {/* Body */}
      <View style={styles.cardBody}>

        {/* Author row */}
        <View style={styles.authorRow}>
          <View style={styles.avatarBubble}>
            <Text style={styles.avatarEmoji}>{post.author_emoji ?? '⭐'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <Text style={styles.timeAgo}>{getTimeAgo(post.created_at)}</Text>
          </View>
          {post.event_title && (
            <View style={styles.eventTag}>
              <Text style={styles.eventTagText} numberOfLines={1}>📋 {post.event_title}</Text>
            </View>
          )}
        </View>

        {/* Caption with hashtag highlighting */}
        {post.caption && <RichCaption text={post.caption} />}

        {/* Hashtag chips (from extracted array, deduplicated) */}
        {post.hashtags && post.hashtags.length > 0 && (
          <View style={styles.tagRow}>
            {post.hashtags.slice(0, 6).map(tag => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>#{tag}</Text>
              </View>
            ))}
            {post.hashtags.length > 6 && (
              <View style={[styles.tagChip, { opacity: 0.6 }]}>
                <Text style={styles.tagChipText}>+{post.hashtags.length - 6}</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.likeBtn, liked && styles.likeBtnActive]}
            onPress={onLike}
            activeOpacity={0.7}
          >
            <Text style={styles.likeEmoji}>{liked ? '🤙' : '👋'}</Text>
            <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
              {post.like_count > 0 ? post.like_count : ''}
            </Text>
          </TouchableOpacity>
          {/* Comment count — read only for now */}
          {post.comment_count > 0 && (
            <View style={styles.commentCount}>
              <Text style={styles.commentCountText}>💬 {post.comment_count}</Text>
            </View>
          )}
        </View>

      </View>
    </View>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function PostsEmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>📸</Text>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySub}>
        Be the first to share a moment.{'\n'}
        Tap <Text style={{ color: colors.orange, fontWeight: '700' }}>+ Post</Text> to get started.
      </Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTimeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0)  return `${days}d ago`;
  if (hours > 0)  return `${hours}h ago`;
  if (mins  > 0)  return `${mins}m ago`;
  return 'just now';
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm,
  },
  headerTitle:    { fontSize: 22, fontWeight: '800', color: colors.white },
  composeBtn:     {
    backgroundColor: colors.orange, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  composeBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  list: { paddingHorizontal: spacing.md, paddingBottom: 24 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, marginBottom: spacing.sm,
    overflow: 'hidden', ...shadow.sm,
  },

  media: { width: '100%', height: 220 },

  cardBody:    { padding: spacing.md },
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  avatarBubble: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji:  { fontSize: 18 },
  authorName:   { fontSize: 14, fontWeight: '700', color: colors.white },
  timeAgo:      { fontSize: 11, color: colors.gray2, marginTop: 1 },
  eventTag: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 3, maxWidth: 130,
  },
  eventTagText: { fontSize: 10, color: colors.gray1, fontWeight: '600' },

  caption:    { fontSize: 14, color: colors.white, lineHeight: 21, marginBottom: spacing.sm },
  captionTag: { color: '#9B8EC4', fontWeight: '700' },

  tagRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: spacing.sm },
  tagChip:      {
    backgroundColor: 'rgba(155,142,196,0.08)', borderWidth: 1,
    borderColor: 'rgba(155,142,196,0.2)', borderRadius: radius.full,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  tagChipText:  { fontSize: 11, color: '#9B8EC4', fontWeight: '600' },

  actions:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 },
  likeBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  likeBtnActive:    { backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 8 },
  likeEmoji:        { fontSize: 18 },
  likeCount:        { fontSize: 14, color: colors.gray1, fontWeight: '600', minWidth: 16 },
  likeCountActive:  { color: colors.orange },
  commentCount:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentCountText: { fontSize: 13, color: colors.gray2, fontWeight: '500' },

  empty:       { alignItems: 'center', paddingTop: 100, paddingHorizontal: spacing.xl },
  emptyEmoji:  { fontSize: 52, marginBottom: spacing.md },
  emptyTitle:  { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: spacing.sm },
  emptySub:    { fontSize: 14, color: colors.gray1, textAlign: 'center', lineHeight: 22 },
});
