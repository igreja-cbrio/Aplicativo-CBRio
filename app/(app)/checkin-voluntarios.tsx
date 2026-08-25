// ============================================================================
// CHECK-IN DOS VOLUNTÁRIOS PELO SUPERVISOR (25/08/2026)
//
// Pedido do Matheus: *"no app de membros os supervisores devem ter a
// funcionalidade de fazer check-in também dos voluntários das suas respectivas
// áreas. E só podem mexer nessa funcionalidade nos dias de culto. Isso ajuda a
// gente não ficar refém de apenas um local de check-in (que hoje é na sala de
// voluntários)."*
//
// ⚠️⚠️ QUEM MANDA É O SERVIDOR. Ele decide a JANELA (dia do culto em BRT) e o
// ESCOPO (área + subárea da concessão) e responde 403. A régua local
// (`lib/janelaCheckin`) existe pra o botão não APARECER fora da janela — nunca
// pra substituir a checagem. Se as duas discordarem, o toque falha, e botão que
// falha é pior que botão que não existe.
//
// ⚠️ A lista de escalados vem de `getEscala`, que JÁ vem recortada pelo escopo
// do supervisor (o backend filtra composição e escalas). Esta tela não refiltra
// nada: refiltrar no cliente criaria uma segunda régua pra divergir da primeira.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { subirUmNivel } from "@/lib/hierarquia";
import { cultosDeHoje } from "@/lib/janelaCheckin";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  getEscalaServicos, getEscala, getCheckinsDoServico, registrarCheckin, desfazerCheckin,
  type EscalaServico, type EscalaItem, type CheckinItem,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function horaBRT(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
  });
}

