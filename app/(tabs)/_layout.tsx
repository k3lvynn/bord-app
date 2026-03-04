import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';
import { Text, View } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          height: 86,
        },
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.gray2,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 8, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="my-events"
        options={{
          title: 'My Events',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      {/* Hidden screens — still routable, just off the tab bar */}
      <Tabs.Screen name="compete"   options={{ href: null }} />
      <Tabs.Screen name="gather"    options={{ href: null }} />
      <Tabs.Screen name="map"       options={{ href: null }} />
      <Tabs.Screen name="posts"     options={{ href: null }} />
    </Tabs>
  );
}
