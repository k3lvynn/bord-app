// app/tournament/bracket.tsx
// PUBLIC live bracket viewer — anyone with the event slug can watch rounds live

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../lib/theme';
import {
  supabase,
  getTournament,
  getTournamentTeams,
  getBracketMatches,
  calcPayouts,
  PAYOUT_PRESETS,
  Tournament,
  TournamentTeam,
  BracketMatch,
} from '../../lib/supabase';

export default function BracketViewer() {
  const { eventId, eventTitle } = useLocalSearchParams<{ eventId: string; eventTitle: string }>();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRound, setActiveRound] = useState(1);

  const load = async () => {
    if (!eventId) return;
    try {
      const t = await getTournament(eventId);
      if (!t) {
        setLoading(false);
        return;
      }
      setTournament(t);
      setActiveRound(Math.max(1, t.current_round));
      const [tm, mx] = await Promise.all([
        getTournamentTeams(t.id),
        getBracketMatches(t.id),
      ]);
      setTeams(tm);
      setMatches(mx);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
      // Live updates — poll every 10s while viewing
      const interval = setInterval(load, 10000);
      return () => clearInterval(interval);
    }, [eventId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View
        style={[
          styles.screen,
          { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
        ]}
      >
        <Text style={{ fontSize: 44, marginBottom: spacing.md }}>🏆</Text>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: colors.white,
            marginBottom: spacing.sm,
          }}
        >
          Bracket not set up yet
        </Text>
        <Text style={{ fontSize: 14, color: colors.gray1, textAlign: 'center' }}>
          The host will seed teams and publish the bracket before the event starts.
        </Text>
      </View>
    );
  }

  const rounds = Array.from({ length: tournament.rounds_total }, (_, i) => i + 1);
  const roundMatches = matches.filter(
    (m) => m.round === activeRound && !m.is_loser_bracket
  );
  const loserRoundMatches = matches.filter(
    (m) => m.round === activeRound && m.is_loser_bracket
  );

  // Prize pool from event (passed as param or fallback to 0)
  const prizePool = 0; // can be updated when opened with prizePool param

  return (
    <View style={styles.screen}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                tournament.status === 'in_progress'
                  ? 'rgba(52,211,153,0.15)'
                  : 'rgba(249,115,22,0.1)',
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  tournament.status === 'in_progress' ? colors.green : colors.orange,
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              {
                color:
                  tournament.status === 'in_progress' ? colors.green : colors.orange,
              },
            ]}
          >
            {tournament.status === 'draft'
              ? 'Bracket not started'
              : tournament.status === 'seeded'
              ? 'Ready to start'
              : tournament.status === 'in_progress'
              ? `Round ${tournament.current_round} of ${tournament.rounds_total} · LIVE`
              : '🏆 Tournament Complete'}
          </Text>
        </View>
        {tournament.winner_id && (
          <Text style={styles.winnerLabel}>
            🥇 Winner:{' '}
            {teams.find((t) => t.id === tournament.winner_id)?.name ?? '—'}
          </Text>
        )}
      </View>

      {/* Format info */}
      <View style={styles.infoRow}>
        <InfoChip label="FORMAT" value={formatLabel(tournament.format)} />
        <InfoChip label="TEAMS" value={`${teams.length}`} />
        <InfoChip label="ROUNDS" value={`${tournament.rounds_total}`} />
        {tournament.payout_structure && (
          <InfoChip
            label="PAYOUT"
            value={PAYOUT_PRESETS[tournament.payout_structure].label}
          />
        )}
      </View>

      {/* Round tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.roundTabs}
      >
        {rounds.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.roundTab,
              activeRound === r && styles.roundTabActive,
            ]}
            onPress={() => setActiveRound(r)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.roundTabText,
                activeRound === r && styles.roundTabTextActive,
              ]}
            >
              {r === tournament.rounds_total ? 'Final' : `Round ${r}`}
            </Text>
            {r < tournament.current_round && (
              <Text style={styles.roundComplete}>✓</Text>
            )}
            {r === tournament.current_round &&
              tournament.status === 'in_progress' && <View style={styles.liveDot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bracket matches */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.orange}
          />
        }
      >
        {roundMatches.length === 0 ? (
          <View style={styles.emptyRound}>
            <Text style={styles.emptyRoundText}>
              Matches for this round haven't been set yet.
            </Text>
          </View>
        ) : (
          <>
            {loserRoundMatches.length > 0 && (
              <Text style={styles.bracketGroupLabel}>WINNERS BRACKET</Text>
            )}
            {roundMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                teams={teams}
                isCurrentRound={activeRound === tournament.current_round}
              />
            ))}
            {loserRoundMatches.length > 0 && (
              <>
                <Text
                  style={[
                    styles.bracketGroupLabel,
                    { color: colors.rose, marginTop: spacing.md },
                  ]}
                >
                  LOSERS BRACKET
                </Text>
                {loserRoundMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    teams={teams}
                    isCurrentRound={activeRound === tournament.current_round}
                    isLoser
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* Standings / results for completed rounds */}
        {tournament.status === 'completed' &&
          activeRound === tournament.rounds_total && (
            <Standings
              teams={teams}
              tournament={tournament}
              prizePool={prizePool}
            />
          )}
      </ScrollView>
    </View>
  );
}

