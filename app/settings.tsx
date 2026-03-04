// app/settings.tsx
// Settings page — preferences, notifications, legal links, data & privacy.
// Accessed from the Profile tab.

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, radius } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  getUserSettings, saveUserSettings, requestAccountDeletion,
  UserSettings, DEFAULT_SETTINGS,
} from '../lib/supabase';

export default function SettingsScreen() {
  const { user, profile, signOut } = useAuth();

  const [settings,       setSettings]       = useState<UserSettings>({ ...DEFAULT_SETTINGS });
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [showDeleteModal,setShowDeleteModal] = useState(false);
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [savingPrivacy,    setSavingPrivacy]    = useState(false);
  const [deleteLoading,  setDeleteLoading]  = useState(false);
  const [deleteSubmitted,setDeleteSubmitted] = useState(false);

  // Load settings + privacy on focus
  useFocusEffect(useCallback(() => {
    if (!user) return;
    getUserSettings(user.id)
      .then(s => setSettings(s))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Load private account flag
    supabase.from('profiles').select('is_private_account').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setIsPrivateAccount(data.is_private_account ?? false); });
  }, [user]));

  const togglePrivateAccount = async (value: boolean) => {
    setIsPrivateAccount(value);
    setSavingPrivacy(true);
    try {
      await supabase.from('profiles').update({ is_private_account: value }).eq('id', user!.id);
    } catch (e) {
      setIsPrivateAccount(!value); // revert
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Save a single setting immediately when toggled
  const updateSetting = async (key: keyof UserSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    if (!user) return;
    setSaving(true);
    try {
      await saveUserSettings(user.id, { [key]: value });
    } catch {
      // Revert on failure
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!user) return;
    setDeleteLoading(true);
    try {
      await requestAccountDeletion(user.id, user.email ?? '');
      setDeleteSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not submit request. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            {deleteSubmitted ? (
              <>
                <Text style={styles.deleteSuccessIcon}>✅</Text>
                <Text style={styles.deleteSuccessTitle}>Request Submitted</Text>
                <Text style={styles.deleteSuccessBody}>
                  Your data deletion request has been submitted. We will process it and
                  permanently delete your Bord account and all associated data as soon as
                  possible (typically within 30 days).
                </Text>
                <TouchableOpacity
                  style={styles.deleteCloseBtn}
                  onPress={() => {
                    setShowDeleteModal(false);
                    setDeleteSubmitted(false);
                    signOut().catch(() => {});
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deleteCloseBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.deleteWarningIcon}>⚠️</Text>
                <Text style={styles.deleteTitle}>Delete Your Account?</Text>
                <Text style={styles.deleteBody}>
                  You can request deletion of your Bord account and all related data,
                  including your profile, RSVPs, events, and activity history.
                  {'\n\n'}
                  This action is irreversible. Once processed, your data cannot be recovered.
                </Text>
                <View style={styles.deleteActions}>
                  <TouchableOpacity
                    style={styles.deleteCancelBtn}
                    onPress={() => setShowDeleteModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.deleteCancelText}>Keep My Account</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteConfirmBtn, deleteLoading && { opacity: 0.6 }]}
                    onPress={handleDeleteRequest}
                    disabled={deleteLoading}
                    activeOpacity={0.85}
                  >
                    {deleteLoading
                      ? <ActivityIndicator color={colors.white} size="small" />
                      : <Text style={styles.deleteConfirmText}>Request Deletion</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Profile & Account ─────────────────────────────────── */}
        <SectionHeader title="Profile & Account" />
        <View style={styles.card}>
          <SettingsRow
            icon="👤"
            label="View & Edit Profile"
            sub={`@${profile?.username ?? ''}`}
            onPress={() => router.push('/profile/edit')}
            showArrow
          />
          <RowDivider />
          <SettingsRow
            icon="✉️"
            label="Email"
            sub={user?.email ?? ''}
          />
        </View>

        {/* ── Preferences ───────────────────────────────────────── */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <View style={styles.modeRow}>
            <Text style={styles.modeLabel}>DEFAULT MODE</Text>
            <View style={styles.modePills}>
              {([
                { key: 'compete', label: '🏆 Compete' },
                { key: 'gather',  label: '🤝 Gather' },
                { key: 'both',    label: 'Both' },
              ] as const).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.modePill,
                    settings.preferred_mode === key && styles.modePillActive,
                  ]}
                  onPress={() => updateSetting('preferred_mode', key)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.modePillText,
                    settings.preferred_mode === key && styles.modePillTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <ToggleRow
            label="Event Reminders"
            sub="Reminded 1 hour before events you're attending"
            value={settings.notif_event_reminders}
            onChange={v => updateSetting('notif_event_reminders', v)}
          />
          <RowDivider />
          <ToggleRow
            label="New Events Nearby"
            sub="Get notified when events are posted in your area"
            value={settings.notif_new_nearby}
            onChange={v => updateSetting('notif_new_nearby', v)}
          />
          <RowDivider />
          <ToggleRow
            label="Host Announcements"
            sub="Updates from hosts of events you've joined"
            value={settings.notif_host_announcements}
            onChange={v => updateSetting('notif_host_announcements', v)}
          />
        </View>

        <SectionHeader title="Safety" />
        <View style={styles.card}>
          <ToggleRow
            label="Share Check-in Status"
            sub="Let people in your circles see when you check in"
            value={settings.share_checkin_status}
            onChange={v => updateSetting('share_checkin_status', v)}
          />
        </View>

        {/* ── Legal & Info ──────────────────────────────────────── */}
        <SectionHeader title="Legal & Info" />
        <View style={styles.card}>
          <SettingsRow icon="🎯" label="About Bord"       onPress={() => router.push('/legal/about')}   showArrow />
          <RowDivider />
          <SettingsRow icon="📄" label="Terms of Service" onPress={() => router.push('/legal/terms')}   showArrow />
          <RowDivider />
          <SettingsRow icon="🔒" label="Privacy Policy"   onPress={() => router.push('/legal/privacy')} showArrow />
        </View>

        {/* ── Account Privacy ────────────────────────────────────── */}
        <SectionHeader title="Account Privacy" />
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={styles.toggleLabel}>🔒  Private Account</Text>
              <Text style={styles.toggleSub}>
                When on, people must send a friend request to see your events and add you as a friend.
                When off, friend requests are auto-accepted.
              </Text>
            </View>
            <Switch
              value={isPrivateAccount}
              onValueChange={togglePrivateAccount}
              disabled={savingPrivacy}
              trackColor={{ false: colors.border, true: colors.orange }}
              thumbColor={isPrivateAccount ? '#fff' : '#aaa'}
            />
          </View>
        </View>

        {/* ── Data & Privacy ────────────────────────────────────── */}
        <SectionHeader title="Data & Privacy" />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.deleteRow}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.deleteRowIcon}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deleteRowLabel}>Request to Delete My Data</Text>
              <Text style={styles.deleteRowSub}>
                Permanently delete your Bord account and all associated data
              </Text>
            </View>
            <Text style={styles.deleteArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color={colors.orange} />
            <Text style={styles.savingText}>Saving…</Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

function RowDivider() {
  return <View style={styles.divider} />;
}

function SettingsRow({
  icon, label, sub, onPress, showArrow,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  showArrow?: boolean;
}) {
  const inner = (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel}>{label}</Text>
        {sub ? <Text style={styles.settingsSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {showArrow && <Text style={styles.rowArrow}>›</Text>}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{inner}</TouchableOpacity>;
  return inner;
}

function ToggleRow({
  label, sub, value, onChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel}>{label}</Text>
        <Text style={styles.settingsSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: 'rgba(249,115,22,0.5)' }}
        thumbColor={value ? colors.orange : colors.gray2}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 80 },

  sectionHeader: {
    fontSize: 10, fontWeight: '700', color: colors.gray2,
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginTop: spacing.lg, marginBottom: spacing.xs,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    marginBottom: spacing.xs,
  },

  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },

  settingsRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  settingsIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  settingsLabel:{ fontSize: 15, fontWeight: '600', color: colors.white },
  settingsSub:  { fontSize: 12, color: colors.gray2, marginTop: 2 },
  rowArrow:     { fontSize: 20, color: colors.gray2 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, padding: spacing.md,
  },

  // Mode picker inside Preferences card
  modeRow:  { padding: spacing.md, gap: 10 },
  modeLabel: {
    fontSize: 10, fontWeight: '700', color: colors.gray2,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  modePills: { flexDirection: 'row', gap: 8 },
  modePill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center',
  },
  modePillActive: { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.12)' },
  modePillText:   { fontSize: 13, fontWeight: '600', color: colors.gray1 },
  modePillTextActive: { color: colors.orange },

  // Delete row
  deleteRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, padding: spacing.md,
  },
  deleteRowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteRowLabel: { fontSize: 15, fontWeight: '600', color: colors.red },
  deleteRowSub:   { fontSize: 12, color: colors.gray2, marginTop: 2 },
  deleteArrow:    { fontSize: 20, color: colors.gray2 },

  // Saving indicator
  savingIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: spacing.sm,
  },
  savingText: { fontSize: 13, color: colors.gray2, fontWeight: '500' },

  // Delete account modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  deleteModal: {
    backgroundColor: colors.panel, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: colors.border,
    padding: spacing.lg, paddingBottom: 48,
    alignItems: 'center',
  },
  deleteWarningIcon:  { fontSize: 44, marginBottom: spacing.sm },
  deleteTitle:        { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: spacing.sm, textAlign: 'center' },
  deleteBody:         { fontSize: 14, color: colors.gray1, lineHeight: 22, textAlign: 'center', marginBottom: spacing.lg },
  deleteActions:      { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  deleteCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.card,
  },
  deleteCancelText:   { color: colors.gray1, fontWeight: '600', fontSize: 15 },
  deleteConfirmBtn: {
    flex: 1, backgroundColor: colors.red, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  deleteConfirmText:  { color: colors.white, fontWeight: '700', fontSize: 15 },

  deleteSuccessIcon:  { fontSize: 48, marginBottom: spacing.sm },
  deleteSuccessTitle: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: spacing.sm, textAlign: 'center' },
  deleteSuccessBody:  { fontSize: 14, color: colors.gray1, lineHeight: 22, textAlign: 'center', marginBottom: spacing.lg },
  deleteCloseBtn: {
    width: '100%', backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  deleteCloseBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
