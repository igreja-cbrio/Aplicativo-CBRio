// ============================================================================
// BARRA DE BAIXO · os 4 valores da jornada + Menu (Marcos · 04/08/2026)
//
// Decisão do dono do produto: a barra são os VALORES (Grupos = conectar,
// Servir, Cuidados, Devocional = investir tempo com Deus) e mais o Menu.
// A HOME fica FORA da barra de propósito — chega-se nela pela seta da faixa
// superior, e não existe botão "Início" em lugar nenhum.
//
// ⚠️ POR QUE NÃO É A BARRA NATIVA (expo-router/unstable-native-tabs):
// na barra nativa (UITabBarController) tudo que aparece TEM que ser uma aba —
// não existe "tela fora da barra com a barra visível". Como a Home precisa
// justamente disso (fora da barra, mas com a barra na tela), a barra passou a
// ser desenhada por nós. Perdemos o vidro nativo do iOS 26 e o encolher-ao-
// rolar; ganhamos o desenho pedido. É JS puro → sai por OTA.
// ⚠️ Isto NÃO é o antigo "dock custom" aposentado em 12/06: aqui não há gesto
// nenhum (sem pan, sem long-press, sem GlassView aninhada) — só Pressable.
// Não reintroduzir gestos aqui.
// ============================================================================
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, spacing, type Palette } from "@/constants/theme";

export const BOTTOMBAR_H = 58;

type Item = {
  rota: string;
  label: string;
  icone: React.ComponentProps<typeof Ionicons>["name"];
  iconeAtivo: React.ComponentProps<typeof Ionicons>["name"];
  /** Rotas filhas que mantêm este item aceso (ex.: estou dentro de um grupo). */
  tambemAtivoEm?: string[];
};

const ITENS: Item[] = [
  {
    rota: "/meu-grupo",
    label: "Grupos",
    icone: "people-outline",
    iconeAtivo: "people",
    tambemAtivoEm: ["/grupos", "/grupo-detalhe", "/grupo-membros", "/grupo-inscricoes", "/grupo-editar", "/inscricao-grupos"],
  },
  { rota: "/voluntariado", label: "Servir", icone: "hand-left-outline", iconeAtivo: "hand-left", tambemAtivoEm: ["/escala-supervisor"] },
  { rota: "/cuidados", label: "Cuidados", icone: "heart-outline", iconeAtivo: "heart" },
  { rota: "/devocional", label: "Devocional", icone: "book-outline", iconeAtivo: "book", tambemAtivoEm: ["/anotacoes"] },
  { rota: "/menu", label: "Menu", icone: "grid-outline", iconeAtivo: "grid" },
];

export function BottomBar() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();

  return (
    <View style={[styles.barra, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {ITENS.map((it) => {
        const ativo = pathname === it.rota || !!it.tambemAtivoEm?.includes(pathname);
        return (
          <Pressable
            key={it.rota}
            onPress={() => {
              // `navigate` reaproveita a tela quando ela já está na pilha (não
              // empilha a mesma coisa duas vezes) — e a seta continua fazendo
              // sentido depois.
              if (pathname !== it.rota) router.navigate(it.rota as never);
            }}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={t(it.label)}
          >
            <Ionicons
              name={ativo ? it.iconeAtivo : it.icone}
              size={22}
              color={ativo ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.label, ativo && styles.labelAtivo]} numberOfLines={1}>
              {t(it.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    barra: {
      flexDirection: "row",
      alignItems: "stretch",
      paddingTop: 6,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      // Sombra sutil só no iOS (no Android a elevação brigaria com o inset).
      ...(Platform.OS === "ios"
        ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } }
        : null),
    },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: spacing.xs,
    },
    // 11px porque "Devocional" tem 10 letras — em 12px amassa em tela estreita
    // (foi o motivo de "Voluntariado" ter virado "Servir" na barra antiga).
    label: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
    labelAtivo: { color: colors.primary },
  });