export default function CheckinVoluntariosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [cultos, setCultos] = useState<EscalaServico[]>([]);
  const [servicoSel, setServicoSel] = useState<EscalaServico | null>(null);
  const [escala, setEscala] = useState<EscalaItem[]>([]);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [emAcao, setEmAcao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarCultos = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await getEscalaServicos();
      // ⚠️ O corte de HOJE é a régua pura do portão, não um filtro inline: o
      // servidor decide igual e um `slice(0,10)` de ISO aqui fecharia a janela
      // no meio do culto da noite (22h UTC já é o dia seguinte).
      const doDia = cultosDeHoje(r.servicos || []);
      setCultos(doDia);
      setServicoSel((atual) => atual && doDia.some((c) => c.id === atual.id) ? atual : doDia[0] ?? null);
    } catch (e: any) {
      setErro(e?.message || t("Não foi possível carregar os cultos de hoje."));
    } finally {
      setCarregando(false);
    }
  }, [t]);

  useEffect(() => { carregarCultos(); }, [carregarCultos]);

  const carregarLista = useCallback(async (servicoId: string) => {
    setCarregandoLista(true);
    try {
      const [esc, cks] = await Promise.all([
        getEscala(servicoId),
        getCheckinsDoServico(servicoId),
      ]);
      setEscala(esc.escalas || []);
      setCheckins(cks || []);
    } catch (e: any) {
      setErro(e?.message || t("Não foi possível carregar a lista."));
    } finally {
      setCarregandoLista(false);
    }
  }, [t]);

  useEffect(() => {
    if (servicoSel?.id) carregarLista(servicoSel.id);
  }, [servicoSel?.id, carregarLista]);

  // Presença por ESCALA e por PESSOA: o backend deduplica por BLOCO de culto
  // (a manhã inteira cobre com 1 check-in), então a mesma pessoa pode aparecer
  // marcada num culto sem ter linha de check-in NESTE service_id.
  const marcadoPorEscala = useMemo(() => {
    const m = new Map<string, CheckinItem>();
    for (const c of checkins) if (c.schedule_id) m.set(c.schedule_id, c);
    return m;
  }, [checkins]);
  const marcadoPorPessoa = useMemo(() => {
    const m = new Map<string, CheckinItem>();
    for (const c of checkins) if (c.volunteer_id) m.set(c.volunteer_id, c);
    return m;
  }, [checkins]);

  const doItem = useCallback((item: EscalaItem): CheckinItem | null => (
    (item.id ? marcadoPorEscala.get(item.id) : null)
    || (item.volunteer_id ? marcadoPorPessoa.get(item.volunteer_id) : null)
    || null
  ), [marcadoPorEscala, marcadoPorPessoa]);

  async function marcar(item: EscalaItem) {
    if (!servicoSel?.id || emAcao) return;
    setEmAcao(item.id);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await registrarCheckin({
        service_id: servicoSel.id,
        schedule_id: item.id,
        ...(item.volunteer_id ? { volunteer_id: item.volunteer_id } : {}),
      });
      await carregarLista(servicoSel.id);
    } catch (e: any) {
      // ⚠️ A mensagem do servidor é MELHOR que qualquer texto genérico daqui:
      // ela diz se foi janela, escopo ou duplicado, com o nome da subárea.
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível registrar o check-in."));
      if (/403|janela|dia do culto/i.test(String(e?.message || ""))) carregarCultos();
    } finally {
      setEmAcao(null);
    }
  }

  async function desfazer(item: EscalaItem, ck: CheckinItem) {
    if (emAcao) return;
    Alert.alert(
      t("Desfazer check-in"),
      `${item.volunteer_name} — ${t("marcado às")} ${horaBRT(ck.checked_in_at)}.`,
      [
        { text: t("Cancelar"), style: "cancel" },
        {
          text: t("Desfazer"), style: "destructive",
          onPress: async () => {
            setEmAcao(item.id);
            try {
              await desfazerCheckin(ck.id);
              if (servicoSel?.id) await carregarLista(servicoSel.id);
            } catch (e: any) {
              Alert.alert(t("Não deu"), e?.message || t("Não foi possível desfazer."));
            } finally {
              setEmAcao(null);
            }
          },
        },
      ],
    );
  }

  const totalMarcados = escala.filter((e) => !!doItem(e)).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel("/checkin-voluntarios")} hitSlop={12} style={styles.voltar}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitulo}>{t("Check-in dos voluntários")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={async () => { setRefrescando(true); await carregarCultos(); setRefrescando(false); }}
            tintColor={colors.brandMid}
          />
        }
      >
        {carregando ? (
          <ActivityIndicator color={colors.brandMid} style={{ marginTop: spacing.xl }} />
        ) : erro ? (
          <Text style={styles.erro}>{erro}</Text>
        ) : cultos.length === 0 ? (
          // ⚠️ Estado vazio EXPLICATIVO. "Nenhum culto" faria o supervisor achar
          // que a tela quebrou; o motivo real é a janela, e ela é a regra.
          <View style={styles.vazio}>
            <Ionicons name="calendar-outline" size={34} color={colors.textMuted} />
            <Text style={styles.vazioTitulo}>{t("Hoje não tem culto")}</Text>
            <Text style={styles.vazioTxt}>
              {t("O check-in pelo app só funciona no dia do culto. Volte no dia e a lista da sua área aparece aqui.")}
            </Text>
          </View>
        ) : (
          <>
            {cultos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {cultos.map((c) => {
                  const ativo = servicoSel?.id === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setServicoSel(c)}
                      style={[styles.chip, ativo && styles.chipAtivo]}
                    >
                      <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>
                        {c.service_type_name || t("Culto")} · {horaBRT(c.scheduled_at)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.resumo}>
              {totalMarcados}/{escala.length} {t("presentes")}
            </Text>

            {carregandoLista ? (
              <ActivityIndicator color={colors.brandMid} style={{ marginTop: spacing.lg }} />
            ) : escala.length === 0 ? (
              <Text style={styles.vazioTxt}>{t("Ninguém escalado da sua área neste culto.")}</Text>
            ) : (
              escala.map((item) => {
                const ck = doItem(item);
                const ocupado = emAcao === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => (ck ? desfazer(item, ck) : marcar(item))}
                    disabled={ocupado}
                    style={[styles.linha, ck && styles.linhaMarcada]}
                  >
                    <View style={[styles.avatar, ck && styles.avatarMarcado]}>
                      <Text style={[styles.avatarTxt, ck && styles.avatarTxtMarcado]}>{iniciais(item.volunteer_name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nome}>{item.volunteer_name}</Text>
                      <Text style={styles.sub}>
                        {[item.team_name, item.position_name].filter(Boolean).join(" · ") || t("Sem equipe")}
                      </Text>
                    </View>
                    {ocupado ? (
                      <ActivityIndicator color={colors.brandMid} />
                    ) : ck ? (
                      <View style={styles.marcado}>
                        <Ionicons name="checkmark-circle" size={22} color={colors.brandMid} />
                        <Text style={styles.marcadoHora}>{horaBRT(ck.checked_in_at)}</Text>
                      </View>
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                    )}
                  </Pressable>
                );
              })
            )}

            {/* Declara o que a tela NÃO faz — a lição do painel que esconde o
                próprio buraco. Quem não está na escala não aparece aqui. */}
            <Text style={styles.nota}>
              {t("A lista mostra quem está escalado da sua área. Quem apareceu sem estar na escala precisa ser lançado pela coordenação.")}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    },
    voltar: { padding: spacing.xs },
    headerTitulo: { flex: 1, color: c.text, fontSize: font.size.lg, fontWeight: "700" },
    erro: { color: c.danger, fontSize: font.size.sm, marginTop: spacing.lg, textAlign: "center" },
    vazio: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
    vazioTitulo: { color: c.text, fontSize: font.size.md, fontWeight: "700" },
    vazioTxt: { color: c.textMuted, fontSize: font.size.sm, textAlign: "center", lineHeight: 20 },
    chip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
      borderWidth: 1, borderColor: c.border, marginRight: spacing.sm, backgroundColor: c.surface,
    },
    chipAtivo: { backgroundColor: c.brandPale, borderColor: c.brandMid },
    chipTxt: { color: c.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    chipTxtAtivo: { color: c.primaryDark },
    resumo: { color: c.textMuted, fontSize: font.size.sm, fontWeight: "700", marginBottom: spacing.sm },
    linha: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border,
      padding: spacing.md, marginBottom: spacing.sm,
    },
    linhaMarcada: { borderColor: c.brandMid },
    avatar: {
      width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
      backgroundColor: c.surface,
    },
    avatarMarcado: { backgroundColor: c.brandPale },
    avatarTxt: { color: c.textMuted, fontSize: font.size.sm, fontWeight: "700" },
    avatarTxtMarcado: { color: c.primaryDark },
    nome: { color: c.text, fontSize: font.size.md, fontWeight: "600" },
    sub: { color: c.textMuted, fontSize: font.size.sm, marginTop: 2 },
    marcado: { alignItems: "center" },
    marcadoHora: { color: c.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    nota: { color: c.textMuted, fontSize: font.size.sm, marginTop: spacing.md, lineHeight: 18 },
  });
}
