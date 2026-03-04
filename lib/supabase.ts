// lib/supabase.ts
// Use targeted URL polyfill — avoids patching every global synchronously on startup.
// 'react-native-url-polyfill/auto' was causing ~2-3s startup delay.
import { setupURLPolyfill } from 'react-native-url-polyfill';
setupURLPolyfill();
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Fall back to a placeholder so createClient() never throws on startup.
// If the real vars are missing, all network calls will fail gracefully rather
// than crashing the app before it renders.
const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in eas.json env');
}

// Explicit adapter — passing AsyncStorage directly can lose method bindings on
// some iOS versions, causing getItem to silently return null on cold start which
// makes the app forget the session. This wrapper guarantees correct binding.
const authStorage = {
  getItem:    (key: string) => AsyncStorage.getItem(key),
  setItem:    (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,
    storage:            authStorage,
  },
});

// ─── Core Types ───────────────────────────────────────────────────────────────

export type Event = {
  id: string;
  created_at: string;
  host_id: string;
  title: string;
  description: string | null;
  location: string;
  date: string;
  time: string;
  end_time: string | null;
  category: string;
  has_buy_in: boolean;
  buy_in_amount: number | null;
  cap: number;
  rsvp_count: number;
  waitlist_count: number;
  is_active: boolean;
  slug: string;
  recurrence: string;
  latitude: number | null;
  longitude: number | null;
  is_private: boolean;
  is_tournament: boolean;
  bracket_format: string | null;
  payout_structure: string | null;
  payout_splits: number[] | null;
  team_size: number;
  // Teams feature
  prize_pool: string | null;
  prize_emoji: string | null;
  teams_enabled: boolean;
  max_team_size: number | null;
  allow_self_team: boolean;
  // Gather features
  vibe:              string | null;
  interest_tags:     string[];
  is_anonymous_rsvp: boolean;
  bring_options:     string[];
  meet_pin_lat:      number | null;
  meet_pin_lng:      number | null;
  template_type:     string | null;
  looking_for_tags:  string[];
  safety_score:      number;
  is_trusted_host:   boolean;
};

export type RSVP = {
  id: string;
  created_at: string;
  event_id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'confirmed' | 'waitlisted' | 'cancelled';
  waitlist_position: number | null;
  cancellation_deadline: string | null;
  notified_at: string | null;
  bringing: string | null;
  is_running_late: boolean;
  running_late_at: string | null;
  // Door check-in
  checked_in: boolean;
  checked_in_at: string | null;
};

// ─── Tournament Types ─────────────────────────────────────────────────────────

export type PayoutStructure =
  | 'winner_takes_all'
  | 'top_2'
  | 'top_3'
  | 'top_4'
  | 'bounty'
  | 'custom';

export type BracketFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'swiss';

export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'bye';

export type Tournament = {
  id: string;
  event_id: string;
  format: BracketFormat;
  payout_structure: PayoutStructure | null;
  payout_splits: number[] | null;
  team_size: number;
  seeding: 'random' | 'manual';
  status: 'draft' | 'seeded' | 'in_progress' | 'completed';
  rounds_total: number;
  current_round: number;
  winner_id: string | null;
  created_at: string;
};

export type TournamentTeam = {
  id: string;
  tournament_id: string;
  name: string;
  seed: number;
  members: string[];
  eliminated: boolean;
  placement: number | null;
  created_at: string;
};

export type BracketMatch = {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner_id: string | null;
  status: MatchStatus;
  next_match_id: string | null;
  is_loser_bracket: boolean;
  // joined
  team_a?: TournamentTeam | null;
  team_b?: TournamentTeam | null;
  winner?: TournamentTeam | null;
};

// ─── Team Types ───────────────────────────────────────────────────────────────

export type Team = {
  id: string;
  event_id: string;
  name: string;
  logo_emoji: string;
  logo_url: string | null;       // uploaded photo URL (takes priority over emoji)
  captain_id: string | null;
  captain_name: string | null;
  max_size: number;
  prize_notes: string | null;
  created_at: string;
  // joined
  members?: TeamMember[];
  member_count?: number;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  positions: string[];
  status: 'pending' | 'accepted' | 'rejected';
  joined_at: string;
};

// Sport-specific positions
export const SPORT_POSITIONS: Record<string, string[]> = {
  ultimate_frisbee: ['Handler', 'Cutter', 'Puller', 'Deep Cutter', 'Defender', 'Midfielder', 'Flex'],
  frisbee:          ['Handler', 'Cutter', 'Puller', 'Deep Cutter', 'Defender', 'Midfielder', 'Flex'],
  flag_football:    ['Quarterback', 'Wide Receiver', 'Running Back', 'Tight End', 'O-Line', 'D-Line', 'Linebacker', 'Cornerback', 'Safety', 'Returner'],
  basketball:       ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
  soccer:           ['Goalkeeper', 'Center Back', 'Left Back', 'Right Back', 'Defensive Mid', 'Central Mid', 'Attacking Mid', 'Left Wing', 'Right Wing', 'Striker'],
  volleyball:       ['Setter', 'Outside Hitter', 'Opposite Hitter', 'Middle Blocker', 'Libero', 'Defensive Specialist'],
  softball:         ['Pitcher', 'Catcher', '1st Base', '2nd Base', '3rd Base', 'Shortstop', 'Left Field', 'Center Field', 'Right Field'],
  pickleball:       ['Singles Player', 'Doubles Partner', 'Sub'],
  tennis:           ['Singles Player', 'Doubles Partner', 'Sub'],
  cornhole:         ['Partner A', 'Partner B', 'Sub'],
};

export function getPositionsForSport(category: string): string[] {
  return SPORT_POSITIONS[category?.toLowerCase()] ?? ['Player', 'Sub', 'Captain', 'Coach'];
}

export const TEAM_EMOJIS = [
  '🛡️','⚔️','🦅','🐺','🦁','🐯','🦊','🐻','🐉','🦂',
  '🌊','🔥','⚡','🌪️','💎','👑','💪','🎯','🏹','🚀',
  '🦋','🌟','❄️','🌙','☀️','🎭','🎪','🏴','⭐','🎖️',
];

