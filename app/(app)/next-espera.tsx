// ============================================================================
// ACEITAÇÕES DO NEXT · a fila de quem foi direcionado e ainda não tem turma.
//
// Espelha o `GET /next/lista-espera` da aba Next da Integração. O voluntário
// aloca em turma ABERTA; transferir quem já tem turma segue sendo do funcionário
// (o servidor responde 409 `ja_tem_turma`).
//
// ⚠️⚠️ Esta tela carrega PII (telefone), então vive atrás do gate de gestão do
// servidor (`autorizarGestaoNextApp`). Quem não gerencia leva 403 e a tela DIZ
// isso — nunca mostra lista vazia, que se leria como "a fila está limpa".
// ============================================================================
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { nomeDaPessoa, turmasQueRecebem } from "@/lib/nextGestao";
import { trackEvento } from "@/lib/telemetria";
import {
  alocarNextMatricula, getNextGestao, getNextListaEspera,
  type NextPessoaEspera, type NextTurmaGestao,
} from "@/lib/api";

function waLink(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
}

export default function NextEsperaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [pessoas, setPessoas] = useState<NextPessoaEspera[] | null>(null);
  const [turmas, setTurmas] = useState<NextTurmaGestao[]>([]);
  const [escreve, setEscreve] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [alocando, setAlocando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    // ⚠️ `allSettled`: a fila é o protagonista. Falhar a lista de turmas não
    // pode esconder quem está esperando — sem turma a tela ainda mostra a fila
    // e diz que não dá pra alocar agora.
    const [fila, gestao] = await Promise.allSettled([getNextListaEspera(), getNextGestao()]);

    if (gestao.status === "fulfilled") {
      setTurmas(turmasQueRecebem(gestao.value.turmas) as NextTurmaGestao[]);
      setEscreve(!!gestao.value.escreve);
    }

    if (fila.status === "fulfilled") {
      setPessoas(fila.value.pessoas || []);
      return;
    }
    const status = (fila.reason as { status?: number })?.status;
    setErro(
      status === 403
        ? t("Esta fila é só para quem gerencia o NEXT.")
        : (fila.reason as Error)?.message || t("Não foi possível carregar a fila.")
    );
    if (pessoas === null) setPessoas([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  async function refrescar() {
    setRefrescando(true);
    try { await carregar(); } finally { setRefrescando(false); }
  }

  function confirmarAlocar(p: NextPessoaEspera, turma: NextTurmaGestao) {
    Alert.alert(
      t("Colocar nesta turma?"),
      `${nomeDaPessoa(p)} ${t("entra em")} ${turma.nome || t("turma")}.`,
      [
        { text: t("Cancelar"), style: "cancel" },
        { text: t("Colocar"), onPress: () => { void alocar(p, turma); } },
      ]
    );
  }

  async function alocar(p: NextPessoaEspera, turma: NextTurmaGestao) {
    if (alocando) return;
    setAlocando(p.id);
    try {
      await alocarNextMatricula(p.id, turma.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      trackEvento("next_alocou_da_fila", { entity_id: turma.id });
      // Sai da fila na hora: o servidor confirmou, e recarregar tudo pra
      // reconfirmar o que ele acabou de confirmar é a lentidão em pessoa.
      setPessoas((atual) => (atual || []).filter((x) => x.id !== p.id));
      setAbertoId(null);
      Alert.alert(t("Pronto"), `${nomeDaPessoa(p)} ${t("está na turma")} ${turma.nome || ""}.`.trim());
    } catch (e) {
      const corpo = (e as { corpo?: { codigo?: string } })?.corpo;
      // ⚠️ 409 `ja_tem_turma` não é erro de app: é fato que mudou por fora
      // (alguém alocou no sistema). A tela diz o caminho e tira da fila.
      if (corpo?.codigo === "ja_tem_turma" || corpo?.codigo === "corrida") {
        setPessoas((atual) => (atual || []).filter((x) => x.id !== p.id));
        Alert.alert(t("Já estava resolvido"), (e as Error).message);
      } else {
        Alert.alert(t("Não foi possível colocar na turma"), (e as Error)?.message || t("Erro."));
      }
    } finally {
      setAlocando(null);
    }
  }

  const fila = pessoas || [];
  const semTurmaAberta = turmas.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{t("Aceitações")}</Text>
        <View style={{ width: 26 }} />
      </View>

      {pessoas === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
        >
          {erro ? (
            <View style={styles.aviso}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
              <Text style={styles.avisoTxt}>{erro}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.pequeno}>
              {t("Quem aceitou o convite no fim do encontro e ainda não tem turma. Coloque cada pessoa numa turma aberta.")}
            </Text>
          </View>

          {!erro && semTurmaAberta && fila.length > 0 ? (
            <View style={styles.aviso}>
              <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
              <Text style={styles.avisoTxt}>
                {t("Nenhuma turma aberta agora — as turmas do mês abrem por rotina automática.")}
              </Text>
            </View>
          ) : null}

          {!escreve && !erro && fila.length > 0 ? (
            <View style={styles.aviso}>
              <Ionicons name="eye-outline" size={18} color={colors.warning} />
              <Text style={styles.avisoTxt}>{t("Seu acesso ao NEXT é só de leitura.")}</Text>
            </View>
          ) : null}

          {fila.length === 0 ? (
            !erro ? (
              <View style={styles.card}>
                <Text style={styles.muted}>{t("Ninguém esperando turma agora.")}</Text>
              </View>
            ) : null
          ) : (
            <>
              <Text style={styles.secLabel}>{t("Esperando")} ({fila.length})</Text>
              {fila.map((p) => {
                const wa = waLink(p.telefone);
                const aberto = abertoId === p.id;
                const proc = alocando === p.id;
                return (
                  <View key={p.id} style={styles.card}>
                    <View style={styles.linha}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nome} numberOfLines={1}>{nomeDaPessoa(p)}</Text>
                        {!!p.observacoes && <Text style={styles.pequeno} numberOfLines={2}>{p.observacoes}</Text>}
                      </View>
                      {wa ? (
                        <Pressable
                          onPress={() => Linking.openURL(wa)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("WhatsApp")} ${nomeDaPessoa(p)}`}
                        >
                          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                        </Pressable>
                      ) : null}
                    </View>

                    {escreve && !semTurmaAberta ? (
                      aberto ? (
                        <View style={{ gap: spacing.sm }}>
                          <Text style={styles.pequeno}>{t("Em qual turma?")}</Text>
                          {turmas.map((turma) => (
                            <Pressable
                              key={turma.id}
                              style={styles.turmaOpcao}
                              disabled={proc}
                              onPress={() => confirmarAlocar(p, turma)}
                              accessibilityRole="button"
                              accessibilityLabel={`${t("Colocar em")} ${turma.nome || ""}`}
                            >
                              <Ionicons name="people-outline" size={18} color={colors.primary} />
                              <Text style={styles.turmaOpcaoTxt} numberOfLines={1}>{turma.nome || t("Turma")}</Text>
                              {proc ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                            </Pressable>
                          ))}
                          <Pressable onPress={() => setAbertoId(null)} hitSlop={8} accessibilityRole="button">
                            <Text style={styles.linkTxt}>{t("Cancelar")}</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.btn}
                          onPress={() => setAbertoId(p.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("Colocar em uma turma")} ${nomeDaPessoa(p)}`}
                        >
                          <Ionicons name="add-circle-outline" size={18} color="#fff" />
                          <Text style={styles.btnTxt}>{t("Colocar em uma turma")}</Text>
                        </Pressable>
                      )
                    ) : null}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
    title: { flex: 1, color: c.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
    muted: { color: c.textMuted, fontSize: font.size.md, textAlign: "center" },
    pequeno: { color: c.textMuted, fontSize: font.size.sm },
    secLabel: { color: c.textMuted, fontSize: font.size.sm - 1, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.xs },
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md, gap: spacing.sm },
    linha: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    nome: { color: c.text, fontSize: font.size.md, fontWeight: "800" },
    aviso: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: c.warning + "1A", borderColor: c.warning, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
    avisoTxt: { flex: 1, color: c.text, fontSize: font.size.sm },
    btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.primary, borderRadius: radius.full, paddingVertical: 12, paddingHorizontal: spacing.md },
    btnTxt: { color: "#fff", fontSize: font.size.sm, fontWeight: "800" },
    turmaOpcao: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surfaceAlt, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: spacing.md },
    turmaOpcaoTxt: { flex: 1, color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    linkTxt: { color: c.textMuted, fontSize: font.size.sm, fontWeight: "700", textAlign: "center" },
  });
}
