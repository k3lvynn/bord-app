// app/team/[id].tsx
// Team detail page.
// Captain: manage roster, accept/reject, assign positions, edit name/logo.
// Member: see team and assigned role.
// Visitor: request to join.

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, TextInput, Modal, FlatList, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../../lib/theme';
import {
  getTeamById, requestJoinTeam, updateMemberStatus, updateMemberPositions,
  removeMember, updateTeam, uploadTeamLogo, getPositionsForSport, TEAM_EMOJIS,
  Team, TeamMember,
} from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

// Show photo if available, else emoji
function TeamLogo({ team, size = 52 }: { team: Team; size?: number }) {
  if (team.logo_url) {
    return (
      <Image
        source={{ uri: team.logo_url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: 'rgba(249,115,22,0.12)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.55 }}>{team.logo_emoji}</Text>
    </View>
  );
}

export default function TeamDetail() {
  const { id, eventId, eventTitle, category } = useLocalSearchParams<{
    id: string; eventId: string; eventTitle: string; category: string;
  }>();
  const { user, profile } = useAuth();

  const [team,         setTeam]         = useState<Team | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [joining,      setJoining]      = useState(false);
  const [editModal,    setEditModal]    = useState(false);
  const [posModal,     setPosModal]     = useState<TeamMember | null>(null);

  // Edit state
  const [editName,       setEditName]       = useState('');
  const [editEmoji,      setEditEmoji]      = useState('');
  const [editPhotoUri,   setEditPhotoUri]   = useState<string | null>(null);
  const [editLogoMode,   setEditLogoMode]   = useState<'emoji' | 'photo'>('emoji');
  const [savingEdit,     setSavingEdit]     = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await getTeamById(id);
      setTeam(t);
      if (t) {
        setEditName(t.name);
        setEditEmoji(t.logo_emoji);
        setEditLogoMode(t.logo_url ? 'photo' : 'emoji');
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isCapt       = !!user && team?.captain_id === user.id;
  const members      = team?.members ?? [];
  const accepted     = members.filter(m => m.status === 'accepted');
  const pending      = members.filter(m => m.status === 'pending');
  const myMembership = user ? members.find(m => m.user_id === user.id) : null;
  const isMember     = !!myMembership && myMembership.status === 'accepted';
  const isPending    = !!myMembership && myMembership.status === 'pending';
  const positions    = getPositionsForSport(category ?? '');
  const isFull       = accepted.length >= (team?.max_size ?? 10);

  const handleJoin = async () => {
    if (!user) { Alert.alert('Sign in required', 'You need an account to join a team.'); return; }
    if (isFull) { Alert.alert('Team Full', 'This team has reached its max roster size.'); return; }
    setJoining(true);
    try {
      await requestJoinTeam({
        team_id:    id,
        user_id:    user.id,
        user_name:  profile?.display_name ?? profile?.username ?? 'Player',
        user_email: user.email ?? null,
      });
      Alert.alert('Request Sent! 📨', 'The team captain will review your request.');
      load();
    } catch (e: any) {
      if (e?.message === 'already_member') {
        Alert.alert('Already requested', 'You already have a pending or accepted request.');
      } else {
        Alert.alert('Error', e?.message ?? 'Could not send request.');
      }
    } finally { setJoining(false); }
  };

  const handleAccept = (member: TeamMember) => {
    Alert.alert(`Accept ${member.user_name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept ✓', onPress: async () => { await updateMemberStatus(member.id, 'accepted'); load(); } },
    ]);
  };

  const handleReject = (member: TeamMember) => {
    Alert.alert(`Reject ${member.user_name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => { await updateMemberStatus(member.id, 'rejected'); load(); } },
    ]);
  };

  const handleRemove = (member: TeamMember) => {
    Alert.alert(`Remove ${member.user_name}?`, 'They\'ll be removed from the roster.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeMember(member.id); load(); } },
    ]);
  };

  const pickEditPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload a team logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setEditPhotoUri(result.assets[0].uri);
      setEditLogoMode('photo');
    }
  };

  const takeEditPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setEditPhotoUri(result.assets[0].uri);
      setEditLogoMode('photo');
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      const updates: Parameters<typeof updateTeam>[1] = { name: editName.trim() };

      if (editLogoMode === 'photo' && editPhotoUri) {
        // Upload new photo
        const url = await uploadTeamLogo(id, editPhotoUri);
        updates.logo_url   = url;
        updates.logo_emoji = team?.logo_emoji ?? '🛡️';
      } else if (editLogoMode === 'emoji') {
        updates.logo_emoji = editEmoji;
        updates.logo_url   = null;  // clear any existing photo
      }

      await updateTeam(id, updates);
      setEditModal(false);
      setEditPhotoUri(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update team.');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 48 }}>🤷</Text>
          <Text style={styles.errorText}>Team not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Team Header */}
        <View style={styles.teamHeader}>
          <TeamLogo team={team} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.teamCaptain}>Captain: {team.captain_name ?? 'Unknown'}</Text>
            {eventTitle && <Text style={styles.teamEvent}>🏟️ {eventTitle}</Text>}
          </View>
          {isCapt && (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditModal(true)}>
              <Text style={styles.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Roster bar */}
        <View style={styles.rosterCard}>
          <View style={styles.rosterRow}>
            <Text style={styles.rosterLabel}>ROSTER</Text>
            <Text style={[styles.rosterCount, isFull && { color: colors.rose }]}>
              {accepted.length} / {team.max_size}
            </Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, {
              width: `${Math.min(100, (accepted.length / team.max_size) * 100)}%` as any,
              backgroundColor: isFull ? colors.rose : colors.orange,
            }]} />
          </View>
          {isFull && <Text style={styles.fullText}>Roster is full</Text>}
        </View>

        {/* My status */}
        {!isCapt && myMembership && (
          <View style={[styles.myStatusCard, {
            borderColor: isMember ? 'rgba(52,211,153,0.4)' : 'rgba(249,115,22,0.4)',
            backgroundColor: isMember ? 'rgba(52,211,153,0.07)' : 'rgba(249,115,22,0.07)',
          }]}>
            <Text style={[styles.myStatusTitle, { color: isMember ? colors.green : colors.orange }]}>
              {isMember ? '✅ You\'re on this team' : '⏳ Join request pending'}
            </Text>
            {isMember && myMembership.positions.length > 0 && (
              <Text style={styles.myPositions}>Positions: {myMembership.positions.join(', ')}</Text>
            )}
            {isMember && myMembership.positions.length === 0 && (
              <Text style={styles.myPositions}>Position not yet assigned by captain</Text>
            )}
            {isPending && (
              <Text style={styles.myStatusSub}>Waiting for the captain to review your request.</Text>
            )}
          </View>
        )}

        {/* Pending requests (captain only) */}
        {isCapt && pending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>JOIN REQUESTS</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pending.length}</Text>
              </View>
            </View>
            {pending.map(m => (
              <View key={m.id} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.user_name}</Text>
                  {m.user_email && <Text style={styles.memberEmail}>{m.user_email}</Text>}
                </View>
                <View style={styles.memberActions}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(m)}>
                    <Text style={styles.rejectBtnText}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(m)}>
                    <Text style={styles.acceptBtnText}>✓ Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Accepted roster */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ROSTER ({accepted.length})</Text>
          {accepted.length === 0 ? (
            <Text style={styles.emptyText}>No members yet. Share this team with your crew!</Text>
          ) : (
            accepted.map((m, idx) => (
              <View key={m.id} style={styles.rosterCard2}>
                <View style={styles.rosterNumBadge}>
                  <Text style={styles.rosterNum}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rosterNameRow}>
                    <Text style={styles.memberName}>{m.user_name}</Text>
                    {m.user_id === team.captain_id && (
                      <View style={styles.captBadge}>
                        <Text style={styles.captBadgeText}>⚔️ CAPTAIN</Text>
                      </View>
                    )}
                  </View>
                  {m.positions.length > 0 ? (
                    <View style={styles.posPillRow}>
                      {m.positions.map(p => (
                        <View key={p} style={styles.posPill}>
                          <Text style={styles.posPillText}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noPositionText}>No position assigned</Text>
                  )}
                </View>
                {isCapt && m.user_id !== user?.id && (
                  <View style={styles.captainActions}>
                    <TouchableOpacity style={styles.assignBtn} onPress={() => setPosModal(m)}>
                      <Text style={styles.assignBtnText}>📋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(m)}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* Join button */}
      {!isCapt && !myMembership && (
        <View style={styles.joinBar}>
          <TouchableOpacity
            style={[styles.joinBtn, (isFull || joining) && { opacity: 0.5 }]}
            onPress={handleJoin}
            disabled={isFull || joining}
            activeOpacity={0.85}
          >
            {joining
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.joinBtnText}>{isFull ? 'Team Full' : '🤝 Request to Join'}</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* ── Edit Team Modal ── */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalSheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Edit Team</Text>

            <Text style={styles.modalLabel}>TEAM NAME</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Team name"
              placeholderTextColor={colors.gray2}
              autoCapitalize="words"
            />

            <Text style={styles.modalLabel}>LOGO</Text>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, editLogoMode === 'photo' && styles.modeBtnActive]}
                onPress={() => setEditLogoMode('photo')}
                activeOpacity={0.8}
              >
                <Text style={styles.modeBtnEmoji}>📸</Text>
                <Text style={[styles.modeBtnText, editLogoMode === 'photo' && styles.modeBtnTextActive]}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, editLogoMode === 'emoji' && styles.modeBtnActive]}
                onPress={() => setEditLogoMode('emoji')}
                activeOpacity={0.8}
              >
                <Text style={styles.modeBtnEmoji}>😎</Text>
                <Text style={[styles.modeBtnText, editLogoMode === 'emoji' && styles.modeBtnTextActive]}>Emoji</Text>
              </TouchableOpacity>
            </View>

            {editLogoMode === 'photo' && (
              <View style={{ marginBottom: spacing.md }}>
                {(editPhotoUri || team.logo_url) ? (
                  <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                    <Image
                      source={{ uri: editPhotoUri ?? team.logo_url! }}
                      style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.orange }}
                    />
                  </View>
                ) : null}
                <View style={styles.photoButtonRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={pickEditPhoto} activeOpacity={0.8}>
                    <Text style={styles.photoBtnText}>📷 Library</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={takeEditPhoto} activeOpacity={0.8}>
                    <Text style={styles.photoBtnText}>📸 Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {editLogoMode === 'emoji' && (
              <FlatList
                data={TEAM_EMOJIS}
                numColumns={8}
                keyExtractor={item => item}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.emojiBtn, item === editEmoji && styles.emojiBtnActive]}
                    onPress={() => setEditEmoji(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiBtnText}>{item}</Text>
                  </TouchableOpacity>
                )}
                style={{ marginBottom: spacing.md }}
              />
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setEditModal(false); setEditPhotoUri(null); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, savingEdit && { opacity: 0.6 }]}
                disabled={savingEdit}
                onPress={handleSaveEdit}
              >
                {savingEdit
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.modalSaveText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Assign Positions Modal ── */}
      {posModal && (
        <PositionModal
          member={posModal}
          positions={positions}
          onClose={() => setPosModal(null)}
          onSave={async (pos) => {
            await updateMemberPositions(posModal.id, pos);
            setPosModal(null);
            load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function PositionModal({ member, positions, onClose, onSave }: {
  member: TeamMember;
  positions: string[];
  onClose: () => void;
  onSave: (positions: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(member.positions ?? []);
  const [saving,   setSaving]   = useState(false);

  const toggle = (pos: string) => {
    setSelected(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheetFixed}>
          <Text style={styles.modalTitle}>Assign Positions</Text>
          <Text style={styles.modalSub}>{member.user_name} · select all that apply</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {positions.map(pos => {
              const active = selected.includes(pos);
              return (
                <TouchableOpacity
                  key={pos}
                  style={[styles.posRow, active && styles.posRowActive]}
                  onPress={() => toggle(pos)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.posRowText, active && styles.posRowTextActive]}>{pos}</Text>
                  {active && <Text style={{ color: colors.orange, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSave, saving && { opacity: 0.6 }]}
              disabled={saving}
              onPress={async () => { setSaving(true); await onSave(selected); }}
            >
              {saving
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={styles.modalSaveText}>Save Positions</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.black },
  scroll:    { paddingHorizontal: spacing.md, paddingBottom: 120 },
  errorText: { fontSize: 20, fontWeight: '700', color: colors.white, marginTop: spacing.md },

  teamHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    paddingTop: spacing.lg, paddingBottom: spacing.lg,
  },
  teamName:    { fontSize: 24, fontWeight: '800', color: colors.white, marginBottom: 3 },
  teamCaptain: { fontSize: 13, color: colors.gray1, fontWeight: '500' },
  teamEvent:   { fontSize: 12, color: colors.gray2, marginTop: 2 },
  editBtn: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },

  rosterCard: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  rosterRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rosterLabel:{ fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 1 },
  rosterCount:{ fontSize: 13, fontWeight: '700', color: colors.orange },
  barBg:  { height: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' },
  barFill:{ height: '100%', borderRadius: 2 },
  fullText: { fontSize: 11, color: colors.rose, fontWeight: '600', marginTop: 5 },

  myStatusCard: {
    borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  myStatusTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  myStatusSub:   { fontSize: 12, color: colors.gray1, lineHeight: 18 },
  myPositions:   { fontSize: 12, color: colors.gray1, marginTop: 3 },

  section:        { marginBottom: spacing.lg },
  sectionHeaderRow:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle:   { fontSize: 11, fontWeight: '700', color: colors.gray2, letterSpacing: 1, textTransform: 'uppercase' },
  pendingBadge:   {
    backgroundColor: colors.orange, borderRadius: radius.full,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white },
  emptyText: { fontSize: 13, color: colors.gray2, fontStyle: 'italic', paddingVertical: spacing.sm },

  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)', padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm,
  },
  memberInfo:    { flex: 1 },
  memberName:    { fontSize: 15, fontWeight: '600', color: colors.white },
  memberEmail:   { fontSize: 11, color: colors.gray2, marginTop: 1 },
  memberActions: { flexDirection: 'row', gap: spacing.sm },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(244,63,94,0.15)',
    borderWidth: 1, borderColor: 'rgba(244,63,94,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  rejectBtnText: { color: colors.rose, fontWeight: '700', fontSize: 14 },
  acceptBtn: {
    paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },

  rosterCard2: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm,
  },
  rosterNumBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  rosterNum:    { fontSize: 12, fontWeight: '700', color: colors.orange },
  rosterNameRow:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  captBadge: {
    backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.35)',
    borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  captBadgeText: { fontSize: 9, fontWeight: '800', color: colors.orange, letterSpacing: 0.8 },
  posPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  posPill: {
    backgroundColor: 'rgba(155,142,196,0.15)', borderWidth: 1, borderColor: 'rgba(155,142,196,0.35)',
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  posPillText:    { fontSize: 11, color: colors.lavender, fontWeight: '600' },
  noPositionText: { fontSize: 11, color: colors.gray2, fontStyle: 'italic' },
  captainActions: { flexDirection: 'row', gap: 6 },
  assignBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  assignBtnText: { fontSize: 14 },
  removeBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(244,63,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: colors.rose, fontWeight: '700', fontSize: 12 },

  joinBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.black, borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, paddingBottom: spacing.xl,
  },
  joinBtn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  joinBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.panel, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg,
    maxHeight: '90%',
  },
  modalSheetFixed: {
    backgroundColor: colors.panel, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.white, marginBottom: spacing.md },
  modalSub:   { fontSize: 13, color: colors.gray1, marginBottom: spacing.md },
  modalLabel: {
    fontSize: 11, fontWeight: '700', color: colors.gray2, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6, marginTop: spacing.md,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.white, fontSize: 15, fontWeight: '600',
  },

  modeToggle:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12,
  },
  modeBtnActive:    { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.1)' },
  modeBtnEmoji:     { fontSize: 18 },
  modeBtnText:      { fontSize: 14, fontWeight: '600', color: colors.gray1 },
  modeBtnTextActive:{ color: colors.orange },

  photoButtonRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  photoBtn: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 13, alignItems: 'center',
  },
  photoBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },

  emojiBtn: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    margin: 3, borderRadius: radius.sm, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  emojiBtnActive: { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.15)' },
  emojiBtnText:   { fontSize: 20 },

  modalBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xl },
  modalCancel: {
    flex: 1, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  modalCancelText: { color: colors.gray1, fontWeight: '600' },
  modalSave: {
    flex: 2, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center',
    backgroundColor: colors.orange,
  },
  modalSaveText: { color: colors.white, fontWeight: '700' },

  posRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  posRowActive:     { backgroundColor: 'rgba(249,115,22,0.06)' },
  posRowText:       { fontSize: 15, color: colors.gray1, fontWeight: '500' },
  posRowTextActive: { color: colors.white, fontWeight: '600' },
});