// ─── Payout Presets ───────────────────────────────────────────────────────────

export const PAYOUT_PRESETS: Record<PayoutStructure, { label: string; emoji: string; desc: string; splits: number[] }> = {
  winner_takes_all: { label: 'Winner Takes All', emoji: '🥇', desc: '100% to 1st place',         splits: [100] },
  top_2:            { label: 'Top 2',            emoji: '🥈', desc: '70% / 30%',                   splits: [70, 30] },
  top_3:            { label: 'Top 3',            emoji: '🥉', desc: '50% / 30% / 20%',             splits: [50, 30, 20] },
  top_4:            { label: 'Top 4',            emoji: '🏅', desc: '45% / 25% / 20% / 10%',       splits: [45, 25, 20, 10] },
  bounty:           { label: 'Bounty',           emoji: '💀', desc: '$X per elimination + prize',   splits: [70, 30] },
  custom:           { label: 'Custom',           emoji: '✏️', desc: 'Define your own splits',       splits: [] },
};

export function calcPayouts(prizePool: number, structure: PayoutStructure, customSplits?: number[] | null): { place: number; pct: number; amount: number }[] {
  const s = structure === 'custom' ? (customSplits ?? []) : PAYOUT_PRESETS[structure].splits;
  return s.map((pct, i) => ({ place: i + 1, pct, amount: Math.floor((prizePool * pct) / 100) }));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function makeSlug(title: string): string {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'event'}-${Math.random().toString(36).slice(2, 6)}`;
}

export function formatDate(date: string): string {
  try {
    // Parse YYYY-MM-DD without timezone shift
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  } catch { return date; }
}


export function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    flag_football: '🏈',
    basketball:    '🏀',
    soccer:        '⚽',
    volleyball:    '🏐',
    softball:      '🥎',
    tennis:        '🎾',
    pickleball:    '🏓',
    golf:          '⛳',
    cornhole:      '🌽',
    dodgeball:     '🔴',
    kickball:      '👟',
    ultimate_frisbee: '🥏',
    frisbee:          '🥏',  // legacy key support
    sports:        '🏈',
    food:          '🍲',
    music:         '🎵',
    arts:          '🎨',
    games:         '🎲',
    film:          '🎬',
    fitness:       '🏃',
    social:        '🤝',
    other:         '⭐',
  };
  return map[cat?.toLowerCase()] ?? '⭐';
}

export function formatCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    flag_football: 'Flag Football',
    basketball:    'Basketball',
    soccer:        'Soccer',
    volleyball:    'Volleyball',
    softball:      'Softball',
    tennis:        'Tennis',
    pickleball:    'Pickleball',
    golf:          'Golf',
    cornhole:      'Cornhole',
    dodgeball:     'Dodgeball',
    kickball:      'Kickball',
    ultimate_frisbee: 'Ultimate Frisbee',
    frisbee:          'Frisbee',
  };
  return labels[cat?.toLowerCase()] ?? cat?.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()) ?? cat;
}
export function formatTime(time: string): string {
  try {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch { return time; }
}

// ─── Event Queries ────────────────────────────────────────────────────────────

const EVENT_SELECT = `
  id, created_at, host_id, title, description, location,
  date, time, end_time, category, has_buy_in, buy_in_amount,
  cap, rsvp_count, waitlist_count, is_active, slug, recurrence,
  latitude, longitude, is_private, is_tournament, bracket_format,
  payout_structure, payout_splits, team_size,
  prize_pool, prize_emoji, teams_enabled, max_team_size, allow_self_team
`;

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

export async function createEvent(fields: Record<string, any>): Promise<Event> {
  const payload = { ...fields };
  if (!payload.slug && payload.title) payload.slug = makeSlug(payload.title);
  if (!payload.slug) payload.slug = makeSlug('event');
  if (!payload.recurrence) payload.recurrence = 'none';
  if (payload.is_tournament === undefined) payload.is_tournament = false;

  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select(EVENT_SELECT)
    .single();
  if (error) throw error;
  return data as Event;
}

// ─── RSVP Queries ─────────────────────────────────────────────────────────────

export async function getEventRSVPs(eventId: string): Promise<RSVP[]> {
  const { data, error } = await supabase
    .from('rsvps')
    .select('id, created_at, event_id, name, email, phone, status, waitlist_position, cancellation_deadline, notified_at, bringing, is_running_late, running_late_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RSVP[];
}

export async function getMyRsvpForEvent(eventId: string, email: string): Promise<RSVP | null> {
  const { data } = await supabase
    .from('rsvps')
    .select('id, status, is_running_late, running_late_at, bringing')
    .eq('event_id', eventId)
    .eq('email', email.toLowerCase())
    .eq('status', 'confirmed')
    .maybeSingle();
  return data as RSVP | null;
}

export async function submitRSVP(
  eventId: string,
  data: { name: string; email: string; phone?: string | null }
): Promise<{ rsvp: RSVP; isConfirmed: boolean }> {
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('cap, rsvp_count, waitlist_count')
    .eq('id', eventId)
    .single();
  if (evErr || !event) throw new Error('Event not found');

  const { data: existing } = await supabase
    .from('rsvps')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('email', data.email)
    .maybeSingle();
  if (existing && existing.status !== 'cancelled') throw new Error('already_registered');

  const isConfirmed = event.rsvp_count < event.cap;
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + 72);

  let waitlistPosition: number | null = null;
  if (!isConfirmed) {
    const { count } = await supabase
      .from('rsvps').select('*', { count:'exact', head:true })
      .eq('event_id', eventId).eq('status', 'waitlisted');
    waitlistPosition = (count ?? 0) + 1;
  }

  const { data: rsvp, error: rsvpErr } = await supabase
    .from('rsvps')
    .insert({
      event_id: eventId,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      status: isConfirmed ? 'confirmed' : 'waitlisted',
      waitlist_position: waitlistPosition,
      cancellation_deadline: isConfirmed ? deadline.toISOString() : null,
    })
    .select()
    .single();
  if (rsvpErr) throw rsvpErr;

  if (isConfirmed) {
    await supabase.from('events').update({ rsvp_count: event.rsvp_count + 1 }).eq('id', eventId);
  } else {
    await supabase.from('events').update({ waitlist_count: event.waitlist_count + 1 }).eq('id', eventId);
  }

  return { rsvp: rsvp as RSVP, isConfirmed };
}

// ─── Tournament Queries ───────────────────────────────────────────────────────

export async function getTournament(eventId: string): Promise<Tournament | null> {
  const { data } = await supabase.from('tournaments').select('*').eq('event_id', eventId).maybeSingle();
  return data as Tournament | null;
}

export async function getTournamentTeams(tournamentId: string): Promise<TournamentTeam[]> {
  const { data } = await supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId).order('seed');
  return (data ?? []) as TournamentTeam[];
}

export async function getBracketMatches(tournamentId: string): Promise<BracketMatch[]> {
  const { data } = await supabase
    .from('bracket_matches')
    .select('*, team_a:tournament_teams!team_a_id(*), team_b:tournament_teams!team_b_id(*), winner:tournament_teams!winner_id(*)')
    .eq('tournament_id', tournamentId)
    .order('round')
    .order('match_number');
  return (data ?? []) as BracketMatch[];
}

export async function updateMatchResult(matchId: string, teamAScore: number, teamBScore: number, winnerId: string): Promise<void> {
  const { error } = await supabase
    .from('bracket_matches')
    .update({ team_a_score: teamAScore, team_b_score: teamBScore, winner_id: winnerId, status: 'completed' })
    .eq('id', matchId);
  if (error) throw error;
}

export async function upsertTournament(payload: Partial<Tournament> & { event_id: string }): Promise<Tournament> {
  const { data, error } = await supabase
    .from('tournaments')
    .upsert(payload, { onConflict: 'event_id' })
    .select()
    .single();
  if (error) throw error;
  return data as Tournament;
}

// ─── Team Queries ─────────────────────────────────────────────────────────────

export async function getEventTeams(eventId: string): Promise<Team[]> {
  const { data } = await supabase
    .from('teams')
    .select('*, members:team_members(*)')
    .eq('event_id', eventId)
    .order('created_at');
  return (data ?? []) as Team[];
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const { data } = await supabase
    .from('teams')
    .select('*, members:team_members(*)')
    .eq('id', teamId)
    .maybeSingle();
  return data as Team | null;
}

export async function createTeam(payload: {
  event_id: string;
  name: string;
  logo_emoji: string;
  logo_url?: string | null;
  captain_id: string;
  captain_name: string;
  max_size: number;
}): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Team;
}

export async function updateTeam(teamId: string, updates: Partial<Pick<Team, 'name' | 'logo_emoji' | 'logo_url'>>): Promise<void> {
  const { error } = await supabase.from('teams').update(updates).eq('id', teamId);
  if (error) throw error;
}

export async function requestJoinTeam(payload: {
  team_id: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
}): Promise<TeamMember> {
  // Check if already a member
  const { data: existing } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('team_id', payload.team_id)
    .eq('user_id', payload.user_id ?? '')
    .maybeSingle();
  if (existing) throw new Error('already_member');

  const { data, error } = await supabase
    .from('team_members')
    .insert({ ...payload, positions: [], status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data as TeamMember;
}

export async function updateMemberStatus(
  memberId: string,
  status: 'accepted' | 'rejected'
): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ status })
    .eq('id', memberId);
  if (error) throw error;
}

export async function updateMemberPositions(
  memberId: string,
  positions: string[]
): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ positions })
    .eq('id', memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function uploadTeamLogo(teamId: string, localUri: string): Promise<string> {
  // Convert local URI to blob
  const response = await fetch(localUri);
  const blob = await response.blob();
  const ext = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const path = `team-logos/${teamId}.${ext}`;

  const { error } = await supabase.storage
    .from('team-assets')
    .upload(path, blob, { upsert: true, contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });

  if (error) throw error;

  const { data } = supabase.storage.from('team-assets').getPublicUrl(path);
  return data.publicUrl;
}

export async function getMyTeamForEvent(eventId: string, userId: string): Promise<{ team: Team; member: TeamMember } | null> {
  const { data: membership } = await supabase
    .from('team_members')
    .select('*, team:teams!team_id(*)')
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) return null;

  // Check team belongs to this event
  const team = membership.team as Team;
  if (team?.event_id !== eventId) return null;

  return { team, member: membership as TeamMember };
}

// ─── Gather Types ─────────────────────────────────────────────────────────────

export type GatherVibe = 'chill' | 'social' | 'mindful' | 'outdoorsy' | 'creative';
export type LookingFor = 'new-friends' | 'activity-buddies' | 'peaceful' | 'game-group';

export const VIBES: { key: GatherVibe; label: string; emoji: string; color: string }[] = [
  { key: 'chill',     label: 'Chill',     emoji: '😌', color: '#7DD3FC' },
  { key: 'social',    label: 'Social',    emoji: '🥂', color: '#9B8EC4' },
  { key: 'mindful',   label: 'Mindful',   emoji: '🧘', color: '#34D399' },
  { key: 'outdoorsy', label: 'Outdoorsy', emoji: '🌿', color: '#86EFAC' },
  { key: 'creative',  label: 'Creative',  emoji: '🎨', color: '#F9A8D4' },
];

export const INTEREST_TAGS = [
  'fitness','hiking','board-games','coffee','photography','brunch',
  'music','cooking','reading','yoga','cycling','running','art','film',
  'gaming','plants','travel','volunteering','parenting','gym-buddy',
  'study','language','tech','entrepreneurship','pets',
];

export const LOOKING_FOR_OPTIONS: { key: LookingFor; label: string; emoji: string }[] = [
  { key: 'new-friends',       label: 'New friends',          emoji: '👫' },
  { key: 'activity-buddies',  label: 'Activity buddies',     emoji: '🏞️' },
  { key: 'peaceful',          label: 'Peaceful meetups',     emoji: '🧘' },
  { key: 'game-group',        label: 'Game night group',     emoji: '🎲' },
];

export const GATHER_TEMPLATES = [
  { key: 'coffee',   label: 'Coffee Hangout',      emoji: '☕', vibe: 'chill',     cap: 6,  tags: ['coffee'] },
  { key: 'walk',     label: 'Walk & Talk',          emoji: '🚶', vibe: 'outdoorsy', cap: 10, tags: ['fitness','hiking'] },
  { key: 'game',     label: 'Board Game Night',     emoji: '🎲', vibe: 'social',    cap: 8,  tags: ['board-games','gaming'] },
  { key: 'sunset',   label: 'Sunset Meetup',        emoji: '🌅', vibe: 'chill',     cap: 12, tags: ['photography'] },
  { key: 'gym',      label: 'Gym Partner Meetup',   emoji: '💪', vibe: 'social',    cap: 4,  tags: ['fitness','gym-buddy'] },
  { key: 'parents',  label: 'Young Parents Meetup', emoji: '👶', vibe: 'social',    cap: 10, tags: ['parenting'] },
  { key: 'study',    label: 'Study Session',        emoji: '📚', vibe: 'mindful',   cap: 6,  tags: ['study'] },
  { key: 'brunch',   label: 'Brunch Crew',          emoji: '🥞', vibe: 'social',    cap: 8,  tags: ['brunch','food'] },
  { key: 'yoga',     label: 'Outdoor Yoga',         emoji: '🧘', vibe: 'mindful',   cap: 12, tags: ['yoga','fitness'] },
  { key: 'art',      label: 'Art & Craft Night',    emoji: '🎨', vibe: 'creative',  cap: 8,  tags: ['art'] },
];

export const ICEBREAKERS = {
  starters: [
    "What's something you're really proud of but never brag about?",
    "If you could have dinner with anyone alive or dead, who and why?",
    "What's the best piece of advice you've ever received?",
    "What hobby do you wish you had more time for?",
    "What's one thing on your bucket list?",
    "If you woke up tomorrow with a new skill, what would you want it to be?",
    "What's your go-to comfort food and where's the best place to get it?",
    "What's a place you've been that everyone should visit?",
  ],
  teamGames: [
    "Two Truths & a Lie — everyone shares two true facts and one lie, group guesses",
    "Word Association — pick a word, everyone says the first word that comes to mind",
    "Would You Rather — take turns giving impossible choices",
    "Photo Scavenger Hunt — find something red, something old, something funny",
    "Group Emoji Story — build a story emoji by emoji around the circle",
  ],
  deepQuestions: [
    "What's something you believe that most people disagree with?",
    "What's the most important thing you've learned in the last year?",
    "What does a perfect day look like to you?",
    "What's something you're still figuring out?",
    "If you could change one thing about how you were raised, what would it be?",
  ],
};

export const BRING_OPTIONS = [
  { key: 'nothing',  label: 'Nothing',  emoji: '✌️' },
  { key: 'drinks',   label: 'Drinks',   emoji: '🥤' },
  { key: 'snacks',   label: 'Snacks',   emoji: '🍪' },
  { key: 'games',    label: 'Games',    emoji: '🎲' },
  { key: 'extras',   label: 'Extras',   emoji: '🧃' },
];

export type GatherCircle = {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  interest_tag: string | null;
  creator_id: string | null;
  member_count: number;
  is_public: boolean;
  created_at: string;
  is_member?: boolean;
};

export type EventCheckin = {
  id: string;
  event_id: string;
  user_id: string | null;
  user_name: string;
  checked_in_at: string;
};

export type EventPoll = {
  id: string;
  event_id: string;
  question: string;
  options: string[];
  created_by: string | null;
  created_at: string;
  closes_at: string | null;
  votes?: { option_idx: number; count: number }[];
  my_vote?: number | null;
};

// ─── Gather Queries ───────────────────────────────────────────────────────────

export async function getGatherEvents(filters?: {
  vibe?: string;
  tags?: string[];
  lookingFor?: string;
}): Promise<Event[]> {
  let q = supabase
    .from('events')
    .select('*')
    .eq('has_buy_in', false)
    .eq('is_active', true)
    .eq('is_private', false)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (filters?.vibe) q = q.eq('vibe', filters.vibe);
  if (filters?.tags?.length) q = q.overlaps('interest_tags', filters.tags);
  if (filters?.lookingFor) q = q.contains('looking_for_tags', [filters.lookingFor]);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ─── Recurring Event Helpers ──────────────────────────────────────────────────

/** Returns the next occurrence date string (YYYY-MM-DD) for a recurring event */
export function nextOccurrence(currentDate: string, recurrence: string): string | null {
  if (!currentDate || recurrence === 'none' || !recurrence) return null;
  const d = new Date(currentDate + 'T00:00:00');
  switch (recurrence) {
    case 'weekly':    d.setDate(d.getDate() + 7);  break;
    case 'biweekly':  d.setDate(d.getDate() + 14); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    default:          return null;
  }
  return d.toISOString().split('T')[0];
}

/**
 * Called on app launch — finds any recurring events whose date has passed
 * and rolls them forward to the next occurrence. Resets RSVPs for fresh signup.
 */
export async function advanceRecurringEvents(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data: stale } = await supabase
      .from('events')
      .select('id, date, recurrence, title')
      .neq('recurrence', 'none')
      .eq('is_active', true)
      .lt('date', today);

    if (!stale?.length) return;

    for (const ev of stale) {
      let nextDate = ev.date;
      // Keep advancing until we land in the future
      while (nextDate < today) {
        const n = nextOccurrence(nextDate, ev.recurrence);
        if (!n) break;
        nextDate = n;
      }
      if (nextDate === ev.date) continue;
      // Update date and reset RSVP count for the new occurrence
      await supabase.from('events').update({
        date: nextDate,
        rsvp_count: 0,
        waitlist_count: 0,
      }).eq('id', ev.id);
      // Clear old RSVPs so the new occurrence starts fresh
      await supabase.from('rsvps').delete().eq('event_id', ev.id);
    }
  } catch (e) {
    console.warn('advanceRecurringEvents error:', e);
  }
}


export async function checkInToEvent(eventId: string, userId: string, userName: string): Promise<void> {
  const { error } = await supabase
    .from('event_checkins')
    .upsert({ event_id: eventId, user_id: userId, user_name: userName },
             { onConflict: 'event_id,user_id' });
  if (error) throw error;
}

export async function getEventCheckins(eventId: string): Promise<EventCheckin[]> {
  const { data, error } = await supabase
    .from('event_checkins')
    .select('*')
    .eq('event_id', eventId)
    .order('checked_in_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getGatherCircles(userId?: string): Promise<GatherCircle[]> {
  const { data, error } = await supabase
    .from('gather_circles')
    .select('*, circle_members(user_id)')
    .eq('is_public', true)
    .order('member_count', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    ...c,
    is_member: userId ? c.circle_members?.some((m: any) => m.user_id === userId) : false,
    circle_members: undefined,
  }));
}

export async function joinCircle(circleId: string, userId: string): Promise<void> {
  await supabase.from('circle_members').insert({ circle_id: circleId, user_id: userId });
  await supabase.rpc('increment_circle_members', { cid: circleId });
}

export async function leaveCircle(circleId: string, userId: string): Promise<void> {
  await supabase.from('circle_members').delete()
    .eq('circle_id', circleId).eq('user_id', userId);
}

export async function createCircle(payload: {
  name: string; emoji: string; description?: string;
  interest_tag?: string; creator_id: string;
}): Promise<GatherCircle> {
  const { data, error } = await supabase
    .from('gather_circles')
    .insert({ ...payload, member_count: 1 })
    .select()
    .single();
  if (error) throw error;
  // Creator auto-joins
  await supabase.from('circle_members').insert({ circle_id: data.id, user_id: payload.creator_id });
  return data;
}

export async function getEventPolls(eventId: string, userId?: string): Promise<EventPoll[]> {
  const { data, error } = await supabase
    .from('event_polls')
    .select('*, event_poll_votes(option_idx, user_id)')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data ?? []).map((p: any) => {
    const votes = p.event_poll_votes ?? [];
    const counts = p.options.map((_: any, i: number) => ({
      option_idx: i,
      count: votes.filter((v: any) => v.option_idx === i).length,
    }));
    const myVote = userId
      ? (votes.find((v: any) => v.user_id === userId)?.option_idx ?? null)
      : null;
    return { ...p, votes: counts, my_vote: myVote, event_poll_votes: undefined };
  });
}

export async function voteOnPoll(pollId: string, userId: string, optionIdx: number): Promise<void> {
  const { error } = await supabase
    .from('event_poll_votes')
    .upsert({ poll_id: pollId, user_id: userId, option_idx: optionIdx }, { onConflict: 'poll_id,user_id' });
  if (error) throw error;
}

export async function createPoll(payload: {
  event_id: string; question: string; options: string[]; created_by: string; closes_at?: string;
}): Promise<EventPoll> {
  const { data, error } = await supabase.from('event_polls').insert(payload).select().single();
  if (error) throw error;
  return { ...data, votes: [], my_vote: null };
}

export async function updateRsvpBringing(rsvpId: string, bringing: string): Promise<void> {
  const { error } = await supabase.from('rsvps').update({ bringing }).eq('id', rsvpId);
  if (error) throw error;
}

// ─── Running Late ─────────────────────────────────────────────────────────────

export async function setRunningLate(rsvpId: string): Promise<void> {
  const { error } = await supabase
    .from('rsvps')
    .update({ is_running_late: true, running_late_at: new Date().toISOString() })
    .eq('id', rsvpId);
  if (error) throw error;
}

export async function clearRunningLate(rsvpId: string): Promise<void> {
  const { error } = await supabase
    .from('rsvps')
    .update({ is_running_late: false, running_late_at: null })
    .eq('id', rsvpId);
  if (error) throw error;
}

// ─── Ticket / Door Check-In ───────────────────────────────────────────────────

/** Look up an RSVP by its ticket_code (scanned from QR). */
export async function getRsvpByTicketCode(ticketCode: string): Promise<RSVP | null> {
  const { data, error } = await supabase
    .from('rsvps')
    .select('*')
    .eq('ticket_code', ticketCode)
    .maybeSingle();
  if (error) throw error;
  return data as RSVP | null;
}

/** Mark an RSVP as checked-in at the door. */
export async function markCheckedIn(rsvpId: string): Promise<void> {
  const { error } = await supabase
    .from('rsvps')
    .update({ checked_in: true, checked_in_at: new Date().toISOString() })
    .eq('id', rsvpId);
  if (error) throw error;
}

/** Get all RSVPs for an event (for the host scanner / door list). */
export async function getEventRsvpsForDoor(eventId: string): Promise<RSVP[]> {
  const { data, error } = await supabase
    .from('rsvps')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RSVP[];
}

// ─── Thank-You Notes ──────────────────────────────────────────────────────────

// ─── Event Admin Types ────────────────────────────────────────────────────────

export type AdminRole = 'admin' | 'captain';

export type EventAdmin = {
  id: string;
  event_id: string;
  host_id: string;
  user_id: string;
  role: AdminRole;
  created_at: string;
  // Joined
  profile?: {
    display_name: string;
    username: string;
    avatar_emoji: string;
    avatar_url?: string | null;
  };
};


export type ThankYouNote = {
  id: string;
  event_id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  // joined fields (when fetched with event + sender info)
  event_title?: string;
  from_display_name?: string;
  from_avatar_emoji?: string;
};

export async function getMyThankYouNotes(userId: string): Promise<ThankYouNote[]> {
  const { data, error } = await supabase
    .from('thank_you_notes')
    .select(`
      *,
      events!event_id(title),
      profiles!from_user_id(display_name, avatar_emoji)
    `)
    .eq('to_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((n: any) => ({
    ...n,
    event_title: n.events?.title,
    from_display_name: n.profiles?.display_name,
    from_avatar_emoji: n.profiles?.avatar_emoji,
    events: undefined,
    profiles: undefined,
  }));
}

export async function sendThankYouNote(payload: {
  event_id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase.from('thank_you_notes').insert(payload);
  if (error) throw error;
}

export async function markNoteRead(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('thank_you_notes')
    .update({ is_read: true })
    .eq('id', noteId);
  if (error) throw error;
}

// ─── Calendar Sync helper (returns structured data for expo-calendar) ─────────

export function eventToCalendarPayload(event: Event): {
  title: string;
  startDate: Date;
  endDate: Date;
  location: string;
  notes: string;
} {
  // Parse date + time into a Date — date is YYYY-MM-DD, time is HH:MM or HH:MM:SS
  const [year, month, day] = event.date.split('-').map(Number);
  const [hour, minute] = event.time.split(':').map(Number);
  const startDate = new Date(year, month - 1, day, hour, minute);

  // Default duration: 2 hours if no end_time
  let endDate: Date;
  if (event.end_time) {
    const [eh, em] = event.end_time.split(':').map(Number);
    endDate = new Date(year, month - 1, day, eh, em);
  } else {
    endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  }

  const notes = [
    event.description ?? '',
    event.has_buy_in ? `Buy-in: $${event.buy_in_amount}` : 'Free event',
    `Bord event — bordevents.com/events/${event.slug}`,
  ].filter(Boolean).join('\n\n');

  return { title: event.title, startDate, endDate, location: event.location, notes };
}

// ─── User Settings ─────────────────────────────────────────────────────────────

export type UserSettings = {
  preferred_mode: 'compete' | 'gather' | 'both';
  notif_event_reminders: boolean;
  notif_new_nearby: boolean;
  notif_host_announcements: boolean;
  share_checkin_status: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  preferred_mode: 'both',
  notif_event_reminders: true,
  notif_new_nearby: true,
  notif_host_announcements: true,
  share_checkin_status: false,
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ? (data as UserSettings) : { ...DEFAULT_SETTINGS };
}

export async function saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ─── Account Deletion ─────────────────────────────────────────────────────────

export async function requestAccountDeletion(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('deletion_requests')
    .insert({ user_id: userId, email });
  if (error) throw error;
}

// ─── Community Tags ────────────────────────────────────────────────────────────

export type Tag = { id: string; name: string; use_count: number };

// Search tags — returns up to 15 matches ordered by popularity
export async function searchTags(query: string): Promise<Tag[]> {
  if (!query.trim()) {
    // Return top tags when no query
    const { data } = await supabase
      .from('tags')
      .select('id, name, use_count')
      .order('use_count', { ascending: false })
      .limit(15);
    return (data ?? []) as Tag[];
  }
  const clean = query.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const { data } = await supabase
    .from('tags')
    .select('id, name, use_count')
    .ilike('name', `%${clean}%`)
    .order('use_count', { ascending: false })
    .limit(15);
  return (data ?? []) as Tag[];
}

// Ensure a tag exists — creates it if new, increments use_count if existing
export async function upsertTag(name: string): Promise<string> {
  const clean = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!clean) throw new Error('Invalid tag name');

  // Try insert first (idempotent)
  const { data: inserted } = await supabase
    .from('tags')
    .upsert({ name: clean }, { onConflict: 'name' })
    .select('id')
    .maybeSingle();

  if (inserted?.id) return inserted.id;

  // Fetch existing
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('name', clean)
    .maybeSingle();

  return existing?.id ?? '';
}

// Bump use_count for a set of tags (called when user saves tags or posts)
export async function incrementTagUsage(names: string[]): Promise<void> {
  if (!names.length) return;
  // Fire-and-forget RPC or manual update — increment each
  await Promise.allSettled(
    names.map(name =>
      supabase.rpc('increment_tag_use_count', { tag_name: name }).catch(() => {})
    )
  );
}

// ─── Posts ─────────────────────────────────────────────────────────────────────

export type Post = {
  id: string;
  created_at: string;
  author_id: string;
  event_id: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: 'photo' | 'video' | 'text';
  hashtags: string[];
  like_count: number;
  comment_count: number;
  // Joined
  author_name?: string;
  author_emoji?: string;
  event_title?: string;
  liked_by_me?: boolean;
};

export function parseHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_-]+)/g) ?? [];
  return [...new Set(matches.map(t => t.slice(1).toLowerCase()))];
}

export async function getPosts(options?: { eventId?: string; authorId?: string; limit?: number }): Promise<Post[]> {
  let q = supabase
    .from('posts')
    .select('*, profiles!author_id(display_name, avatar_emoji), events(title)')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 30);

  if (options?.eventId)  q = q.eq('event_id', options.eventId);
  if (options?.authorId) q = q.eq('author_id', options.authorId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    ...p,
    author_name:  p.profiles?.display_name ?? 'Someone',
    author_emoji: p.profiles?.avatar_emoji ?? '⭐',
    event_title:  p.events?.title ?? null,
    profiles: undefined,
    events: undefined,
  }));
}

export async function createPost(payload: {
  author_id: string;
  event_id?: string | null;
  caption: string;
  media_url?: string | null;
  media_type?: 'photo' | 'video' | 'text';
  hashtags: string[];
}): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id:  payload.author_id,
      event_id:   payload.event_id ?? null,
      caption:    payload.caption.trim() || null,
      media_url:  payload.media_url ?? null,
      media_type: payload.media_type ?? (payload.media_url ? 'photo' : 'text'),
      hashtags:   payload.hashtags,
    })
    .select()
    .single();
  if (error) throw error;

  // Write post_tags junction rows
  if (payload.hashtags.length) {
    await supabase.from('post_tags').insert(
      payload.hashtags.map(tag => ({ post_id: data.id, tag_name: tag }))
    ).then(() => {}).catch(() => {});

    // Upsert tags into the community registry
    await Promise.allSettled(payload.hashtags.map(t => upsertTag(t)));
  }

  return data as Post;
}

export async function togglePostLike(postId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    await supabase.from('posts').update({ like_count: supabase.rpc('decrement', { x: 1 }) as any }).eq('id', postId);
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    await supabase.from('posts').update({ like_count: supabase.rpc('increment', { x: 1 }) as any }).eq('id', postId);
  }
}

export async function getMyPostLikes(userId: string, postIds: string[]): Promise<string[]> {
  if (!postIds.length) return [];
  const { data } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  return (data ?? []).map((r: any) => r.post_id);
}

// ─── Ticket Verification (Door Entry) ────────────────────────────────────────
//
// Flow:
//   1. Host pulls up their event's "Door QR" — encodes bord://entry/{eventSlug}
//   2. Attendee opens Bord → taps "Scan to Enter" → camera opens
//   3. Attendee scans the host's QR at the door
//   4. App calls verifyMyTicketForEvent(eventSlug, userId)
//   5. Shows "Ticket Confirmed!" or error state

export type TicketVerifyResult =
  | { status: 'confirmed';  rsvp: RSVP;       event: Event }
  | { status: 'waitlisted'; rsvp: RSVP;       event: Event }
  | { status: 'not_found';  rsvp: null;        event: Event | null }
  | { status: 'free_event'; rsvp: RSVP | null; event: Event };

export async function verifyMyTicketForEvent(
  eventSlug: string,
  userId: string,
): Promise<TicketVerifyResult> {
  // 1. Load the event
  const event = await getEventBySlug(eventSlug);
  if (!event) return { status: 'not_found', rsvp: null, event: null };

  // 2. Look up the RSVP by user_id on the rsvp row
  const { data: rsvp } = await supabase
    .from('rsvps')
    .select('*')
    .eq('event_id', event.id)
    .eq('user_id', userId)
    .maybeSingle();

  // 3. Free event — confirm they RSVPd (or just let them in)
  if (!event.has_buy_in) {
    return { status: 'free_event', rsvp: rsvp as RSVP | null, event };
  }

  if (!rsvp) return { status: 'not_found', rsvp: null, event };
  if ((rsvp as RSVP).status === 'waitlisted') {
    return { status: 'waitlisted', rsvp: rsvp as RSVP, event };
  }
  return { status: 'confirmed', rsvp: rsvp as RSVP, event };
}

// ─── Direct Messages ──────────────────────────────────────────────────────────

export type DirectMessage = {
  id: string;
  created_at: string;
  from_user_id: string;
  to_user_id: string;
  body: string;
  is_read: boolean;
  // joined via view
  from_display_name?: string;
  from_username?: string;
  from_avatar_emoji?: string;
  to_display_name?: string;
  to_username?: string;
};

export type DMThread = {
  other_user_id: string;
  other_display_name: string;
  other_username: string;
  other_avatar_emoji: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

/** Get all DM threads for the current user, newest first. */
export async function getDMThreads(userId: string): Promise<DMThread[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select(`
      id, created_at, from_user_id, to_user_id, body, is_read,
      from_profile:profiles!direct_messages_from_user_id_fkey(display_name, username, avatar_emoji),
      to_profile:profiles!direct_messages_to_user_id_fkey(display_name, username, avatar_emoji)
    `)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  // Collapse into threads keyed by the other person
  const threads = new Map<string, DMThread>();
  for (const msg of (data ?? []) as any[]) {
    const isFromMe = msg.from_user_id === userId;
    const otherId  = isFromMe ? msg.to_user_id   : msg.from_user_id;
    const otherP   = isFromMe ? msg.to_profile   : msg.from_profile;
    if (!threads.has(otherId)) {
      threads.set(otherId, {
        other_user_id:       otherId,
        other_display_name:  otherP?.display_name ?? 'Unknown',
        other_username:      otherP?.username     ?? '',
        other_avatar_emoji:  otherP?.avatar_emoji ?? '👤',
        last_message:        msg.body,
        last_message_at:     msg.created_at,
        unread_count:        (!isFromMe && !msg.is_read) ? 1 : 0,
      });
    } else if (!isFromMe && !msg.is_read) {
      threads.get(otherId)!.unread_count++;
    }
  }
  return Array.from(threads.values());
}

/** Get all messages in a thread between two users. */
export async function getDMMessages(userId: string, otherId: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(
      `and(from_user_id.eq.${userId},to_user_id.eq.${otherId}),` +
      `and(from_user_id.eq.${otherId},to_user_id.eq.${userId})`
    )
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DirectMessage[];
}

/** Send a direct message. */
export async function sendDM(fromUserId: string, toUserId: string, body: string): Promise<void> {
  const { error } = await supabase.from('direct_messages').insert({
    from_user_id: fromUserId,
    to_user_id:   toUserId,
    body:         body.trim(),
    is_read:      false,
  });
  if (error) throw error;
}

/** Mark all messages in a thread as read. */
export async function markThreadRead(userId: string, otherId: string): Promise<void> {
  await supabase
    .from('direct_messages')
    .update({ is_read: true })
    .eq('to_user_id', userId)
    .eq('from_user_id', otherId)
    .eq('is_read', false);
}

// ─── Host Announcements ───────────────────────────────────────────────────────

export type HostAnnouncement = {
  id: string;
  created_at: string;
  event_id: string;
  host_user_id: string;
  body: string;
  is_pinned: boolean;
  // joined
  event_title?: string;
  event_slug?:  string;
  host_display_name?: string;
  host_avatar_emoji?: string;
};

/** Get all announcements for events the user is attending. */
export async function getMyAnnouncements(userId: string): Promise<HostAnnouncement[]> {
  // Get event IDs the user has a confirmed RSVP for
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('event_id')
    .eq('user_id', userId)
    .eq('status', 'confirmed');
  const eventIds = (rsvps ?? []).map((r: any) => r.event_id);
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from('host_announcements')
    .select(`
      *,
      event:events(title, slug),
      host:profiles!host_announcements_host_user_id_fkey(display_name, avatar_emoji)
    `)
    .in('event_id', eventIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return ((data ?? []) as any[]).map(a => ({
    ...a,
    event_title:       a.event?.title,
    event_slug:        a.event?.slug,
    host_display_name: a.host?.display_name,
    host_avatar_emoji: a.host?.avatar_emoji,
  }));
}

/** Post an announcement to all confirmed attendees of an event. */
export async function postAnnouncement(
  eventId: string, hostUserId: string, body: string, isPinned = false
): Promise<void> {
  const { error } = await supabase.from('host_announcements').insert({
    event_id:     eventId,
    host_user_id: hostUserId,
    body:         body.trim(),
    is_pinned:    isPinned,
  });
  if (error) throw error;
}

/** Count unread items (DMs + announcements since last seen). */
export async function getInboxUnreadCount(userId: string): Promise<number> {
  const [dmRes, annRes] = await Promise.all([
    supabase
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .eq('is_read', false),
    // Announcements posted in last 7 days count as "new"
    supabase
      .from('host_announcements')
      .select('event_id')
      .order('created_at', { ascending: false })
      .limit(1), // just check it exists — simplified
  ]);
  return dmRes.count ?? 0;
}

// ─── Event Admin Functions ───────────────────────────────────────────────────

/** Get all admins (co-hosts / captains) for an event, with their profiles. */
export async function getEventAdmins(eventId: string): Promise<EventAdmin[]> {
  const { data, error } = await supabase
    .from('event_admins')
    .select('*, profile:profiles!event_admins_user_id_fkey(display_name, username, avatar_emoji, avatar_url)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventAdmin[];
}

/** Appoint a user as admin or captain for an event. */
export async function addEventAdmin(
  eventId: string, hostId: string, userId: string, role: AdminRole
): Promise<void> {
  const { error } = await supabase.from('event_admins').insert({
    event_id: eventId,
    host_id:  hostId,
    user_id:  userId,
    role,
  });
  if (error) throw error;
}

/** Remove an admin from an event. */
export async function removeEventAdmin(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_admins')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Check if a user is an admin or captain for a specific event. */
export async function getMyAdminRole(eventId: string, userId: string): Promise<AdminRole | null> {
  const { data } = await supabase
    .from('event_admins')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role as AdminRole) ?? null;
}

/** Search Bord users by display name or username (for admin appointment). */
export async function searchBordUsers(query: string): Promise<Array<{
  id: string; display_name: string; username: string;
  avatar_emoji: string; avatar_url: string | null;
}>> {
  if (!query.trim() || query.length < 2) return [];
  const q = query.replace(/^@/, '').toLowerCase();
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_emoji, avatar_url')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(15);
  return data ?? [];
}


// ─── Friends System ───────────────────────────────────────────────────────────

export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface FriendProfile {
  id: string;
  display_name: string;
  username: string;
  avatar_emoji: string;
  avatar_url: string | null;
  friendship_id: string;
}

/** Get the friendship status between current user and another user */
export async function getFriendshipStatus(
  myId: string, otherId: string,
): Promise<{ status: FriendshipStatus; friendshipId: string | null }> {
  const { data } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`)
    .maybeSingle();

  if (!data) return { status: 'none', friendshipId: null };

  if (data.status === 'accepted') return { status: 'accepted', friendshipId: data.id };
  if (data.status === 'rejected') return { status: 'rejected', friendshipId: data.id };
  if (data.requester_id === myId)  return { status: 'pending_sent', friendshipId: data.id };
  return { status: 'pending_received', friendshipId: data.id };
}

