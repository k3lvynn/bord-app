// app/inbox/dm/[userId].tsx
// DM conversation thread between the current user and another user.

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, radius } from '../../../lib/theme';
import { getDMMessages, sendDM, markThreadRead, DirectMessage } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';

function timeStamp(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function DMConversation() {
  const { userId: otherId, name } = useLocalSearchParams<{ userId: string; name: string }>();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);

  const [messages,  setMessages]  = useState<DirectMessage[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [draft,     setDraft]     = useState('');

  const load = async () => {
    if (!user || !otherId) return;
    try {
      const msgs = await getDMMessages(user.id, otherId as string);
      setMessages(msgs);
      await markThreadRead(user.id, otherId as string).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user, otherId]);
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !user || !otherId) return;
    setDraft('');
    setSending(true);
    try {
      await sendDM(user.id, otherId as string, body);
      await load();
    } catch (e: any) {
      setDraft(body); // restore on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: DirectMessage; index: number }) => {
    const isMe = item.from_user_id === user?.id;
    const prevItem = messages[index - 1];
    const showTime = !prevItem ||
      new Date(item.created_at).getTime() - new Date(prevItem.created_at).getTime() > 5 * 60000;

    return (
      <View>
        {showTime && (
          <Text style={styles.timestamp}>{timeStamp(item.created_at)}</Text>
        )}
        <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.body}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.black }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerName} numberOfLines={1}>{name ?? 'Message'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.orange} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Say hello! This is the start of your conversation.</Text>
            </View>
          }
        />
      )}

      {/* Compose bar */}
      <View style={[styles.compose, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.composeInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={colors.gray2}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!draft.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.sendBtnText}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.black,
  },
  headerName:  { flex: 1, fontSize: 16, fontWeight: '700', color: colors.white, textAlign: 'center' },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: colors.orange, fontSize: 22 },

  list: { padding: spacing.md, gap: 2, flexGrow: 1 },

  timestamp: {
    textAlign: 'center', fontSize: 11, color: colors.gray2,
    marginVertical: spacing.sm,
  },

  bubbleRow:   { flexDirection: 'row', marginVertical: 2 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  bubbleMe: {
    backgroundColor: colors.orange, borderColor: colors.orange,
    borderBottomRightRadius: 4,
  },
  bubbleThem:   { borderBottomLeftRadius: 4 },
  bubbleText:   { fontSize: 15, color: colors.white, lineHeight: 21 },
  bubbleTextMe: { color: '#fff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.gray2, fontSize: 14, textAlign: 'center' },

  compose: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.black,
  },
  composeInput: {
    flex: 1, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    color: colors.white, fontSize: 15, maxHeight: 120, lineHeight: 21,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.gray3 },
  sendBtnText: { color: colors.white, fontSize: 20, fontWeight: '700', marginTop: -2 },
});
