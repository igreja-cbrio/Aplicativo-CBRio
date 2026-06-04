import { RefreshControl, type RefreshControlProps } from "react-native";
import { useColors } from "@/contexts/ThemeContext";

/**
 * RefreshControl com a cor da marca CBRio. O coração pulsando aparece
 * via overlay (PulsingHeartOverlay) acima da tela quando refreshing=true.
 */
export function HeartRefresh(props: Omit<RefreshControlProps, "tintColor" | "colors">) {
  const colors = useColors();
  return (
    <RefreshControl
      {...props}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );
}
