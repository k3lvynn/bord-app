// Redirect old /event/find route to home
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../lib/theme';

export default function FindRedirect() {
  useEffect(() => { router.replace('/'); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.orange} />
    </View>
  );
}
