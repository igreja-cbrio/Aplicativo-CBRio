import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/Colors';
import { AnimatedDock } from '@/components/ui/AnimatedDock';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : `${name}-outline` as IconName}
      size={22}
      color={focused ? C.primary : C.text2}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <AnimatedDock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="inscricoes"
        options={{ title: 'Inscrições', tabBarIcon: ({ focused }) => <TabIcon name="ticket" focused={focused} /> }}
      />
      <Tabs.Screen
        name="biblia"
        options={{ title: 'Bíblia', tabBarIcon: ({ focused }) => <TabIcon name="book" focused={focused} /> }}
      />
      <Tabs.Screen
        name="assistir"
        options={{ title: 'Assistir', tabBarIcon: ({ focused }) => <TabIcon name="play-circle" focused={focused} /> }}
      />
      <Tabs.Screen
        name="comunidade"
        options={{ title: 'Grupos', tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} /> }}
      />
    </Tabs>
  );
}
