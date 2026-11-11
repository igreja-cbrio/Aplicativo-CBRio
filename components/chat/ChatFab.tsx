import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { radius, spacing } from "@/constants/theme";

const TAMANHO = 56;

/**
 * Botão flutuante que abre o assistente direto (/fale-conosco-chat), sem passar
 * pelo hub /fale-conosco.
 *
 * `bottomOffset` = altura do dock (BottomBar) que o layout já mede; o botão
 * fica acima dele. Sem o dock, cai no inset de segurança. Some com o teclado
 * aberto (mesmo padrão do BottomBar). Quem decide EM QUAIS telas aparece é o
 * `app/(app)/_layout.tsx`.
 */
export function ChatFab({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [teclado, setTeclado] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setTeclado(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setTeclado(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (teclado) return null;

  const bottom = Math.max(bottomOffset, insets.bottom) + spacing.md;

  return (
    // box-none: o contêiner não captura toques; só o botão.
    <View pointerEvents="box-none" style={[styles.wrap, { bottom, right: spacing.md }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir chat com o assistente"
        onPress={() => router.navigate("/fale-conosco-chat")}
        style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", zIndex: 20, elevation: 8 },
  fab: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
});
