// app/tournament/manage.tsx
// HOST-ONLY bracket management screen
// Access: host/event/[id] → "Manage Bracket" button (only shown if is_tournament=true)
import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { colors, spacing, radius} from '../../lib/theme';
import {
  supabase, getTournament, getTournamentTeams, getBracketMatches,
  updateMatchResult, upsertTournament, calcPayouts, PAYOUT_PRESETS,
  Tournament, TournamentTeam, BracketMatch,
} from '../../lib/supabase';

export default function ManageBracket() {
  const { eventId, eventTitle, prizePool: prizePoolParam } = useLocalSearchParams<{
    eventId: string; eventTitle: string; prizePool: string;
  }>();
  const prizePool = parseInt(prizePoolParam ?? '0') || 0;

  const [tournament, setTournament]   = useState<Tournament | null>(null);
  const [teams,      setTeams]        = useState<TournamentTeam[]>([]);
  const [matches,    setMatches]      = useState<BracketMatch[]>([]);
  const [loading,    setLoading]      = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeTab,  setActiveTab]    = useState<'bracket'|'teams'|'payouts'>('bracket');
  const [saving,     setSaving]       = useState(false);

  // Manual matchup picking
  const [manualMode,   setManualMode]   = useState(false);
  const [teamA,        setTeamA]        = useState<TournamentTeam | null>(null);
  const [teamB,        setTeamB]        = useState<TournamentTeam | null>(null);
  const [editingMatch, setEditingMatch] = useState<BracketMatch | null>(null);

  // Score entry state: matchId → { a: string, b: string }
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});

  const load = async () => {
    if (!eventId) return;
    try {
      const t = await getTournament(eventId);
      setTournament(t);
      if (t) {
        const [tm, mx] = await Promise.all([getTournamentTeams(t.id), getBracketMatches(t.id)]);
        setTeams(tm);
        setMatches(mx);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [eventId]));
  const onRefresh = () => { setRefreshing(true); load(); };

  // ── SEED TEAMS from confirmed RSVPs ──────────────────────────────────────
  const handleSeedTeams = async () => {
    if (!tournament) return;
    setSaving(true);
    try {
      // Get confirmed RSVPs for this event
      const { data: rsvps } = await supabase
        .from('rsvps')
        .select('id, name')
        .eq('event_id', eventId)
        .eq('status', 'confirmed');

      if (!rsvps || rsvps.length < 2) {
        Alert.alert('Not enough participants', 'You need at least 2 confirmed RSVPs to seed the bracket.');
        return;
      }

      // Delete existing teams
      await supabase.from('tournament_teams').delete().eq('tournament_id', tournament.id);

      // Group into teams based on team_size
      const size = tournament.team_size ?? 1;
      const teamEntries: { name: string; members: string[]; seed: number }[] = [];
      const shuffled = [...rsvps].sort(() => Math.random() - 0.5);

      for (let i = 0; i < shuffled.length; i += size) {
        const chunk = shuffled.slice(i, i + size);
        if (chunk.length < size && size > 1) break; // skip incomplete teams
        teamEntries.push({
          name:    size === 1 ? chunk[0].name : chunk.map(r=>r.name.split(' ')[0]).join(' & '),
          members: chunk.map(r => r.id),
          seed:    teamEntries.length + 1,
        });
      }

      // Insert teams
      const { data: insertedTeams, error: teamErr } = await supabase
        .from('tournament_teams')
        .insert(teamEntries.map(t => ({ ...t, tournament_id: tournament.id, eliminated: false })))
        .select();
      if (teamErr) throw teamErr;

      // Generate bracket matches
      await generateBracket(tournament, insertedTeams as TournamentTeam[]);

      // Update tournament status
      await upsertTournament({ event_id: eventId, status: 'seeded', id: tournament.id });
      await load();
      Alert.alert('✅ Bracket seeded!', `${teamEntries.length} teams seeded randomly. Review below.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const generateBracket = async (t: Tournament, seedTeams: TournamentTeam[]) => {
    // Single elimination bracket generation
    const n = seedTeams.length;
    const rounds = Math.ceil(Math.log2(n));
    const bracketSize = Math.pow(2, rounds);
    const byes = bracketSize - n;

    // First round matchups (1v8, 2v7, etc.)
    const matchInserts: any[] = [];
    let matchNum = 1;

    for (let i = 0; i < bracketSize / 2; i++) {
      const teamA = seedTeams[i] ?? null;
      const teamB = seedTeams[bracketSize - 1 - i] ?? null;
      const isBye = !teamA || !teamB;

      matchInserts.push({
        tournament_id: t.id,
        round: 1,
        match_number: matchNum++,
        team_a_id: teamA?.id ?? null,
        team_b_id: teamB?.id ?? null,
        status: isBye ? 'bye' : 'pending',
        winner_id: isBye ? (teamA?.id ?? teamB?.id ?? null) : null,
        is_loser_bracket: false,
      });
    }

    // Future rounds (TBD)
    for (let r = 2; r <= rounds; r++) {
      const matchesInRound = Math.pow(2, rounds - r);
      for (let i = 0; i < matchesInRound; i++) {
        matchInserts.push({
          tournament_id: t.id,
          round: r,
          match_number: matchNum++,
          team_a_id: null,
          team_b_id: null,
          status: 'pending',
          winner_id: null,
          is_loser_bracket: false,
        });
      }
    }

    await supabase.from('bracket_matches').delete().eq('tournament_id', t.id);
    await supabase.from('bracket_matches').insert(matchInserts);
    await upsertTournament({ event_id: eventId, id: t.id, rounds_total: rounds, current_round: 1 });
  };

  // ── START TOURNAMENT ──────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!tournament) return;
    Alert.alert('Start Tournament?', "This will start Round 1 and make the bracket public. You can't undo this.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', style: 'destructive', onPress: async () => {
        await upsertTournament({ event_id: eventId, id: tournament.id, status: 'in_progress', current_round: 1 });
        await load();
      }},
    ]);
  };

  // ── SUBMIT MATCH SCORE ────────────────────────────────────────────────────
  const handleSubmitScore = async (match: BracketMatch) => {
    const sc = scores[match.id];
    if (!sc?.a || !sc?.b) { Alert.alert('Enter both scores', 'Fill in scores for both teams before submitting.'); return; }
    const aScore = parseInt(sc.a);
    const bScore = parseInt(sc.b);
    if (isNaN(aScore) || isNaN(bScore)) { Alert.alert('Invalid scores', 'Scores must be numbers.'); return; }
    if (aScore === bScore) { Alert.alert('No ties', 'Scores must be different to determine a winner.'); return; }

    const winnerId = aScore > bScore ? match.team_a_id! : match.team_b_id!;
    const loserId  = aScore > bScore ? match.team_b_id  : match.team_a_id;

    setSaving(true);
    try {
      await updateMatchResult(match.id, aScore, bScore, winnerId);

      // Mark losing team as eliminated
      if (loserId) {
        await supabase.from('tournament_teams').update({ eliminated: true }).eq('id', loserId);
      }

      // Advance winner to next round if match has a next_match_id
      if (match.next_match_id) {
        const nextMatch = matches.find(m => m.id === match.next_match_id);
        if (nextMatch) {
          const updateField = !nextMatch.team_a_id ? 'team_a_id' : 'team_b_id';
          await supabase.from('bracket_matches').update({ [updateField]: winnerId }).eq('id', match.next_match_id);
        }
      }

      // Check if all matches in current round are done → advance round
      const currentRoundMatches = matches.filter(m => m.round === tournament!.current_round && !m.is_loser_bracket && m.id !== match.id);
      const allComplete = currentRoundMatches.every(m => m.status === 'completed' || m.status === 'bye');

      if (allComplete) {
        const nextRound = tournament!.current_round + 1;
        if (nextRound > tournament!.rounds_total) {
          // Tournament over
          await supabase.from('tournament_teams').update({ placement: 1 }).eq('id', winnerId);
          await upsertTournament({ event_id: eventId, id: tournament!.id, status: 'completed', winner_id: winnerId });
          Alert.alert('🏆 Tournament complete!', `${teams.find(t=>t.id===winnerId)?.name} wins!`);
        } else {
          await upsertTournament({ event_id: eventId, id: tournament!.id, current_round: nextRound });
          Alert.alert('✅ Round complete!', `Advancing to Round ${nextRound}.`);
        }
      }

      setScores(prev => { const n={...prev}; delete n[match.id]; return n; });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[styles.screen,{justifyContent:'center',alignItems:'center'}]}><ActivityIndicator color={colors.orange} size="large"/></View>;
  }

  const currentRoundMatches = matches.filter(m => m.round === (tournament?.current_round ?? 1) && !m.is_loser_bracket);
  const payouts = tournament?.payout_structure && prizePool > 0
    ? calcPayouts(prizePool, tournament.payout_structure, tournament.payout_splits)
    : [];

  return (
    <View style={styles.screen}>
      {/* Status + actions */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle} numberOfLines={1}>{eventTitle ?? 'Tournament'}</Text>
          <Text style={[styles.statusText, { color: tournament?.status === 'in_progress' ? colors.green : colors.orange }]}>
            {!tournament ? 'Not configured'
            : tournament.status === 'draft'       ? '⚙️ Draft — seed teams to start'
            : tournament.status === 'seeded'      ? '✅ Seeded — ready to start'
            : tournament.status === 'in_progress' ? `🔴 Round ${tournament.current_round}/${tournament.rounds_total} Live`
            : '🏆 Complete'}
          </Text>
        </View>
        {tournament?.status === 'seeded' && (
          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>▶ Start Tournament</Text>
          </TouchableOpacity>
        )}
        {(!tournament || tournament.status === 'draft') && (
          <View style={styles.seedOptions}>
            <Text style={styles.seedLabel}>SET UP BRACKET</Text>
            {/* Auto/random seeding */}
            <TouchableOpacity
              style={[styles.seedBtn, saving && {opacity:0.5}]}
              onPress={handleSeedTeams}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={colors.white} size="small"/>
                : <>
                    <Text style={styles.seedBtnIcon}>🎲</Text>
                    <View style={{flex:1}}>
                      <Text style={styles.seedBtnTitle}>Auto Seed (Random)</Text>
                      <Text style={styles.seedBtnSub}>Teams are randomly matched — fair draw</Text>
                    </View>
                  </>
              }
            </TouchableOpacity>
            {/* Manual matchup picking */}
            <TouchableOpacity
              style={[styles.seedBtn, styles.seedBtnManual]}
              onPress={() => setManualMode(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.seedBtnIcon}>🎯</Text>
              <View style={{flex:1}}>
                <Text style={styles.seedBtnTitle}>Manual Matchups</Text>
                <Text style={styles.seedBtnSub}>You choose which teams face each other</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── MANUAL MATCHUP PICKER ─────────────────────────────────── */}
        {manualMode && tournament && (
          <View style={styles.manualPicker}>
            <View style={styles.manualPickerHeader}>
              <Text style={styles.manualPickerTitle}>🎯 Manual Matchups</Text>
              <TouchableOpacity onPress={() => { setManualMode(false); setTeamA(null); setTeamB(null); }}>
                <Text style={styles.manualPickerClose}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.manualPickerSub}>
              Tap two teams to create a first-round matchup. Remaining teams get auto-seeded.
            </Text>

            {/* Team A selector */}
            <Text style={styles.manualPickerStep}>SELECT TEAM A</Text>
            <View style={styles.manualTeamGrid}>
              {teams.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.manualTeamChip,
                    teamA?.id === t.id && styles.manualTeamChipA,
                    teamB?.id === t.id && styles.manualTeamChipUsed,
                  ]}
                  onPress={() => {
                    if (teamB?.id === t.id) return;
                    setTeamA(prev => prev?.id === t.id ? null : t);
                  }}
                  disabled={teamB?.id === t.id}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manualTeamChipText} numberOfLines={1}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Team B selector */}
            {teamA && (
              <>
                <Text style={styles.manualPickerStep}>SELECT TEAM B (faces {teamA.name})</Text>
                <View style={styles.manualTeamGrid}>
                  {teams.filter(t => t.id !== teamA.id).map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.manualTeamChip,
                        teamB?.id === t.id && styles.manualTeamChipB,
                      ]}
                      onPress={() => setTeamB(prev => prev?.id === t.id ? null : t)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.manualTeamChipText} numberOfLines={1}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Confirm matchup */}
            {teamA && teamB && (
              <TouchableOpacity
                style={[styles.seedBtn, {marginTop:12}, saving && {opacity:0.5}]}
                onPress={async () => {
                  if (!tournament) return;
                  setSaving(true);
                  try {
                    // Insert this manual matchup as round 1
                    const existing = matches.filter(m => m.round === 1);
                    await supabase.from('bracket_matches').insert({
                      tournament_id: tournament.id,
                      round: 1,
                      match_number: existing.length + 1,
                      team_a_id: teamA.id,
                      team_b_id: teamB.id,
                      status: 'pending',
                      is_loser_bracket: false,
                    });
                    setTeamA(null); setTeamB(null);
                    await load();
                    Alert.alert('Matchup added!', `${teamA.name} vs ${teamB.name} set for Round 1.`);
                  } catch (e: any) {
                    Alert.alert('Error', e.message);
                  } finally { setSaving(false); }
                }}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.seedBtnTitle}>
                  ✅ Confirm: {teamA.name} vs {teamB.name}
                </Text>
              </TouchableOpacity>
            )}

            {/* Finalize — seal remaining teams with byes or auto-fill */}
            {matches.filter(m => m.round === 1).length > 0 && (
              <TouchableOpacity
                style={[styles.seedBtnManual, styles.seedBtn, {marginTop:8}]}
                onPress={async () => {
                  // Auto-fill any unmatched teams with byes, then mark seeded
                  const matchedIds = new Set(
                    matches.flatMap(m => [m.team_a_id, m.team_b_id]).filter(Boolean)
                  );
                  const unmatched = teams.filter(t => !matchedIds.has(t.id));
                  if (unmatched.length > 0) {
                    const byeInserts = unmatched.map((t, i) => ({
                      tournament_id: tournament.id,
                      round: 1,
                      match_number: matches.filter(m=>m.round===1).length + i + 1,
                      team_a_id: t.id,
                      team_b_id: null,
                      status: 'bye',
                      winner_id: t.id,
                      is_loser_bracket: false,
                    }));
                    await supabase.from('bracket_matches').insert(byeInserts);
                  }
                  await upsertTournament({ event_id: eventId, id: tournament.id, status: 'seeded' });
                  setManualMode(false);
                  await load();
                  Alert.alert('Bracket ready!', 'All matchups set. Tap Start when ready.');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.seedBtnTitle}>🏁 Finalize Bracket</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* View bracket button */}
      {tournament && tournament.status !== 'draft' && (
        <TouchableOpacity style={styles.viewBracketBtn}
          onPress={() => router.push({ pathname:'/tournament/bracket', params:{ eventId, eventTitle, prizePool: prizePool.toString() } })}
          activeOpacity={0.85}>
          <Text style={styles.viewBracketText}>👁 View Public Bracket →</Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['bracket','teams','payouts'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab===t && styles.tabActive]} onPress={()=>setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab===t && styles.tabTextActive]}>
              {t==='bracket'?'🏆 Bracket':t==='teams'?`👥 Teams (${teams.length})`:'💰 Payouts'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange}/>}>

        {/* ── BRACKET TAB ── */}
        {activeTab === 'bracket' && (
          <>
            {tournament?.status === 'in_progress' ? (
              <>
                <Text style={styles.sectionLabel}>ROUND {tournament.current_round} — ENTER RESULTS</Text>
                {currentRoundMatches.map(match => {
                  const teamA = teams.find(t=>t.id===match.team_a_id);
                  const teamB = teams.find(t=>t.id===match.team_b_id);
                  if (match.status === 'completed') return (
                    <View key={match.id} style={[styles.scoreCard, styles.scoreCardDone]}>
                      <Text style={styles.scoreCardLabel}>Match {match.match_number} · Complete</Text>
                      <Text style={styles.scoreCardResult}>
                        {teamA?.name} {match.team_a_score} — {match.team_b_score} {teamB?.name}
                      </Text>
                      <Text style={styles.scoreCardWinner}>🏆 {teams.find(t=>t.id===match.winner_id)?.name} advances</Text>
                    </View>
                  );
                  if (match.status === 'bye') return (
                    <View key={match.id} style={[styles.scoreCard, {opacity:0.5}]}>
                      <Text style={styles.scoreCardLabel}>Match {match.match_number} · BYE</Text>
                      <Text style={styles.scoreCardResult}>{teamA?.name ?? teamB?.name} advances automatically</Text>
                    </View>
                  );
                  return (
                    <View key={match.id} style={styles.scoreCard}>
                      <Text style={styles.scoreCardLabel}>Match {match.match_number}</Text>
                      <View style={styles.scoreRow}>
                        <Text style={styles.scoreTeamName} numberOfLines={1}>{teamA?.name ?? 'TBD'}</Text>
                        <TextInput
                          style={styles.scoreInput}
                          value={scores[match.id]?.a ?? ''}
                          onChangeText={v => setScores(p=>({...p,[match.id]:{...p[match.id],a:v}}))}
                          keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.gray2}
                          maxLength={3}/>
                        <Text style={styles.scoreDash}>—</Text>
                        <TextInput
                          style={styles.scoreInput}
                          value={scores[match.id]?.b ?? ''}
                          onChangeText={v => setScores(p=>({...p,[match.id]:{...p[match.id],b:v}}))}
                          keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.gray2}
                          maxLength={3}/>
                        <Text style={styles.scoreTeamName} numberOfLines={1}>{teamB?.name ?? 'TBD'}</Text>
                      </View>
                      <TouchableOpacity style={[styles.submitScoreBtn, saving&&{opacity:0.5}]}
                        onPress={()=>handleSubmitScore(match)} disabled={saving} activeOpacity={0.85}>
                        <Text style={styles.submitScoreBtnText}>Submit Result →</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={styles.emptyTitle}>
                  {!tournament ? 'No tournament set up' : tournament.status === 'seeded' ? 'Ready to start!' : 'Tournament complete'}
                </Text>
                <Text style={styles.emptySub}>
                  {!tournament ? 'This event was created without tournament mode.' : tournament.status === 'seeded' ? 'Tap "Start" above to begin Round 1.' : 'All rounds are finished.'}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── TEAMS TAB ── */}
        {activeTab === 'teams' && (
          <>
            {teams.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>👥</Text>
                <Text style={styles.emptyTitle}>No teams yet</Text>
                <Text style={styles.emptySub}>Tap "Seed Teams" to randomly assign participants into teams.</Text>
              </View>
            ) : (
              teams.map(team => (
                <View key={team.id} style={[styles.teamCard, team.eliminated && styles.teamCardEliminated]}>
                  <View style={styles.seedBubble}><Text style={styles.seedText}>#{team.seed}</Text></View>
                  <View style={{flex:1}}>
                    <Text style={[styles.teamName, team.eliminated && {textDecorationLine:'line-through',color:colors.gray2}]}>{team.name}</Text>
                    {team.placement && <Text style={styles.teamPlacement}>Finished: {team.placement === 1 ? '🥇 1st' : team.placement === 2 ? '🥈 2nd' : `${team.placement}th`}</Text>}
                  </View>
                  {team.eliminated && <Text style={styles.eliminatedBadge}>Eliminated</Text>}
                </View>
              ))
            )}
          </>
        )}

        {/* ── PAYOUTS TAB ── */}
        {activeTab === 'payouts' && (
          <>
            {!tournament?.payout_structure || prizePool === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>💰</Text>
                <Text style={styles.emptyTitle}>No payouts configured</Text>
                <Text style={styles.emptySub}>Enable Buy-In and Tournament when creating the event to set up payouts.</Text>
              </View>
            ) : (
              <>
                <View style={styles.payoutSummary}>
                  <Text style={styles.payoutSummaryTitle}>
                    {PAYOUT_PRESETS[tournament.payout_structure].emoji} {PAYOUT_PRESETS[tournament.payout_structure].label}
                  </Text>
                  <Text style={styles.payoutSummaryPool}>Total Prize Pool: ${prizePool.toLocaleString()}</Text>
                </View>
                {payouts.map((p, i) => (
                  <View key={i} style={styles.payoutRow}>
                    <Text style={styles.payoutPlace}>
                      {i===0?'🥇 1st':i===1?'🥈 2nd':i===2?'🥉 3rd':`🏅 ${i+1}th`}
                    </Text>
                    <View style={styles.payoutBar}>
                      <View style={[styles.payoutBarFill, {width:`${p.pct}%`}]}/>
                    </View>
                    <Text style={styles.payoutAmt}>${p.amount.toLocaleString()} <Text style={styles.payoutPct}>({p.pct}%)</Text></Text>
                  </View>
                ))}
                <Text style={styles.payoutNote}>
                  💡 Payouts are distributed manually by you after the tournament. Bord tracks who won — you handle the Stripe payouts.
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex:1, backgroundColor:colors.black },
  scroll:  { padding:spacing.md, paddingBottom:spacing.xxl },

  header:     { flexDirection:'row', alignItems:'center', padding:spacing.md, borderBottomWidth:1, borderBottomColor:colors.border, gap:spacing.sm },
  headerLeft: { flex:1 },
  headerTitle:{ fontSize:16, fontWeight:'700', color:colors.white },
  statusText: { fontSize:12, fontWeight:'600', marginTop:2 },
  startBtn:   { backgroundColor:colors.orange, borderRadius:radius.sm, paddingHorizontal:spacing.md, paddingVertical:9 },
  // Seed options
  seedOptions: { gap: 8, marginTop: 4 },
  seedLabel: { fontSize: 11, fontWeight: '800', color: '#A8A29E', letterSpacing: 1, marginBottom: 4 },
  seedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.orange, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  seedBtnManual: { backgroundColor: 'rgba(155,142,196,0.15)', borderWidth: 1, borderColor: 'rgba(155,142,196,0.3)' },
  seedBtnIcon: { fontSize: 22 },
  seedBtnTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  seedBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  // Manual matchup picker
  manualPicker: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2C2C2C',
    borderRadius: 14, padding: 14, marginTop: 12, gap: 10,
  },
  manualPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manualPickerTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  manualPickerClose: { fontSize: 13, color: '#A8A29E', fontWeight: '600' },
  manualPickerSub: { fontSize: 12, color: '#A8A29E', lineHeight: 18 },
  manualPickerStep: { fontSize: 11, fontWeight: '800', color: '#F97316', letterSpacing: 0.8, marginTop: 4 },
  manualTeamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  manualTeamChip: {
    backgroundColor: '#2C2C2C', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  manualTeamChipA: { backgroundColor: 'rgba(249,115,22,0.25)', borderWidth: 1, borderColor: '#F97316' },
  manualTeamChipB: { backgroundColor: 'rgba(155,142,196,0.25)', borderWidth: 1, borderColor: '#9B8EC4' },
  manualTeamChipUsed: { opacity: 0.3 },
  manualTeamChipText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  startBtnText:{ fontSize:13, fontWeight:'700', color:colors.white },

  viewBracketBtn: { margin:spacing.md, backgroundColor:'rgba(249,115,22,0.1)', borderWidth:1, borderColor:'rgba(249,115,22,0.3)', borderRadius:radius.sm, paddingVertical:10, alignItems:'center' },
  viewBracketText:{ fontSize:13, color:colors.orange, fontWeight:'700' },

  tabs:        { flexDirection:'row', borderBottomWidth:1, borderBottomColor:colors.border },
  tab:         { flex:1, paddingVertical:12, alignItems:'center' },
  tabActive:   { borderBottomWidth:2, borderBottomColor:colors.orange },
  tabText:     { fontSize:11, fontWeight:'600', color:colors.gray2 },
  tabTextActive:{ color:colors.orange, fontWeight:'700' },

  sectionLabel:{ fontSize:10, fontWeight:'700', color:colors.gray2, letterSpacing:1, marginBottom:spacing.sm },

  scoreCard:     { backgroundColor:colors.card, borderRadius:radius.md, borderWidth:1, borderColor:colors.border, padding:spacing.md, marginBottom:spacing.sm },
  scoreCardDone: { borderColor:colors.green, backgroundColor:'rgba(52,211,153,0.04)' },
  scoreCardLabel:{ fontSize:10, fontWeight:'700', color:colors.gray2, letterSpacing:0.8, marginBottom:spacing.sm },
  scoreCardResult:{ fontSize:14, fontWeight:'600', color:colors.white },
  scoreCardWinner:{ fontSize:12, color:colors.green, fontWeight:'600', marginTop:4 },
  scoreRow:      { flexDirection:'row', alignItems:'center', gap:spacing.sm, marginBottom:spacing.sm },
  scoreTeamName: { flex:1, fontSize:13, fontWeight:'700', color:colors.white },
  scoreInput:    { width:52, textAlign:'center', backgroundColor:'rgba(255,255,255,0.07)', borderWidth:1, borderColor:colors.border, borderRadius:radius.sm, paddingVertical:8, color:colors.white, fontSize:20, fontWeight:'800' },
  scoreDash:     { fontSize:16, color:colors.gray2, fontWeight:'700' },
  submitScoreBtn:{ backgroundColor:colors.orange, borderRadius:radius.sm, paddingVertical:10, alignItems:'center' },
  submitScoreBtnText:{ fontSize:14, fontWeight:'700', color:colors.white },

  emptyState: { alignItems:'center', paddingTop:60, paddingHorizontal:spacing.xl },
  emptyEmoji: { fontSize:44, marginBottom:spacing.md },
  emptyTitle: { fontSize:18, fontWeight:'700', color:colors.white, marginBottom:spacing.xs },
  emptySub:   { fontSize:13, color:colors.gray1, textAlign:'center', lineHeight:20 },

  teamCard:          { flexDirection:'row', alignItems:'center', gap:spacing.sm, backgroundColor:colors.card, borderRadius:radius.sm, borderWidth:1, borderColor:colors.border, padding:spacing.sm, marginBottom:8 },
  teamCardEliminated:{ opacity:0.5, borderColor:colors.border },
  seedBubble:        { width:32, height:32, borderRadius:16, backgroundColor:'rgba(249,115,22,0.12)', borderWidth:1, borderColor:'rgba(249,115,22,0.25)', alignItems:'center', justifyContent:'center' },
  seedText:          { fontSize:12, fontWeight:'700', color:colors.orange },
  teamName:          { fontSize:14, fontWeight:'700', color:colors.white },
  teamPlacement:     { fontSize:11, color:colors.green, fontWeight:'600', marginTop:2 },
  eliminatedBadge:   { fontSize:10, fontWeight:'700', color:colors.rose, borderWidth:1, borderColor:'rgba(244,63,94,0.25)', borderRadius:radius.sm, paddingHorizontal:6, paddingVertical:2 },

  payoutSummary:     { backgroundColor:'rgba(249,115,22,0.07)', borderRadius:radius.md, borderWidth:1, borderColor:'rgba(249,115,22,0.2)', padding:spacing.md, marginBottom:spacing.md },
  payoutSummaryTitle:{ fontSize:18, fontWeight:'700', color:colors.white, marginBottom:4 },
  payoutSummaryPool: { fontSize:14, color:colors.orange, fontWeight:'600' },
  payoutRow:         { flexDirection:'row', alignItems:'center', gap:spacing.sm, marginBottom:spacing.sm },
  payoutPlace:       { width:64, fontSize:13, fontWeight:'700', color:colors.white },
  payoutBar:         { flex:1, height:6, backgroundColor:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden' },
  payoutBarFill:     { height:'100%', backgroundColor:colors.orange, borderRadius:3 },
  payoutAmt:         { fontSize:14, fontWeight:'800', color:colors.white, minWidth:90, textAlign:'right' },
  payoutPct:         { fontSize:11, fontWeight:'400', color:colors.gray1 },
  payoutNote:        { fontSize:12, color:colors.gray2, lineHeight:18, marginTop:spacing.md, borderTopWidth:1, borderTopColor:colors.border, paddingTop:spacing.md },
});