/** Send a friend request. If target account is public, auto-accept. */
export async function sendFriendRequest(
  requesterId: string, addresseeId: string, addresseeIsPrivate: boolean,
): Promise<{ friendshipId: string; autoAccepted: boolean }> {
  const status = addresseeIsPrivate ? 'pending' : 'accepted';

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status })
    .select('id')
    .single();
  if (error) throw error;

  // Notify the addressee
  const notifType = addresseeIsPrivate ? 'friend_request' : 'friend_auto_accepted';
  await supabase.from('notifications').insert({
    user_id: addresseeId,
    actor_id: requesterId,
    type: notifType,
    data: { friendship_id: data.id },
  }).throwOnError();

  // If auto-accepted, also notify the requester
  if (!addresseeIsPrivate) {
    await supabase.from('notifications').insert({
      user_id: requesterId,
      actor_id: addresseeId,
      type: 'friend_accepted',
      data: { friendship_id: data.id, auto: true },
    }).throwOnError();
  }

  return { friendshipId: data.id, autoAccepted: !addresseeIsPrivate };
}

/** Accept a pending friend request */
export async function acceptFriendRequest(friendshipId: string, requesterId: string, myId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', friendshipId);
  if (error) throw error;

  // Notify the original requester their request was accepted
  await supabase.from('notifications').insert({
    user_id: requesterId,
    actor_id: myId,
    type: 'friend_accepted',
    data: { friendship_id: friendshipId },
  }).throwOnError();

  // Mark the original friend_request notification as read
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', myId)
    .eq('actor_id', requesterId)
    .eq('type', 'friend_request');
}

