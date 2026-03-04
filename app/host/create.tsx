import { useState } from 'react';
import * as Location from 'expo-location';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Switch, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../lib/theme';
import { createEvent, PAYOUT_PRESETS, PayoutStructure, BracketFormat, VIBES, INTEREST_TAGS, LOOKING_FOR_OPTIONS, BRING_OPTIONS } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'flag_football', label: '🏈 Flag Football', sport: true  },
  { key: 'basketball',    label: '🏀 Basketball',    sport: true  },
  { key: 'soccer',        label: '⚽ Soccer',        sport: true  },
  { key: 'volleyball',    label: '🏐 Volleyball',    sport: true  },
  { key: 'softball',      label: '🥎 Softball',      sport: true  },
  { key: 'tennis',        label: '🎾 Tennis',        sport: true  },
  { key: 'pickleball',    label: '🏓 Pickleball',    sport: true  },
  { key: 'golf',          label: '⛳ Golf',           sport: true  },
  { key: 'cornhole',      label: '🌽 Cornhole',      sport: true  },
  { key: 'dodgeball',     label: '🔴 Dodgeball',     sport: true  },
  { key: 'kickball',      label: '👟 Kickball',       sport: true  },
  { key: 'ultimate_frisbee', label: '🥏 Ultimate Frisbee', sport: true  },
  { key: 'food',          label: '🍲 Food & Drink',  sport: false },
  { key: 'music',         label: '🎵 Music',          sport: false },
  { key: 'arts',          label: '🎨 Arts',           sport: false },
  { key: 'games',         label: '🎲 Games',          sport: false },
  { key: 'fitness',       label: '🏃 Fitness',        sport: false },
  { key: 'social',        label: '🤝 Social',         sport: false },
  { key: 'other',         label: '⭐ Other',          sport: false },
];

// Team size options per sport — { value: number, label: string }
type TeamOption = { value: number; label: string };
const SPORT_TEAM_SIZES: Record<string, TeamOption[]> = {
  flag_football: [
    { value:  4, label: '4v4'  },
    { value:  5, label: '5v5'  },
    { value:  6, label: '6v6'  },
    { value:  7, label: '7v7'  },
    { value:  8, label: '8v8'  },
    { value:  9, label: '9v9'  },
    { value: 11, label: '11v11'},
  ],
  basketball: [
    { value:  3, label: '3v3 (Half Court)' },
    { value:  5, label: '5v5 (Full Court)' },
  ],
  soccer: [
    { value:  5, label: '5v5 (Indoor)'  },
    { value:  6, label: '6v6'            },
    { value:  7, label: '7v7'            },
    { value: 11, label: '11v11 (Full)'  },
  ],
  volleyball: [
    { value: 2, label: '2v2 (Beach)'    },
    { value: 4, label: '4v4'             },
    { value: 6, label: '6v6 (Standard)' },
  ],
  softball: [
    { value:  9, label: '9v9 (Standard)' },
    { value: 10, label: '10v10 (Coed)'   },
  ],
  tennis: [
    { value: 1, label: 'Singles (1v1)' },
    { value: 2, label: 'Doubles (2v2)' },
  ],
  pickleball: [
    { value: 1, label: 'Singles (1v1)' },
    { value: 2, label: 'Doubles (2v2)' },
  ],
  golf: [
    { value: 1, label: 'Individual'     },
    { value: 2, label: 'Best Ball (2)'  },
    { value: 4, label: 'Scramble (4)'   },
  ],
  cornhole: [
    { value: 1, label: 'Singles (1v1)' },
    { value: 2, label: 'Doubles (2v2)' },
  ],
  dodgeball: [
    { value: 5,  label: '5v5'  },
    { value: 6,  label: '6v6'  },
    { value: 10, label: '10v10'},
  ],
  kickball: [
    { value:  8, label: '8v8'   },
    { value: 10, label: '10v10' },
  ],
  ultimate_frisbee: [
    { value: 5,  label: '5v5 (Casual)'     },
    { value: 7,  label: '7v7 (Standard)'   },
    { value: 11, label: '11v11 (Full Field)'},
  ],
};

// For non-sport categories or fallback
const GENERIC_TEAM_SIZES: TeamOption[] = [
  { value:  1, label: '🧍 Individual' },
  { value:  2, label: '👥 Pairs (2)'  },
  { value:  3, label: '👥 3-person'   },
  { value:  4, label: '👥 4-person'   },
  { value:  5, label: '👥 5-person'   },
];

function getTeamSizes(cat: string): TeamOption[] {
  return SPORT_TEAM_SIZES[cat] ?? GENERIC_TEAM_SIZES;
}

const RECURRENCE = [
  { key: 'none',     label: 'One-time'      },
  { key: 'weekly',   label: 'Weekly'        },
  { key: 'biweekly', label: 'Every 2 weeks' },
  { key: 'monthly',  label: 'Monthly'       },
];

const BRACKET_FORMATS: { key: BracketFormat; label: string; desc: string }[] = [
  { key: 'single_elimination', label: 'Single Elim',  desc: 'One loss = out. Fast.'            },
  { key: 'double_elimination', label: 'Double Elim',  desc: 'Two losses to be out.'            },
  { key: 'round_robin',        label: 'Round Robin',  desc: 'Everyone plays everyone.'         },
  { key: 'swiss',              label: 'Swiss',        desc: 'Paired by record. No elimination.'},
];

const PAYOUT_KEYS: PayoutStructure[] = ['winner_takes_all','top_2','top_3','top_4','bounty','custom'];

const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

const TIME_OPTIONS: { label: string; value: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    const ampm = h < 12 ? 'AM' : 'PM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    const min  = m.toString().padStart(2, '0');
    TIME_OPTIONS.push({ label: `${hour}:${min} ${ampm}`, value: `${h.toString().padStart(2,'0')}:${min}` });
  }
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────

