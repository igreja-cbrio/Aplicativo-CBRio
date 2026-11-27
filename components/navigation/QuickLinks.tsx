import { useTutorial, TutorialTarget, type TutorialTargetId } from "@/contexts/TutorialContext";
import React, { useMemo } from "react";
import { Text } from "@/components/ui/Typography";
import { DockSurface } from "@/components/navigation/DockSurface";
import { NativeShortcuts } from "@/modules/native-shortcuts/src/NativeShortcuts";
import { Icone } from "@/components/ui/Icone";
import { usePathname } from "expo-router";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useT } from "@/lib/i18n";
import { irParaBarra } from "@/lib/nav";
import { QUICK_LINKS } from "@/lib/appNavigation";
import { abaDaRota } from "@/lib/abas";
import { useTrocaDeAba } from "@/components/navigation/TrocaDeAba";

const TARGETS: TutorialTargetId[] = ["care", "devotional", "groups", "serve", "giving"];

/**
 * ⚠️⚠️ OS CINCO ATALHOS SEMPRE À VISTA (27/11/2026).
 *
 * Até aqui, letra do sistema acima de 1,2× (ou tela < 360) virava a barra numa
 * faixa ROLÁVEL com itens de 120 px: cabiam 3 e Servir/Generosidade ficavam
 * escondidos à direita, sem sinal de que dava para rolar. O Marcos viu isso em
 * vários celulares na quarta e pediu que a formatação do telefone não quebre o
 * app. Agora:
 * - fallback (Android, binário sem o módulo, tela estreita): 5 colunas fixas,
 *   legenda de TAMANHO FIXO (`allowFontScaling={false}`) que encolhe para caber;
 * - iPhone com o módulo: UITabBar nativa também com letra grande (o UIKit não
 *   amplia a legenda da barra; oferece a lupa de acessibilidade do sistema).
 * ⚠️ Não voltar à rolagem horizontal: esconder destino é pior que legenda menor.
 */
export function QuickLinks({ rota }: { rota?: string } = {}) {
  const tutorial = useTutorial();
  const tutorialIndex = tutorial?.highlightedTarget ? TARGETS.indexOf(tutorial.highlightedTarget) : -1;
  const { width } = useWindowDimensions();
  const estreita = width < 360;
  const globalPathname = usePathname(), t = useT();
  const pathname = rota ?? globalPathname;
  const labels = useMemo(() => QUICK_LINKS.map(item => t(item.label)), [t]);
  // Memória por aba (27/11/2026): a troca sobe o galho vivo da aba (lib/abas.ts).
  // Fora das telas principais não há pilha para reordenar e vale o caminho antigo.
  const trocaDeAba = useTrocaDeAba();
  const ir = (href: string) => trocaDeAba ? trocaDeAba(href) : irParaBarra(pathname, href);
  // A aba fica acesa também nas telas de dentro dela (Montar escala acende Servir).
  const abaAtual = abaDaRota(pathname);
  // Só a versão que contém o controle UIKit usa a interação nativa. A OTA é
  // segura em binários antigos: nenhum gesto/lupa customizado é simulado.
  if (NativeShortcuts && !estreita) return <TutorialTarget id="dock"><NativeShortcuts
    labels={labels}
    selectedIndex={tutorialIndex >= 0 ? tutorialIndex : QUICK_LINKS.findIndex(item => abaAtual === item.href)}
    style={{ height: 74, width: "100%" }}
    onShortcutSelect={({ nativeEvent }) => {
      if (tutorial?.highlightedTarget) return;
      const item = QUICK_LINKS[nativeEvent.index];
      if (item) ir(item.href);
    }}
  /></TutorialTarget>;
  // UITabBar já aplica o próprio recuo. Só o fallback precisa dessa margem.
  return <View style={estreita ? styles.fallbackMarginEstreita : styles.fallbackMargin}><DockSurface><View style={styles.dock}>
    {QUICK_LINKS.map((item, i) => <TutorialTarget key={item.href} id={TARGETS[i]} style={{ flex: i === 4 ? 1.4 : 1, minWidth: 0 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={labels[i]} accessibilityState={{ selected: abaAtual === item.href }} onPress={() => ir(item.href)} style={({ pressed }) => [styles.item, i > 0 && styles.divider, (pressed || abaAtual === item.href) && styles.selected]}>
        <Icone name={item.icon} size={21} color="#29434a" />
        <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.label}>{labels[i]}</Text>
      </Pressable>
    </TutorialTarget>)}
  </View></DockSurface></View>;
}
const styles = StyleSheet.create({
  fallbackMargin: { paddingHorizontal: 20 },
  fallbackMarginEstreita: { paddingHorizontal: 10 },
  dock: { flexDirection: "row", borderRadius: 28, paddingVertical: 10, paddingHorizontal: 3 },
  item: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 2, gap: 7 },
  label: { fontSize: 10, fontWeight: "700", color: "#29434a", textAlign: "center", width: "100%" },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#c9d1cf" },
  selected: { backgroundColor: "#dfe9e7", borderRadius: 16 },
});
