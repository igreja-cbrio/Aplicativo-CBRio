import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { salvarRodizioSemana } from "@/lib/api";

/**
 * "Meu domingo de preferência" (24/09/2026 · pedido do Marcos).
 *
 * "cada um tem um domingo de preferência e ao clicar para escalar naquela
 * posição, ele filtra as pessoas que estão naquele time priorizando quem
 * colocou aquele domingo como rodízio". Grava `vol_profiles.rodizio_semana`.
 *
 * ⚠️ É PREFERÊNCIA, não bloqueio — o texto diz isso porque a pessoa pode achar
 * que marcar o 1º a tira dos outros. Pra "não posso", existe a Disponibilidade.
 * ⚠️ Salva no toque, sem botão: uma escolha só, sem formulário.
 */
const SEMANAS = [1, 2, 3, 4] as const;

export function DomingoPreferido({ inicial }: { inicial: number | null }) {
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [semana, setSemana] = useState<number | null>(inicial);
  const [salvando, setSalvando] = useState<number | null | "nenhum">(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { setSemana(inicial); }, [inicial]);

  async function escolher(nova: number | null) {
    if (nova === semana || salvando !== null) return;
    const anterior = semana;
    setSemana(nova); setErro(false); setSalvando(nova ?? "nenhum");
    try { await salvarRodizioSemana(nova); }
    catch { setSemana(anterior); setErro(true); }
    finally { setSalvando(null); }
  }

  return (
    <View style={styles.box}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="calendar-number-outline" size={18} color={colors.primary} />
          <Text style={styles.titulo}>{t("Meu domingo de preferência")}</Text>
        </View>
      </View>
      <Text style={styles.hint}>{t("Quem monta a escala vê você primeiro nos cultos desse domingo do mês. Não é bloqueio: você continua podendo ser escalado em qualquer data.")}</Text>
      <View style={styles.chips}>
        <Pressable
          onPress={() => escolher(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: semana === null }}
          style={[styles.chip, semana === null && styles.chipAtivo]}
        >
          <Text style={[styles.chipTxt, semana === null && styles.chipTxtAtivo]}>{t("Nenhum")}</Text>
        </Pressable>
        {SEMANAS.map((n) => {
          const ativo = semana === n;
          return (
            <Pressable
              key={n}
              onPress={() => escolher(n)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={`${n}º ${t("domingo")}`}
              style={[styles.chip, ativo && styles.chipAtivo]}
            >
              <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>{n}º</Text>
            </Pressable>
          );
        })}
      </View>
      {erro && <Text style={styles.erro}>{t("Não deu pra salvar. Tente de novo.")}</Text>}
    </View>
  );
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
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    hint: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    chipAtivo: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    chipTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    chipTxtAtivo: { color: colors.primary },
    erro: { color: colors.danger, fontSize: font.size.sm },
  });
