import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { adicionarWalletMembresia } from "@/lib/wallet";
import { onlyDigits } from "@/lib/validators";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/**
 * Cartão ÚNICO da CBRio: um QR (mem_qrcodes.token) que serve para tudo —
 * identificação de membro e check-in de voluntário (o leitor decide a ação).
 * O QR aparece na tela (lê na hora) e dá para adicionar à Wallet (.pkpass do ERP).
 */
export default function CartoesScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [nome, setNome] = useState<string | null>(null);
  const [cpf, setCpf] = useState<string | null>(null);
  const [nascimento, setNascimento] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [voluntario, setVoluntario] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vinculado, setVinculado] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
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
      setVinculado(false);
      setLoading(false);
      return;
    }
    const { data: m } = await supabase
      .from("mem_membros")
      .select("nome, cpf, status, data_nascimento, voluntario")
      .eq("id", prof.membro_id)
      .maybeSingle();
    if (m) {
      setNome(m.nome ?? null);
      setCpf(m.cpf ?? null);
      setStatus(m.status ?? null);
      setNascimento(m.data_nascimento ?? null);
      let vol = !!m.voluntario;
      if (!vol) {
        const { data: vols } = await supabase
          .from("mem_voluntarios")
          .select("id")
          .eq("membro_id", prof.membro_id)
          .is("deleted_at", null)
          .limit(1);
        vol = !!vols && vols.length > 0;
      }
      setVoluntario(vol);
    }
    // token do QR (cria se faltar, via função no servidor)
    const { data: tk } = await supabase.rpc("app_meu_qrcode");
    setToken((tk as string) ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function addWallet() {
    setErro(null);
    if (!cpf) {
      setErro("Cadastro sem CPF — atualize seu perfil para gerar o cartão.");
      return;
    }
    setWalletLoading(true);
    try {
      await adicionarWalletMembresia(onlyDigits(cpf), nascimento);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir a Wallet.");
    } finally {
      setWalletLoading(false);
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
          <Text style={styles.title}>Meu cartão</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : !vinculado ? (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Sua conta ainda não está vinculada a um membro da CBRio. Informe seu
              CPF no perfil para liberar seu cartão.
            </Text>
            <Button title="Vincular pelo CPF" onPress={() => router.navigate("/perfil")} />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="id-card" size={22} color={colors.brandPale} />
              <Text style={styles.cardTipo}>Cartão CBRio</Text>
            </View>
            <Text style={styles.cardNome}>{nome ?? "Membro"}</Text>
            <View style={styles.badges}>
              {!!status && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{status}</Text>
                </View>
              )}
              {voluntario && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>voluntário</Text>
                </View>
              )}
            </View>

            <View style={styles.qrBox}>
              {token ? (
                <QRCode value={token} size={196} backgroundColor="#ffffff" color="#0B1F26" />
              ) : (
                <Text style={styles.qrMissing}>QR indisponível</Text>
              )}
            </View>
            <Text style={styles.qrHint}>
              Mostre este QR para identificação e check-in.
            </Text>

            <Button
              title="Adicionar à Wallet"
              onPress={addWallet}
              loading={walletLoading}
            />
            {erro && <Text style={styles.erro}>{erro}</Text>}
          </View>
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
    card: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      alignItems: "center",
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start" },
    cardTipo: { color: "#fff", fontSize: font.size.md, fontWeight: "700" },
    cardNome: { color: "#fff", fontSize: font.size.lg, fontWeight: "700", alignSelf: "flex-start" },
    badges: { flexDirection: "row", gap: spacing.xs, alignSelf: "flex-start", flexWrap: "wrap" },
    badge: {
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    badgeText: { color: "#fff", fontSize: font.size.sm, fontWeight: "600" },
    qrBox: {
      backgroundColor: "#fff",
      padding: spacing.md,
      borderRadius: radius.lg,
      marginTop: spacing.sm,
    },
    qrMissing: { color: colors.textMuted, padding: spacing.xl },
    qrHint: { color: "rgba(255,255,255,0.85)", fontSize: font.size.sm, textAlign: "center" },
    erro: { color: "#fff", fontSize: font.size.sm, textAlign: "center" },
  });
