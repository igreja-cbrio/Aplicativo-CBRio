import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Botão "Add to Apple Wallet".
 *
 * Visual conforme a especificação de marca da Apple Wallet
 * (https://developer.apple.com/design/human-interface-guidelines/wallet):
 * fundo preto, cantos arredondados, logo da Apple + "Add to Apple Wallet"
 * em inglês (a marca não é traduzida). Ao tocar, abre a folha nativa
 * `PKAddPassesViewController` (via módulo `apple-pay`).
 *
 * Nota: não usamos `PKAddPassButton` nativo porque a lib legada que o
 * expunha (`react-native-wallet-pass`) quebra na nova arquitetura do RN
 * (constantes não bridgeadas) — era a causa do crash da tela de cartões.
 */
export function AddToWalletButton({ onPress, loading, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add to Apple Wallet"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        (pressed || disabled || loading) && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.content}>
          <Ionicons name="logo-apple" size={22} color="#FFFFFF" style={styles.apple} />
          <View>
            <Text style={styles.addTo}>Add to</Text>
            <Text style={styles.wallet}>Apple Wallet</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#000000",
    borderRadius: 8,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pressed: { opacity: 0.85 },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  apple: { marginTop: -2 },
  addTo: { color: "#FFFFFF", fontSize: 11, fontWeight: "500", lineHeight: 13 },
  wallet: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 22,
    letterSpacing: -0.2,
  },
});