// ── MATCH CARD ────────────────────────────────────────────────────────────────

function MatchCard({
  match,
  teams,
  isCurrentRound,
  isLoser = false,
}: {
  match: BracketMatch;
  teams: TournamentTeam[];
  isCurrentRound: boolean;
  isLoser?: boolean;
}) {
  const teamA = match.team_a ?? teams.find((t) => t.id === match.team_a_id) ?? null;
  const teamB = match.team_b ?? teams.find((t) => t.id === match.team_b_id) ?? null;
  const isCompleted = match.status === 'completed';
  const isBye = match.status === 'bye' || !teamA || !teamB;
  const accentColor = isLoser ? colors.rose : colors.orange;

  return (
    <View
      style={[
        styles.matchCard,
        isCurrentRound && !isCompleted && styles.matchCardLive,
        isBye && styles.matchCardBye,
      ]}
    >
      {isCurrentRound && !isCompleted && !isBye && (
        <View style={styles.liveTag}>
          <View style={[styles.liveDot, { marginRight: 4 }]} />
          <Text style={styles.liveTagText}>LIVE</Text>
        </View>
      )}
      <Text style={styles.matchLabel}>Match {match.match_number}</Text>

      {isBye && !teamA && !teamB ? (
        <Text style={styles.byeText}>TBD — waiting for previous round</Text>
      ) : (
        <>
          <TeamRow
            team={teamA}
            score={match.team_a_score}
            isWinner={isCompleted && match.winner_id === teamA?.id}
            isLoser={
              isCompleted &&
              match.winner_id !== null &&
              match.winner_id !== teamA?.id
            }
            accentColor={accentColor}
            seed={teamA?.seed}
          />
          <View style={styles.vsRow}>
            <View style={styles.vsDivider} />
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.vsDivider} />
          </View>
          <TeamRow
            team={teamB}
            score={match.team_b_score}
            isWinner={isCompleted && match.winner_id === teamB?.id}
            isLoser={
              isCompleted &&
              match.winner_id !== null &&
              match.winner_id !== teamB?.id
            }
            accentColor={accentColor}
            seed={teamB?.seed}
          />
        </>
      )}

      {isCompleted && match.winner_id && (
        <View style={styles.advancesRow}>
          <Text style={styles.advancesText}>
            ✓ {teams.find((t) => t.id === match.winner_id)?.name ?? 'Winner'} advances
          </Text>
        </View>
      )}
    </View>
  );
}

function TeamRow({
  team,
  score,
  isWinner,
  isLoser,
  accentColor,
  seed,
}: {
  team: TournamentTeam | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  accentColor: string;
  seed?: number;
}) {
  if (!team) {
    return (
      <View style={styles.teamRow}>
        <Text style={[styles.teamName, { color: colors.gray2 }]}>TBD</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.teamRow,
        isWinner && styles.teamRowWinner,
        isLoser && styles.teamRowLoser,
      ]}
    >
      {seed !== undefined && (
        <View style={styles.seedBubble}>
          <Text style={styles.seedText}>{seed}</Text>
        </View>
      )}
      <Text
        style={[
          styles.teamName,
          isWinner && { color: accentColor },
          isLoser && { color: colors.gray2, textDecorationLine: 'line-through' },
        ]}
        numberOfLines={1}
      >
        {team.name}
      </Text>
      {score !== null && (
        <Text
          style={[
            styles.scoreText,
            isWinner && { color: accentColor, fontWeight: '800' },
          ]}
        >
          {score}
        </Text>
      )}
      {isWinner && <Text style={styles.crownText}>🏆</Text>}
    </View>
  );
}

