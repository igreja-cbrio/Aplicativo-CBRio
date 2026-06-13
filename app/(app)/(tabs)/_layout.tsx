import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";

/**
 * Tab bar NATIVA (UITabBarController via expo-router NativeTabs).
 * No iOS 26 ela vem com Liquid Glass de verdade e a interação de
 * pressionar-e-arrastar a lente entre as abas — implementação da
 * própria Apple, sem gesto custom (o Dock JS foi aposentado depois
 * de 3 rodadas de bugs com reconhecedores de gesto).
 * `minimizeBehavior="onScrollDown"`: a barra encolhe ao rolar pra
 * baixo e volta ao rolar pra cima, como nos apps do sistema.
 *
 * Identidade CBRio: `tintColor` pinta o item ATIVO com o teal da marca
 * (tom mais claro no dark pra ler bem sobre o vidro escuro). Fundo e
 * blur ficam por conta do sistema — pintar o fundo mataria o glass.
 */
export default function TabsLayout() {
  const t = useT();
  const { colors, mode } = useTheme();
  const tint = mode === "dark" ? colors.brandMid : colors.primary;

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={tint}
      labelStyle={{ fontWeight: "600" }}
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>{t("Home")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cuidados">
        <Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <Label>{t("Cuidados")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="voluntariado">
        <Icon sf={{ default: "hand.raised", selected: "hand.raised.fill" }} />
        <Label>{t("Voluntariado")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="generosidade">
        <Icon sf={{ default: "gift", selected: "gift.fill" }} />
        <Label>{t("Generosidade")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>{t("Menu")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
