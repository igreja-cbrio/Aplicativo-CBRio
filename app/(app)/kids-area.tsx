// KIDS — menu do membro. Cada item abre a sua tela (o check-in vive em /kids).
// Não carrega dados: só navega.
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";

import { useKidsTheme } from "@/contexts/KidsThemeContext";
import { TEMAS_KIDS, type TemaKids } from "@/lib/kidsTema";

type Item = { rota: Href; icone: keyof typeof Ionicons.glyphMap; titulo: string; sub: string; destaque?: boolean };

export default function KidsAreaScreen() {
  const { colors, mode } = useTheme();
  const { tema, escolher } = useKidsTheme();
  const [erroCor, setErroCor] = useState(false);
  const styles = useMemo(() => makeStyles(colors, tema), [colors, tema]);
  const t = useT();

  const itens: Item[] = [
    { rota: "/kids", icone: "happy-outline", titulo: t("Minhas crianças"), sub: t("Check-in, fichas e avisos dos seus filhos."), destaque: true },
    { rota: "/kids-mural", icone: "megaphone-outline", titulo: t("Mural de avisos"), sub: t("Avisos e calendário de eventos do Kids.") },
    { rota: "/kids-horarios", icone: "time-outline", titulo: t("Horários de funcionamento"), sub: t("Quando o Kids está aberto.") },
    { rota: "/kids-salas", icone: "grid-outline", titulo: t("Divisão das salas"), sub: t("Qual sala é de cada idade.") },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel("/kids-area")} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("KIDS")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {itens.map((it) => (
          <Pressable
            key={String(it.rota)}
            onPress={() => router.navigate(it.rota)}
            style={({ pressed }) => [styles.tile, it.destaque && styles.tileDestaque, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={it.titulo}
          >
            <View style={[styles.icone, it.destaque && styles.iconeDestaque]}>
              <Ionicons name={it.icone} size={26} color={it.destaque ? "#253D44" : mode === "dark" ? tema.fundo : tema.tinta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tileTitulo, it.destaque && { color: "#253D44" }]}>{it.titulo}</Text>
              <Text style={[styles.tileSub, it.destaque && { color: "#253D44" }]}>{it.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={it.destaque ? "#253D44" : colors.textMuted} />
          </Pressable>
        ))}
        <View style={styles.tile}>
          <View style={{ flex: 1, gap: 12 }}>
            <Text style={styles.tileTitulo}>{t("Cor do seu Kids")}</Text>
            <Text style={styles.tileSub}>{t("Escolha a cor que combina com você. Fica salva neste aparelho.")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {TEMAS_KIDS.map(opcao => <Pressable key={opcao.id}
                onPress={() => { setErroCor(false); escolher(opcao.id).catch(() => setErroCor(true)); }}
                accessibilityRole="radio" accessibilityState={{ checked: tema.id === opcao.id }} accessibilityLabel={t(opcao.nome)}
                style={{ alignItems: "center", gap: 5, minWidth: 48 }}>
                <View style={{ backgroundColor: opcao.fundo, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: tema.id === opcao.id ? 3 : 1, borderColor: tema.id === opcao.id ? colors.text : colors.glassBorder }}>
                  {tema.id === opcao.id && <Ionicons name="checkmark" size={23} color="#253D44" />}
                </View><Text style={styles.tileSub}>{t(opcao.nome)}</Text>
              </Pressable>)}
            </View>
            {erroCor && <Text accessibilityLiveRegion="polite" style={styles.tileSub}>{t("Não foi possível salvar a cor. Toque nela para tentar novamente.")}</Text>}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette, tema: TemaKids) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    tile: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.lg },
    tileDestaque: { backgroundColor: tema.fundo, borderColor: tema.fundo },
    icone: { width: 46, height: 46, borderRadius: 23, backgroundColor: tema.fundo + "25", alignItems: "center", justifyContent: "center" },
    iconeDestaque: { backgroundColor: "rgba(255,255,255,0.25)" },
    tileTitulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    tileSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
  });
