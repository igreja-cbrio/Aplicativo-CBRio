import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = TextInputProps & {
  label: string;
  secure?: boolean;
};

export function Input({ label, secure, ...rest }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {/*
        ⚠️⚠️ CAMPO `multiline` ERA UMA LINHA SÓ (07/08/2026). O estilo fixava
        `height: 52` e o container centralizava verticalmente, então TODO
        textarea do app — comentário da visita, motivo da saída, pedido de
        oração, "mande uma mensagem", observação do batismo — mostrava uma
        única linha do que a pessoa escrevia, com o texto no meio da caixa.
        É a mesma queixa de "não dá pra ver o que estou digitando", por outra
        causa que não o teclado.
      */}
      <View style={[styles.field, rest.multiline && styles.fieldMultiline]}>
        <TextInput
          style={[styles.input, rest.multiline && styles.inputMultiline]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          autoCapitalize="none"
          // `top` é obrigatório no Android: sem ele o texto começa no MEIO da
          // caixa alta e some conforme cresce.
          textAlignVertical={rest.multiline ? "top" : undefined}
          {...rest}
        />
        {secure && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8}>
            <Text style={styles.toggle}>{hidden ? t("Mostrar") : t("Ocultar")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrapper: { gap: spacing.xs },
    label: {
      color: colors.textMuted,
      fontSize: font.size.sm,
      fontWeight: "600",
    },
    field: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    fieldMultiline: { alignItems: "flex-start", paddingVertical: spacing.sm },
    input: {
      flex: 1,
      height: 52,
      color: colors.text,
      fontSize: font.size.md,
    },
    // `minHeight` em vez de `height`: a caixa nasce com ~4 linhas e cresce com
    // o texto, em vez de travar em 52px.
    inputMultiline: { height: undefined, minHeight: 96, paddingTop: 0 },
    toggle: {
      color: colors.primary,
      fontSize: font.size.sm,
      fontWeight: "600",
    },
  });
