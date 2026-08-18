import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: "primary" | "ghost";
};

export function Button({
  title,
  loading,
  variant = "primary",
  disabled,
  style,
  ...rest
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      // ⚠️⚠️ O `style` de quem chama entra AQUI, no fim do array — e essa é a
      // correção (18/08). Antes ele vinha no `{...rest}`, que é espalhado
      // DEPOIS de `style=` e portanto SUBSTITUÍA o array inteiro: o botão
      // perdia fundo, altura 52, borda arredondada e centralização, virando
      // texto solto. Sintoma relatado: "salvar nova data não está centralizado,
      // fica deslocado e quero que tenha esse quadrado em volta".
      // ⚠️ Atingia 6 pontos, 3 deles VIVOS em produção (telas de senha), que
      // passavam só `marginTop` e ficavam sem botão nenhum.
      style={(estado) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.ghost,
        (estado.pressed || isDisabled) && styles.dimmed,
        typeof style === "function" ? style(estado) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? colors.primary : "#fff"} />
      ) : (
        <Text
          // ⚠️ O botão tem ALTURA FIXA (52): rótulo que quebra em duas linhas
          // transborda a caixa e some pela borda. Aconteceu quando dois botões
          // passaram a dividir a largura (18/08).
          numberOfLines={1}
          style={[
            styles.label,
            variant === "ghost" && { color: colors.primary },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    base: {
      height: 52,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    primary: { backgroundColor: colors.primary },
    ghost: { backgroundColor: "transparent" },
    dimmed: { opacity: 0.6 },
    label: { color: "#fff", fontSize: font.size.md, fontWeight: "600" },
  });