function CalendarPicker({ visible, selectedDate, onSelect, onClose }:
  { visible: boolean; selectedDate: Date | null; onSelect: (d: Date) => void; onClose: () => void }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [viewYear,  setViewYear]  = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth()    ?? today.getMonth());
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonth = () => { if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); };
  const cells: (number|null)[] = [...Array(firstDay).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cal.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={cal.sheet}>
          <View style={cal.nav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{top:10,bottom:10,left:10,right:10}}><Text style={cal.arrow}>‹</Text></TouchableOpacity>
            <Text style={cal.title}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{top:10,bottom:10,left:10,right:10}}><Text style={cal.arrow}>›</Text></TouchableOpacity>
          </View>
          <View style={cal.weekRow}>{DAY_NAMES.map(d=><Text key={d} style={cal.weekDay}>{d}</Text>)}</View>
          <View style={cal.grid}>
            {cells.map((day,i)=>{
              if(!day) return <View key={`_${i}`} style={cal.cell}/>;
              const past=new Date(viewYear,viewMonth,day)<today;
              const sel=!!selectedDate&&selectedDate.getFullYear()===viewYear&&selectedDate.getMonth()===viewMonth&&selectedDate.getDate()===day;
              const tod=day===today.getDate()&&viewMonth===today.getMonth()&&viewYear===today.getFullYear();
              return (
                <TouchableOpacity key={day} style={[cal.cell,tod&&!sel&&cal.cellToday,sel&&cal.cellSel]}
                  onPress={()=>{ if(!past){onSelect(new Date(viewYear,viewMonth,day));onClose();} }} activeOpacity={past?1:0.75}>
                  <Text style={[cal.cellText,tod&&!sel&&cal.cellTextToday,sel&&cal.cellTextSel,past&&cal.cellTextPast]}>{day}</Text>
                </TouchableOpacity>);
            })}
          </View>
          <TouchableOpacity style={cal.doneBtn} onPress={onClose}><Text style={cal.doneBtnText}>Done</Text></TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const cal = StyleSheet.create({
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', alignItems:'center', padding:spacing.lg },
  sheet:        { backgroundColor:'#1A1A1A', borderRadius:radius.lg, borderWidth:1, borderColor:colors.border, padding:spacing.md, width:'100%' },
  nav:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:spacing.md },
  arrow:        { fontSize:28, color:colors.orange, fontWeight:'700', lineHeight:32 },
  title:        { fontSize:17, fontWeight:'700', color:colors.white },
  weekRow:      { flexDirection:'row', marginBottom:6 },
  weekDay:      { flex:1, textAlign:'center', fontSize:11, fontWeight:'700', color:colors.gray2, paddingBottom:8 },
  grid:         { flexDirection:'row', flexWrap:'wrap' },
  cell:         { width:`${100/7}%` as any, aspectRatio:1, alignItems:'center', justifyContent:'center', padding:2 },
  cellToday:    { borderRadius:999, borderWidth:1.5, borderColor:colors.orange },
  cellSel:      { borderRadius:999, backgroundColor:colors.orange },
  cellText:     { fontSize:14, fontWeight:'500', color:colors.white },
  cellTextToday:{ color:colors.orange, fontWeight:'700' },
  cellTextSel:  { color:'#000', fontWeight:'800' },
  cellTextPast: { color:colors.gray3, opacity:0.4 },
  doneBtn:      { marginTop:spacing.md, backgroundColor:colors.orange, borderRadius:radius.sm, paddingVertical:12, alignItems:'center' },
  doneBtnText:  { color:colors.white, fontWeight:'700', fontSize:15 },
});

// ── TIME PICKER ───────────────────────────────────────────────────────────────

