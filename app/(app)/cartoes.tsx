import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/**
 * Cartões (membresia/voluntariado) do SISTEMA_INTEGRADO_CBRIO.
 * Modelo real: profiles.membro_id -> mem_membros; QR em mem_qrcodes (por cpf).
 * O passe da Wallet (.pkpass) é gerado por um endpoint do sistema — defina abaixo.
 */
const WALLET_PASS_URL: string | null = null; // ex.: "https://sistema.cbrio.com.br/wallet/pass"

type Membro = {
  id: string;
  nome: string;
  cpf: string | null;
  status: string | null;
  voluntario: boolean | null;
};

export default function CartoesScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [membro, setMembro] = useState<Membro | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setErro(null);
    const { data: prof } = await supabase
      .from("profiles")
      .select("membro_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!prof?.membro_id) {
      setLoading(false);
      return;
    }
    const { data: m, error } = await supabase
      .from("mem_membros")
      .select("id, nome, cpf, status, voluntario")
      .eq("id", prof.membro_id)
      .maybeSingle();
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }
    setMembro(m as Membro);
    if (m?.cpf) {
      const { data: qr } = await supabase
        .from("mem_qrcodes")
        .select("token")
        .eq("cpf", m.cpf)
        .maybeSingle();
      setToken(qr?.token ?? null);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function addWallet(tipo: string) {
    if (WALLET_PASS_URL && token) {
      Linking.openURL(`${WALLET_PASS_URL}?token=${encodeURIComponent(token)}&tipo=${tipo}`);
    } else {
      Alert.alert(
        "Em breve",
        "A geração do passe para a Wallet ainda será conectada ao sistema."
      );
    }
  }

  const cards: { tipo: "membresia" | "voluntariado"; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [];
  if (membro) {
    cards.push({ tipo: "membresia", label: "Cartão de Membresia", icon: "id-card" });
    if (membro.voluntario) {
      cards.push({ tipo: "voluntariado", label: "Cartão de Voluntariado", icon: "hand-left" });
    }
  }

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
            <Text style={styles.emptyText}>Não consegui carregar os cartões.</Text>
            <Text style={styles.emptyHint}>{erro}</Text>
          </View>
        ) : !membro ? (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Sua conta ainda não está vinculada a um membro da CBRio. Informe seu
              CPF no perfil para liberar seus cartões.
            </Text>
            <Button title="Vincular pelo CPF" onPress={() => router.navigate("/perfil")} />
          </View>
        ) : (
          cards.map((c) => (
            <View
              key={c.tipo}
              style={[
                styles.card,
                c.tipo === "voluntariado" && { backgroundColor: colors.primaryDark },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name={c.icon} size={22} color={colors.brandPale} />
                <Text style={styles.cardTipo}>{c.label}</Text>
              </View>
              <Text style={styles.cardNome}>{membro.nome}</Text>
              {!!membro.status && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{membro.status}</Text>
                </View>
              )}
              <Pressable style={styles.walletBtn} onPress={() => addWallet(c.tipo)}>
                <Ionicons name="wallet" size={18} color="#fff" />
                <Text style={styles.walletText}>Adicionar à Wallet</Text>
              </Pressable>
            </View>
          ))
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
    cardNome: { color: "#fff", fontSize: font.size.lg, fontWeight: "700" },
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
