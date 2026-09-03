// Gestão da turma do NEXT (app de membros): info da turma + inscritos +
// presença POR ENCONTRO + **walk-in** (quem chegou e não estava na lista) +
// **direcionamento** do fim do encontro. Espelha app/(app)/grupo-membros.tsx.
//
// ⚠️⚠️ O gate não é mais POSSE. Até 03/09 esta tela era inalcançável em
// produção: o servidor exigia `next_turmas.responsavel_id = membro.id` e as 44
// turmas vivas têm esse campo NULO. Agora entra quem tem o módulo `next` >= 2
// (∪ posse), e **quem AGE precisa de nível de ESCRITA** — daí o `escreve`.
//
// ⚠️ Nada aqui reimplementa régua: o direcionamento roda a MESMA
// `direcionarMatricula` do totem e da aba Pessoas, e o walk-in passa pelo
// matcher canônico. A tela só evita oferecer o que o servidor vai recusar.
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { mascararTelefoneBR } from "@/lib/telefone";
import { mascararCpf } from "@/lib/cpf";
import { hojeBRT } from "@/lib/dataBRT";
import { trackEvento } from "@/lib/telemetria";
import {
  DESTINOS_NEXT, encontroSugerido, nomeDaPessoa, podeDirecionar,
  type DestinoNext,
} from "@/lib/nextGestao";
import {
  direcionarNextMatricula, getNextDirecionarOpcoes, getNextGestao, getNextTurma,
  marcarPresencaNext, nextWalkIn,
  type NextDirecionarOpcoes, type NextMatricula, type NextTurmaDetalhe,
  type NextTurmaEncontro,
} from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  matriculado: "Matriculado",
  formado: "Formado",
  incompleto: "Incompleto",
  desistiu: "Desistiu",
};

function waLink(tel: string | null): string | null {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
}
/** Digitos crus. A mascara TRUNCA no limite do BR; e ela que impede o campo
 *  aceitar 20 digitos e o servidor recusar sem a pessoa saber por que. */
function soDigitos(v: string): string {
  return String(v || "").replace(/[^0-9]/g, "");
}
function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function nomeCompleto(m: NextMatricula): string {
  return [m.nome, m.sobrenome].filter(Boolean).join(" ").trim() || "—";
}
function rotuloEncontro(e: NextTurmaEncontro, t: (s: string) => string): string {
  if (e.tema) return e.tema;
  return `${t("Encontro")} ${e.numero ?? "?"}`;
}

