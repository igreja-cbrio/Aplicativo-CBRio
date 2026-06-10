import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Dock, type DockItem } from "@/components/ui/Dock";
import { MembroProvider } from "@/contexts/MembroContext";

const META: Record<string, { label: string; icon: DockItem["icon"]; iconActive: DockItem["icon"] }> = {
  index: { label: "Home", icon: "home-outline", iconActive: "home" },
  cuidados: { label: "Cuidados", icon: "heart-outline", iconActive: "heart" },
  voluntariado: { label: "Voluntariado", icon: "hand-left-outline", iconActive: "hand-left" },
  generosidade: { label: "Generosidade", icon: "gift-outline", iconActive: "gift" },
  menu: { label: "Menu", icon: "grid-outline", iconActive: "grid" },
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
        iconActive: META[route.name].iconActive,
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
    <MembroProvider>
      <Tabs
        tabBar={(props) => <DockTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="cuidados" />
      <Tabs.Screen name="voluntariado" />
      <Tabs.Screen name="generosidade" />
      <Tabs.Screen name="menu" />
      <Tabs.Screen name="perfil" options={{ href: null }} />
      <Tabs.Screen name="cartoes" options={{ href: null }} />
      <Tabs.Screen name="inscricoes" options={{ href: null }} />
      <Tabs.Screen name="inscricao-batismo" options={{ href: null }} />
      <Tabs.Screen name="inscricao-grupos" options={{ href: null }} />
      <Tabs.Screen name="inscricao-next" options={{ href: null }} />
      <Tabs.Screen name="grupos" options={{ href: null }} />
      <Tabs.Screen name="grupo-detalhe" options={{ href: null }} />
      </Tabs>
    </MembroProvider>
  );
}
