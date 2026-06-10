import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AddPassButton, addPassButtonNativo } from "@/modules/apple-pay";

type Props = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Botão "Add to Apple Wallet".
 *
 * Usa o botão OFICIAL do sistema (`PKAddPassButton`) — com o ícone e a arte
 * da Apple Wallet desenhados pelo iOS, localizados automaticamente e em
 * conformidade com as HIG
 * (https://developer.apple.com/design/human-interface-guidelines/wallet).
 * O ícone oficial da Wallet passa a credibilidade que o usuário Apple espera.
 *
 * Durante o carregamento mostra um botão equivalente com spinner; em binário
 * sem o módulo nativo, cai num botão estilizado com o ícone da carteira.
 */
export function AddToWalletButton({ onPress, loading, disabled }: Props) {
  if (addPassButtonNativo && !loading) {
    return <AddPassButton onPress={onPress} disabled={disabled} />;
  }

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
          <Ionicons name="wallet" size={24} color="#FFFFFF" style={styles.icon} />
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
  content: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { marginTop: -1 },
  addTo: { color: "#FFFFFF", fontSize: 11, fontWeight: "500", lineHeight: 13 },
  wallet: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 22,
    letterSpacing: -0.2,
  },
});
