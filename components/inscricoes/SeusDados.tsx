// ============================================================================
// "SEUS DADOS" · resumo em vez de formulário (Marcos · 05/08/2026)
//
// Regra dele: "pra entrar no app hoje a pessoa já deve ter preenchido a ficha de
// cadastro — nas inscrições ela só preenche campos A MAIS, e nunca os padrão que
// já foram preenchidos".
//
// Então toda tela de inscrição mostra ESTE resumo (nome · telefone · e-mail, com
// caminho pro perfil) no lugar de reperguntar. Os valores continuam indo no
// payload — só não são digitados de novo.
//
// ⚠️ Quem decide se mostra resumo ou formulário é a tela, com `fichaCompleta()`:
// instalação antiga (ou cadastro que ficou pela metade) precisa do formulário,
// senão a pessoa não consegue se inscrever de jeito nenhum.
// ============================================================================
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

// ⚠️ A RÉGUA MUDOU DE CASA (05/08/2026): `fichaCompleta` mora em `lib/ficha.ts`
// pra poder ser TESTADA (arquivo .tsx importa react-native e não roda no CI).
// Continua exportada daqui pra não quebrar quem já importava — a implementação
// é uma só, travada por `test/reguas.test.ts`.
export { fichaCompleta } from "@/lib/ficha";

export function SeusDados({
  nome,
  telefone,
  email,
  extra,
}: {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  /** Linha extra (ex.: CPF já no cadastro). */
  extra?: string | null;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  return (
    <View style={styles.box}>
      <View style={styles.topo}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={styles.titulo}>{t("Seus dados")}</Text>
      </View>
      {!!nome && <Text style={styles.linha}>{nome}</Text>}
      {!!telefone && <Text style={styles.linhaFraca}>{telefone}</Text>}
      {!!email && <Text style={styles.linhaFraca}>{email}</Text>}
      {!!extra && <Text style={styles.linhaFraca}>{extra}</Text>}
      <Pressable onPress={() => router.navigate("/perfil")} hitSlop={6} accessibilityRole="button">
        <Text style={styles.link}>{t("Algo mudou? Ajuste no seu perfil")}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    box: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 2,
    },
    topo: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    titulo: { color: colors.textMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
    linha: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    linhaFraca: { color: colors.textMuted, fontSize: font.size.sm },
    link: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700", marginTop: 8 },
  });
