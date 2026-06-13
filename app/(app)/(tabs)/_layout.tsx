import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";

/**
 * Tab bar NATIVA (UITabBarController via expo-router NativeTabs).
 * No iOS 26 ela vem com Liquid Glass de verdade e a interação de
 * pressionar-e-arrastar a lente entre as abas — implementação da Apple.
 *
 * Rótulos CURTOS de propósito: "Voluntariado"/"Generosidade" amassavam e
 * se sobrepunham no aparelho. "Servir" (voluntariado) e "Doar"
 * (generosidade) cabem sem comprimir. (Esconder 100% via
 * labelVisibilityMode não é respeitado nesta versão do react-native-screens,
 * e remover <Label> faz o iOS cair no nome técnico da rota.)
 * `tintColor` pinta o ativo no teal; `minimizeBehavior` encolhe ao rolar.
 */
export default function TabsLayout() {
  const { colors, mode } = useTheme();
  const t = useT();
  const tint = mode === "dark" ? colors.brandMid : colors.primary;

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={tint}>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>{t("Início")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cuidados">
        <Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <Label>{t("Cuidados")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="voluntariado">
        <Icon sf={{ default: "hand.raised", selected: "hand.raised.fill" }} />
        <Label>{t("Servir")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="generosidade">
        <Icon sf={{ default: "gift", selected: "gift.fill" }} />
        <Label>{t("Doar")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>{t("Menu")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
