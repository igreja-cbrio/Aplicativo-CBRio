import { useRef } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import WebView from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Status = "loading" | "success" | "cancel" | "interrupted";

/**
 * Modal com WebView que carrega uma Stripe Checkout Session.
 * O Checkout redireciona pra success_url ou cancel_url (configurados
 * no backend como deep links cbrio://generosidade/...); detectamos
 * o redirect pra fechar o modal e avisar a tela.
 */
export function CheckoutWebView({
  url,
  visible,
  onResult,
}: {
  url: string | null;
  visible: boolean;
  onResult: (status: Status) => void;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const webview = useRef<WebView | null>(null);

  function handleNav(navState: { url: string; loading: boolean }) {
    const u = navState.url;
    if (u.startsWith("cbrio://generosidade/sucesso")) {
      onResult("success");
      return;
    }
    if (u.startsWith("cbrio://generosidade/cancelado")) {
      onResult("cancel");
      return;
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => onResult("interrupted")}
      presentationStyle="formSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => onResult("interrupted")}
            hitSlop={8}
            style={styles.fechar}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.titulo}>Pagamento seguro</Text>
          <View style={{ width: 22 }} />
        </View>
        {url ? (
          <WebView
            ref={webview}
            source={{ uri: url }}
            startInLoadingState
            onNavigationStateChange={handleNav}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            )}
            style={styles.webview}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.glassBorder,
    },
    fechar: { padding: 4 },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    webview: { flex: 1, backgroundColor: colors.background },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  });
