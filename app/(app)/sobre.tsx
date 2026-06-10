import { useMemo } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors, useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const LOGO = require("../../assets/images/cbrio-wordmark.png");

const VALORES = [
  { icon: "rocket-outline" as const, titulo: "Seguir a Jesus" },
  { icon: "people-outline" as const, titulo: "Conectar (grupos)" },
  { icon: "book-outline" as const, titulo: "Investir tempo com Deus" },
  { icon: "hand-left-outline" as const, titulo: "Servir (voluntariado)" },
  { icon: "gift-outline" as const, titulo: "Generosidade" },
];

export default function SobreScreen() {
  const colors = useColors();
  const { mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Sobre a CBRio")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.logoBox}>
          <Image
            source={LOGO}
            style={[styles.logo, { tintColor: mode === "light" ? colors.primary : colors.brandPale }]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Nossa missão")}</Text>
          <Text style={styles.missao}>
            {t("\"Empoderados por Deus para alcançar pessoas pra Jesus\" (Mt 28:19).")}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Onde estamos")}</Text>
          <Row icon="location-outline" colors={colors} styles={styles}>
            {t("Av. das Américas, 7907 — Open Mall (subsolo), Barra da Tijuca, Rio de Janeiro")}
          </Row>
          <ActionLink
            icon="logo-youtube"
            label={t("Assistir online (cbrio.tv)")}
            onPress={() => Linking.openURL("https://cbrio.tv")}
            colors={colors}
            styles={styles}
          />
          <ActionLink
            icon="logo-instagram"
            label="@igrejacbrio"
            onPress={() => Linking.openURL("https://instagram.com/igrejacbrio")}
            colors={colors}
            styles={styles}
          />
          <ActionLink
            icon="logo-whatsapp"
            label={t("Falar com a igreja (CBZap)")}
            onPress={() => Linking.openURL("https://wa.me/5521997567770")}
            colors={colors}
            styles={styles}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Os 5 valores da jornada")}</Text>
          {VALORES.map((v) => (
            <View key={v.titulo} style={styles.valor}>
              <Ionicons name={v.icon} size={20} color={colors.brandMid} />
              <Text style={styles.valorTxt}>{t(v.titulo)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Marcos do novo convertido")}</Text>
          <Row icon="call-outline" colors={colors} styles={styles}>
            {t("Contato pastoral em até 3 dias")}
          </Row>
          <Row icon="water-outline" colors={colors} styles={styles}>
            {t("Batismo em até 90 dias")}
          </Row>
          <Row icon="map-outline" colors={colors} styles={styles}>
            {t("NEXT em até 90 dias")}
          </Row>
          <Text style={styles.nsm}>
            <Text style={{ fontWeight: "800" }}>NSM: </Text>
            {t("\"Novos convertidos engajados em ≥1 valor da CBRio em até 60 dias da decisão.\"")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  children,
  colors,
  styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  children: React.ReactNode;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.brandMid} />
      <Text style={styles.rowTxt}>{children}</Text>
    </View>
  );
}

function ActionLink({
  icon,
  label,
  onPress,
  colors,
  styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.actionTxt}>{label}</Text>
      <Ionicons name="open-outline" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.lg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    logoBox: { alignItems: "center", paddingVertical: spacing.md },
    logo: { width: 200, height: 56 },
    card: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    cardTitle: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    missao: { color: colors.text, fontSize: font.size.md, fontStyle: "italic", lineHeight: 22 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    rowTxt: { color: colors.text, fontSize: font.size.sm, flex: 1, lineHeight: 20 },
    action: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    actionTxt: { flex: 1, color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    valor: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
    valorTxt: { color: colors.text, fontSize: font.size.sm },
    nsm: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      fontSize: font.size.sm,
      lineHeight: 20,
      fontStyle: "italic",
    },
  });
