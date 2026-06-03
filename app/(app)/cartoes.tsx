import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/**
 * Cartões de membresia/voluntariado (mesmo Supabase do sistema existente).
 * Schema ASSUMIDO — ajustar os nomes de tabela/colunas conforme o sistema:
 *   tabela: cartoes | colunas: user_id, tipo, numero, status, wallet_url
 */
type Cartao = {
  id: string;
  tipo?: string | null;
  numero?: string | null;
  status?: string | null;
  wallet_url?: string | null;
};

const TIPO_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  membresia: { label: "Cartão de Membresia", icon: "id-card" },
  voluntariado: { label: "Cartão de Voluntariado", icon: "hand-left" },
};

export default function CartoesScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setErro(null);
    const { data, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("user_id", user.id);
    if (error) {
      setErro(error.message);
    } else {
      setCartoes((data as Cartao[]) ?? []);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Meus cartões</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : erro ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Não consegui carregar os cartões. Confirme o nome da tabela/colunas
              no Supabase para eu ajustar.
            </Text>
            <Text style={styles.emptyHint}>{erro}</Text>
          </View>
        ) : cartoes.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Você ainda não tem cartões disponíveis.
            </Text>
          </View>
        ) : (
          cartoes.map((c) => {
            const meta = TIPO_META[(c.tipo ?? "").toLowerCase()] ?? {
              label: c.tipo ?? "Cartão",
              icon: "card" as const,
            };
            return (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name={meta.icon} size={22} color={colors.brandPale} />
                  <Text style={styles.cardTipo}>{meta.label}</Text>
                </View>
                {!!c.numero && <Text style={styles.cardNumero}>{c.numero}</Text>}
                {!!c.status && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{c.status}</Text>
                  </View>
                )}
                {!!c.wallet_url && (
                  <Pressable
                    style={styles.walletBtn}
                    onPress={() => Linking.openURL(c.wallet_url!)}
                  >
                    <Ionicons name="wallet" size={18} color="#fff" />
                    <Text style={styles.walletText}>Adicionar à Wallet</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    empty: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
    emptyText: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    emptyHint: { color: colors.textMuted, fontSize: font.size.sm, opacity: 0.7, textAlign: "center" },
    card: {
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cardTipo: { color: "#fff", fontSize: font.size.md, fontWeight: "700" },
    cardNumero: {
      color: "#fff",
      fontSize: font.size.lg,
      letterSpacing: 2,
      fontWeight: "600",
    },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    badgeText: { color: "#fff", fontSize: font.size.sm, fontWeight: "600" },
    walletBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "#000",
      borderRadius: radius.full,
      height: 46,
      marginTop: spacing.sm,
    },
    walletText: { color: "#fff", fontSize: font.size.md, fontWeight: "600" },
  });
