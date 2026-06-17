import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
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
import { useFocusEffect } from "expo-router";
import { font, radius, spacing, type Palette } from "@/constants/theme";

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
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [oracao, setOracao] = useState("");
  const [enviandoOracao, setEnviandoOracao] = useState(false);
  const [enviandoSos, setEnviandoSos] = useState(false);
  const [enviandoAcons, setEnviandoAcons] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoCuidado[]>([]);

  const carregarPedidos = useCallback(() => {
    meusPedidosCuidado().then(setPedidos).catch(() => {});
  }, []);

  useFocusEffect(carregarPedidos);

  async function enviarOracao() {
    if (!oracao.trim()) {
      setMsg(t("Escreva seu pedido de oração."));
      return;
    }
    setMsg(null);
    setEnviandoOracao(true);
    try {
      await criarInscricao(
        "oracao",
        {
          mensagem: oracao.trim(),
          nome: membro?.nome || null,
          telefone: membro?.telefone || null,
          membro_id: membro?.membroId ?? null,
        },
        user?.id
      );
      setOracao("");
      Alert.alert(
        t("Recebemos seu pedido 🙏"),
        t("Nossa equipe vai orar por você. Que Deus te console.")
      );
      setTimeout(carregarPedidos, 1500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("Não foi possível enviar."));
    } finally {
      setEnviandoOracao(false);
    }
  }

  async function pedirAconselhamento() {
    setMsg(null);
    setEnviandoAcons(true);
    try {
      await criarInscricao(
        "aconselhamento",
        {
          nome: membro?.nome || null,
          telefone: membro?.telefone || null,
          membro_id: membro?.membroId ?? null,
        },
        user?.id
      );
      Alert.alert(
        t("Pedido enviado"),
        t("Um pastor ou líder vai entrar em contato com você em breve.")
      );
      setTimeout(carregarPedidos, 1500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("Não foi possível enviar."));
    } finally {
      setEnviandoAcons(false);
    }
  }

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
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

          {/* Pedido de oração · sólido (form denso não usa glass · HIG) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Pedido de oração")}</Text>
            <TextInput
              style={styles.textarea}
              value={oracao}
              onChangeText={setOracao}
              placeholder={t("Conte pelo que podemos orar…")}
              placeholderTextColor={colors.textMuted}
              multiline
            />
            {msg && <Text style={styles.err}>{msg}</Text>}
            <Button title={t("Enviar pedido")} onPress={enviarOracao} loading={enviandoOracao} />
          </View>

          {/* Aconselhamento · sólido */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Conversar com um pastor")}</Text>
            <Text style={styles.cardText}>
              {t("Quer um aconselhamento ou uma conversa? Um pastor ou líder entra em contato com você.")}
            </Text>
            <Button
              title={t("Quero conversar")}
              variant="ghost"
              onPress={pedirAconselhamento}
              loading={enviandoAcons}
            />
          </View>

          {/* Meus pedidos — acompanhamento do que já enviei */}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.lg },
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
