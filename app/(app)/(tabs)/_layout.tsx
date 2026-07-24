import { NativeTabs, Icon, Label, VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { FEATURES } from "@/lib/features";

/**
 * Tab bar NATIVA (UITabBarController via expo-router NativeTabs).
 * No iOS 26 ela vem com Liquid Glass de verdade e a interação de
 * pressionar-e-arrastar a lente entre as abas — implementação da Apple.
 *
 * ⚠️ Ícones: `sf` só existe no iOS. No ANDROID precisa de `androidSrc` (imagem),
 * senão a aba fica SEM ícone (dock "quebrado"). Passamos VectorIcon (Ionicons)
 * como androidSrc pra cada aba — mantém os SF Symbols no iOS e resolve o Android.
 *
 * Rótulos CURTOS de propósito: "Voluntariado"/"Generosidade" amassavam e
 * se sobrepunham no aparelho. "Servir" (voluntariado) e "Doar" (generosidade)
 * cabem sem comprimir. `tintColor` pinta o ativo no teal; `minimizeBehavior`
 * encolhe ao rolar.
 */
export default function TabsLayout() {
  const { colors, mode } = useTheme();
  const t = useT();
  const tint = mode === "dark" ? colors.brandMid : colors.primary;

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={tint}>
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: "house", selected: "house.fill" }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
        <Label>{t("Início")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cuidados">
        <Icon
          sf={{ default: "heart", selected: "heart.fill" }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="heart-outline" />,
            selected: <VectorIcon family={Ionicons} name="heart" />,
          }}
        />
        <Label>{t("Cuidados")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="voluntariado">
        <Icon
          sf={{ default: "hand.raised", selected: "hand.raised.fill" }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="hand-left-outline" />,
            selected: <VectorIcon family={Ionicons} name="hand-left" />,
          }}
        />
        <Label>{t("Servir")}</Label>
      </NativeTabs.Trigger>
      {FEATURES.generosidade && (
        <NativeTabs.Trigger name="generosidade">
          <Icon
            sf={{ default: "gift", selected: "gift.fill" }}
            androidSrc={{
              default: <VectorIcon family={Ionicons} name="gift-outline" />,
              selected: <VectorIcon family={Ionicons} name="gift" />,
            }}
          />
          <Label>{t("Doar")}</Label>
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="menu">
        <Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="grid-outline" />,
            selected: <VectorIcon family={Ionicons} name="grid" />,
          }}
        />
        <Label>{t("Menu")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
