import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PassKit, { AddPassButton } from "react-native-wallet-pass";

type Props = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Botão "Add to Apple Wallet".
 *
 * No iOS usa o botão OFICIAL nativo da Apple (`PKAddPassButton`, via
 * react-native-wallet-pass) — arte oficial, localizada automaticamente e em
 * conformidade com as Human Interface Guidelines da Apple
 * (https://developer.apple.com/design/human-interface-guidelines/wallet),
 * sem recriar nem modificar a arte.
 *
 * Durante o carregamento (ou no Android, que não tem Apple Wallet) cai num
 * botão estilizado equivalente.
 */
export function AddToWalletButton({ onPress, loading, disabled }: Props) {
  if (Platform.OS === "ios" && !loading) {
    return (
      <AddPassButton
        addPassButtonStyle={PassKit.AddPassButtonStyle.black}
        onPress={disabled ? () => {} : onPress}
        style={styles.nativeButton}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add to Apple Wallet"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.fallback,
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
  nativeButton: { height: 52, alignSelf: "stretch" },
  fallback: {
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
