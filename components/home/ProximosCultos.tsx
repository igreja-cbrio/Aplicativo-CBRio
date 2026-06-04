import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { type CultoUpcoming, formatCultoDia, formatCultoHora } from "@/lib/cultos";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export function ProximosCultos({ cultos }: { cultos: CultoUpcoming[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);

  if (!cultos.length) return null;

  // Agrupa por data (mostra cada dia uma vez com seus horários)
  const porDia = new Map<string, CultoUpcoming[]>();
  for (const c of cultos) {
    if (!porDia.has(c.data)) porDia.set(c.data, []);
    porDia.get(c.data)!.push(c);
  }

  return (
    <View style={styles.box}>
      <View style={styles.headerRow}>
        <Ionicons name="calendar" size={18} color={colors.brandMid} />
        <Text style={styles.titulo}>Próximos cultos</Text>
      </View>
      {[...porDia.entries()].slice(0, 4).map(([data, lista]) => (
        <View key={data} style={styles.linha}>
          <View style={styles.diaPill}>
            <Text style={styles.diaTxt}>{formatCultoDia(data)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nomes} numberOfLines={2}>
              {lista
                .map((c) => `${formatCultoHora(c.hora)} ${nomeCurto(c.nome)}`)
                .join("  ·  ")}
            </Text>
          </View>
        </View>
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
    linha: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    diaPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      minWidth: 64,
      alignItems: "center",
    },
    diaTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    nomes: { color: colors.textMuted, fontSize: font.size.sm },
  });