function TimePicker({ visible, selectedValue, onSelect, onClose, title = 'Select Time' }:
  { visible: boolean; selectedValue: string; onSelect: (v: string) => void; onClose: () => void; title?: string }) {
  const initIdx = Math.max(0, TIME_OPTIONS.findIndex(t => t.value === selectedValue));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={tp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={tp.sheet}>
          <Text style={tp.title}>{title}</Text>
          <FlatList data={TIME_OPTIONS} keyExtractor={i=>i.value} style={tp.list}
            initialScrollIndex={initIdx} getItemLayout={(_,idx)=>({length:48,offset:48*idx,index:idx})}
            renderItem={({item})=>{
              const active=item.value===selectedValue;
              return (
                <TouchableOpacity style={[tp.item,active&&tp.itemActive]} onPress={()=>{onSelect(item.value);onClose();}} activeOpacity={0.75}>
                  <Text style={[tp.itemText,active&&tp.itemTextActive]}>{item.label}</Text>
                  {active&&<Text style={tp.check}>✓</Text>}
                </TouchableOpacity>);
            }}/>
          <TouchableOpacity style={tp.doneBtn} onPress={onClose}><Text style={tp.doneBtnText}>Done</Text></TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const tp = StyleSheet.create({
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', alignItems:'center', padding:spacing.lg },
  sheet:        { backgroundColor:'#1A1A1A', borderRadius:radius.lg, borderWidth:1, borderColor:colors.border, width:'78%', maxHeight:440, padding:spacing.md },
  title:        { fontSize:16, fontWeight:'700', color:colors.white, textAlign:'center', marginBottom:spacing.sm },
  list:         { maxHeight:320 },
  item:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', height:48, paddingHorizontal:spacing.md, borderRadius:radius.sm },
  itemActive:   { backgroundColor:'rgba(249,115,22,0.13)' },
  itemText:     { fontSize:16, color:colors.gray1, fontWeight:'500' },
  itemTextActive:{ color:colors.orange, fontWeight:'700' },
  check:        { color:colors.orange, fontSize:16, fontWeight:'700' },
  doneBtn:      { marginTop:spacing.sm, backgroundColor:colors.orange, borderRadius:radius.sm, paddingVertical:12, alignItems:'center' },
  doneBtnText:  { color:colors.white, fontWeight:'700', fontSize:15 },
});

// ── UTILS ─────────────────────────────────────────────────────────────────────

function formatDisplayDate(d: Date) {
  return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
function toDBDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getTimeLabel(value: string) {
  return TIME_OPTIONS.find(t=>t.value===value)?.label ?? value;
}
function recurrenceDesc(key: string, startDate: Date | null): string {
  if (!startDate) return 'Pick a start date to see the schedule.';
  const day = DAY_NAMES[startDate.getDay()];
  const dateStr = startDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const n = startDate.getDate();
  const ord=['th','st','nd','rd']; const v=n%100;
  const suffix=ord[(v-20)%10]||ord[v]||ord[0];
  switch(key){
    case 'weekly':   return `Repeats every ${day} starting ${dateStr}.`;
    case 'biweekly': return `Repeats every other ${day} starting ${dateStr}.`;
    case 'monthly':  return `Repeats monthly on the ${n}${suffix}, starting ${dateStr}.`;
    default: return '';
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default function CreateEvent() {
  const { user } = useAuth();

  // ── Compete vs Gather toggle ─────────────────────────────────────────────────
  // Compete = sports/competition events (with or without buy-in)
  // Gather  = social/community events   (with or without buy-in)
  const [eventMode, setEventMode] = useState<'compete' | 'gather'>('compete');

  // Basic info
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [location,    setLocation]    = useState('');
  const [category,    setCategory]    = useState('sports');
  const [cap,         setCap]         = useState('32');
  const [saving,      setSaving]      = useState(false);
  const [focused,     setFocused]     = useState<string | null>(null);

  // Date & time
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startTime,    setStartTime]    = useState('10:00');
  const [endTime,      setEndTime]      = useState('13:00');
  const [showCal,      setShowCal]      = useState(false);
  const [showStart,    setShowStart]    = useState(false);
  const [showEnd,      setShowEnd]      = useState(false);

  // Recurrence
  const [recurrence, setRecurrence] = useState('none');

  // Buy-in
  const [hasBuyIn,    setHasBuyIn]    = useState(false);
  const [buyInAmount, setBuyInAmount] = useState('');

  // Tournament + privacy
  const [isTournament,    setIsTournament]    = useState(false);
  const [isPrivate,       setIsPrivate]       = useState(false);
  const [doorCheckinEnabled, setDoorCheckinEnabled] = useState(false);

  // Teams
  const [teamsEnabled,   setTeamsEnabled]   = useState(false);
  const [maxTeamSize,    setMaxTeamSize]    = useState('10');
  const [allowSelfTeam,  setAllowSelfTeam]  = useState(true);
  const [prizePool,      setPrizePool]      = useState('');
  const [prizeEmoji,     setPrizeEmoji]     = useState('🏆');

  const PRIZE_EMOJIS = ['🏆','🥇','🎖️','💎','👑','🎯','💪','🔥','⚡','🌟','💰','🏅'];
  const [bracketFormat,   setBracketFormat]   = useState<BracketFormat>('single_elimination');
  const [payoutStructure, setPayoutStructure] = useState<PayoutStructure>('winner_takes_all');
  const [customSplits,    setCustomSplits]    = useState('');  // e.g. "50,30,20"
  const [teamSize,        setTeamSize]        = useState('1');
  const [customTeamSize,  setCustomTeamSize]  = useState('');
  const [showCustomTeam,  setShowCustomTeam]  = useState(false);

  // Gather fields (free events only)
  const [gatherVibe,      setGatherVibe]      = useState('social');
  const [gatherTags,      setGatherTags]      = useState<string[]>([]);
  const [gatherLookingFor,setGatherLookingFor]= useState<string[]>([]);
  const [gatherBringOpts, setGatherBringOpts] = useState<string[]>([]);
  const [anonRsvp,        setAnonRsvp]        = useState(false);

  const inp = (f: string) => [styles.input, focused === f && styles.inputFocused];

  // When category changes, auto-select the first (most common) team size for that sport
  const handleCategoryChange = (key: string) => {
    setCategory(key);
    const sizes = getTeamSizes(key);
    setTeamSize(sizes[0].value.toString());
    setShowCustomTeam(false);
    setCustomTeamSize('');
  };

  // Estimated prize pool from buy-in (computed, separate from prize text state)
  const estimatedPrizePool = hasBuyIn ? Math.floor(parseFloat(buyInAmount||'0') * parseInt(cap||'0') * 0.9) : 0;

  const validate = (): string | null => {
    if (!title.trim())    return 'Event title is required.';
    if (!location.trim()) return 'Location is required.';
    if (!selectedDate)    return 'Please pick a date.';
    const capNum = parseInt(cap);
    if (isNaN(capNum) || capNum < 2 || capNum > 500) return 'Cap must be between 2 and 500.';
    if (hasBuyIn && (isNaN(parseFloat(buyInAmount)) || parseFloat(buyInAmount) < 1))
      return 'Buy-in amount must be at least $1.';
    if (isTournament && payoutStructure === 'custom') {
      const splits = customSplits.split(',').map(s => parseInt(s.trim()));
      if (splits.some(isNaN) || splits.reduce((a,b)=>a+b,0) !== 100)
        return 'Custom payout splits must add up to exactly 100%.';
    }
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) { Alert.alert('Check your info', err); return; }
    setSaving(true);
    try {
      const parsedSplits = payoutStructure === 'custom'
        ? customSplits.split(',').map(s => parseInt(s.trim()))
        : PAYOUT_PRESETS[payoutStructure].splits;

      // Geocode the location address to get lat/lng for map pins
      let geoLat: number | null = null;
      let geoLng: number | null = null;
      try {
        const geoResults = await Location.geocodeAsync(location.trim());
        if (geoResults.length > 0) {
          geoLat = geoResults[0].latitude;
          geoLng = geoResults[0].longitude;
        }
      } catch (_) { /* geocoding is best-effort — map pin just won't show */ }

      const event = await createEvent({
        host_id:            user!.id,
        title:              title.trim(),
        description:        description.trim() || null,
        location:           location.trim(),
        date:               toDBDate(selectedDate!),
        time:               startTime,
        end_time:           endTime,
        category,
        has_buy_in:         hasBuyIn,
        buy_in_amount:      hasBuyIn ? parseFloat(buyInAmount) : null,
        cap:                parseInt(cap),
        is_active:          true,
        is_private:         isPrivate,
        door_checkin_enabled: hasBuyIn ? doorCheckinEnabled : false,
        recurrence,
        is_tournament:      isTournament,
        bracket_format:     isTournament ? bracketFormat : null,
        payout_structure:   isTournament && hasBuyIn ? payoutStructure : null,
        payout_splits:      isTournament && hasBuyIn ? parsedSplits : null,
        team_size:          isTournament ? (showCustomTeam ? parseInt(customTeamSize||'1') : parseInt(teamSize)) : 1,
        // Teams feature
        teams_enabled:      teamsEnabled,
        max_team_size:      teamsEnabled ? parseInt(maxTeamSize||'10') : null,
        allow_self_team:    teamsEnabled ? allowSelfTeam : false,
        prize_pool:         prizePool.trim() || null,
        prize_emoji:        prizePool.trim() ? prizeEmoji : null,
        // Gather fields
        vibe:               eventMode === 'gather' ? gatherVibe : null,
        interest_tags:      eventMode === 'gather' ? gatherTags : [],
        looking_for_tags:   eventMode === 'gather' ? gatherLookingFor : [],
        bring_options:      eventMode === 'gather' ? gatherBringOpts : [],
        is_anonymous_rsvp:  eventMode === 'gather' ? anonRsvp : false,
        latitude:           geoLat,
        longitude:          geoLng,
      });
      router.replace(`/host/event/${event.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not create event.');
    } finally {
      setSaving(false);
    }
  };

  // Filter categories by mode
  const visibleCategories = CATEGORIES.filter(c =>
    eventMode === 'compete' ? c.sport : !c.sport
  );

  return (
    <>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── COMPETE / GATHER TOGGLE ── */}
          <View style={styles.modeToggleWrap}>
            <TouchableOpacity
              style={[styles.modeBtn, eventMode === 'compete' && styles.modeBtnActiveCompete]}
              onPress={() => {
                setEventMode('compete');
                // Reset category to first sport category
                const firstSport = CATEGORIES.find(c => c.sport);
                if (firstSport) handleCategoryChange(firstSport.key);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modeBtnEmoji}>{'🏆'}</Text>
              <Text style={[styles.modeBtnLabel, eventMode === 'compete' && styles.modeBtnLabelActive]}>Compete</Text>
              <Text style={[styles.modeBtnSub, eventMode === 'compete' && { color: 'rgba(255,255,255,0.75)' }]}>Sports & competition</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, eventMode === 'gather' && styles.modeBtnActiveGather]}
              onPress={() => {
                setEventMode('gather');
                // Reset category to first social category
                const firstSocial = CATEGORIES.find(c => !c.sport);
                if (firstSocial) handleCategoryChange(firstSocial.key);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modeBtnEmoji}>{'🤝'}</Text>
              <Text style={[styles.modeBtnLabel, eventMode === 'gather' && styles.modeBtnLabelActive]}>Gather</Text>
              <Text style={[styles.modeBtnSub, eventMode === 'gather' && { color: 'rgba(255,255,255,0.75)' }]}>Social & community</Text>
            </TouchableOpacity>
          </View>

          {/* ── EVENT DETAILS ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Details</Text>

            <Text style={styles.label}>Event Title *</Text>
            <TextInput style={inp('title')} value={title} onChangeText={setTitle}
              placeholder="Sunday Flag Football Pickup" placeholderTextColor={colors.gray2}
              onFocus={()=>setFocused('title')} onBlur={()=>setFocused(null)} returnKeyType="next" maxLength={80}/>

            <Text style={styles.label}>Description</Text>
            <TextInput style={[inp('desc'),styles.textArea]} value={description} onChangeText={setDescription}
              placeholder="Tell people what to expect — format, rules, what to bring..."
              placeholderTextColor={colors.gray2} onFocus={()=>setFocused('desc')} onBlur={()=>setFocused(null)}
              multiline numberOfLines={4} textAlignVertical="top"/>

            <Text style={styles.label}>Location *</Text>
            <TextInput style={inp('location')} value={location} onChangeText={setLocation}
              placeholder="Balboa Park, Field 3 · San Diego, CA" placeholderTextColor={colors.gray2}
              onFocus={()=>setFocused('location')} onBlur={()=>setFocused(null)}/>
          </View>

          {/* ── DATE & TIME ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When</Text>

            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity style={[styles.pickerBtn, selectedDate && styles.pickerBtnFilled]}
              onPress={()=>setShowCal(true)} activeOpacity={0.8}>
              <Text style={styles.pickerIcon}>📅</Text>
              <Text style={[styles.pickerText, !selectedDate && styles.pickerPlaceholder]}>
                {selectedDate ? formatDisplayDate(selectedDate) : 'Choose a date'}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.timeRow}>
              <View style={{flex:1}}>
                <Text style={styles.label}>Start Time *</Text>
                <TouchableOpacity style={[styles.pickerBtn, styles.pickerBtnFilled]} onPress={()=>setShowStart(true)} activeOpacity={0.8}>
                  <Text style={styles.pickerIcon}>⏰</Text>
                  <Text style={styles.pickerText}>{getTimeLabel(startTime)}</Text>
                  <Text style={styles.pickerChevron}>›</Text>
                </TouchableOpacity>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.label}>Est. End Time</Text>
                <TouchableOpacity style={[styles.pickerBtn, styles.pickerBtnFilled]} onPress={()=>setShowEnd(true)} activeOpacity={0.8}>
                  <Text style={styles.pickerIcon}>🏁</Text>
                  <Text style={styles.pickerText}>{getTimeLabel(endTime)}</Text>
                  <Text style={styles.pickerChevron}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── RECURRENCE ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repeating?</Text>
            <View style={styles.chipRow}>
              {RECURRENCE.map(opt=>(
                <TouchableOpacity key={opt.key}
                  style={[styles.chip, recurrence===opt.key && styles.chipActive]}
                  onPress={()=>setRecurrence(opt.key)} activeOpacity={0.75}>
                  <Text style={[styles.chipText, recurrence===opt.key && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {recurrence !== 'none' && selectedDate && (
              <View style={styles.recInfo}>
                <Text style={styles.recInfoText}>{recurrenceDesc(recurrence, selectedDate)}</Text>
              </View>
            )}
          </View>

          {/* ── CATEGORY ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.chipRow}>
              {visibleCategories.map(c=>(
                <TouchableOpacity key={c.key}
                  style={[styles.chip, category===c.key && styles.chipActive]}
                  onPress={()=>handleCategoryChange(c.key)} activeOpacity={0.75}>
                  <Text style={[styles.chipText, category===c.key && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── RSVP CAP ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RSVP Cap</Text>
            <Text style={styles.hint}>Max participants. Anyone over the cap is automatically waitlisted.</Text>
            <TextInput style={[inp('cap'),styles.capInput]} value={cap} onChangeText={setCap}
              placeholder="32" placeholderTextColor={colors.gray2} keyboardType="number-pad"
              onFocus={()=>setFocused('cap')} onBlur={()=>setFocused(null)} maxLength={3}/>
            <Text style={styles.capNote}>2–500 · Waitlist is automatic &amp; unlimited</Text>
          </View>

          {/* ── BUY-IN / TICKETS ── */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={{flex:1}}>
                <Text style={styles.sectionTitle}>
                  {eventMode === 'gather' ? '🎟️ Tickets' : '💰 Buy-In'}
                </Text>
                <Text style={styles.hint}>
                  {eventMode === 'gather'
                    ? 'Charge admission. Great for shows, parties, and ticketed events.'
                    : 'Participants pay to enter. Prize pool built from entries.'}
                </Text>
              </View>
              <Switch value={hasBuyIn} onValueChange={setHasBuyIn}
                trackColor={{false:colors.border,true:colors.orange}} thumbColor={colors.white}/>
            </View>
            {hasBuyIn && (
              <>
                <View style={styles.buyInRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput style={[inp('buyin'),styles.buyInInput]} value={buyInAmount} onChangeText={setBuyInAmount}
                    placeholder={eventMode === 'gather' ? '15' : '25'}
                    placeholderTextColor={colors.gray2} keyboardType="decimal-pad"
                    onFocus={()=>setFocused('buyin')} onBlur={()=>setFocused(null)}/>
                  <Text style={styles.perPerson}>
                    {eventMode === 'gather' ? 'per ticket' : 'per person'}
                  </Text>
                </View>
                {eventMode === 'gather' && estimatedPrizePool > 0 && (
                  <View style={styles.prizePreview}>
                    <Text style={styles.prizePreviewText}>
                      {'🎟️ Estimated revenue: $'}{estimatedPrizePool.toLocaleString()}{' (after 10% platform fee)'}
                    </Text>
                  </View>
                )}
                {eventMode === 'compete' && estimatedPrizePool > 0 && (
                  <View style={styles.prizePreview}>
                    <Text style={styles.prizePreviewText}>
                      {'💰 Estimated prize pool: $'}{estimatedPrizePool.toLocaleString()}{' (after 10% platform fee)'}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── VISIBILITY (PUBLIC/PRIVATE) ── */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={{flex:1}}>
                <Text style={styles.sectionTitle}>Visibility</Text>
                <Text style={styles.hint}>
                  {isPrivate
                    ? 'Private — only people with your RSVP link can register.'
                    : 'Public — visible to anyone searching on Bord.'}
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: colors.border, true: colors.orange }}
                thumbColor={colors.white}
              />
            </View>
            <View style={styles.privacyPills}>
              <TouchableOpacity
                style={[styles.privacyPill, !isPrivate && styles.privacyPillActive]}
                onPress={() => setIsPrivate(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.privacyPillEmoji}>🌐</Text>
                <View>
                  <Text style={[styles.privacyPillLabel, !isPrivate && styles.privacyPillLabelActive]}>Public</Text>
                  <Text style={styles.privacyPillSub}>Appears in search &amp; map</Text>
                </View>
                {!isPrivate && <Text style={styles.privacyCheck}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.privacyPill, isPrivate && styles.privacyPillActive]}
                onPress={() => setIsPrivate(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.privacyPillEmoji}>🔒</Text>
                <View>
                  <Text style={[styles.privacyPillLabel, isPrivate && styles.privacyPillLabelActive]}>Private</Text>
                  <Text style={styles.privacyPillSub}>Invite-only via link</Text>
                </View>
                {isPrivate && <Text style={styles.privacyCheck}>✓</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── DOOR CHECK-IN ── only shown when buy-in / tickets are on ── */}
          {hasBuyIn && (
            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <View style={{flex:1}}>
                  <Text style={styles.sectionTitle}>
                    {eventMode === 'gather' ? '🎟️ Ticket Scanning at Door' : '📲 QR Check-In at Door'}
                  </Text>
                  <Text style={styles.hint}>
                    {eventMode === 'gather'
                      ? 'Attendees get a QR code after paying. A designated door person can scan to confirm entry.'
                      : 'Players get a QR code after paying. Scan at check-in to confirm their spot.'}
                  </Text>
                </View>
                <Switch
                  value={doorCheckinEnabled}
                  onValueChange={setDoorCheckinEnabled}
                  trackColor={{ false: colors.border, true: colors.orange }}
                  thumbColor={colors.white}
                />
              </View>
              {doorCheckinEnabled && (
                <View style={styles.doorCheckinNote}>
                  <Text style={styles.doorCheckinNoteText}>
                    {'📋 You\'ll get a Door Scanner link in your host dashboard to share with a designated person at the door. They can scan QR codes or check people in manually by name.'}
                  </Text>
                </View>
              )}
              {!doorCheckinEnabled && (
                <View style={styles.doorCheckinNote}>
                  <Text style={styles.doorCheckinNoteText}>
                    {'✅ Attendees will receive a confirmation # and their name will be on your RSVP list. No scanning required — just check names at the door.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── GATHER SETTINGS ── */}
          {eventMode === 'gather' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🤝 Gather Settings</Text>
              <Text style={styles.hint}>Help people find the right vibe and connect with others like them.</Text>

              {/* Vibe */}
              <Text style={[styles.hint,{marginTop:spacing.sm,fontWeight:'700',color:colors.gray1}]}>EVENT VIBE</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:spacing.sm}}>
                {VIBES.map(v=>(
                  <TouchableOpacity
                    key={v.key}
                    style={[styles.chip, gatherVibe===v.key && {borderColor:v.color,backgroundColor:v.color+'18'}]}
                    onPress={()=>setGatherVibe(v.key)} activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, gatherVibe===v.key && {color:v.color,fontWeight:'700'}]}>
                      {v.emoji} {v.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Interest tags */}
              <Text style={[styles.hint,{fontWeight:'700',color:colors.gray1}]}>INTEREST TAGS (optional)</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:spacing.sm}}>
                {INTEREST_TAGS.slice(0,16).map(t=>(
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, gatherTags.includes(t) && styles.chipActive]}
                    onPress={()=>setGatherTags(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t])}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, gatherTags.includes(t) && styles.chipTextActive]}>#{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Looking for */}
              <Text style={[styles.hint,{fontWeight:'700',color:colors.gray1}]}>LOOKING FOR (optional)</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:spacing.sm}}>
                {LOOKING_FOR_OPTIONS.map(l=>(
                  <TouchableOpacity
                    key={l.key}
                    style={[styles.chip, gatherLookingFor.includes(l.key) && styles.chipActive]}
                    onPress={()=>setGatherLookingFor(prev=>prev.includes(l.key)?prev.filter(x=>x!==l.key):[...prev,l.key])}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, gatherLookingFor.includes(l.key) && styles.chipTextActive]}>
                      {l.emoji} {l.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bring something */}
              <Text style={[styles.hint,{fontWeight:'700',color:colors.gray1}]}>ATTENDEES CAN BRING (optional)</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:spacing.sm}}>
                {BRING_OPTIONS.map(b=>(
                  <TouchableOpacity
                    key={b.key}
                    style={[styles.chip, gatherBringOpts.includes(b.key) && styles.chipActive]}
                    onPress={()=>setGatherBringOpts(prev=>prev.includes(b.key)?prev.filter(x=>x!==b.key):[...prev,b.key])}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, gatherBringOpts.includes(b.key) && styles.chipTextActive]}>
                      {b.emoji} {b.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Anonymous RSVP */}
              <View style={styles.toggleRow}>
                <View style={{flex:1}}>
                  <Text style={styles.sectionTitle}>Anonymous headcount</Text>
                  <Text style={styles.hint}>Show "12 going" but hide names until 24hrs before</Text>
                </View>
                <Switch value={anonRsvp} onValueChange={setAnonRsvp}
                  trackColor={{false:colors.border,true:colors.lavender}} thumbColor={colors.white}/>
              </View>
            </View>
          )}

          {/* ── TOURNAMENT ── */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={{flex:1}}>
                <Text style={styles.sectionTitle}>Tournament</Text>
                <Text style={styles.hint}>Enable brackets, seeding, and live round tracking.</Text>
              </View>
              <Switch value={isTournament} onValueChange={setIsTournament}
                trackColor={{false:colors.border,true:colors.orange}} thumbColor={colors.white}/>
            </View>

            {isTournament && (
              <>
                {/* Bracket format */}
                <Text style={styles.label}>Bracket Format</Text>
                <View style={styles.bracketGrid}>
                  {BRACKET_FORMATS.map(f=>(
                    <TouchableOpacity key={f.key}
                      style={[styles.bracketCard, bracketFormat===f.key && styles.bracketCardActive]}
                      onPress={()=>setBracketFormat(f.key)} activeOpacity={0.8}>
                      <Text style={[styles.bracketCardTitle, bracketFormat===f.key && styles.bracketCardTitleActive]}>{f.label}</Text>
                      <Text style={styles.bracketCardDesc}>{f.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Team size — smart per sport */}
                <Text style={[styles.label,{marginTop:spacing.md}]}>Team Size</Text>
                <View style={styles.chipRow}>
                  {getTeamSizes(category).map(opt=>(
                    <TouchableOpacity key={opt.value}
                      style={[styles.chip, teamSize===opt.value.toString() && !showCustomTeam && styles.chipActive]}
                      onPress={()=>{ setTeamSize(opt.value.toString()); setShowCustomTeam(false); setCustomTeamSize(''); }}
                      activeOpacity={0.75}>
                      <Text style={[styles.chipText, teamSize===opt.value.toString() && !showCustomTeam && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {/* Custom size chip */}
                  <TouchableOpacity
                    style={[styles.chip, showCustomTeam && styles.chipActive]}
                    onPress={()=>setShowCustomTeam(true)}
                    activeOpacity={0.75}>
                    <Text style={[styles.chipText, showCustomTeam && styles.chipTextActive]}>✏️ Custom</Text>
                  </TouchableOpacity>
                </View>
                {showCustomTeam && (
                  <View style={{ marginTop: 8 }}>
                    <TextInput
                      style={[inp('customTeam'), { marginBottom: 4 }]}
                      value={customTeamSize}
                      onChangeText={v => { setCustomTeamSize(v); setTeamSize(v); }}
                      placeholder="e.g. 8 (for 8v8 flag football)"
                      placeholderTextColor={colors.gray2}
                      keyboardType="number-pad"
                      onFocus={()=>setFocused('customTeam')}
                      onBlur={()=>setFocused(null)}
                      maxLength={2}
                    />
                    <Text style={styles.hint}>Enter players per side. 8 = 8v8.</Text>
                  </View>
                )}

                {/* Payout structure — only shown when buy-in is on */}
                {hasBuyIn && (
                  <>
                    <Text style={[styles.label,{marginTop:spacing.md}]}>Payout Structure</Text>
                    <View style={styles.payoutList}>
                      {PAYOUT_KEYS.map(k=>{
                        const p = PAYOUT_PRESETS[k];
                        const selected = payoutStructure === k;
                        return (
                          <TouchableOpacity key={k}
                            style={[styles.payoutCard, selected && styles.payoutCardActive]}
                            onPress={()=>setPayoutStructure(k)} activeOpacity={0.8}>
                            <Text style={styles.payoutEmoji}>{p.emoji}</Text>
                            <View style={{flex:1}}>
                              <Text style={[styles.payoutLabel, selected && {color:colors.white}]}>{p.label}</Text>
                              <Text style={styles.payoutDesc}>{p.desc}</Text>
                            </View>
                            {selected && <Text style={styles.payoutCheck}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Custom splits input */}
                    {payoutStructure === 'custom' && (
                      <View style={{marginTop:spacing.sm}}>
                        <Text style={styles.label}>Custom Splits (must total 100)</Text>
                        <TextInput style={inp('splits')} value={customSplits} onChangeText={setCustomSplits}
                          placeholder="e.g. 60,25,15" placeholderTextColor={colors.gray2}
                          onFocus={()=>setFocused('splits')} onBlur={()=>setFocused(null)} keyboardType="numbers-and-punctuation"/>
                        <Text style={styles.hint}>Comma-separated percentages. First = 1st place.</Text>
                      </View>
                    )}

                    {/* Payout preview */}
                    {estimatedPrizePool > 0 && payoutStructure !== 'custom' && (
                      <View style={styles.payoutPreview}>
                        <Text style={styles.payoutPreviewTitle}>💵 Payout Preview (${estimatedPrizePool.toLocaleString()} pool)</Text>
                        {PAYOUT_PRESETS[payoutStructure].splits.map((pct,i)=>(
                          <View key={i} style={styles.payoutPreviewRow}>
                            <Text style={styles.payoutPreviewPlace}>
                              {i===0?'🥇':i===1?'🥈':i===2?'🥉':'🏅'} {i===0?'1st':i===1?'2nd':i===2?'3rd':`${i+1}th`} place
                            </Text>
                            <Text style={styles.payoutPreviewAmt}>
                              ${Math.floor(estimatedPrizePool*pct/100).toLocaleString()} ({pct}%)
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </View>

          {/* ── TEAMS & PRIZE ── */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={{flex:1}}>
                <Text style={styles.sectionTitle}>⚔️ Teams</Text>
                <Text style={styles.hint}>Let participants form or join teams. Great for squadron tournaments, org events, etc.</Text>
              </View>
              <Switch value={teamsEnabled} onValueChange={setTeamsEnabled}
                trackColor={{false:colors.border,true:colors.orange}} thumbColor={colors.white}/>
            </View>

            {teamsEnabled && (
              <>
                <Text style={styles.label}>Max Players Per Team</Text>
                <TextInput
                  style={[inp('maxTeam'), styles.capInput]}
                  value={maxTeamSize}
                  onChangeText={setMaxTeamSize}
                  placeholder="10"
                  placeholderTextColor={colors.gray2}
                  keyboardType="number-pad"
                  onFocus={()=>setFocused('maxTeam')}
                  onBlur={()=>setFocused(null)}
                  maxLength={3}
                />

                <View style={[styles.toggleRow, {marginTop: spacing.md}]}>
                  <View style={{flex:1}}>
                    <Text style={styles.label}>Allow Self-Organized Teams</Text>
                    <Text style={styles.hint}>Participants can create their own team. Turn off to have you assign everyone.</Text>
                  </View>
                  <Switch value={allowSelfTeam} onValueChange={setAllowSelfTeam}
                    trackColor={{false:colors.border,true:colors.orange}} thumbColor={colors.white}/>
                </View>
              </>
            )}

            {/* Prize Pool — available even without teams toggle */}
            <Text style={[styles.label, {marginTop: spacing.md}]}>🏆 Prize / Award</Text>
            <Text style={styles.hint}>Displayed prominently on the event page to fuel competition. Leave blank if no prize.</Text>
            <TextInput
              style={inp('prize')}
              value={prizePool}
              onChangeText={setPrizePool}
              placeholder='e.g. "Trophy + Bragging Rights" or "$500 cash"'
              placeholderTextColor={colors.gray2}
              onFocus={()=>setFocused('prize')}
              onBlur={()=>setFocused(null)}
              maxLength={80}
            />
            {prizePool.trim().length > 0 && (
              <>
                <Text style={[styles.label, {marginTop: spacing.sm}]}>Prize Icon</Text>
                <View style={styles.chipRow}>
                  {PRIZE_EMOJIS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.chip, prizeEmoji === e && styles.chipActive, {paddingHorizontal: 10}]}
                      onPress={() => setPrizeEmoji(e)}
                      activeOpacity={0.75}
                    >
                      <Text style={{fontSize: 22}}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.prizePreview}>
                  <Text style={styles.prizePreviewText}>
                    {prizeEmoji} Preview: "{prizePool}" — shown with a pulsing banner on your event page
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* ── CREATE BUTTON ── */}
          <TouchableOpacity style={[styles.createBtn, saving && {opacity:0.6}]}
            onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color={colors.white}/>
              : <Text style={styles.createBtnText}>
                  {isTournament ? 'Create Tournament & Get Link →' : 'Create Event & Get Link →'}
                </Text>
            }
          </TouchableOpacity>
          <Text style={styles.createNote}>{"You'll get a shareable RSVP link immediately after creating."}</Text>

        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarPicker visible={showCal} selectedDate={selectedDate} onSelect={setSelectedDate} onClose={()=>setShowCal(false)}/>
      <TimePicker visible={showStart} selectedValue={startTime} onSelect={setStartTime} onClose={()=>setShowStart(false)} title="Start Time"/>
      <TimePicker visible={showEnd} selectedValue={endTime} onSelect={setEndTime} onClose={()=>setShowEnd(false)} title="Estimated End Time"/>
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Compete/Gather toggle ───────────────────────────────────────────────────
  modeToggleWrap: {
    flexDirection: 'row', gap: spacing.sm,
    marginBottom: spacing.lg, marginTop: spacing.xs,
  },
  modeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card, gap: 3,
  },
  modeBtnActiveCompete: {
    borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.1)',
  },
  modeBtnActiveGather: {
    borderColor: '#9B8EC4', backgroundColor: 'rgba(155,142,196,0.1)',
  },
  modeBtnEmoji:  { fontSize: 24 },
  modeBtnLabel:  { fontSize: 15, fontWeight: '700', color: colors.gray1 },
  modeBtnLabelActive: { color: colors.white },
  modeBtnSub:    { fontSize: 11, color: colors.gray2, textAlign: 'center' },
  screen:  { flex:1, backgroundColor:colors.black },
  scroll:  { paddingHorizontal:spacing.md, paddingBottom:spacing.xxl, paddingTop:spacing.md },
  section: { marginBottom:spacing.xl },
  sectionTitle: { fontSize:20, fontWeight:'700', color:colors.white, marginBottom:spacing.sm },
  label:   { fontSize:11, fontWeight:'700', color:colors.gray2, letterSpacing:1, textTransform:'uppercase', marginBottom:6 },
  input:   { backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:colors.border, borderRadius:radius.sm, paddingHorizontal:spacing.md, paddingVertical:13, color:colors.white, fontSize:15, fontWeight:'500' },
  inputFocused: { borderColor:'rgba(249,115,22,0.5)' },
  textArea: { height:100, paddingTop:12 },
  hint:    { fontSize:13, color:colors.gray1, lineHeight:19, marginBottom:spacing.sm },

  pickerBtn:         { flexDirection:'row', alignItems:'center', gap:spacing.sm, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:colors.border, borderRadius:radius.sm, paddingHorizontal:spacing.md, paddingVertical:14 },
  pickerBtnFilled:   { borderColor:'rgba(249,115,22,0.4)' },
  pickerIcon:        { fontSize:18 },
  pickerText:        { flex:1, fontSize:15, fontWeight:'600', color:colors.white },
  pickerPlaceholder: { color:colors.gray2, fontWeight:'400' },
  pickerChevron:     { fontSize:22, color:colors.orange, fontWeight:'700' },
  timeRow:           { flexDirection:'row', gap:spacing.sm, marginTop:spacing.sm },

  chipRow:       { flexDirection:'row', flexWrap:'wrap', gap:8 },
  chip:          { borderWidth:1, borderColor:colors.border, borderRadius:radius.full, paddingHorizontal:14, paddingVertical:8, backgroundColor:colors.card },
  chipActive:    { backgroundColor:'rgba(249,115,22,0.13)', borderColor:colors.orange },
  chipText:      { fontSize:13, color:colors.gray1, fontWeight:'500' },
  chipTextActive:{ color:colors.orange, fontWeight:'700' },
  recInfo:       { marginTop:spacing.sm, backgroundColor:'rgba(249,115,22,0.07)', borderRadius:radius.sm, borderWidth:1, borderColor:'rgba(249,115,22,0.25)', paddingHorizontal:spacing.md, paddingVertical:10 },
  recInfoText:   { fontSize:13, color:colors.orange, fontWeight:'600' },

  capInput: { fontSize:22, fontWeight:'700', textAlign:'center', color:colors.white },
  capNote:  { fontSize:11, color:colors.gray2, textAlign:'center', marginTop:6, fontWeight:'500' },

  toggleRow:   { flexDirection:'row', alignItems:'flex-start', gap:spacing.md, marginBottom:spacing.md },
  buyInRow:    { flexDirection:'row', alignItems:'center', gap:spacing.sm, backgroundColor:'rgba(249,115,22,0.07)', borderWidth:1, borderColor:'rgba(249,115,22,0.3)', borderRadius:radius.sm, paddingHorizontal:spacing.md },
  dollarSign:  { fontSize:22, fontWeight:'700', color:colors.orange },
  buyInInput:  { flex:1, fontSize:28, fontWeight:'700', textAlign:'center', borderWidth:0, backgroundColor:'transparent', paddingHorizontal:0, color:colors.white, paddingVertical:12 },
  perPerson:   { fontSize:13, color:colors.gray1, fontWeight:'500' },
  prizePreview:{ marginTop:spacing.sm, backgroundColor:'rgba(52,211,153,0.07)', borderWidth:1, borderColor:'rgba(52,211,153,0.25)', borderRadius:radius.sm, padding:spacing.sm },
  prizePreviewText: { fontSize:12, color:colors.green, fontWeight:'600' },

  bracketGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:spacing.sm },
  bracketCard: { width:'48%', backgroundColor:colors.card, borderRadius:radius.sm, borderWidth:1, borderColor:colors.border, padding:spacing.sm },
  bracketCardActive: { borderColor:colors.orange, backgroundColor:'rgba(249,115,22,0.1)' },
  bracketCardTitle:  { fontSize:13, fontWeight:'700', color:colors.gray1, marginBottom:2 },
  bracketCardTitleActive: { color:colors.orange },
  bracketCardDesc:   { fontSize:11, color:colors.gray2, lineHeight:15 },

  payoutList: { gap:8, marginBottom:spacing.sm },
  payoutCard: { flexDirection:'row', alignItems:'center', gap:spacing.sm, backgroundColor:colors.card, borderRadius:radius.sm, borderWidth:1, borderColor:colors.border, padding:spacing.sm },
  payoutCardActive: { borderColor:colors.orange, backgroundColor:'rgba(249,115,22,0.08)' },
  payoutEmoji: { fontSize:22 },
  payoutLabel: { fontSize:14, fontWeight:'700', color:colors.gray1 },
  payoutDesc:  { fontSize:11, color:colors.gray2 },
  payoutCheck: { fontSize:16, color:colors.orange, fontWeight:'700' },

  payoutPreview: { backgroundColor:'rgba(52,211,153,0.07)', borderRadius:radius.sm, borderWidth:1, borderColor:'rgba(52,211,153,0.2)', padding:spacing.md, marginTop:spacing.sm },
  payoutPreviewTitle: { fontSize:13, fontWeight:'700', color:colors.green, marginBottom:spacing.sm },
  payoutPreviewRow:   { flexDirection:'row', justifyContent:'space-between', marginBottom:4 },
  payoutPreviewPlace: { fontSize:13, color:colors.gray1, fontWeight:'500' },
  payoutPreviewAmt:   { fontSize:13, color:colors.white, fontWeight:'700' },

  privacyBadge:        { borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 9, alignSelf: 'flex-start' },
  privacyBadgePrivate: { backgroundColor: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.3)' },
  privacyBadgePublic:  { backgroundColor: 'rgba(52,211,153,0.08)',  borderColor: 'rgba(52,211,153,0.25)' },
  privacyBadgeText:    { fontSize: 13, fontWeight: '700' },

  privacyPills:          { gap: 8, marginTop: 4 },
  privacyPill:           { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  privacyPillActive:     { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.08)' },
  doorCheckinNote: {
    marginTop: spacing.sm, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm,
  },
  doorCheckinNoteText:   { fontSize: 12, color: colors.gray1, lineHeight: 18 },
  privacyPillEmoji:      { fontSize: 22 },
  privacyPillLabel:      { fontSize: 14, fontWeight: '700', color: colors.gray1 },
  privacyPillLabelActive:{ color: colors.white },
  privacyPillSub:        { fontSize: 11, color: colors.gray2, marginTop: 1 },
  privacyCheck:          { marginLeft: 'auto' as any, fontSize: 16, color: colors.orange, fontWeight: '700' },

  createBtn:     { backgroundColor:colors.orange, borderRadius:radius.md, paddingVertical:17, alignItems:'center', marginBottom:spacing.sm },
  createBtnText: { color:colors.white, fontSize:17, fontWeight:'700', letterSpacing:0.3 },
  createNote:    { fontSize:12, color:colors.gray2, textAlign:'center', lineHeight:18 },
});