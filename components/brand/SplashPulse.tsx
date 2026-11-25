import { Animated, Image, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { useMovimentoAbertura } from "@/lib/useMovimentoAbertura";

/** Mesma marca e posição na restauração da sessão e na aplicação do OTA. */
export function SplashPulse({ mensagem }: { mensagem?: string }) {
  const { colors, mode } = useTheme();
  const scale = useMovimentoAbertura();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.marca}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Image
            source={mode === "dark"
              ? require("../../assets/images/cbrio-vertical-light.png")
              : require("../../assets/images/cbrio-vertical.png")}
            style={styles.logo}
            resizeMode="contain"
            accessible={false}
          />
        </Animated.View>
        {!!mensagem && (
          <Text accessibilityLiveRegion="polite" style={[styles.mensagem, { color: colors.textMuted }]}>
            {mensagem}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  marca: { width: 180, height: 180 },
  logo: { width: 180, height: 180 },
  mensagem: { position: "absolute", top: "100%", left: -60, right: -60, marginTop: 24, fontSize: 14, textAlign: "center" },
});
