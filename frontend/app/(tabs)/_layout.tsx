import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.onSurfaceTertiary,
        tabBarStyle: {
          backgroundColor: theme.color.surfaceSecondary,
          borderTopColor: theme.color.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            dashboard: 'grid',
            ceo: 'sparkles',
            agents: 'people',
            tasks: 'list',
            approvals: 'shield-checkmark',
          };
          return <Ionicons name={map[route.name] || 'ellipse'} size={size - 2} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Command' }} />
      <Tabs.Screen name="ceo" options={{ title: 'CEO' }} />
      <Tabs.Screen name="agents" options={{ title: 'Agents' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
    </Tabs>
  );
}
