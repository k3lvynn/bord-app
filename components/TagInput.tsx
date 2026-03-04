// components/TagInput.tsx
// Searchable, creatable tag input used in profile edit and post compose.
// — Type to search the community tag registry
// — Tap a suggestion to add it
// — Type a brand-new name + hit "Create" to mint a new tag
// — No cap on how many tags a user can select

import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius } from '../lib/theme';
import { searchTags, Tag } from '../lib/supabase';

type Props = {
  selected: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxVisible?: number;
};

export default function TagInput({ selected, onChange, placeholder = 'Search or create tags…', maxVisible = 6 }: Props) {
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [showSugg,    setShowSugg]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchTags(text);
        // Filter out already-selected
        setSuggestions(results.filter(t => !selected.includes(t.name)));
        setShowSugg(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, [selected]);

  const addTag = (name: string) => {
    const clean = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!clean || selected.includes(clean)) return;
    onChange([...selected, clean]);
    setQuery('');
    setSuggestions([]);
    setShowSugg(false);
  };

  const removeTag = (name: string) => {
    onChange(selected.filter(t => t !== name));
  };

  const canCreate = query.trim().length >= 2 && !suggestions.some(s => s.name === query.toLowerCase().trim());
  const showDropdown = showSugg && (suggestions.length > 0 || (searching && query.length > 0) || canCreate);

  return (
    <View style={styles.container}>
      {/* Selected tags */}
      {selected.length > 0 && (
        <View style={styles.selectedRow}>
          {selected.map(tag => (
            <TouchableOpacity
              key={tag}
              style={styles.selectedChip}
              onPress={() => removeTag(tag)}
              activeOpacity={0.75}
            >
              <Text style={styles.selectedChipText}>#{tag}</Text>
              <Text style={styles.removeX}> ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          onFocus={() => { if (!query) handleChange(''); }}
          onBlur={() => setTimeout(() => setShowSugg(false), 200)}
          placeholder={placeholder}
          placeholderTextColor={colors.gray2}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => { if (canCreate) addTag(query.trim()); }}
        />
        {searching && <ActivityIndicator size="small" color={colors.orange} style={{ marginRight: 8 }} />}
      </View>

      {/* Suggestions dropdown */}
      {showDropdown && (
        <View style={styles.dropdown}>
          {/* Create new option */}
          {canCreate && (
            <TouchableOpacity
              style={styles.createRow}
              onPress={() => addTag(query.trim())}
              activeOpacity={0.8}
            >
              <Text style={styles.createIcon}>＋</Text>
              <Text style={styles.createText}>
                Create <Text style={{ color: colors.orange }}>#{query.trim().toLowerCase().replace(/\s+/g,'-')}</Text>
              </Text>
            </TouchableOpacity>
          )}
          {suggestions.slice(0, maxVisible).map(tag => (
            <TouchableOpacity
              key={tag.id}
              style={styles.suggRow}
              onPress={() => addTag(tag.name)}
              activeOpacity={0.75}
            >
              <Text style={styles.suggTag}>#{tag.name}</Text>
              <Text style={styles.suggCount}>{tag.use_count} uses</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Popular tags hint — shown when nothing selected and no query */}
      {selected.length === 0 && !query && (
        <Text style={styles.hint}>
          Tap to search, or type a new tag and press enter to create it.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },

  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(155,142,196,0.15)', borderWidth: 1,
    borderColor: 'rgba(155,142,196,0.4)', borderRadius: radius.full,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  selectedChipText: { fontSize: 13, color: '#9B8EC4', fontWeight: '600' },
  removeX:          { fontSize: 11, color: '#9B8EC4', opacity: 0.7 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.sm,
  },
  input: {
    flex: 1, paddingHorizontal: spacing.md, paddingVertical: 13,
    color: colors.white, fontSize: 15, fontWeight: '500',
  },

  dropdown: {
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, overflow: 'hidden',
  },

  createRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: 'rgba(249,115,22,0.05)',
  },
  createIcon: { fontSize: 16, color: colors.orange, fontWeight: '700' },
  createText: { fontSize: 14, color: colors.gray1, fontWeight: '500' },

  suggRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  suggTag:   { fontSize: 14, color: colors.white, fontWeight: '600' },
  suggCount: { fontSize: 11, color: colors.gray2 },

  hint: { fontSize: 12, color: colors.gray2, lineHeight: 17 },
});
