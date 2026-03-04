// app/event/[slug].tsx
// Public event detail page — prize banner, teams, and Gather-specific features.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated, Image, Modal, Alert, Linking, Pressable, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import ShareCanvas, { ShareCanvasEvent } from '../../components/ShareCanvas';
import ShareFormatPicker from '../../components/ShareFormatPicker';
import { useInstagramShare } from '../../hooks/useInstagramShare';
import { colors, spacing, radius, shadow } from '../../lib/theme';
import {
  getEventBySlug, getEventTeams, getEventCheckins, checkInToEvent,
  getEventPolls, voteOnPoll, getMyRsvpForEvent, setRunningLate,
  getTournament, getBracketMatches, createPost, parseHashtags,
  formatDate, formatTime, getPosts, togglePostLike, getMyPostLikes,
  Event, Team, EventCheckin, BracketMatch, TournamentTeam, getCategoryEmoji, formatCategoryLabel,
  VIBES, BRING_OPTIONS, ICEBREAKERS, LOOKING_FOR_OPTIONS,
  AdminRole, getMyAdminRole,
} from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const SPORT_CATS = new Set([
  'flag_football','basketball','soccer','volleyball','softball','tennis',
  'pickleball','golf','cornhole','dodgeball','kickball','ultimate_frisbee',
]);

