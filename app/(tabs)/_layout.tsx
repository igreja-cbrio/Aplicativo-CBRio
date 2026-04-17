import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/Colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return <Ionicons name={focused ? name : `${name}-outline` as IconName} size={24} color={focused ? C.primary : C.text2} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarStyle:     { borderTopWidth: 1, borderTopColor: C.border, height: 84, paddingBottom: 24 },
        tabBarActiveTintColor:   C.primary,
        tabBarInactiveTintColor: C.text2,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Início',    tabBarIcon: ({ focused }) => <TabIcon name="home"    focused={focused} /> }} />
      <Tabs.Screen name="checkin" options={{ title: 'Check-in',  tabBarIcon: ({ focused }) => <TabIcon name="qr-code" focused={focused} /> }} />
      <Tabs.Screen name="grupos"  options={{ title: 'Grupos',    tabBarIcon: ({ focused }) => <TabIcon name="people"  focused={focused} /> }} />
      <Tabs.Screen name="perfil"  options={{ title: 'Perfil',    tabBarIcon: ({ focused }) => <TabIcon name="person"  focused={focused} /> }} />
    </Tabs>
  );
}