export default function NextTurmaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ id: string; nome?: string }>();
  const turmaId = String(params.id || "");

  const insets = useSafeAreaInsets();
  // ⚠️ PISO, não o inset cru: dentro de um <Modal> do Android o inset pode vir
  // 0 (a folha é outra janela) e o botão encosta na barra de navegação.
  const fundoSeguro = spacing.lg + Math.max(insets.bottom, spacing.lg);

  const [data, setData] = useState<NextTurmaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  // chave "encontroId:matriculaId" em processamento (evita duplo toque)
  const [processando, setProcessando] = useState<string | null>(null);

  // ⚠️ Quem AGE tem nível de escrita. Enquanto não sabemos (null), a tela não
  // mostra botão de escrita: oferecer e levar 403 é pior que não oferecer.
  const [escreve, setEscreve] = useState<boolean | null>(null);

  // ── walk-in ──
  const [walkAberto, setWalkAberto] = useState(false);
  const [wNome, setWNome] = useState("");
  const [wSobrenome, setWSobrenome] = useState("");
  const [wTelefone, setWTelefone] = useState("");
  const [wCpf, setWCpf] = useState("");
  const [wEncontroId, setWEncontroId] = useState<string | null>(null);
  const [salvandoWalk, setSalvandoWalk] = useState(false);

  // ── direcionamento ──
  const [dirAlvo, setDirAlvo] = useState<NextMatricula | null>(null);
  const [dirDestinos, setDirDestinos] = useState<DestinoNext[]>([]);
  const [dirAreas, setDirAreas] = useState<string[]>([]);
  const [dirHorario, setDirHorario] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<NextDirecionarOpcoes | null>(null);
  const [salvandoDir, setSalvandoDir] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setErro(null);
    try {
      const r = await getNextTurma(turmaId);
      setData(r);
      setErro(null);
    } catch (e: any) {
      const status = (e as { status?: number })?.status;
      setErro(status === 403 ? t("Você não é o responsável por esta turma.") : (e?.message || t("Erro ao carregar a turma.")));
      if (data === null) setData({ turma: null as any, encontros: [], matriculas: [], presencas: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId, t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // ⚠️ Consulta SEPARADA e best-effort: se ela falhar, a tela não perde a
  // chamada (o protagonista) — só não oferece as ações de escrita.
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      getNextGestao()
        .then((g) => { if (vivo) setEscreve(!!g.escreve); })
        .catch(() => { if (vivo) setEscreve(null); });
      return () => { vivo = false; };
    }, [])
  );

  async function refrescar() {
    setRefrescando(true);
    try { await carregar(true); } finally { setRefrescando(false); }
  }

  const turma = data?.turma;
  const encontros = data?.encontros || [];
  const matriculas = data?.matriculas || [];
  const presencas = data?.presencas || [];

  // presença por (encontro_id, matricula_id) → presente
  const presMap = useMemo(() => {
    const m = new Map<string, boolean>();
    presencas.forEach((p) => m.set(`${p.encontro_id}:${p.matricula_id}`, !!p.presente));
    return m;
  }, [presencas]);

  async function togglePresenca(enc: NextTurmaEncontro, mat: NextMatricula) {
    const chave = `${enc.id}:${mat.id}`;
    if (processando) return;
    const atual = presMap.get(chave) === true;
    const novo = !atual;
    setProcessando(chave);
    try {
      await marcarPresencaNext(enc.id, mat.id, novo);
      Haptics.selectionAsync().catch(() => {});
      await carregar(true); // recarrega presenças + status recalculado no backend
    } catch (e: any) {
      Alert.alert(t("Erro"), e?.message || t("Não foi possível marcar presença."));
    } finally {
      setProcessando(null);
    }
  }

  const nome = turma?.nome || params.nome || t("Turma");
  const podeEscrever = escreve === true;

  // ═══ WALK-IN ═══
  function abrirWalkIn() {
    setWNome(""); setWSobrenome(""); setWTelefone(""); setWCpf("");
    // ⚠️ Pré-seleciona o encontro de HOJE (BRT). Sem isso o líder registra
    // presença no encontro errado — e a régua compara STRING, nunca `Date`.
    setWEncontroId(encontroSugerido(encontros, hojeBRT()));
    setWalkAberto(true);
  }

  async function salvarWalkIn() {
    const nomeLimpo = wNome.trim();
    if (nomeLimpo.length < 2) {
      Alert.alert(t("Falta o nome"), t("Informe pelo menos o primeiro nome."));
      return;
    }
    setSalvandoWalk(true);
    try {
      const r = await nextWalkIn(turmaId, {
        nome: nomeLimpo,
        sobrenome: wSobrenome.trim() || null,
        telefone: wTelefone.replace(/\D/g, "") || null,
        cpf: wCpf.replace(/\D/g, "") || null,
        encontro_id: wEncontroId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      trackEvento("next_walkin", { entity_id: turmaId, label: r.ja_inscrito ? "ja_inscrito" : "nova" });
      setWalkAberto(false);
      await carregar(true);
      // ⚠️ DIZ quando o matcher LIGOU numa pessoa que já existia: sem isso o
      // líder acha que não funcionou e tenta de novo com outro nome — o
      // comportamento que fabrica duplicata na base.
      Alert.alert(
        r.ja_inscrito ? t("Já estava na turma") : t("Registrado"),
        r.ja_inscrito
          ? t("Marcamos a presença — essa pessoa já estava matriculada aqui.")
          : r.pessoa_nova === false
            ? t("Pronto. Ligamos ao cadastro que já existia dessa pessoa.")
            : t("Pronto. A pessoa entrou na turma e a presença foi marcada.")
      );
    } catch (e) {
      const campo = (e as { corpo?: { campo?: string } })?.corpo?.campo;
      Alert.alert(
        campo ? t("Confira o campo") : t("Não foi possível registrar"),
        (e as Error)?.message || t("Erro.")
      );
    } finally {
      setSalvandoWalk(false);
    }
  }

  // ═══ DIRECIONAMENTO ═══
  async function abrirDirecionar(m: NextMatricula) {
    setDirAlvo(m); setDirDestinos([]); setDirAreas([]); setDirHorario(null);
    if (opcoes) return; // catálogo já em mão; não repete a ida
    try {
      setOpcoes(await getNextDirecionarOpcoes());
    } catch {
      // ⚠️ Falha aqui NÃO fecha a folha: grupo e servir seguem possíveis. O que
      // fica bloqueado é o batismo, e a régua diz isso ao lado do botão.
      setOpcoes({ batismo: { data_batismo: null, horarios: [], indisponivel: true }, areas: [], areas_indisponivel: true });
    }
  }

  function alternar<T>(lista: T[], v: T): T[] {
    return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
  }

  const vereditoDir = podeDirecionar({
    destinos: dirDestinos,
    horarioBatismo: dirHorario,
    batismoIndisponivel: !!opcoes?.batismo?.indisponivel,
  });

  async function salvarDirecionar() {
    if (!dirAlvo || !vereditoDir.pode) return;
    setSalvandoDir(true);
    try {
      await direcionarNextMatricula(dirAlvo.id, {
        destinos: dirDestinos,
        areas: dirAreas.length ? dirAreas : undefined,
        horario_batismo: dirDestinos.includes("batismo") ? dirHorario : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      trackEvento("next_direcionou", { entity_id: turmaId, label: dirDestinos.join("+") });
      setDirAlvo(null);
      await carregar(true);
      Alert.alert(t("Direcionado"), t("A equipe de cada área recebe o encaminhamento."));
    } catch (e) {
      // ⚠️ `direcionarMatricula` LANÇA regra de negócio com código (horário
      // ausente = 400 · lotado = 409). Propagar a mensagem dela é o que faz a
      // tela pedir o horário em vez de dizer "erro".
      Alert.alert(t("Não foi possível direcionar"), (e as Error)?.message || t("Erro."));
    } finally {
      setSalvandoDir(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{nome}</Text>
        <View style={{ width: 26 }} />
      </View>

      {data === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
        >
          {erro && !turma ? (
            <View style={[styles.center, { paddingTop: spacing.xl }]}>
              <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
              <Text style={styles.muted}>{erro}</Text>
            </View>
          ) : (
            <>
              {/* resumo */}
              <View style={styles.card}>
                <View style={styles.resumoRow}>
                  <View>
                    <Text style={styles.resumoNum}>{matriculas.length}</Text>
                    <Text style={styles.pequeno}>{matriculas.length === 1 ? t("inscrito") : t("inscritos")}</Text>
                  </View>
                  <View>
                    <Text style={styles.resumoNum}>{encontros.length}</Text>
                    <Text style={styles.pequeno}>{encontros.length === 1 ? t("encontro") : t("encontros")}</Text>
                  </View>
                  <View>
                    <Text style={[styles.resumoNum, { color: colors.success }]}>{matriculas.filter((m) => m.status === "formado").length}</Text>
                    <Text style={styles.pequeno}>{t("formados")}</Text>
                  </View>
                </View>
                {!!turma?.observacoes && <Text style={[styles.linhaTxt, { marginTop: spacing.sm }]}>{turma.observacoes}</Text>}
              </View>

              {/* legenda dos encontros */}
              <Text style={styles.secLabel}>{t("Presença por encontro")}</Text>
              <View style={styles.card}>
                <Text style={styles.pequeno}>
                  {t("Toque em cada encontro pra marcar a presença do inscrito. Quem for presente em todos os encontros vira 'Formado'.")}
                </Text>
              </View>

              {/* ⚠️ WALK-IN · a política do totem: "nunca travar o atendimento
                  na hora". Só o nome é obrigatório; o resto ajuda o cadastro. */}
              {podeEscrever ? (
                <Pressable style={styles.btnPrimario} onPress={abrirWalkIn} accessibilityRole="button" accessibilityLabel={t("Registrar quem chegou agora")}>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={styles.btnPrimarioTxt}>{t("Chegou agora")}</Text>
                </Pressable>
              ) : escreve === false ? (
                <View style={styles.aviso}>
                  <Ionicons name="eye-outline" size={18} color={colors.warning} />
                  <Text style={styles.avisoTxt}>{t("Seu acesso ao NEXT é só de leitura.")}</Text>
                </View>
              ) : null}

              {/* inscritos */}
              <Text style={styles.secLabel}>{t("Inscritos")} ({matriculas.length})</Text>
              {matriculas.length === 0 ? (
                <View style={styles.card}><Text style={styles.muted}>{t("Ninguém matriculado nesta turma ainda.")}</Text></View>
              ) : (
                matriculas.map((m) => {
                  const wa = waLink(m.telefone);
                  const sLabel = m.status ? (STATUS_LABEL[m.status] || m.status) : null;
                  const formado = m.status === "formado";
                  return (
                    <View key={m.id} style={styles.card}>
                      <View style={styles.membroHead}>
                        <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{iniciais(nomeCompleto(m))}</Text></View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.nomeRow}>
                            <Text style={styles.nome} numberOfLines={1}>{nomeCompleto(m)}</Text>
                            {sLabel && (
                              <View style={[styles.statusBadge, formado ? { backgroundColor: colors.success } : null]}>
                                <Text style={[styles.statusTxt, formado ? { color: "#fff" } : null]}>{t(sLabel)}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {wa ? (
                          <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${nomeCompleto(m)}`}>
                            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                          </Pressable>
                        ) : null}
                      </View>

                      {/* toggles de presença por encontro */}
                      <View style={styles.encRow}>
                        {encontros.map((enc) => {
                          const chave = `${enc.id}:${m.id}`;
                          const presente = presMap.get(chave) === true;
                          const proc = processando === chave;
                          return (
                            <Pressable
                              key={enc.id}
                              style={[styles.encChip, presente ? styles.encChipOn : null]}
                              disabled={!!processando}
                              onPress={() => togglePresenca(enc, m)}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: presente }}
                              accessibilityLabel={`${rotuloEncontro(enc, t)} · ${nomeCompleto(m)}`}
                            >
                              {proc ? (
                                <ActivityIndicator size="small" color={presente ? "#fff" : colors.primary} />
                              ) : (
                                <Ionicons
                                  name={presente ? "checkmark-circle" : "ellipse-outline"}
                                  size={16}
                                  color={presente ? "#fff" : colors.textMuted}
                                />
                              )}
                              <Text style={[styles.encChipTxt, presente ? { color: "#fff" } : null]} numberOfLines={1}>
                                {rotuloEncontro(enc, t)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* ⚠️ DIRECIONAMENTO · o fim do encontro. Roda a MESMA
                          régua do totem; aqui só se escolhe o destino. */}
                      {podeEscrever ? (
                        <Pressable
                          style={styles.btnGhost}
                          onPress={() => { void abrirDirecionar(m); }}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("Direcionar")} ${nomeCompleto(m)}`}
                        >
                          <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primary} />
                          <Text style={styles.btnGhostTxt}>{t("Direcionar")}</Text>
                          {/* Mostra o que já foi indicado no sistema — o
                              direcionamento é ADITIVO e idempotente. */}
                          {m.indicou_batismo || m.indicou_servir || m.indicou_grupo ? (
                            <Text style={styles.pequeno}>
                              {"· "}
                              {[
                                m.indicou_batismo ? t("batismo") : null,
                                m.indicou_servir ? t("servir") : null,
                                m.indicou_grupo ? t("grupo") : null,
                              ].filter(Boolean).join(", ")}
                            </Text>
                          ) : null}
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ═══ WALK-IN · quem chegou e não estava na lista ═══ */}
      <Modal visible={walkAberto} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setWalkAberto(false)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoSeguro }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Chegou agora")}</Text>
              <Pressable onPress={() => setWalkAberto(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.pequeno}>
              {t("Só o nome é obrigatório. O resto ajuda a equipe a achar essa pessoa depois.")}
            </Text>

            <Text style={styles.sheetLabel}>{t("Nome")} *</Text>
            <TextInput style={styles.input} value={wNome} onChangeText={setWNome} placeholder={t("Primeiro nome")} placeholderTextColor={colors.textMuted} autoCapitalize="words" />

            <Text style={styles.sheetLabel}>{t("Sobrenome")}</Text>
            <TextInput style={styles.input} value={wSobrenome} onChangeText={setWSobrenome} placeholder={t("Opcional")} placeholderTextColor={colors.textMuted} autoCapitalize="words" />

            <Text style={styles.sheetLabel}>{t("Celular")}</Text>
            <TextInput
              style={styles.input}
              value={wTelefone}
              onChangeText={(v) => setWTelefone(mascararTelefoneBR(soDigitos(v)))}
              placeholder="(21) 99999-8888"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={styles.sheetLabel}>{t("CPF")}</Text>
            <TextInput
              style={styles.input}
              value={wCpf}
              onChangeText={(v) => setWCpf(mascararCpf(v))}
              placeholder={t("Opcional — ajuda a não duplicar cadastro")}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />

            {encontros.length > 1 ? (
              <>
                <Text style={styles.sheetLabel}>{t("Marcar presença em")}</Text>
                <View style={styles.chipsRow}>
                  {encontros.map((e) => {
                    const on = wEncontroId === e.id;
                    return (
                      <Pressable
                        key={e.id}
                        style={[styles.chip, on ? styles.chipOn : null]}
                        onPress={() => setWEncontroId(on ? null : e.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                      >
                        <Text style={[styles.chipTxt, on ? styles.chipTxtOn : null]} numberOfLines={1}>{rotuloEncontro(e, t)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Pressable style={[styles.btnPrimario, { marginTop: spacing.md }]} disabled={salvandoWalk} onPress={() => { void salvarWalkIn(); }} accessibilityRole="button">
              {salvandoWalk ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimarioTxt}>{t("Registrar")}</Text>}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

      {/* ═══ DIRECIONAMENTO · o fim do encontro ═══ */}
      <Modal visible={!!dirAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setDirAlvo(null)}>
        <TecladoSeguro style={styles.modalWrap}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.sheet, { paddingBottom: fundoSeguro }]}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {dirAlvo ? nomeDaPessoa(dirAlvo) : t("Direcionar")}
                </Text>
                <Pressable onPress={() => setDirAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <Text style={styles.pequeno}>{t("Pra onde essa pessoa vai depois do NEXT?")}</Text>

              <View style={styles.chipsRow}>
                {DESTINOS_NEXT.map((d) => {
                  const on = dirDestinos.includes(d.chave);
                  return (
                    <Pressable
                      key={d.chave}
                      style={[styles.chip, on ? styles.chipOn : null]}
                      onPress={() => setDirDestinos((atual) => alternar(atual, d.chave))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={t(d.rotulo)}
                    >
                      <Ionicons name={d.icone as never} size={16} color={on ? "#fff" : colors.textMuted} />
                      <Text style={[styles.chipTxt, on ? styles.chipTxtOn : null]}>{t(d.rotulo)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* ⚠️⚠️ Horário do batismo é OBRIGATÓRIO — a régua do servidor
                  lança 400 sem ele. Aqui a mesma condição desabilita o botão. */}
              {dirDestinos.includes("batismo") ? (
                <>
                  <Text style={styles.sheetLabel}>
                    {t("Horário do batismo")}
                    {opcoes?.batismo?.data_batismo
                      ? ` · ${String(opcoes.batismo.data_batismo).slice(8, 10)}/${String(opcoes.batismo.data_batismo).slice(5, 7)}`
                      : ""}
                  </Text>
                  {opcoes === null ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (opcoes.batismo?.horarios || []).length === 0 ? (
                    <Text style={styles.motivo}>
                      {opcoes.batismo?.indisponivel
                        ? t("Os horários do batismo não carregaram.")
                        : t("Nenhum horário aberto no próximo batismo.")}
                    </Text>
                  ) : (
                    <View style={styles.chipsRow}>
                      {opcoes.batismo.horarios.map((h) => {
                        const on = dirHorario === h.horario;
                        return (
                          <Pressable
                            key={h.horario}
                            style={[styles.chip, on ? styles.chipOn : null]}
                            onPress={() => setDirHorario(on ? null : h.horario)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                          >
                            <Text style={[styles.chipTxt, on ? styles.chipTxtOn : null]}>{h.label || h.horario}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}

              {/* ⚠️ Área do servir é OPCIONAL (o servidor aceita sem) — exigir
                  aqui travaria o direcionamento por campo que ele não pede. */}
              {dirDestinos.includes("voluntarios") && (opcoes?.areas || []).length > 0 ? (
                <>
                  <Text style={styles.sheetLabel}>{t("Onde quer servir? (opcional)")}</Text>
                  <View style={styles.chipsRow}>
                    {(opcoes?.areas || []).map((a) => {
                      const on = dirAreas.includes(a.id);
                      return (
                        <Pressable
                          key={a.id}
                          style={[styles.chip, on ? styles.chipOn : null]}
                          onPress={() => setDirAreas((atual) => alternar(atual, a.id))}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                        >
                          <Text style={[styles.chipTxt, on ? styles.chipTxtOn : null]}>{a.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* ⚠️ Botão cinza sem explicação lê-se como app quebrado. */}
              {!vereditoDir.pode && vereditoDir.motivo ? (
                <Text style={[styles.motivo, { marginTop: spacing.sm }]}>{t(vereditoDir.motivo)}</Text>
              ) : null}

              <Pressable
                style={[styles.btnPrimario, { marginTop: spacing.md }, !vereditoDir.pode ? { opacity: 0.5 } : null]}
                disabled={!vereditoDir.pode || salvandoDir}
                onPress={() => { void salvarDirecionar(); }}
                accessibilityRole="button"
              >
                {salvandoDir ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimarioTxt}>{t("Direcionar")}</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </TecladoSeguro>
      </Modal>
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
    resumoRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xs },
    resumoNum: { color: c.text, fontSize: font.size.xl, fontWeight: "800" },
    linhaTxt: { color: c.textMuted, fontSize: font.size.sm },
    membroHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatarSm: { height: 38, width: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: c.primary + "1A" },
    avatarSmTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.sm },
    nomeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    nome: { color: c.text, fontSize: font.size.md, fontWeight: "800" },
    statusBadge: { backgroundColor: c.glass, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    statusTxt: { color: c.primary, fontSize: 11, fontWeight: "700" },
    encRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    encChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surfaceAlt },
    encChipOn: { backgroundColor: c.primary, borderColor: c.primary },
    encChipTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700", maxWidth: 140 },

    btnPrimario: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.primary, borderRadius: radius.full, paddingVertical: 13 },
    btnPrimarioTxt: { color: "#fff", fontSize: font.size.sm, fontWeight: "800" },
    btnGhost: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surfaceAlt, borderRadius: radius.full, paddingVertical: 10, paddingHorizontal: spacing.md, marginTop: spacing.xs },
    btnGhostTxt: { color: c.primary, fontSize: font.size.sm, fontWeight: "800" },
    aviso: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: c.warning + "1A", borderColor: c.warning, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
    avisoTxt: { flex: 1, color: c.text, fontSize: font.size.sm },

    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetTitle: { flex: 1, color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    sheetLabel: { color: c.textMuted, fontSize: font.size.sm - 1, marginBottom: 4, marginTop: spacing.xs },
    // Estilo PROPRIO de linha unica: o `card` desta tela e bloco, e um input
    // multiline de 70px x 4 campos nao caberia na folha.
    input: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 12, color: c.text, fontSize: font.size.md },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surfaceAlt, borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: spacing.md },
    chipOn: { backgroundColor: c.primary, borderColor: c.primary },
    chipTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    chipTxtOn: { color: "#fff" },
    motivo: { color: c.warning, fontSize: font.size.sm, fontWeight: "700" },
  });
}
