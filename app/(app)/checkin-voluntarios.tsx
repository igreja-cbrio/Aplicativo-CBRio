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
  ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
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

  /**
   * Agrupa a escala por ÁREA (pedido do Matheus, 26/08: "no check-in pelo app
   * dos membros deve ter separado por área").
   *
   * ⚠️ A `area` vem do SERVIDOR (PR #2733), não é derivada aqui: ela mora em
   * `vol_teams.area`, e remontar o mapa equipe→área no app criaria uma segunda
   * fonte pra divergir na primeira equipe que trocasse de área.
   *
   * ⚠️ Quem não tem área cai num grupo próprio no FIM, com rótulo que diz isso —
   * em vez de sumir da lista ou se misturar a uma área de verdade.
   */
  const porArea = useMemo(() => {
    const m = new Map<string, EscalaItem[]>();
    for (const e of escala) {
      const k = (e.area || "").trim() || "__sem";
      const arr = m.get(k) || [];
      arr.push(e);
      m.set(k, arr);
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] === "__sem" ? 1 : b[0] === "__sem" ? -1 : a[0].localeCompare(b[0], "pt-BR")))
      .map(([k, itens]) => ({
        chave: k,
        rotulo: k === "__sem" ? t("Sem área definida") : k,
        itens: itens.sort((x, y) => (x.volunteer_name || "").localeCompare(y.volunteer_name || "", "pt-BR")),
      }));
  }, [escala, t]);

  const doItem = useCallback((item: EscalaItem): CheckinItem | null => (
    (item.id ? marcadoPorEscala.get(item.id) : null)
    || (item.volunteer_id ? marcadoPorPessoa.get(item.volunteer_id) : null)
    || null
  ), [marcadoPorEscala, marcadoPorPessoa]);

  /**
   * Marca presença de forma OTIMISTA.
   *
   * ⚠️⚠️ POR QUE OTIMISTA (26/08 · "quando marca a pessoa, achei o carregamento
   * meio lento; deixe mais suave e mais rápido"). A primeira versão fazia
   * `await registrarCheckin()` e DEPOIS `await carregarLista()`, que refaz DOIS
   * pedidos (escala + check-ins) — três idas ao servidor antes de a linha mudar
   * de cor, com a fila do culto esperando na porta. É o mesmo padrão que o ERP já
   * usa em `Batismos.tsx`: "a UI muda na hora; persiste em background e reverte
   * se falhar".
   *
   * ⚠️ NÃO recarrega a lista no sucesso. A resposta do POST já é a linha criada;
   * recarregar tudo pra confirmar o que o servidor acabou de confirmar é a
   * lentidão que motivou o pedido.
   *
   * ⚠️ E REVERTE no erro — sem isso o otimismo vira mentira: a pessoa ficaria
   * marcada na tela e ausente no banco, que é pior que o carregamento lento.
   */
  async function marcar(item: EscalaItem) {
    if (!servicoSel?.id) return;
    if (doItem(item)) return;                       // já marcado: nada a fazer
    const provisorio: CheckinItem = {
      id: `otimista:${item.id}`,
      schedule_id: item.id,
      volunteer_id: item.volunteer_id,
      volunteer_name: item.volunteer_name,
      checked_in_at: new Date().toISOString(),
      method: "manual",
    };
    setCheckins((atuais) => [provisorio, ...atuais]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const criado = await registrarCheckin({
        service_id: servicoSel.id,
        schedule_id: item.id,
        ...(item.volunteer_id ? { volunteer_id: item.volunteer_id } : {}),
      });
      // Troca o provisório pelo real (o id importa: é o que o desfazer usa).
      setCheckins((atuais) => atuais.map((c) => (c.id === provisorio.id ? { ...provisorio, ...criado } : c)));
    } catch (e: any) {
      setCheckins((atuais) => atuais.filter((c) => c.id !== provisorio.id));
      // ⚠️ A mensagem do servidor é MELHOR que qualquer texto genérico daqui:
      // ela diz se foi janela, escopo ou duplicado, com o nome da subárea.
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível registrar o check-in."));
      if (/403|janela|dia do culto/i.test(String(e?.message || ""))) carregarCultos();
    }
  }

  async function desfazer(item: EscalaItem, ck: CheckinItem) {
    Alert.alert(
      t("Desfazer check-in"),
      `${item.volunteer_name} — ${t("marcado às")} ${horaBRT(ck.checked_in_at)}.`,
      [
        { text: t("Cancelar"), style: "cancel" },
        {
          text: t("Desfazer"), style: "destructive",
          onPress: async () => {
            // Mesmo raciocínio do marcar: some da tela na hora, volta se falhar.
            setCheckins((atuais) => atuais.filter((c) => c.id !== ck.id));
            try {
              await desfazerCheckin(ck.id);
            } catch (e: any) {
              setCheckins((atuais) => [ck, ...atuais]);   // reverte
              Alert.alert(t("Não deu"), e?.message || t("Não foi possível desfazer."));
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
              porArea.map((g) => (
                <View key={g.chave} style={{ marginBottom: spacing.md }}>
                  {/* Cabeçalho da ÁREA · com a conta do turno, que é o que o
                      supervisor confere de relance na porta do culto. */}
                  <View style={styles.areaHeader}>
                    <Text style={styles.areaTitulo}>{g.rotulo}</Text>
                    <Text style={styles.areaConta}>
                      {g.itens.filter((x) => !!doItem(x)).length}/{g.itens.length}
                    </Text>
                  </View>
                  {g.itens.map((item) => {
                    const ck = doItem(item);
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => (ck ? desfazer(item, ck) : marcar(item))}
                        style={[styles.linha, ck && styles.linhaMarcada]}
                      >
                        {/* ⚠️ Foto SÓ quando o servidor manda `foto_url` — ele já
                            descarta o placeholder de iniciais do Planning Center
                            (352 dos 619 escalados têm um). Sem foto, ficam as
                            iniciais desenhadas aqui, que combinam com o app. */}
                        {item.foto_url ? (
                          <Image
                            source={{ uri: item.foto_url }}
                            style={[styles.avatar, ck && styles.avatarMarcado]}
                            accessibilityIgnoresInvertColors
                          />
                        ) : (
                          <View style={[styles.avatar, ck && styles.avatarMarcado]}>
                            <Text style={[styles.avatarTxt, ck && styles.avatarTxtMarcado]}>{iniciais(item.volunteer_name)}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.nome}>{item.volunteer_name}</Text>
                          {/* A área já é o cabeçalho — aqui fica só equipe/função,
                              pra não repetir a mesma palavra em toda linha. */}
                          <Text style={styles.sub}>
                            {[item.team_name, item.position_name].filter(Boolean).join(" · ") || t("Sem equipe")}
                          </Text>
                        </View>
                        {ck ? (
                          <View style={styles.marcado}>
                            <Ionicons name="checkmark-circle" size={22} color={colors.brandMid} />
                            <Text style={styles.marcadoHora}>{horaBRT(ck.checked_in_at)}</Text>
                          </View>
                        ) : (
                          <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))
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
    areaHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: spacing.xs, paddingHorizontal: spacing.xs,
    },
    areaTitulo: { color: c.text, fontSize: font.size.sm, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
    areaConta: { color: c.textMuted, fontSize: font.size.sm, fontWeight: "700" },
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