/** Reject or cancel a friend request / unfriend */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

/** Get all accepted friends for a user */
export async function getFriends(userId: string): Promise<FriendProfile[]> {
  const { data } = await supabase
    .from('friendships')
    .select(`
      id,
      requester_id,
      addressee_id,
      requester:profiles!friendships_requester_id_fkey(id, display_name, username, avatar_emoji, avatar_url),
      addressee:profiles!friendships_addressee_id_fkey(id, display_name, username, avatar_emoji, avatar_url)
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  return (data ?? []).map((row: any) => {
    const isMeRequester = row.requester_id === userId;
    const other = isMeRequester ? row.addressee : row.requester;
    return { ...other, friendship_id: row.id } as FriendProfile;
  });
}

/** Get the number of accepted friendships (Crew count) for a user */
export async function getCrewCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('friendships')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return count ?? 0;
}

/** Get pending incoming friend requests for a user */
export async function getPendingFriendRequests(userId: string): Promise<Array<{
  friendship_id: string;
  requester: FriendProfile;
  created_at: string;
}>> {
  const { data } = await supabase
    .from('friendships')
    .select(`
      id, created_at,
      requester:profiles!friendships_requester_id_fkey(id, display_name, username, avatar_emoji, avatar_url)
    `)
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return (data ?? []).map((row: any) => ({
    friendship_id: row.id,
    requester: { ...row.requester, friendship_id: row.id },
    created_at: row.created_at,
  }));
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'friend_request' | 'friend_accepted' | 'friend_auto_accepted';
  data: any;
  is_read: boolean;
  created_at: string;
  actor?: { display_name: string; username: string; avatar_emoji: string; avatar_url: string | null };
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select(`*, actor:profiles!notifications_actor_id_fkey(display_name, username, avatar_emoji, avatar_url)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as AppNotification[];
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count ?? 0;
}
