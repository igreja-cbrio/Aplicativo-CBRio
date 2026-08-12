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
import { useEffect, useMemo, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { irParaBarra } from "@/lib/nav";
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
    tambemAtivoEm: ["/grupos", "/grupo-detalhe", "/grupo-membros", "/grupo-visita", "/grupo-inscricoes", "/grupo-editar", "/inscricao-grupos"],
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
  const pathname = usePathname();
  const t = useT();

  // ⚠️⚠️ A BARRA SOME COM O TECLADO ABERTO (07/08/2026). Ela é IRMÃ do Stack,
  // não sobreposta — então no Android, com o teclado aberto, ela continua
  // colada acima dele comendo `58 + insets.bottom` da altura que já encolheu.
  // Em ~20 telas isso é ~80 dp roubados exatamente quando o espaço é mais
  // escasso, e o campo que a pessoa está digitando é o primeiro a sair de vista.
  // ⚠️ Só no Android: no iOS a barra fica ABAIXO do teclado (a janela não
  // encolhe), então escondê-la lá não devolveria espaço nenhum e ainda faria a
  // barra piscar a cada foco de campo.
  const [tecladoAberto, setTecladoAberto] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const abrir = Keyboard.addListener("keyboardDidShow", () => setTecladoAberto(true));
    const fechar = Keyboard.addListener("keyboardDidHide", () => setTecladoAberto(false));
    return () => { abrir.remove(); fechar.remove(); };
  }, []);
  if (tecladoAberto) return null;

  return (
    <View style={[styles.barra, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {ITENS.map((it) => {
        const ativo = pathname === it.rota || !!it.tambemAtivoEm?.includes(pathname);
        return (
          <Pressable
            key={it.rota}
            onPress={() => {
              // Régua em lib/nav.ts: entre irmãs da barra é `replace` (troca
              // lateral, não empilha); da Home/profundidade é `navigate`.
              if (pathname === it.rota) return;
              // ⚠️ O toque tem que RESPONDER antes de a tela trocar. O retorno
              // tátil sai na hora (thread nativa) e não depende de a próxima
              // tela montar — era esse vazio de ~300 ms que se lia como
              // "travado". Best-effort: aparelho sem motor não pode derrubar a
              // navegação (por isso o catch vazio).
              Haptics.selectionAsync().catch(() => {});
              irParaBarra(pathname, it.rota);
            }}
            android_ripple={{ color: colors.border, borderless: true }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressionado]}
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
    // ⚠️ O `android_ripple` cobre o Android; no iOS não existe ripple, e sem
    // este estado o item ficava IDÊNTICO durante o toque — a pessoa não sabia
    // se o app registrou o dedo. Não é enfeite: é a única resposta que aparece
    // enquanto a próxima tela ainda não desenhou.
    itemPressionado: { opacity: 0.55 },
    // 11px porque "Devocional" tem 10 letras — em 12px amassa em tela estreita
    // (foi o motivo de "Voluntariado" ter virado "Servir" na barra antiga).
    label: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
    labelAtivo: { color: colors.primary },
  });
