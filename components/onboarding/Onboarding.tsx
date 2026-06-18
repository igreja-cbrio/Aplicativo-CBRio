import { useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const { width: W } = Dimensions.get("window");

type Slide = {
  icon: React.ComponentProps<typeof Ionicons>["name"] | "heart-brand";
  titulo: string;
  texto: string;
};

const SLIDES: Slide[] = [
  { icon: "heart-brand", titulo: "Bem-vindo à CBRio", texto: "Sua igreja no bolso. Tudo que você vive na CBRio, num só lugar." },
  { icon: "card", titulo: "Seu cartão e os cultos", texto: "Cartão de membro com QR, próximos cultos e o devocional do dia na tela inicial." },
  { icon: "hand-left", titulo: "Sirva e participe", texto: "Voluntariado, grupos, batismo e mais — dê os próximos passos da sua jornada." },
  { icon: "heart", titulo: "A gente cuida de você", texto: "Peça oração, fale com um pastor e acompanhe tudo pelo app. Você não está sozinho. 💙" },
];

export function Onboarding({ onConcluir }: { onConcluir: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const ref = useRef<FlatList<Slide>>(null);
  const [idx, setIdx] = useState(0);
  const ultimo = idx === SLIDES.length - 1;

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIdx(viewableItems[0].index);
  }).current;

  function avancar() {
    if (ultimo) onConcluir();
    else ref.current?.scrollToIndex({ index: idx + 1, animated: true });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={onConcluir} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("Pular")}>
          <Text style={styles.pular}>{t("Pular")}</Text>
        </Pressable>
      </View>

      <FlatList
        ref={ref}
        data={SLIDES}
        keyExtractor={(s) => s.titulo}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconWrap}>
              {item.icon === "heart-brand" ? (
                <CbrioHeart size={64} color={colors.brandPale} />
              ) : (
                <Ionicons name={item.icon} size={60} color={colors.brandMid} />
              )}
            </View>
            <Text style={styles.titulo}>{t(item.titulo)}</Text>
            <Text style={styles.texto}>{t(item.texto)}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === idx && styles.dotAtivo]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.botao} onPress={avancar} accessibilityRole="button" accessibilityLabel={ultimo ? t("Começar") : t("Próximo")}>
          <Text style={styles.botaoTxt}>{ultimo ? t("Começar") : t("Próximo")}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    top: { alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, height: 44, justifyContent: "center" },
    pular: { color: colors.textMuted, fontSize: font.size.md, fontWeight: "600" },
    slide: { width: W, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.md },
    iconWrap: {
      width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center",
      backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, marginBottom: spacing.lg,
    },
    titulo: { color: colors.text, fontSize: font.size.xxl, fontWeight: "800", textAlign: "center" },
    texto: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 24, textAlign: "center", paddingHorizontal: spacing.md },
    dots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: spacing.lg },
    dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: colors.border },
    dotAtivo: { backgroundColor: colors.primary, width: 22 },
    footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    botao: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: 16,
    },
    botaoTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
  });
