import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { brand, font, radius, spacing, type Palette } from "@/constants/theme";

function statusLabel(s?: string | null) {
  // Espelha o passe do ERP: "Ativo" ou "Cadastro pendente".
  return s === "membro_ativo" || s === "membro" ? "Ativo" : "Cadastro pendente";
}

function cartaoId(membroId?: string | null) {
  if (!membroId) return "";
  return `CBR-M-${membroId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export default function CartoesScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [membroId, setMembroId] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [cpf, setCpf] = useState<string | null>(null);
  const [nascimento, setNascimento] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
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
    setMembroId(prof.membro_id);
    const { data: m } = await supabase
      .from("mem_membros")
      .select("nome, cpf, status, data_nascimento")
      .eq("id", prof.membro_id)
      .maybeSingle();
    if (m) {
      setNome(m.nome ?? null);
      setCpf(m.cpf ?? null);
      setStatus(m.status ?? null);
      setNascimento(m.data_nascimento ?? null);
    }
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
          <>
            {/* Cartão idêntico ao passe da Wallet (fundo teal #408097) */}
            <View style={styles.card}>
              <Image
                source={require("../../assets/images/cbrio-wordmark.png")}
                style={styles.wordmark}
                resizeMode="contain"
              />

              <Text style={styles.label}>MEMBRO</Text>
              <Text style={styles.nome}>{nome ?? "Membro"}</Text>

              <View style={styles.row}>
                <View>
                  <Text style={styles.label}>IGREJA</Text>
                  <Text style={styles.value}>CBRio</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.label}>STATUS</Text>
                  <Text style={styles.value}>{statusLabel(status)}</Text>
                </View>
              </View>

              <Text style={[styles.label, { marginTop: spacing.md }]}>ID</Text>
              <Text style={styles.value}>{cartaoId(membroId)}</Text>

              <View style={styles.qrBox}>
                {token ? (
                  <QRCode value={token} size={196} backgroundColor="#ffffff" color="#0B1F26" />
                ) : (
                  <Text style={styles.qrMissing}>QR indisponível</Text>
                )}
              </View>
            </View>

            <Button
              title="Adicionar à Wallet"
              onPress={addWallet}
              loading={walletLoading}
            />
            {erro && <Text style={styles.erro}>{erro}</Text>}
          </>
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
      backgroundColor: brand.primary, // azul/teal principal #408097
      borderRadius: 22,
      padding: spacing.lg,
    },
    wordmark: {
      width: 92,
      height: 30,
      tintColor: "#FFFFFF",
      marginBottom: spacing.lg,
    },
    label: {
      color: "rgba(255,255,255,0.7)",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
    },
    nome: {
      color: "#FFFFFF",
      fontSize: 30,
      fontWeight: "700",
      marginTop: 2,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.xl,
    },
    value: { color: "#FFFFFF", fontSize: font.size.lg, marginTop: 2 },
    qrBox: {
      alignSelf: "center",
      backgroundColor: "#fff",
      padding: spacing.md,
      borderRadius: radius.lg,
      marginTop: spacing.xl,
    },
    qrMissing: { color: colors.textMuted, padding: spacing.xl },
    erro: { color: colors.danger, fontSize: font.size.sm, textAlign: "center" },
  });
