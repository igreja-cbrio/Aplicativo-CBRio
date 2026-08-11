import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { criarInscricao } from "@/lib/inscricoes";
import { meusPedidosCuidado, type PedidoCuidado } from "@/lib/meusPedidos";
import { useT } from "@/lib/i18n";
import { useFocusEffect, useRouter } from "expo-router";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

const TIPO_LABEL: Record<PedidoCuidado["tipo"], string> = {
  oracao: "Pedido de oração",
  aconselhamento: "Conversa com pastor",
  sos: "Pedido de ajuda",
};

const STATUS_META: Record<PedidoCuidado["tratamento_status"], { label: string; cor: string; bg: string }> = {
  pendente: { label: "Recebido", cor: "#9FB8BF", bg: "rgba(159,184,191,0.16)" },
  em_andamento: { label: "Um pastor está cuidando 💙", cor: "#70A8B0", bg: "rgba(112,168,176,0.18)" },
  concluido: { label: "Atendido", cor: "#3FA66B", bg: "rgba(63,166,107,0.16)" },
};

export default function CuidadosScreen() {
  const { user } = useAuth();
  const { membro } = useMembro();
  const colors = useColors();
  const router = useRouter();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [enviandoSos, setEnviandoSos] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoCuidado[]>([]);
  const [pedidosFalhou, setPedidosFalhou] = useState(false);

  const carregarPedidos = useCallback(() => {
    // Falha NÃO pode ser silenciosa: quem tem pedido em andamento veria a
    // seção sumir e acharia que o pedido foi apagado/ignorado.
    meusPedidosCuidado()
      .then((p) => { setPedidos(p); setPedidosFalhou(false); })
      .catch(() => setPedidosFalhou(true));
  }, []);

  useFocusEffect(carregarPedidos);



  function abrirSOS() {
    Alert.alert(
      t("Precisa de ajuda agora?"),
      t("Se há risco imediato à vida, ligue 192 (SAMU). Você também pode falar agora, de graça e em sigilo, com o CVV (188).\n\nQuer que a gente avise um pastor da CBRio agora?"),
      [
        { text: t("Ligar para o CVV (188)"), onPress: () => Linking.openURL("tel:188") },
        { text: t("Avisar um pastor"), style: "destructive", onPress: enviarSos },
        { text: t("Fechar"), style: "cancel" },
      ]
    );
  }

  async function enviarSos() {
    setEnviandoSos(true);
    try {
      await criarInscricao(
        "sos",
        {
          urgente: true,
          nome: membro?.nome || null,
          telefone: membro?.telefone || null,
          membro_id: membro?.membroId ?? null,
        },
        user?.id
      );
      Alert.alert(
        t("Avisamos um pastor 💙"),
        t("Um pastor responsável foi notificado e vai te procurar. Se for emergência, ligue 192 (SAMU) ou 188 (CVV) agora.")
      );
      setTimeout(carregarPedidos, 1500);
    } catch {
      Alert.alert(
        t("Não foi possível avisar agora"),
        t("Por favor, ligue para o CVV (188) ou 192 (SAMU). Você não está sozinho.")
      );
    } finally {
      setEnviandoSos(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TecladoSeguro        style={styles.flex}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="heart" size={28} color={colors.brandPale} />
            </View>
            <Text style={styles.title}>{t("Cuidados")}</Text>
            <Text style={styles.subtitle}>
              {t("Você não está sozinho. Conte com a CBRio.")}
            </Text>
          </View>

          {/* SOS — ajuda imediata */}
          <View style={styles.sos}>
            <View style={styles.sosTop}>
              <Ionicons name="alert-circle" size={22} color="#fff" />
              <Text style={styles.sosTitle}>{t("Preciso de ajuda agora")}</Text>
            </View>
            <Text style={styles.sosText}>
              {t("Se você está em sofrimento ou pensando em desistir, fale agora. É de graça e em sigilo.")}
            </Text>
            <Pressable
              style={styles.sosBtn}
              onPress={abrirSOS}
              disabled={enviandoSos}
            >
              <Ionicons name="hand-right" size={18} color={colors.danger} />
              <Text style={styles.sosBtnText}>
                {enviandoSos ? t("Enviando...") : t("Pedir ajuda urgente")}
              </Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL("tel:188")} hitSlop={6}>
              <Text style={styles.sosLink}>
                {t("Ou ligue agora para o CVV — 188 (24h, gratuito)")}
              </Text>
            </Pressable>
          </View>

          {/* ⚠️⚠️ DUAS PORTAS, NÃO QUATRO (11/08/2026 · apontamento 14).
              Decisão do Marcos: *"vamos separar em duas portas então, uma que é
              esse contato SOS, que tem que ser destacado como é hoje, e a outra
              é o fale com a CBRio: ao clicar, você teria 3 opções — marcar
              conversa com pastor, pedir oração, e a terceira opção de enviar
              mensagem de dúvida, sugestão, pedido ou feedback."*

              Aqui havia DOIS cartões (oração com textarea, e aconselhamento com
              botão), e o "Fale conosco" morava a QUATRO toques daqui (Menu →
              Ajustes → Configurações → Ajuda). Os três viraram uma entrada só.

              ⚠️ O SOS acima NÃO entrou na fusão, de propósito: é a única destas
              portas que pode salvar alguém em minuto zero, e ele oferece o CVV
              188 ANTES de qualquer formulário. Virar item de lista somaria dois
              toques entre a pessoa e o socorro. */}
          <Pressable
            style={styles.portaUnica}
            onPress={() => router.navigate("/falar-com-a-igreja")}
            accessibilityRole="button"
            accessibilityLabel={t("Falar com a CBRio")}
          >
            <View style={styles.portaIcone}>
              <Ionicons name="chatbubbles" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t("Falar com a CBRio")}</Text>
              <Text style={styles.cardText}>
                {t("Conversa com pastor, pedido de oração, dúvida ou sugestão — num lugar só.")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {/* Meus pedidos — acompanhamento do que já enviei */}
          {pedidosFalhou && pedidos.length === 0 && (
            <View style={styles.meusWrap}>
              <Text style={styles.meusTitulo}>{t("Meus pedidos")}</Text>
              <Pressable onPress={carregarPedidos} accessibilityRole="button">
                <Text style={{ color: colors.textMuted, fontSize: font.size.sm }}>
                  {t("Não foi possível carregar seus pedidos. Toque pra tentar de novo.")}
                </Text>
              </Pressable>
            </View>
          )}
          {pedidos.length > 0 && (
            <View style={styles.meusWrap}>
              <Text style={styles.meusTitulo}>{t("Meus pedidos")}</Text>
              {pedidos.map((p) => {
                const st = STATUS_META[p.tratamento_status];
                return (
                  <View key={p.id} style={styles.pedido}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pedidoTipo}>{t(TIPO_LABEL[p.tipo])}</Text>
                      {p.mensagem ? (
                        <Text style={styles.pedidoMsg} numberOfLines={1}>{p.mensagem}</Text>
                      ) : null}
                      <Text style={styles.pedidoData}>
                        {new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: st.cor }]} />
                      <Text style={[styles.statusTxt, { color: st.cor }]}>{t(st.label)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </TecladoSeguro>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },
    header: { alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
    badge: {
      width: 72,
      height: 72,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    title: { color: colors.text, fontSize: font.size.xl, fontWeight: "800" },
    subtitle: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center" },
    sos: {
      backgroundColor: colors.danger,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    sosTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sosTitle: { color: "#fff", fontSize: font.size.lg, fontWeight: "800" },
    sosText: { color: "rgba(255,255,255,0.95)", fontSize: font.size.sm, lineHeight: 20 },
    sosBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "#fff",
      borderRadius: radius.full,
      height: 48,
      marginTop: spacing.xs,
    },
    sosBtnText: { color: colors.danger, fontSize: font.size.md, fontWeight: "800" },
    sosLink: {
      color: "#fff",
      fontSize: font.size.sm,
      textAlign: "center",
      textDecorationLine: "underline",
      marginTop: spacing.xs,
    },
    portaUnica: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, borderColor: colors.glassBorder,
    },
    portaIcone: {
      width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
      backgroundColor: colors.primary + "18",
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    cardTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
    cardText: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
    meusWrap: { gap: spacing.sm, marginTop: spacing.sm },
    meusTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700", marginBottom: 2 },
    pedido: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    pedidoTipo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    pedidoMsg: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 1 },
    pedidoData: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
    },
    statusDot: { width: 6, height: 6, borderRadius: 999 },
    statusTxt: { fontSize: 11, fontWeight: "700" },
    textarea: {
      minHeight: 100,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      color: colors.text,
      fontSize: font.size.md,
      textAlignVertical: "top",
    },
    err: { color: colors.danger, fontSize: font.size.sm },
  });
