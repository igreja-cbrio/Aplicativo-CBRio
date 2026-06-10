import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { autenticarBiometria, rotuloBiometria } from "@/lib/biometria";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

/**
 * Tela de bloqueio por biometria. Aparece quando há sessão salva e o
 * usuário ativou o desbloqueio rápido: em vez de digitar e-mail/senha,
 * desbloqueia com Face ID / Touch ID. Dispara a folha nativa ao montar.
 */
export function BiometriaLock({
  onUnlock,
  onSair,
}: {
  onUnlock: () => void;
  onSair: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [rotulo, setRotulo] = useState("Face ID");
  const [tentando, setTentando] = useState(false);
  const tentouAuto = useRef(false);

  const tentar = useCallback(async () => {
    setTentando(true);
    const ok = await autenticarBiometria("Desbloquear o CBRio");
    setTentando(false);
    if (ok) onUnlock();
  }, [onUnlock]);

  useEffect(() => {
    rotuloBiometria().then(setRotulo);
    // Auto-dispara uma vez ao abrir (padrão de apps que travam por biometria).
    if (!tentouAuto.current) {
      tentouAuto.current = true;
      tentar();
    }
  }, [tentar]);

  const icone = rotulo === "Face ID" ? "scan-outline" : "finger-print";

  return (
    <View style={styles.container}>
      <Image
        source={
          colors.background === "#0B1F26"
            ? require("../../assets/images/cbrio-vertical-light.png")
            : require("../../assets/images/cbrio-vertical.png")
        }
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.titulo}>App bloqueado</Text>
      <Text style={styles.sub}>
        Desbloqueie com {rotulo} para continuar.
      </Text>

      <Pressable
        onPress={tentar}
        disabled={tentando}
        style={({ pressed }) => [
          styles.btn,
          (pressed || tentando) && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Desbloquear com ${rotulo}`}
      >
        <Ionicons name={icone} size={22} color="#fff" />
        <Text style={styles.btnTxt}>Desbloquear com {rotulo}</Text>
      </Pressable>

      <Pressable onPress={onSair} hitSlop={12} style={styles.sair}>
        <Text style={styles.sairTxt}>Entrar com outra conta</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
    },
    logo: { width: 140, height: 140, marginBottom: spacing.lg },
    titulo: { color: colors.text, fontSize: font.size.xl, fontFamily: BRAND_FONT },
    sub: {
      color: colors.textMuted,
      fontSize: font.size.md,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      alignSelf: "stretch",
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.full,
    },
    btnTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
    sair: { marginTop: spacing.sm, paddingVertical: spacing.sm },
    sairTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
  });
