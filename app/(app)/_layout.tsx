import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Dock, type DockItem } from "@/components/ui/Dock";

const META: Record<string, { label: string; icon: DockItem["icon"] }> = {
  index: { label: "Home", icon: "home" },
  cuidados: { label: "Cuidados", icon: "heart" },
  voluntariado: { label: "Voluntariado", icon: "hand-left" },
  generosidade: { label: "Generosidade", icon: "gift" },
  menu: { label: "Menu", icon: "menu" },
};

function DockTabBar({ state, navigation }: BottomTabBarProps) {
  const items: DockItem[] = state.routes
    .filter((route) => META[route.name])
    .map((route) => {
      const routeIndex = state.routes.findIndex((r) => r.key === route.key);
      const active = state.index === routeIndex;
      return {
        key: route.key,
        label: META[route.name].label,
        icon: META[route.name].icon,
        active,
        onPress: () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        },
      };
    });

  return <Dock items={items} />;
}

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <DockTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="cuidados" />
      <Tabs.Screen name="voluntariado" />
      <Tabs.Screen name="generosidade" />
      <Tabs.Screen name="menu" />
    </Tabs>
  );
}
