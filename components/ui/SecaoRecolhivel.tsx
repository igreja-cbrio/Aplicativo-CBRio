// Seção que abre e fecha, RECOLHIDA por padrão.
//
// ⚠️ O cabeçalho é a única coisa que a pessoa vê enquanto a seção está fechada,
// então ele carrega um RESUMO (contagem, ou o que pede ação). Esconder conteúdo
// sem dizer o que ficou lá dentro transforma "recolher" em "sumir".
//
// ⚠️ Os filhos NÃO são renderizados enquanto está fechada — é o que faz a aba
// abrir leve mesmo com dezenas de cartões.
// ⚠️ Sem animação de altura de propósito: `LayoutAnimation` é ignorado na nova
// arquitetura do RN e o resto do app não usa transição de layout em lista.
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = {
  titulo: string;
  /** Texto curto à direita do título (ex.: "3" ou "1 aguarda você"). */
  resumo?: string | null;
  /** Resumo pinta de âmbar: tem coisa esperando a pessoa. */
  destaque?: boolean;
  /** Padrão: fechada. Só passe `true` com um motivo. */
  inicialAberta?: boolean;
  children: ReactNode;
};

export function SecaoRecolhivel({ titulo, resumo, destaque, inicialAberta = false, children }: Props) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const [aberta, setAberta] = useState(inicialAberta);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setAberta((v) => !v)}
        style={({ pressed }) => [styles.head, pressed && styles.headPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberta }}
        accessibilityLabel={resumo ? `${titulo} — ${resumo}` : titulo}
        hitSlop={6}
      >
        <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text>
        {!!resumo && (
          <View style={[styles.pill, destaque && styles.pillDestaque]}>
            <Text style={[styles.pillTxt, destaque && styles.pillTxtDestaque]}>{resumo}</Text>
          </View>
        )}
        <Ionicons name={aberta ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
      </Pressable>
      {aberta && <View style={styles.corpo}>{children}</View>}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    headPressed: { opacity: 0.6 },
    titulo: { flex: 1, color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillDestaque: { backgroundColor: colors.warning + "22", borderColor: colors.warning },
    pillTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "700" },
    pillTxtDestaque: { color: colors.warning },
    corpo: { gap: spacing.md },
  });