function Standings({
  teams,
  tournament,
  prizePool,
}: {
  teams: TournamentTeam[];
  tournament: Tournament;
  prizePool: number;
}) {
  const placed = [...teams]
    .filter((t) => t.placement)
    .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));

  const payouts =
    tournament.payout_structure && prizePool > 0
      ? calcPayouts(prizePool, tournament.payout_structure, tournament.payout_splits)
      : [];

  return (
    <View style={styles.standingsCard}>
      <Text style={styles.standingsTitle}>🏁 Final Standings</Text>
      {placed.map((t, i) => {
        const payout = payouts.find((p) => p.place === i + 1);
        return (
          <View key={t.id} style={styles.standingRow}>
            <Text style={styles.standingPlace}>
              {i === 0
                ? '🥇 1st'
                : i === 1
                ? '🥈 2nd'
                : i === 2
                ? '🥉 3rd'
                : `🏅 ${i + 1}th`}
            </Text>
            <Text style={styles.standingName} numberOfLines={1}>
              {t.name}
            </Text>
            {payout && (
              <Text style={styles.standingPrize}>
                ${payout.amount.toLocaleString()}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoChip}>
      <Text style={styles.infoChipLabel}>{label}</Text>
      <Text style={styles.infoChipValue}>{value}</Text>
    </View>
  );
}

function formatLabel(f: string) {
  return (
    {
      single_elimination: 'Single Elim',
      double_elimination: 'Double Elim',
      round_robin: 'Round Robin',
      swiss: 'Swiss',
    }[f] ?? f
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  statusBar: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  winnerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    marginTop: 2,
  },

  infoRow: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoChip: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    alignItems: 'center',
  },
  infoChipLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.gray2,
    letterSpacing: 1,
    marginBottom: 2,
  },
  infoChipValue: { fontSize: 13, fontWeight: '700', color: colors.white },

  roundTabs: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  roundTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roundTabActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  roundTabText: { fontSize: 12, fontWeight: '600', color: colors.gray1 },
  roundTabTextActive: { color: colors.white, fontWeight: '700' },
  roundComplete: { fontSize: 11, color: colors.green, fontWeight: '700' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },

  bracketGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray2,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },

  matchCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  matchCardLive: {
    borderColor: 'rgba(52,211,153,0.4)',
    backgroundColor: 'rgba(52,211,153,0.03)',
  },
  matchCardBye: { opacity: 0.6 },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.green,
    letterSpacing: 1,
  },
  matchLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray2,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  byeText: { fontSize: 13, color: colors.gray2, fontStyle: 'italic' },

  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  teamRowWinner: {
    backgroundColor: 'rgba(249,115,22,0.05)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },
  teamRowLoser: { opacity: 0.45 },
  seedBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seedText: { fontSize: 11, fontWeight: '700', color: colors.gray2 },
  teamName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.white },
  scoreText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    minWidth: 32,
    textAlign: 'center',
  },
  crownText: { fontSize: 16 },

  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  vsDivider: { flex: 1, height: 1, backgroundColor: colors.border },
  vsText: { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 1 },

  advancesRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  advancesText: { fontSize: 11, color: colors.green, fontWeight: '600' },

  emptyRound: { padding: spacing.xl, alignItems: 'center' },
  emptyRoundText: { fontSize: 14, color: colors.gray2, textAlign: 'center' },

  standingsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  standingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.md,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  standingPlace: { fontSize: 13, fontWeight: '700', color: colors.white, width: 56 },
  standingName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.white },
  standingPrize: { fontSize: 14, fontWeight: '800', color: colors.green },
});