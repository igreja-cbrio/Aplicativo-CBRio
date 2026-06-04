import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { type CultoUpcoming, formatCultoDia, formatCultoHora } from "@/lib/cultos";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export function ProximosCultos({ cultos }: { cultos: CultoUpcoming[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();

  if (!cultos.length) return null;

  return (
    <View style={styles.box}>
      <View style={styles.headerRow}>
        <Ionicons name="calendar" size={18} color={colors.brandMid} />
        <Text style={styles.titulo}>Próximos cultos</Text>
      </View>
      {cultos.slice(0, 6).map((c) => (
        <Pressable
          key={c.id}
          style={({ pressed }) => [styles.linha, pressed && { opacity: 0.6 }]}
          onPress={() => router.navigate({ pathname: "/culto-detalhe", params: { id: c.id } })}
        >
          <View style={styles.diaPill}>
            <Text style={styles.diaTxt}>{formatCultoDia(c.data)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nome} numberOfLines={1}>
              {nomeCurto(c.nome)}
            </Text>
            <Text style={styles.hora}>{formatCultoHora(c.hora)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

/** Remove a data redundante do nome ("Domingo 10:00 — 07/06/2026" -> "Domingo 10:00"). */
function nomeCurto(nome: string | null) {
  if (!nome) return "";
  return nome.replace(/\s*[—–-]\s*\d{2}\/\d{2}\/\d{4}\s*$/, "").trim();
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    box: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    linha: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 4 },
    diaPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      minWidth: 64,
      alignItems: "center",
    },
    diaTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    nome: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    hora: { color: colors.textMuted, fontSize: 12 },
  });