export default function EventPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [event,    setEvent]    = useState<Event | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [teams,    setTeams]    = useState<Team[]>([]);
  const [checkins, setCheckins] = useState<EventCheckin[]>([]);
  const [polls,    setPolls]    = useState<any[]>([]);
  const [myRsvp,   setMyRsvp]   = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Tournament bracket
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>([]);
  const [bracketTeams,   setBracketTeams]   = useState<TournamentTeam[]>([]);
  const [showBracket,    setShowBracket]    = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const {
    canvasRef: igCanvasRef,
    pickerVisible: igPickerVisible,
    selectedFormat: igSelectedFormat,
    isCapturing: igIsCapturing,
    openPicker: openIgPicker,
    closePicker: closeIgPicker,
    onFormatSelected: onIgFormatSelected,
  } = useInstagramShare();
  const [postingToFeed,  setPostingToFeed]  = useState(false);
  // Event posts / media feed
  const [posts,      setPosts]      = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  // Gather-specific state
  const [showSafety,    setShowSafety]    = useState(false);
  const [showIcebreaker,setShowIcebreaker]= useState(false);
  const [icebreakerSet, setIcebreakerSet] = useState<'starters' | 'teamGames' | 'deepQuestions'>('starters');
  const [icebreakerIdx, setIcebreakerIdx] = useState(0);
  const [checkedIn,     setCheckedIn]     = useState(false);
  const [checkingIn,    setCheckingIn]    = useState(false);
  // Running late
  const [runningLate,   setRunningLateState] = useState(false);
  const [lateLoading,   setLateLoading]   = useState(false);
  // Emergency mode — long-press builds up a pulsing animation
  const emergencyScale = useRef(new Animated.Value(1)).current;

  // Pulse animation for prize banner — useRef keeps value stable across renders (RN 0.76)
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const ev = await getEventBySlug(slug);
      if (!ev) { setNotFound(true); return; }
      setEvent(ev);
      const fetches: Promise<any>[] = [];
      if (ev.teams_enabled) fetches.push(getEventTeams(ev.id).then(setTeams));
      if (!ev.has_buy_in) {
        fetches.push(getEventCheckins(ev.id).then(data => {
          setCheckins(data);
          if (user) setCheckedIn(data.some(c => c.user_id === user.id));
        }));
        fetches.push(getEventPolls(ev.id, user?.id).then(setPolls));
      }
      // Fetch user's own RSVP to show running late state
      if (user?.email) {
        fetches.push(
          getMyRsvpForEvent(ev.id, user.email).then(rsvp => {
            if (rsvp) {
              setMyRsvp(rsvp);
              setRunningLateState(rsvp.is_running_late ?? false);
            }
          }).catch(() => {})
        );
      }
      // Check if user is an admin/captain for this event
      if (user) {
        fetches.push(
          getMyAdminRole(ev.id, user.id).then(role => setAdminRole(role)).catch(() => {})
        );
      }
      // Fetch tournament bracket if teams are enabled
      if (ev.teams_enabled) {
        fetches.push(
          getTournament(ev.id).then(async t => {
            if (!t) return;
            const [tm, mx] = await Promise.all([
              supabase.from('tournament_teams').select('*').eq('tournament_id', t.id).order('seed'),
              getBracketMatches(t.id),
            ]);
            setBracketTeams((tm.data ?? []) as TournamentTeam[]);
            setBracketMatches(mx);
          }).catch(() => {})
        );
      }
      // Always fetch event posts / media
      fetches.push(
        getPosts({ eventId: ev.id, limit: 20 }).then(async eventPosts => {
          setPosts(eventPosts);
          if (user && eventPosts.length > 0) {
            const liked = await getMyPostLikes(user.id, eventPosts.map(p => p.id)).catch(() => [] as string[]);
            setLikedPosts(new Set(liked));
          }
        }).catch(() => {})
      );
      await Promise.all(fetches);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  }, [slug, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  if (notFound || !event) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <Text style={{ fontSize: 48 }}>🤷</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.white, marginTop: spacing.md }}>
          Event not found
        </Text>
      </View>
    );
  }

  const spotsLeft = event.cap - event.rsvp_count;
  const isFull    = spotsLeft <= 0;
  const isCompete = SPORT_CATS.has(event.category ?? '');
  const fillPct   = Math.min(100, (event.rsvp_count / event.cap) * 100);

  // Teams logic
  const myTeam = user ? teams.find(t =>
    t.members?.some(m => m.user_id === user.id && m.status === 'accepted')
  ) : null;
  const isCaptain = user ? teams.some(t => t.captain_id === user.id) : false;

  // Share helpers
  const eventUrl = `https://bordevents.com/events/${event.slug}`;
  const shareNative = async () => {
    setShowShareSheet(false);
    try {
      await Share.share({
        message: `🎉 ${event.title}\n${formatDate(event.date)} · ${event.location}\n\n${eventUrl}`,
        url: eventUrl,
        title: event.title,
      });
    } catch {}
  };
  const copyLink = async () => {
    setShowShareSheet(false);
    await Clipboard.setStringAsync(eventUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };
  const postToBordFeed = async () => {
    setShowShareSheet(false);
    if (!user) { router.push('/(auth)/sign-in'); return; }
    setPostingToFeed(true);
    try {
      const caption = `🎉 ${event.title} — ${formatDate(event.date)} at ${event.location}. Check it out & register!\n\n${eventUrl} #bord #events`;
      await createPost({
        author_id: user.id, event_id: event.id,
        caption, media_url: null, media_type: 'text',
        hashtags: parseHashtags(caption),
      });
      Alert.alert('Posted to Bord! 🎉', 'Others can tap your post to see this event.');
    } catch (e: any) {
      Alert.alert('Could not post', e?.message ?? 'Please try again.');
    } finally { setPostingToFeed(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: spacing.md }]}>

        {/* Logo bar */}
        <View style={styles.logoBar}>
          <View>
            <Text style={styles.logo}>
              <Text style={{ color: colors.white }}>B</Text>
              <Text style={{ color: colors.orange }}>ord</Text>
            </Text>
            <Text style={styles.logoTag}>are you bored?</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Admin / co-host badge → taps to host management */}
            {adminRole && (
              <TouchableOpacity
                style={styles.adminBadgeBtn}
                onPress={() => router.push(`/host/event/${event.id}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.adminBadgeText}>
                  {adminRole === 'captain' ? '⚑ Captain' : '👑 Admin'}
                </Text>
              </TouchableOpacity>
            )}
            {/* Copy link */}
            <TouchableOpacity
              style={[styles.shareIconBtn, linkCopied && { backgroundColor: 'rgba(52,211,153,0.2)' }]}
              onPress={copyLink}
              activeOpacity={0.8}
            >
              <Text style={styles.shareIconText}>{linkCopied ? '✅' : '🔗'}</Text>
            </TouchableOpacity>
            {/* Share as image */}
            <TouchableOpacity
              style={styles.shareIconBtn}
              onPress={() => openIgPicker()}
              activeOpacity={0.8}
            >
              <Text style={styles.shareIconText}>📤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category badge */}
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>
            {getCategoryEmoji(event.category)} {formatCategoryLabel(event.category).toUpperCase()}
            {event.has_buy_in ? (isCompete ? ' · COMPETE' : ' · TICKETED') : ' · GATHER'}
          </Text>
        </View>

        {event.is_private && (
          <View style={styles.privateBadge}>
            <Text style={styles.privateBadgeText}>🔒 Private Event · Invite Only</Text>
          </View>
        )}

        <Text style={styles.title}>{event.title}</Text>

        {/* ── PRIZE BANNER ── flashy, only if prize_pool is set */}
        {event.prize_pool && (
          <Animated.View style={[styles.prizeBanner, { transform: [{ scale: pulse }] }]}>
            <View style={styles.prizeGlow} />
            <Text style={styles.prizeTopLabel}>🏆 PRIZE ON THE LINE</Text>
            <Text style={styles.prizeEmoji}>{event.prize_emoji ?? '🏆'}</Text>
            <Text style={styles.prizeAmount}>{event.prize_pool}</Text>
            <Text style={styles.prizeSubtext}>Winner takes the glory — and the prize</Text>
          </Animated.View>
        )}

        {/* ── EVENT POSTS / MEDIA FEED — right after prize banner ── */}
        <View style={styles.postsSection}>
          <View style={styles.postsSectionHeader}>
            <Text style={styles.postsSectionTitle}>📸 Event Feed</Text>
            {user && (
              <TouchableOpacity
                style={styles.addPostBtn}
                onPress={() => router.push({
                  pathname: '/post/create',
                  params: { eventId: event.id, eventSlug: event.slug, eventTitle: event.title },
                })}
                activeOpacity={0.85}
              >
                <Text style={styles.addPostBtnText}>+ Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {posts.length === 0 ? (
            <TouchableOpacity
              style={styles.postsEmpty}
              onPress={() => user && router.push({
                pathname: '/post/create',
                params: { eventId: event.id, eventSlug: event.slug, eventTitle: event.title },
              })}
              activeOpacity={0.8}
            >
              <Text style={styles.postsEmptyEmoji}>📷</Text>
              <Text style={styles.postsEmptyText}>
                {user ? 'Be the first to post a photo from this event' : 'No posts yet'}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.postGrid}>
                {posts.filter(p => p.media_url).map(post => (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.postTile}
                    activeOpacity={0.88}
                    onPress={async () => {
                      const liked = likedPosts.has(post.id);
                      if (!user) return;
                      await togglePostLike(post.id, user.id, liked).catch(() => {});
                      setLikedPosts(prev => {
                        const next = new Set(prev);
                        liked ? next.delete(post.id) : next.add(post.id);
                        return next;
                      });
                      setPosts(prev => prev.map(q =>
                        q.id === post.id
                          ? { ...q, like_count: q.like_count + (liked ? -1 : 1) }
                          : q
                      ));
                    }}
                  >
                    {post.media_type === 'video' ? (
                      <Video
                        source={{ uri: post.media_url }}
                        style={styles.postTileImage}
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        isMuted
                        shouldPlay={false}
                      />
                    ) : (
                      <Image source={{ uri: post.media_url }} style={styles.postTileImage} />
                    )}
                    <View style={styles.postTileOverlay}>
                      <Text style={styles.postTileAuthor} numberOfLines={1}>
                        {post.author_emoji} {post.author_name}
                      </Text>
                      <Text style={styles.postTileLikes}>
                        {post.media_type === 'video' ? '🎥 ' : (likedPosts.has(post.id) ? '❤️ ' : '🤍 ')}{post.like_count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {posts.filter(p => !p.media_url && p.caption).map(post => (
                <View key={post.id} style={styles.textPost}>
                  <View style={styles.textPostHeader}>
                    <Text style={styles.textPostAuthor}>{post.author_emoji} {post.author_name}</Text>
                    <TouchableOpacity
                      onPress={async () => {
                        if (!user) return;
                        const liked = likedPosts.has(post.id);
                        await togglePostLike(post.id, user.id, liked).catch(() => {});
                        setLikedPosts(prev => {
                          const next = new Set(prev);
                          liked ? next.delete(post.id) : next.add(post.id);
                          return next;
                        });
                        setPosts(prev => prev.map(q =>
                          q.id === post.id
                            ? { ...q, like_count: q.like_count + (liked ? -1 : 1) }
                            : q
                        ));
                      }}
                    >
                      <Text style={styles.textPostLike}>
                        {likedPosts.has(post.id) ? '❤️' : '🤍'} {post.like_count}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {post.caption ? <Text style={styles.textPostCaption}>{post.caption}</Text> : null}
                </View>
              ))}
            </>
          )}
        </View>

        {/* Meta grid */}
        <View style={styles.metaGrid}>
          <MetaItem icon="📅" label="Date"     value={formatDate(event.date)} />
          <MetaItem icon="⏰" label="Time"     value={formatTime(event.time)} />
          <MetaItem icon="📍" label="Location" value={event.location} />
          {event.has_buy_in && (
            <MetaItem
              icon={isCompete ? '💰' : '🎟️'}
              label={isCompete ? 'Buy-In' : 'Ticket Price'}
              value={`$${event.buy_in_amount} ${isCompete ? 'per person' : 'per ticket'}`}
              highlight
            />
          )}
        </View>

        {/* RSVP cap bar */}
        <View style={styles.capCard}>
          <View style={styles.capRow}>
            <Text style={styles.capLabel}>SPOTS AVAILABLE</Text>
            <Text style={[styles.capVal, isFull && { color: colors.rose }]}>
              {isFull ? `FULL · ${event.waitlist_count} on waitlist` : event.is_anonymous_rsvp ? `${event.rsvp_count} going · spots available` : `${event.rsvp_count} of ${event.cap} registered`}
            </Text>
          </View>
          <View style={styles.capBarBg}>
            <View style={[styles.capBarFill, { width: `${fillPct}%` as any }, isFull && styles.capBarFull]} />
          </View>
          {!isFull && <Text style={styles.spotsLeft}>{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} remaining</Text>}
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.descCard}>
            <Text style={styles.descLabel}>ABOUT THIS EVENT</Text>
            <Text style={styles.desc}>{event.description}</Text>
          </View>
        )}

        {/* ── GATHER INFO SECTION — only for free/community events ── */}
        {!event.has_buy_in && (
          <>
            {/* Vibe + Trusted Host row */}
            {(event.vibe || event.is_trusted_host || event.safety_score > 0) && (
              <View style={gstyles.gatherInfoRow}>
                {event.is_trusted_host && (
                  <View style={gstyles.trustedBadge}>
                    <Text style={gstyles.trustedText}>✓ Trusted Host</Text>
                  </View>
                )}
                {event.vibe && (() => {
                  const v = VIBES.find(x => x.key === event.vibe);
                  return v ? (
                    <View style={[gstyles.vibeBadge, { borderColor: v.color + '60', backgroundColor: v.color + '18' }]}>
                      <Text style={[gstyles.vibeBadgeText, { color: v.color }]}>{v.emoji} {v.label}</Text>
                    </View>
                  ) : null;
                })()}
                {event.safety_score > 0 && (
                  <View style={gstyles.safetyBadge}>
                    <Text style={gstyles.safetyBadgeText}>🛡️ {event.safety_score}% safe</Text>
                  </View>
                )}
              </View>
            )}

            {/* Interest tags */}
            {event.interest_tags?.length > 0 && (
              <View style={gstyles.tagsCard}>
                <Text style={gstyles.tagsLabel}>INTERESTS</Text>
                <View style={gstyles.tagsRow}>
                  {event.interest_tags.map(tag => (
                    <View key={tag} style={gstyles.tagPill}>
                      <Text style={gstyles.tagPillText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Looking for */}
            {event.looking_for_tags?.length > 0 && (
              <View style={gstyles.tagsCard}>
                <Text style={gstyles.tagsLabel}>LOOKING FOR</Text>
                <View style={gstyles.tagsRow}>
                  {event.looking_for_tags.map(key => {
                    const info = LOOKING_FOR_OPTIONS.find(l => l.key === key);
                    return info ? (
                      <View key={key} style={gstyles.lookingPill}>
                        <Text style={gstyles.lookingPillText}>{info.emoji} {info.label}</Text>
                      </View>
                    ) : null;
                  })}
                </View>
              </View>
            )}

            {/* Bring something */}
            {event.bring_options?.length > 0 && (
              <View style={gstyles.bringCard}>
                <Text style={gstyles.tagsLabel}>BRING SOMETHING? (OPTIONAL)</Text>
                <Text style={gstyles.bringHint}>Tap what you plan to bring — shown to the host</Text>
                <View style={gstyles.tagsRow}>
                  {BRING_OPTIONS.filter(b => event.bring_options.includes(b.key)).map(b => (
                    <View key={b.key} style={gstyles.bringPill}>
                      <Text style={gstyles.bringPillText}>{b.emoji} {b.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Group Polls */}
            {polls.length > 0 && (
              <View style={gstyles.tagsCard}>
                <Text style={gstyles.tagsLabel}>📊 POLLS</Text>
                {polls.map((poll: any) => {
                  const totalVotes = poll.votes?.reduce((s: number, v: any) => s + v.count, 0) ?? 0;
                  return (
                    <View key={poll.id} style={gstyles.pollCard}>
                      <Text style={gstyles.pollQuestion}>{poll.question}</Text>
                      {poll.options.map((opt: string, idx: number) => {
                        const voteData = poll.votes?.find((v: any) => v.option_idx === idx);
                        const count = voteData?.count ?? 0;
                        const pct   = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const isMyVote = poll.my_vote === idx;
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[gstyles.pollOption, isMyVote && gstyles.pollOptionVoted]}
                            activeOpacity={0.75}
                            onPress={async () => {
                              if (!user) return;
                              try {
                                await voteOnPoll(poll.id, user.id, idx);
                                const updated = await getEventPolls(event.id, user.id);
                                setPolls(updated);
                              } catch (e) { console.error(e); }
                            }}
                          >
                            <Text style={[gstyles.pollOptionText, isMyVote && gstyles.pollOptionTextVoted]}>
                              {isMyVote ? '✓ ' : ''}{opt}
                            </Text>
                            <View style={[gstyles.pollBar, { width: `${pct}%` as any }]} />
                            <Text style={gstyles.pollPct}>{pct}%</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <Text style={gstyles.pollMeta}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── TEAMS SECTION ── */}
        {event.teams_enabled && (
          <View style={styles.teamsSection}>
            <View style={styles.teamsSectionHeader}>
              <Text style={styles.teamsSectionTitle}>⚔️ COMPETING TEAMS</Text>
              <Text style={styles.teamsSectionSub}>{teams.length} team{teams.length !== 1 ? 's' : ''} registered</Text>
            </View>

            {/* My team status */}
            {myTeam && (
              <TouchableOpacity
                style={styles.myTeamCard}
                onPress={() => router.push({
                  pathname: '/team/[id]',
                  params: { id: myTeam.id, eventId: event.id, eventTitle: event.title, category: event.category },
                })}
                activeOpacity={0.85}
              >
                {myTeam.logo_url
                ? <Image source={{ uri: myTeam.logo_url }} style={styles.myTeamLogoImg} />
                : <Text style={styles.myTeamEmoji}>{myTeam.logo_emoji}</Text>
              }
                <View style={{ flex: 1 }}>
                  <Text style={styles.myTeamLabel}>YOUR TEAM</Text>
                  <Text style={styles.myTeamName}>{myTeam.name}</Text>
                  <Text style={styles.myTeamCount}>
                    {myTeam.members?.filter(m => m.status === 'accepted').length ?? 0} / {myTeam.max_size} members
                  </Text>
                </View>
                <Text style={{ color: colors.orange, fontSize: 18 }}>→</Text>
              </TouchableOpacity>
            )}

            {/* Captain shortcut */}
            {isCaptain && !myTeam && (
              <TouchableOpacity
                style={styles.myTeamCard}
                onPress={() => {
                  const myT = teams.find(t => t.captain_id === user?.id);
                  if (myT) router.push({ pathname: '/team/[id]', params: { id: myT.id, eventId: event.id, eventTitle: event.title, category: event.category } });
                }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 28 }}>⚔️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myTeamLabel}>YOU ARE A CAPTAIN</Text>
                  <Text style={styles.myTeamName}>Manage your team</Text>
                </View>
                <Text style={{ color: colors.orange, fontSize: 18 }}>→</Text>
              </TouchableOpacity>
            )}

            {/* Other teams list */}
            {teams.filter(t => t.id !== myTeam?.id && t.captain_id !== user?.id).map(team => {
              const accepted = team.members?.filter(m => m.status === 'accepted').length ?? 0;
              const full = accepted >= team.max_size;
              return (
                <TouchableOpacity
                  key={team.id}
                  style={styles.teamCard}
                  onPress={() => router.push({
                    pathname: '/team/[id]',
                    params: { id: team.id, eventId: event.id, eventTitle: event.title, category: event.category },
                  })}
                  activeOpacity={0.85}
                >
                  {team.logo_url
                    ? <Image source={{ uri: team.logo_url }} style={styles.teamCardLogoImg} />
                    : <Text style={styles.teamCardEmoji}>{team.logo_emoji}</Text>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamCardName}>{team.name}</Text>
                    <Text style={styles.teamCardCaptain}>Captain: {team.captain_name}</Text>
                  </View>
                  <View style={styles.teamCardRight}>
                    <Text style={[styles.teamCardCount, full && { color: colors.rose }]}>
                      {accepted}/{team.max_size}
                    </Text>
                    {full
                      ? <Text style={styles.teamFull}>Full</Text>
                      : <Text style={styles.teamJoin}>Join →</Text>
                    }
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Create team button */}
            {event.allow_self_team && !myTeam && !isCaptain && (
              <TouchableOpacity
                style={styles.createTeamBtn}
                onPress={() => {
                  if (!user) {
                    router.push('/(auth)/sign-in');
                    return;
                  }
                  router.push({
                    pathname: '/team/create',
                    params: {
                      eventId: event.id,
                      eventTitle: event.title,
                      category: event.category,
                      maxSize: String(event.max_team_size ?? 10),
                    },
                  });
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.createTeamBtnEmoji}>⚔️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.createTeamBtnTitle}>Create a Team</Text>
                  <Text style={styles.createTeamBtnSub}>{"You'll be designated as team captain"}</Text>
                </View>
                <Text style={{ color: colors.orange, fontSize: 18 }}>→</Text>
              </TouchableOpacity>
            )}

            {teams.length === 0 && event.allow_self_team && (
              <Text style={styles.noTeamsText}>
                No teams yet — be the first to create one!
              </Text>
            )}
          </View>
        )}

        {/* ── BRACKET PREVIEW — collapsible, only when matches exist ── */}
        {event.teams_enabled && bracketMatches.length > 0 && (() => {
          const round1 = bracketMatches.filter(m => m.round === 1 && !m.is_loser_bracket);
          const allRounds = [...new Set(bracketMatches.map(m => m.round))].sort((a,b) => a-b);
          const teamName = (id: string | null) => bracketTeams.find(t => t.id === id)?.name ?? 'TBD';
          return (
            <View style={styles.bracketCard}>
              <TouchableOpacity
                style={styles.bracketHeader}
                onPress={() => setShowBracket(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={styles.bracketTitle}>🏆 Tournament Bracket</Text>
                <View style={styles.bracketHeaderRight}>
                  <Text style={styles.bracketRoundPill}>
                    {bracketMatches.filter(m => m.status === 'completed').length}/{bracketMatches.length} done
                  </Text>
                  <Text style={styles.bracketChevron}>{showBracket ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {showBracket && (
                <View style={styles.bracketBody}>
                  {allRounds.map(r => {
                    const roundMatches = bracketMatches.filter(m => m.round === r && !m.is_loser_bracket);
                    const roundLabel = r === allRounds[allRounds.length - 1]
                      ? '🏆 Final' : r === allRounds[allRounds.length - 2]
                      ? 'Semifinals' : `Round ${r}`;
                    return (
                      <View key={r} style={styles.bracketRound}>
                        <Text style={styles.bracketRoundLabel}>{roundLabel}</Text>
                        {roundMatches.map(match => {
                          const aName = teamName(match.team_a_id);
                          const bName = teamName(match.team_b_id);
                          const aWon = match.winner_id === match.team_a_id;
                          const bWon = match.winner_id === match.team_b_id;
                          const done = match.status === 'completed';
                          return (
                            <View key={match.id} style={styles.bracketMatch}>
                              <View style={[styles.bracketTeamRow, aWon && styles.bracketWinner]}>
                                <Text style={[styles.bracketTeamName, aWon && styles.bracketWinnerText]} numberOfLines={1}>
                                  {aWon ? '🥇 ' : ''}{aName}
                                </Text>
                                {done && <Text style={styles.bracketScore}>{match.team_a_score ?? ''}</Text>}
                              </View>
                              <View style={styles.bracketDivider} />
                              <View style={[styles.bracketTeamRow, bWon && styles.bracketWinner]}>
                                <Text style={[styles.bracketTeamName, bWon && styles.bracketWinnerText]} numberOfLines={1}>
                                  {bWon ? '🥇 ' : ''}{bName}
                                </Text>
                                {done && <Text style={styles.bracketScore}>{match.team_b_score ?? ''}</Text>}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        {/* Cancellation policy */}
        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>⏱ 72-Hour Cancellation Policy</Text>
          <Text style={styles.policyBody}>
            After registering, you have 72 hours to cancel for a full refund.
            After that window closes, your spot is locked and your buy-in is non-refundable.
          </Text>
        </View>

      </ScrollView>

      {/* ── Share sheet modal ─────────────────────────────────────────── */}
      <Modal visible={showShareSheet} transparent animationType="fade" onRequestClose={() => setShowShareSheet(false)}>
        <Pressable style={styles.shareBackdrop} onPress={() => setShowShareSheet(false)}>
          <Pressable style={styles.shareSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.shareHandle} />
            <Text style={styles.shareSheetTitle}>Share Event</Text>
            <Text style={styles.shareSheetSub} numberOfLines={2}>{event.title}</Text>

            {/* Share as image — opens card capture flow */}
            <TouchableOpacity
              style={styles.shareRow}
              onPress={() => { setShowShareSheet(false); openIgPicker(); }}
              activeOpacity={0.8}
            >
              <View style={[styles.shareIconBox, { backgroundColor: 'rgba(249,115,22,0.18)' }]}>
                <Text style={styles.shareRowIcon}>🖼️</Text>
              </View>
              <View style={styles.shareRowText}>
                <Text style={styles.shareRowTitle}>Share as Image</Text>
                <Text style={styles.shareRowSub}>Post to Instagram, Snapchat, Threads & more</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.shareDivider} />

            <TouchableOpacity style={styles.shareRow} onPress={shareNative} activeOpacity={0.8}>
              <View style={[styles.shareIconBox, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                <Text style={styles.shareRowIcon}>📤</Text>
              </View>
              <View style={styles.shareRowText}>
                <Text style={styles.shareRowTitle}>Share Link via...</Text>
                <Text style={styles.shareRowSub}>Messages, WhatsApp, email & more</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.shareDivider} />

            <TouchableOpacity style={styles.shareRow} onPress={copyLink} activeOpacity={0.8}>
              <View style={[styles.shareIconBox, { backgroundColor: 'rgba(155,142,196,0.12)' }]}>
                <Text style={styles.shareRowIcon}>🔗</Text>
              </View>
              <View style={styles.shareRowText}>
                <Text style={styles.shareRowTitle}>Copy Event Link</Text>
                <Text style={styles.shareRowSub}>{eventUrl}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.shareDivider} />

            <TouchableOpacity
              style={[styles.shareRow, postingToFeed && { opacity: 0.5 }]}
              onPress={postToBordFeed}
              disabled={postingToFeed}
              activeOpacity={0.8}
            >
              <View style={[styles.shareIconBox, { backgroundColor: 'rgba(52,211,153,0.12)' }]}>
                <Text style={styles.shareRowIcon}>{postingToFeed ? '⏳' : '🤝'}</Text>
              </View>
              <View style={styles.shareRowText}>
                <Text style={styles.shareRowTitle}>{postingToFeed ? 'Posting…' : 'Post to Bord Feed'}</Text>
                <Text style={styles.shareRowSub}>Others on Bord can tap to see & register</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareCancelBtn} onPress={() => setShowShareSheet(false)} activeOpacity={0.8}>
              <Text style={styles.shareCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Instagram format picker ─────────────────────────────────── */}
      <ShareFormatPicker
        visible={igPickerVisible}
        onSelect={onIgFormatSelected}
        onDismiss={closeIgPicker}
        isCapturing={igIsCapturing}
      />

      {/* ── Offscreen ShareCanvas — always mounted, captures at correct IG dimensions */}
      {event && (
        <ShareCanvas
          ref={igCanvasRef}
          format={igSelectedFormat ?? 'story'}
          event={{
            title:         event.title,
            date:          formatDate(event.date),
            time:          formatTime(event.time),
            price:         event.has_buy_in && event.buy_in_amount ? event.buy_in_amount : null,
            spotsLeft:     Math.max(0, event.cap - (event.rsvp_count ?? 0)),
            totalSpots:    event.cap,
            category:      event.category ?? 'EVENT',
            coverImageUrl: null,
            eventUrl,
          }}
        />
      )}

      {/* ── Gather-mode features: safety, check-in, icebreakers ── */}
      {!event.has_buy_in && (
        <>
          {/* Safety briefing modal */}
          <Modal visible={showSafety} transparent animationType="slide" onRequestClose={() => setShowSafety(false)}>
            <View style={gstyles.modalOverlay}>
              <View style={gstyles.safetyModal}>
                <Text style={gstyles.safetyTitle}>🛡️ Quick Safety Reminder</Text>
                <Text style={gstyles.safetyBody}>Before you head out, a few good habits:</Text>
                {[
                  '📍 Share your location with a friend or family member',
                  '☀️ Meet in a public place for first-time meetups',
                  '📱 Keep your phone charged',
                  '🧭 Trust your instincts — leave any time you want',
                  '🚨 Emergency: call 911 or text 911 in most US cities',
                ].map((tip, i) => (
                  <View key={i} style={gstyles.safetyTip}>
                    <Text style={gstyles.safetyTipText}>{tip}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={gstyles.safetyBtn}
                  onPress={() => { setShowSafety(false); router.push(`/rsvp/${slug}`); }}
                  activeOpacity={0.85}
                >
                  <Text style={gstyles.safetyBtnText}>Got it — RSVP →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowSafety(false)} style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ color: colors.gray1, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Icebreaker modal */}
          <Modal visible={showIcebreaker} transparent animationType="slide" onRequestClose={() => setShowIcebreaker(false)}>
            <View style={gstyles.modalOverlay}>
              <View style={gstyles.icebreakerModal}>
                <Text style={gstyles.icebreakerTitle}>🎲 Icebreaker Cards</Text>
                <View style={gstyles.icebreakerSetRow}>
                  {(['starters','teamGames','deepQuestions'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[gstyles.setBtn, icebreakerSet === s && gstyles.setBtnActive]}
                      onPress={() => { setIcebreakerSet(s); setIcebreakerIdx(0); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[gstyles.setBtnText, icebreakerSet === s && gstyles.setBtnTextActive]}>
                        {s === 'starters' ? '💬 Chat' : s === 'teamGames' ? '🎯 Games' : '💭 Deep'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={gstyles.icebreakerCard}>
                  <Text style={gstyles.icebreakerText}>
                    {ICEBREAKERS[icebreakerSet][icebreakerIdx % ICEBREAKERS[icebreakerSet].length]}
                  </Text>
                </View>
                <View style={gstyles.icebreakerBtns}>
                  <TouchableOpacity
                    style={gstyles.icebreakerNextBtn}
                    onPress={() => setIcebreakerIdx(i => i + 1)}
                    activeOpacity={0.8}
                  >
                    <Text style={gstyles.icebreakerNextText}>Next Card 🃏</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setShowIcebreaker(false)} style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ color: colors.gray1, fontSize: 14 }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}

      {/* Sticky RSVP / Gather action bar */}
      <View style={[styles.stickyBtn, { paddingBottom: insets.bottom + spacing.sm }]}>
        {/* Gather tools row — only for free/community events */}
        {!event.has_buy_in && (
          <View style={gstyles.gatherToolsRow}>
            {/* Check-in */}
            <TouchableOpacity
              style={[gstyles.toolBtn, checkedIn && gstyles.toolBtnActive]}
              activeOpacity={0.8}
              disabled={checkingIn}
              onPress={async () => {
                if (!user) { router.push('/(auth)/sign-in'); return; }
                if (checkedIn) return;
                setCheckingIn(true);
                try {
                  await checkInToEvent(event.id, user.id, user.email ?? 'Attendee');
                  setCheckedIn(true);
                  const updated = await getEventCheckins(event.id);
                  setCheckins(updated);
                } catch (e) { console.error(e); }
                finally { setCheckingIn(false); }
              }}
            >
              {checkingIn
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={gstyles.toolBtnText}>{checkedIn ? '✓ Here' : '📍 Check In'}</Text>
              }
            </TouchableOpacity>

            {/* Running Late — only visible if user has a confirmed RSVP */}
            {myRsvp && (
              <TouchableOpacity
                style={[gstyles.toolBtn, runningLate && gstyles.toolBtnLate]}
                activeOpacity={0.8}
                disabled={lateLoading}
                onPress={async () => {
                  if (runningLate) return;
                  setLateLoading(true);
                  try {
                    await setRunningLate(myRsvp.id);
                    setRunningLateState(true);
                  } catch (e) { console.error(e); }
                  finally { setLateLoading(false); }
                }}
              >
                {lateLoading
                  ? <ActivityIndicator size="small" color={colors.orange} />
                  : <Text style={[gstyles.toolBtnText, runningLate && { color: colors.orange }]}>
                      {runningLate ? '🕐 Notified' : '🕐 Running Late'}
                    </Text>
                }
              </TouchableOpacity>
            )}

            {/* Icebreakers */}
            <TouchableOpacity
              style={gstyles.toolBtn}
              onPress={() => setShowIcebreaker(true)}
              activeOpacity={0.8}
            >
              <Text style={gstyles.toolBtnText}>🎲 Ice</Text>
            </TouchableOpacity>

            {checkins.length > 0 && (
              <View style={gstyles.checkinCount}>
                <Text style={gstyles.checkinCountText}>📍 {checkins.length}</Text>
              </View>
            )}
          </View>
        )}

        {/* Emergency SOS — hold 1.5s to confirm dial 911. Always accessible. */}
        {!event.has_buy_in && (
          <Pressable
            style={gstyles.emergencyBtn}
            onLongPress={() => {
              Alert.alert(
                '🚨 Emergency',
                'This will call 911. Only use in a real emergency.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Call 911', style: 'destructive', onPress: () => Linking.openURL('tel:911') },
                ]
              );
            }}
            delayLongPress={1500}
            onPressIn={() =>
              Animated.timing(emergencyScale, { toValue: 1.1, duration: 1500, useNativeDriver: true }).start()
            }
            onPressOut={() =>
              Animated.timing(emergencyScale, { toValue: 1, duration: 150, useNativeDriver: true }).start()
            }
          >
            <Animated.View style={[gstyles.emergencyInner, { transform: [{ scale: emergencyScale }] }]}>
              <Text style={gstyles.emergencyText}>Hold for SOS 🆘</Text>
            </Animated.View>
          </Pressable>
        )}

        {/* Main RSVP button */}
        <TouchableOpacity
          style={[styles.rsvpBtn, isFull && styles.rsvpBtnWaitlist]}
          onPress={() => {
            if (!event.has_buy_in && !isFull) {
              setShowSafety(true);
            } else {
              router.push(`/rsvp/${slug}`);
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.rsvpBtnText}>
            {isFull ? 'Join Waitlist →' : event.has_buy_in ? `${isCompete ? 'Register & Pay' : 'Get Ticket'} $${event.buy_in_amount} →` : 'RSVP Now →'}
          </Text>
        </TouchableOpacity>

        {!isFull && (
          <Text style={styles.stickyNote}>
            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left · Waitlist opens at {event.cap}
          </Text>
        )}
      </View>
    </View>
  );
}

function MetaItem({ icon, label, value, highlight = false }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <View>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={[styles.metaValue, highlight && { color: colors.orange }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll:   { paddingHorizontal: spacing.md, paddingBottom: 120 },
  logoBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  adminBadgeBtn: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '800', color: '#F97316' },
  shareIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  shareIconText: { fontSize: 18 },
  // Share sheet modal
  shareBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  shareSheet: {
    backgroundColor: '#1E1E1E', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 40,
  },
  shareHandle: { width: 36, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  shareSheetTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  shareSheetSub: { fontSize: 13, color: '#A8A29E', marginBottom: 20 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  shareIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  shareRowIcon: { fontSize: 22 },
  shareRowText: { flex: 1 },
  shareRowTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  shareRowSub: { fontSize: 12, color: '#A8A29E', lineHeight: 17 },
  shareDivider: { height: 1, backgroundColor: '#2C2C2C', marginVertical: 2 },
  shareCancelBtn: { marginTop: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: '#2C2C2C', borderRadius: 12 },
  shareCancelText: { color: '#A8A29E', fontSize: 15, fontWeight: '600' },
  logo:     { fontSize: 28, fontWeight: '900' },
  logoTag:  { fontSize: 12, color: colors.gray2, fontStyle: 'italic' },

  catBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: spacing.sm,
  },
  catBadgeText: { fontSize: 10, fontWeight: '700', color: colors.orange, letterSpacing: 0.8 },

  privateBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(155,142,196,0.12)',
    borderWidth: 1, borderColor: 'rgba(155,142,196,0.35)', borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: spacing.sm,
  },
  privateBadgeText: { fontSize: 11, fontWeight: '700', color: '#9B8EC4', letterSpacing: 0.5 },

  title: { fontSize: 32, fontWeight: '800', color: colors.white, lineHeight: 38, marginBottom: spacing.lg },

  // ── Prize Banner ──
  prizeBanner: {
    backgroundColor: '#1a0e00', borderWidth: 1.5, borderColor: '#f97316',
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg,
    alignItems: 'center', overflow: 'hidden', ...shadow.md,
  },
  prizeGlow: {
    position: 'absolute', top: -40, left: '10%', right: '10%', height: 80,
    backgroundColor: 'rgba(249,115,22,0.18)', borderRadius: 40,
  },
  prizeTopLabel: { fontSize: 11, fontWeight: '800', color: colors.orange, letterSpacing: 2, marginBottom: spacing.sm },
  prizeEmoji:    { fontSize: 56, marginBottom: spacing.xs },
  prizeAmount:   { fontSize: 32, fontWeight: '900', color: colors.white, textAlign: 'center', marginBottom: spacing.xs },
  prizeSubtext:  { fontSize: 13, color: colors.gray1, fontStyle: 'italic', textAlign: 'center' },

  metaGrid: { gap: spacing.sm, marginBottom: spacing.md },
  metaItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, padding: spacing.sm,
  },
  metaIcon:  { fontSize: 20 },
  metaLabel: { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '600', color: colors.white },

  capCard: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  capRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  capLabel:  { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 1 },
  capVal:    { fontSize: 12, fontWeight: '700', color: colors.orange },
  capBarBg:  { height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  capBarFill:{ height: '100%', backgroundColor: colors.orange, borderRadius: 3 },
  capBarFull:{ backgroundColor: colors.rose },
  spotsLeft: { fontSize: 11, color: colors.gray2, fontWeight: '600' },

  descCard: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  descLabel: { fontSize: 10, fontWeight: '700', color: colors.gray2, letterSpacing: 1, marginBottom: spacing.sm },
  desc:      { fontSize: 15, color: colors.gray1, lineHeight: 23 },

  // ── Teams ──
  // ── Bracket preview ──────────────────────────────────────────────────────
  bracketCard: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2C2C2C',
    borderRadius: 14, marginBottom: 16, overflow: 'hidden',
  },
  bracketHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  bracketTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  bracketHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bracketRoundPill: {
    fontSize: 11, fontWeight: '700', color: '#F97316',
    backgroundColor: 'rgba(249,115,22,0.12)', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 10,
  },
  bracketChevron: { fontSize: 11, color: '#A8A29E' },
  bracketBody: { paddingHorizontal: 12, paddingBottom: 14 },
  bracketRound: { marginBottom: 14 },
  bracketRoundLabel: { fontSize: 11, fontWeight: '800', color: '#A8A29E', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  bracketMatch: {
    backgroundColor: '#242424', borderRadius: 10,
    overflow: 'hidden', marginBottom: 6,
  },
  bracketTeamRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  bracketWinner: { backgroundColor: 'rgba(249,115,22,0.1)' },
  bracketTeamName: { fontSize: 13, color: '#A8A29E', flex: 1 },
  bracketWinnerText: { color: '#FFFFFF', fontWeight: '700' },
  bracketScore: { fontSize: 13, fontWeight: '800', color: '#F97316', marginLeft: 8 },
  bracketDivider: { height: 1, backgroundColor: '#2C2C2C', marginHorizontal: 12 },

  teamsSection: {
    backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)', padding: spacing.md, marginBottom: spacing.md,
  },
  teamsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  teamsSectionTitle: { fontSize: 13, fontWeight: '800', color: colors.orange, letterSpacing: 1 },
  teamsSectionSub:   { fontSize: 12, color: colors.gray2 },

  myTeamCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  myTeamEmoji: { fontSize: 36 },
  myTeamLogoImg: { width: 44, height: 44, borderRadius: 22 },
  myTeamLabel: { fontSize: 10, fontWeight: '700', color: colors.orange, letterSpacing: 1, marginBottom: 2 },
  myTeamName:  { fontSize: 16, fontWeight: '700', color: colors.white },
  myTeamCount: { fontSize: 12, color: colors.gray1, marginTop: 1 },

  teamCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  teamCardEmoji:   { fontSize: 32 },
  teamCardLogoImg: { width: 40, height: 40, borderRadius: 20 },
  teamCardName:    { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 2 },
  teamCardCaptain: { fontSize: 12, color: colors.gray2 },
  teamCardRight:   { alignItems: 'flex-end', gap: 2 },
  teamCardCount:   { fontSize: 12, fontWeight: '700', color: colors.gray1 },
  teamFull:  { fontSize: 11, color: colors.rose, fontWeight: '600' },
  teamJoin:  { fontSize: 12, color: colors.orange, fontWeight: '700' },

  createTeamBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.5)',
    borderRadius: radius.md, padding: spacing.md, borderStyle: 'dashed',
  },
  createTeamBtnEmoji: { fontSize: 28 },
  createTeamBtnTitle: { fontSize: 15, fontWeight: '700', color: colors.orange, marginBottom: 2 },
  createTeamBtnSub:   { fontSize: 12, color: colors.gray2 },
  noTeamsText: { fontSize: 13, color: colors.gray2, textAlign: 'center', fontStyle: 'italic', paddingVertical: spacing.sm },

  // ── Event posts feed ────────────────────────────────────────────────────────
  postsSection: { marginBottom: 20 },
  postsSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  postsSectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  addPostBtn: {
    backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  addPostBtnText: { color: '#F97316', fontSize: 13, fontWeight: '700' },
  postsEmpty: {
    alignItems: 'center' as const, paddingVertical: 28,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: '#2C2C2C', borderRadius: 12, gap: 8,
  },
  postsEmptyEmoji: { fontSize: 32 },
  postsEmptyText:  { fontSize: 13, color: '#A8A29E', textAlign: 'center' as const },
  postGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4 },
  postTile: {
    width: '49%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#1E1E1E',
  },
  postTileImage:   { width: '100%', height: '100%' },
  postTileOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row' as const,
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 5,
  },
  postTileAuthor: { fontSize: 11, color: '#FFFFFF', fontWeight: '600', flex: 1 },
  postTileLikes:  { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
  textPost: {
    backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2C2C2C',
    borderRadius: 10, padding: 12, marginTop: 4,
  },
  textPostHeader: { flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  textPostAuthor: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  textPostLike:   { fontSize: 13, color: '#FFFFFF' },
  textPostCaption:{ fontSize: 14, color: '#A8A29E', lineHeight: 20 },

  policyCard: {
    backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.orange,
    marginBottom: spacing.md,
  },
  policyTitle: { fontSize: 13, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  policyBody:  { fontSize: 12, color: colors.gray1, lineHeight: 19 },

  stickyBtn: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.black, borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md,
  },
  rsvpBtn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginBottom: 6,
  },
  rsvpBtnWaitlist: { backgroundColor: colors.rose },
  rsvpBtnText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  stickyNote: { textAlign: 'center', fontSize: 11, color: colors.gray2, fontWeight: '500' },
});

// ── Gather-specific styles (separate sheet to keep main styles clean) ─────────
const gstyles = StyleSheet.create({
  // Gather info row (vibe + trusted + safety)
  gatherInfoRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    marginBottom: spacing.sm,
  },
  trustedBadge: {
    backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  trustedText: { fontSize: 12, fontWeight: '700', color: '#34D399' },
  vibeBadge: {
    borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  vibeBadgeText: { fontSize: 12, fontWeight: '600' },
  safetyBadge: {
    backgroundColor: 'rgba(125,211,252,0.08)', borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.3)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  safetyBadgeText: { fontSize: 12, fontWeight: '600', color: '#7DD3FC' },

  // Tags / interests
  tagsCard: {
    backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm,
  },
  tagsLabel: {
    fontSize: 10, fontWeight: '700', color: colors.gray2,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagPill: {
    backgroundColor: 'rgba(155,142,196,0.1)', borderWidth: 1,
    borderColor: 'rgba(155,142,196,0.3)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagPillText:  { fontSize: 12, color: '#9B8EC4', fontWeight: '500' },
  lookingPill: {
    backgroundColor: 'rgba(125,211,252,0.08)', borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.25)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  lookingPillText: { fontSize: 12, color: '#7DD3FC', fontWeight: '500' },

  // Bring something
  bringCard: {
    backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm,
  },
  bringHint: { fontSize: 11, color: colors.gray2, marginBottom: 10 },
  bringPill: {
    backgroundColor: 'rgba(52,211,153,0.06)', borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  bringPillText: { fontSize: 12, color: '#34D399', fontWeight: '500' },

  // Polls
  pollCard:     { marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  pollQuestion: { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 10 },
  pollOption:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(155,142,196,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 7, overflow: 'hidden', position: 'relative',
  },
  pollOptionVoted: { borderColor: '#9B8EC4', backgroundColor: 'rgba(155,142,196,0.12)' },
  pollOptionText:  { flex: 1, fontSize: 13, color: colors.gray1, fontWeight: '500' },
  pollOptionTextVoted: { color: '#9B8EC4', fontWeight: '700' },
  pollBar:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(155,142,196,0.08)', borderRadius: radius.sm },
  pollPct:  { fontSize: 12, color: colors.gray2, fontWeight: '600', minWidth: 32, textAlign: 'right' },
  pollMeta: { fontSize: 11, color: colors.gray2, marginTop: 4 },

  // Gather tools row (check-in + icebreaker buttons above RSVP)
  gatherToolsRow: {
    flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center',
  },
  toolBtn: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center',
  },
  toolBtnActive: { borderColor: '#34D399', backgroundColor: 'rgba(52,211,153,0.1)' },
  toolBtnLate:   { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.1)' },
  toolBtnText:   { fontSize: 12, fontWeight: '600', color: colors.white },
  checkinCount: {
    backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 10,
  },
  checkinCountText: { fontSize: 11, fontWeight: '700', color: '#34D399' },

  // Emergency SOS button — subtle but always there
  emergencyBtn: {
    alignItems: 'center',
    marginBottom: 6,
  },
  emergencyInner: {
    backgroundColor: 'rgba(239,68,68,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: 6,
  },
  emergencyText: { fontSize: 11, color: 'rgba(239,68,68,0.6)', fontWeight: '600', letterSpacing: 0.5 },

  // Safety modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  safetyModal: {
    backgroundColor: colors.panel, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: 40,
  },
  safetyTitle: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 8 },
  safetyBody:  { fontSize: 14, color: colors.gray1, marginBottom: spacing.md },
  safetyTip: {
    backgroundColor: 'rgba(52,211,153,0.06)', borderLeftWidth: 3, borderLeftColor: '#34D399',
    borderRadius: radius.sm, padding: spacing.sm, marginBottom: 8,
  },
  safetyTipText: { fontSize: 13, color: colors.white, lineHeight: 20 },
  safetyBtn: {
    backgroundColor: '#9B8EC4', borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.md,
  },
  safetyBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  // Icebreaker modal
  icebreakerModal: {
    backgroundColor: colors.panel, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: 40,
  },
  icebreakerTitle:  { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: spacing.md },
  icebreakerSetRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  setBtn: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center',
  },
  setBtnActive:     { borderColor: '#9B8EC4', backgroundColor: 'rgba(155,142,196,0.15)' },
  setBtnText:       { fontSize: 12, fontWeight: '600', color: colors.gray1 },
  setBtnTextActive: { color: '#9B8EC4' },
  icebreakerCard: {
    backgroundColor: 'rgba(155,142,196,0.08)', borderWidth: 1,
    borderColor: 'rgba(155,142,196,0.3)', borderRadius: radius.md,
    padding: spacing.lg, minHeight: 100, justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icebreakerText: { fontSize: 17, color: colors.white, fontWeight: '500', lineHeight: 26, textAlign: 'center' },
  icebreakerBtns: { flexDirection: 'row', gap: 10 },
  icebreakerNextBtn: {
    flex: 1, backgroundColor: '#9B8EC4', borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  icebreakerNextText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
