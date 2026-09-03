// ============================================================================
// GESTÃO DO NEXT · a superfície ÚNICA de quem gerencia (03/09/2026)
//
// Pedido do Marcos: *"agora dentro do next tem várias turmas, gostaria que para
// quem tem permissões, abrisse direto na página de gerenciamento, e pode fazer
// essa nova página, muito semelhante com a que temos de batismo em estilo."*
//
// ⚠️⚠️ Ela SUBSTITUI `/next-turma` e `/next-espera` (feitas horas antes, no mesmo
// dia). Duas portas pro mesmo lugar é o erro que o módulo de Grupos pagou — lá
// "grupos" no menu e "Grupos" na barra abriam telas diferentes, e a saída foi
// juntar em uma. As duas rotas antigas viraram redirect: link antigo e push já
// entregue continuam funcionando.
//
// ⚠️⚠️ QUEM AUTORIZA É O SERVIDOR (`backend/utils/nextGestaoApp.js`): entrar é
// módulo `next` >= 2 ∪ posse da turma, AGIR é escrita >= 2 ∪ posse. `escreve`
// vem na resposta e some com os botões — botão que devolve 403 é pior que botão
// ausente. Nada aqui reimplementa régua: direcionar roda a MESMA
// `direcionarMatricula` do totem, o walk-in passa pelo matcher canônico.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { hojeBRT } from "@/lib/dataBRT";
import { mascararTelefoneBR } from "@/lib/telefone";
import { mascararCpf } from "@/lib/cpf";
import { trackEvento } from "@/lib/telemetria";
import {
  DESTINOS_NEXT, contarPresentes, dataDaTurma, encontroSugerido, nomeDaPessoa,
  podeDirecionar, turmaSugerida, turmasQueRecebem, type DestinoNext,
} from "@/lib/nextGestao";
import {
  alocarNextMatricula, direcionarNextMatricula, getNextDirecionarOpcoes,
  getNextGestao, getNextListaEspera, getNextTurma, marcarPresencaNext, nextWalkIn,
  type NextDirecionarOpcoes, type NextGestao, type NextMatricula,
  type NextPessoaEspera, type NextTurmaDetalhe, type NextTurmaGestao,
} from "@/lib/api";

type Aba = "turma" | "aceitacoes";

function dataCurta(iso: string): { dia: string; mes: string; semana: string } {
  const d = new Date(`${iso}T12:00:00`);
  return {
    dia: d.toLocaleDateString("pt-BR", { day: "2-digit" }),
    mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    semana: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
  };
}

function dataLonga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function waLink(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let d = String(tel).replace(/[^0-9]/g, "");
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
}

/** Dígitos crus — a máscara TRUNCA no limite do BR. */
function soDigitos(v: string): string {
  return String(v || "").replace(/[^0-9]/g, "");
}

export function NextGestaoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  // ⚠️ PISO, não o inset cru: dentro de um <Modal> do Android o inset pode vir
  // 0 (a folha é outra janela) e o botão encosta na barra de navegação.
  const fundoSeguro = spacing.lg + Math.max(insets.bottom, spacing.lg);
  const t = useT();

  const [gestao, setGestao] = useState<NextGestao | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<NextTurmaDetalhe | null>(null);
  const [espera, setEspera] = useState<NextPessoaEspera[] | null>(null);
  const [aba, setAba] = useState<Aba>("turma");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [avisoEspera, setAvisoEspera] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);

  // walk-in
  const [walkAberto, setWalkAberto] = useState(false);
  const [wNome, setWNome] = useState("");
  const [wSobrenome, setWSobrenome] = useState("");
  const [wTelefone, setWTelefone] = useState("");
  const [wCpf, setWCpf] = useState("");
  const [salvandoWalk, setSalvandoWalk] = useState(false);

  // direcionamento
  const [dirAlvo, setDirAlvo] = useState<NextMatricula | null>(null);
  const [dirDestinos, setDirDestinos] = useState<DestinoNext[]>([]);
  const [dirAreas, setDirAreas] = useState<string[]>([]);
  const [dirHorario, setDirHorario] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<NextDirecionarOpcoes | null>(null);
  const [salvandoDir, setSalvandoDir] = useState(false);

  // alocar da fila
  const [alocarAlvo, setAlocarAlvo] = useState<NextPessoaEspera | null>(null);

  const carregarGestao = useCallback(async () => {
    setErro(null);
    try {
      const g = await getNextGestao();
      setGestao(g);
      // ⚠️ Só escolhe turma na PRIMEIRA carga: refrescar não pode arrastar a
      // pessoa pra outra turma no meio do trabalho dela.
      setTurmaId((atual) => atual ?? turmaSugerida(g.turmas, hojeBRT()));
    } catch (e) {
      setErro((e as Error)?.message || t("Não foi possível carregar a gestão do NEXT."));
    }
  }, [t]);

  const carregarDetalhe = useCallback(async (id: string) => {
    try {
      setDetalhe(await getNextTurma(id));
    } catch (e) {
      // ⚠️ Erro no detalhe NÃO derruba a tela: o trilho de turmas e a fila
      // continuam de pé, e a mensagem diz o que faltou.
      setDetalhe(null);
      setErro((e as Error)?.message || t("Não foi possível carregar esta turma."));
    }
  }, [t]);

  const carregarEspera = useCallback(async () => {
    setAvisoEspera(null);
    try {
      const r = await getNextListaEspera();
      setEspera(r.pessoas || []);
    } catch (e) {
      // ⚠️ Erro NÃO vira fila vazia — "ninguém esperando" e "não carregou"
      // levam a decisões opostas.
      setEspera(null);
      setAvisoEspera((e as Error)?.message || t("Não foi possível carregar a fila."));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void carregarGestao(); }, [carregarGestao]));
  // ⚠️⚠️ LIMPA O DETALHE ANTES DE BUSCAR O DA TURMA NOVA. Sem isso a lista da
  // turma ANTERIOR fica na tela sob o cabeçalho da nova — e não é só cosmético:
  // `encontroAtual` e `presMap` são derivados desse detalhe, então um toque em
  // "Presença" nessa janela marcaria presença no encontro da turma ERRADA. É a
  // versão em miniatura do bug de 12/07 no web (19 nomes lançados no culto
  // errado), que a régua "o culto vem do token" existe pra impedir.
  useEffect(() => {
    if (!turmaId) return;
    setDetalhe(null);
    void carregarDetalhe(turmaId);
  }, [turmaId, carregarDetalhe]);
  // ⚠️ A fila só é buscada quando a aba abre: ela carrega PII (telefone) e não
  // tem por que trafegar enquanto a pessoa está marcando presença.
  useEffect(() => { if (aba === "aceitacoes" && espera === null && !avisoEspera) void carregarEspera(); }, [aba, espera, avisoEspera, carregarEspera]);

  async function refrescar() {
    setRefrescando(true);
    try {
      await carregarGestao();
      if (turmaId) await carregarDetalhe(turmaId);
      if (aba === "aceitacoes") await carregarEspera();
    } finally { setRefrescando(false); }
  }

  const podeEscrever = gestao?.escreve === true;
  const turmas = gestao?.turmas || [];
  const turma = turmas.find((x) => x.id === turmaId) || null;
  const encontros = detalhe?.encontros || [];
  const matriculas = detalhe?.matriculas || [];
  const encontroAtual = encontroSugerido(encontros, hojeBRT());
  const presentes = contarPresentes(detalhe?.presencas, encontroAtual);
  const dataTurma = dataDaTurma(turma);
  const turmasAbertas = turmasQueRecebem(turmas) as NextTurmaGestao[];

  const presMap = useMemo(() => {
    const m = new Map<string, boolean>();
    (detalhe?.presencas || []).forEach((p) => m.set(`${p.encontro_id}:${p.matricula_id}`, !!p.presente));
    return m;
  }, [detalhe?.presencas]);

  const lista = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    const base: (NextMatricula | NextPessoaEspera)[] = aba === "turma" ? matriculas : (espera || []);
    if (!q) return base;
    return base.filter((p) =>
      `${nomeDaPessoa(p)} ${p.telefone || ""}`.toLocaleLowerCase("pt-BR").includes(q)
    );
  }, [aba, busca, matriculas, espera]);

  // ═══ presença ═══
  async function alternarPresenca(m: NextMatricula) {
    if (!encontroAtual || processando) return;
    // ⚠️ Rede de segurança: só marca presença de quem está NA turma carregada.
    // O efeito acima já limpa o detalhe ao trocar de turma; esta guarda é o que
    // impede qualquer caminho futuro de marcar no encontro errado.
    if (!matriculas.some((x) => x.id === m.id)) return;
    const chave = `${encontroAtual}:${m.id}`;
    const novo = presMap.get(chave) !== true;
    setProcessando(m.id);
    try {
      await marcarPresencaNext(encontroAtual, m.id, novo);
      Haptics.selectionAsync().catch(() => {});
      if (turmaId) await carregarDetalhe(turmaId);
    } catch (e) {
      Alert.alert(t("Não foi possível marcar presença"), (e as Error)?.message || t("Tente novamente."));
    } finally { setProcessando(null); }
  }

  // ═══ walk-in ═══
  function abrirWalkIn() {
    setWNome(""); setWSobrenome(""); setWTelefone(""); setWCpf("");
    setWalkAberto(true);
  }

  async function salvarWalkIn() {
    if (!turmaId) return;
    const nome = wNome.trim();
    if (nome.length < 2) {
      Alert.alert(t("Falta o nome"), t("Informe pelo menos o primeiro nome."));
      return;
    }
    setSalvandoWalk(true);
    try {
      const r = await nextWalkIn(turmaId, {
        nome,
        sobrenome: wSobrenome.trim() || null,
        telefone: soDigitos(wTelefone) || null,
        cpf: soDigitos(wCpf) || null,
        // ⚠️ Marca presença no encontro de HOJE (BRT). Sem isso o walk-in
        // entra na turma e a chamada do dia continua sem ele.
        encontro_id: encontroAtual,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      trackEvento("next_walkin", { entity_id: turmaId, label: r.ja_inscrito ? "ja_inscrito" : "nova" });
      setWalkAberto(false);
      await carregarDetalhe(turmaId);
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
      Alert.alert(campo ? t("Confira o campo") : t("Não foi possível registrar"), (e as Error)?.message || t("Erro."));
    } finally { setSalvandoWalk(false); }
  }

  // ═══ direcionamento ═══
  async function abrirDirecionar(m: NextMatricula) {
    setDirAlvo(m); setDirDestinos([]); setDirAreas([]); setDirHorario(null);
    if (opcoes) return;
    try {
      setOpcoes(await getNextDirecionarOpcoes());
    } catch {
      // ⚠️ Falha aqui NÃO fecha a folha: grupo e servir seguem possíveis. O que
      // fica bloqueado é o batismo, e a régua diz isso ao lado do botão.
      setOpcoes({ batismo: { data_batismo: null, horarios: [], indisponivel: true }, areas: [], areas_indisponivel: true });
    }
  }

  function alternar<T>(l: T[], v: T): T[] {
    return l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
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
      trackEvento("next_direcionou", { entity_id: turmaId || undefined, label: dirDestinos.join("+") });
      setDirAlvo(null);
      if (turmaId) await carregarDetalhe(turmaId);
      Alert.alert(t("Direcionado"), t("A equipe de cada área recebe o encaminhamento."));
    } catch (e) {
      // ⚠️ A régua do servidor LANÇA regra de negócio com código (horário
      // ausente = 400 · lotado = 409). Propagar a mensagem dela é o que faz a
      // tela pedir o horário em vez de dizer "erro".
      Alert.alert(t("Não foi possível direcionar"), (e as Error)?.message || t("Erro."));
    } finally { setSalvandoDir(false); }
  }

  // ═══ alocar da fila ═══
  async function alocar(p: NextPessoaEspera, alvo: NextTurmaGestao) {
    setProcessando(p.id);
    try {
      await alocarNextMatricula(p.id, alvo.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      trackEvento("next_alocou_da_fila", { entity_id: alvo.id });
      // Sai da fila na hora: o servidor confirmou.
      setEspera((atual) => (atual || []).filter((x) => x.id !== p.id));
      setGestao((g) => (g ? { ...g, espera: Math.max(0, g.espera - 1) } : g));
      setAlocarAlvo(null);
      if (alvo.id === turmaId) await carregarDetalhe(alvo.id);
      Alert.alert(t("Pronto"), `${nomeDaPessoa(p)} ${t("está na turma")} ${alvo.nome || ""}`.trim());
    } catch (e) {
      const codigo = (e as { corpo?: { codigo?: string } })?.corpo?.codigo;
      // ⚠️ `ja_tem_turma`/`corrida` NÃO é erro de app: é fato que mudou por fora
      // (alguém alocou no sistema). Tira da fila e diz o que aconteceu.
      if (codigo === "ja_tem_turma" || codigo === "corrida") {
        setEspera((atual) => (atual || []).filter((x) => x.id !== p.id));
        setAlocarAlvo(null);
        Alert.alert(t("Já estava resolvido"), (e as Error).message);
      } else {
        Alert.alert(t("Não foi possível colocar na turma"), (e as Error)?.message || t("Erro."));
      }
    } finally { setProcessando(null); }
  }

  if (!gestao && !erro) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (erro && !gestao) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={34} color={colors.textMuted} />
        <Text style={styles.centerTxt}>{erro}</Text>
        <Pressable style={styles.retry} onPress={() => { void carregarGestao(); }} accessibilityRole="button">
          <Ionicons name="refresh" size={17} color={colors.primary} />
          <Text style={styles.retryTxt}>{t("Tentar novamente")}</Text>
        </Pressable>
      </View>
    );
  }

  if (!gestao) return null;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t("Equipe do NEXT")}</Text>
              <Text style={styles.heroTitle}>{t("Cada pessoa até o próximo passo")}</Text>
            </View>
            <View style={styles.drop}><Ionicons name="sparkles" size={22} color="#fff" /></View>
          </View>
          {/* ⚠️ Turma sem encontro datado mostra o NOME dela, nunca uma data
              calculada: desde 26/08 a turma é um domingo, e inventar a data
              faria a equipe esperar no dia errado. */}
          <Text style={styles.heroDate}>
            {dataTurma ? dataLonga(dataTurma) : turma?.nome || t("Nenhuma turma aberta")}
          </Text>
          <View style={styles.stats}>
            <Stat valor={matriculas.length} label={t("inscritos")} styles={styles} />
            <View style={styles.statDiv} />
            <Stat valor={presentes} label={t("presentes")} styles={styles} />
            <View style={styles.statDiv} />
            <Stat valor={gestao.espera} label={t("esperando")} styles={styles} />
          </View>
        </View>

        {/* ⚠️ "Somente leitura" é DECLARADO: sem isso a pessoa toca em presença e
            leva 403 sem entender por quê. */}
        {gestao.escreve === false ? (
          <View style={styles.aviso}>
            <Ionicons name="eye-outline" size={18} color={colors.warning} />
            <Text style={styles.avisoTxt}>{t("Seu acesso ao NEXT é só de leitura.")}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>{t("Turma")}</Text>
            <Text style={styles.sectionHint}>{t("A turma do domingo mais próximo já vem selecionada")}</Text>
          </View>
          {podeEscrever && turmaId ? (
            <Pressable style={styles.addMini} onPress={abrirWalkIn} accessibilityRole="button" accessibilityLabel={t("Registrar quem chegou agora")}>
              <Ionicons name="person-add" size={17} color="#fff" />
              <Text style={styles.addMiniTxt}>{t("Chegou agora")}</Text>
            </Pressable>
          ) : null}
        </View>

        {turmas.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={38} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("Nenhuma turma aberta agora")}</Text>
            <Text style={styles.emptyTxt}>{t("As turmas do mês abrem por rotina automática.")}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRail}>
            {turmas.map((x) => {
              const iso = dataDaTurma(x);
              const d = iso ? dataCurta(iso) : null;
              const ativo = x.id === turmaId;
              const ehHoje = iso === hojeBRT();
              return (
                <Pressable
                  key={x.id}
                  onPress={() => { setTurmaId(x.id); setAba("turma"); setBusca(""); }}
                  style={[styles.dateCard, ativo && styles.dateCardActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  accessibilityLabel={`${x.nome || t("Turma")}${iso ? ` · ${dataLonga(iso)}` : ""}`}
                >
                  {d ? (
                    <>
                      <Text style={[styles.dateWeek, ativo && styles.dateTextActive]}>{d.semana}</Text>
                      <Text style={[styles.dateDay, ativo && styles.dateTextActive]}>{d.dia}</Text>
                      <Text style={[styles.dateMonth, ativo && styles.dateTextActive]}>{d.mes}</Text>
                    </>
                  ) : (
                    <Text style={[styles.dateSemData, ativo && styles.dateTextActive]} numberOfLines={2}>
                      {x.nome || t("Turma")}
                    </Text>
                  )}
                  {ehHoje ? <View style={[styles.todayDot, ativo && { backgroundColor: "#fff" }]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.tabs}>
          <Tab label={t("Pessoas da turma")} count={matriculas.length} active={aba === "turma"} onPress={() => { setAba("turma"); setBusca(""); }} styles={styles} />
          <Tab label={t("Aceitações")} count={gestao.espera} active={aba === "aceitacoes"} onPress={() => { setAba("aceitacoes"); setBusca(""); }} styles={styles} />
        </View>

        {aba === "aceitacoes" ? (
          <Text style={styles.sectionHint}>
            {t("Quem aceitou o convite no fim do encontro e ainda não tem turma.")}
          </Text>
        ) : null}

        {aba === "aceitacoes" && avisoEspera ? (
          <View style={styles.aviso}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.avisoTxt}>{avisoEspera}</Text>
          </View>
        ) : null}

        {/* ⚠️ Erro do detalhe aparece SEM esconder o resto da tela. */}
        {aba === "turma" && erro && turmaId ? (
          <View style={styles.aviso}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.avisoTxt}>{erro}</Text>
          </View>
        ) : null}

        {aba === "turma" && !encontroAtual && matriculas.length > 0 ? (
          <View style={styles.aviso}>
            <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.avisoTxt}>{t("Esta turma não tem encontro cadastrado — não dá pra marcar presença.")}</Text>
          </View>
        ) : null}

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder={t("Buscar por nome ou telefone")}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {busca ? (
            <Pressable onPress={() => setBusca("")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("Limpar busca")}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {aba === "turma" && detalhe === null && turmaId && !erro ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : aba === "aceitacoes" && espera === null && !avisoEspera ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : lista.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name={aba === "turma" ? "people-outline" : "checkmark-done-circle-outline"} size={38} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {busca
                ? t("Ninguém com esse nome")
                : aba === "turma" ? t("Ninguém matriculado nesta turma") : t("Ninguém esperando turma")}
            </Text>
            <Text style={styles.emptyTxt}>
              {busca
                ? t("Confira a busca ou limpe o campo.")
                : aba === "turma" ? t("Quem chegar sem estar na lista entra pelo \"Chegou agora\".") : t("Quem aceitar no fim do encontro aparece aqui.")}
            </Text>
          </View>
        ) : aba === "turma" ? (
          (lista as NextMatricula[]).map((m) => (
            <PessoaCard
              key={m.id}
              nome={nomeDaPessoa(m)}
              telefone={m.telefone}
              status={m.status}
              presente={!!encontroAtual && presMap.get(`${encontroAtual}:${m.id}`) === true}
              indicou={[
                m.indicou_batismo ? t("batismo") : null,
                m.indicou_servir ? t("servir") : null,
                m.indicou_grupo ? t("grupo") : null,
              ].filter(Boolean) as string[]}
              processando={processando === m.id}
              podeEscrever={podeEscrever && !!encontroAtual}
              acaoPrincipal={t("Presença")}
              onAcaoPrincipal={() => { void alternarPresenca(m); }}
              acaoSecundaria={podeEscrever ? t("Direcionar") : null}
              onAcaoSecundaria={() => { void abrirDirecionar(m); }}
              colors={colors}
              styles={styles}
            />
          ))
        ) : (
          (lista as NextPessoaEspera[]).map((p) => (
            <PessoaCard
              key={p.id}
              nome={nomeDaPessoa(p)}
              telefone={p.telefone}
              status={null}
              presente={false}
              indicou={[]}
              observacao={p.observacoes}
              processando={processando === p.id}
              podeEscrever={podeEscrever && turmasAbertas.length > 0}
              acaoPrincipal={t("Colocar em uma turma")}
              onAcaoPrincipal={() => setAlocarAlvo(p)}
              acaoSecundaria={null}
              onAcaoSecundaria={() => {}}
              colors={colors}
              styles={styles}
            />
          ))
        )}

        {aba === "aceitacoes" && podeEscrever && turmasAbertas.length === 0 && (espera || []).length > 0 ? (
          <View style={styles.aviso}>
            <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.avisoTxt}>{t("Nenhuma turma aberta agora — as turmas do mês abrem por rotina automática.")}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ═══ WALK-IN ═══ */}
      <Modal visible={walkAberto} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setWalkAberto(false)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoSeguro }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Chegou agora")}</Text>
              <Pressable onPress={() => setWalkAberto(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.sheetSub}>
              {t("Só o nome é obrigatório. O resto ajuda a equipe a achar essa pessoa depois.")}
            </Text>
            <Campo label={t("Nome")} obrigatorio value={wNome} onChange={setWNome} styles={styles} />
            <Campo label={t("Sobrenome")} value={wSobrenome} onChange={setWSobrenome} styles={styles} />
            <Campo
              label={t("Celular")}
              value={wTelefone}
              onChange={(v) => setWTelefone(mascararTelefoneBR(soDigitos(v)))}
              keyboard="phone-pad"
              styles={styles}
            />
            <Campo
              label={t("CPF")}
              hint={t("ajuda a não duplicar cadastro")}
              value={wCpf}
              onChange={(v) => setWCpf(mascararCpf(v))}
              keyboard="number-pad"
              styles={styles}
            />
            <Pressable style={[styles.saveBtn, { marginTop: spacing.md }]} disabled={salvandoWalk} onPress={() => { void salvarWalkIn(); }} accessibilityRole="button">
              {salvandoWalk ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>{t("Registrar e marcar presença")}</Text>}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

      {/* ═══ DIRECIONAMENTO ═══ */}
      <Modal visible={!!dirAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setDirAlvo(null)}>
        <TecladoSeguro style={styles.modalWrap}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.sheet, { paddingBottom: fundoSeguro }]}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle} numberOfLines={1}>{dirAlvo ? nomeDaPessoa(dirAlvo) : t("Direcionar")}</Text>
                <Pressable onPress={() => setDirAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <Text style={styles.sheetSub}>{t("Pra onde essa pessoa vai depois do NEXT?")}</Text>

              <View style={styles.chipsRow}>
                {DESTINOS_NEXT.map((d) => {
                  const on = dirDestinos.includes(d.chave);
                  return (
                    <Pressable
                      key={d.chave}
                      style={[styles.option, on && styles.optionActive]}
                      onPress={() => setDirDestinos((a) => alternar(a, d.chave))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Ionicons name={d.icone as never} size={16} color={on ? "#fff" : colors.textMuted} />
                      <Text style={[styles.optionTxt, on && styles.optionTxtActive]}>{t(d.rotulo)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* ⚠️⚠️ Horário do batismo é OBRIGATÓRIO — a régua do servidor lança
                  400 sem ele. Aqui a mesma condição desabilita o botão. */}
              {dirDestinos.includes("batismo") ? (
                <>
                  <Text style={styles.fieldLabel}>
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
                            style={[styles.option, on && styles.optionActive]}
                            onPress={() => setDirHorario(on ? null : h.horario)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                          >
                            <Text style={[styles.optionTxt, on && styles.optionTxtActive]}>{h.label || h.horario}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}

              {/* ⚠️ Área do servir é OPCIONAL (o servidor aceita sem). */}
              {dirDestinos.includes("voluntarios") && (opcoes?.areas || []).length > 0 ? (
                <>
                  <Text style={styles.fieldLabel}>{t("Onde quer servir? (opcional)")}</Text>
                  <View style={styles.chipsRow}>
                    {(opcoes?.areas || []).map((a) => {
                      const on = dirAreas.includes(a.id);
                      return (
                        <Pressable
                          key={a.id}
                          style={[styles.option, on && styles.optionActive]}
                          onPress={() => setDirAreas((x) => alternar(x, a.id))}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                        >
                          <Text style={[styles.optionTxt, on && styles.optionTxtActive]}>{a.label}</Text>
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
                style={[styles.saveBtn, { marginTop: spacing.md }, !vereditoDir.pode && { opacity: 0.5 }]}
                disabled={!vereditoDir.pode || salvandoDir}
                onPress={() => { void salvarDirecionar(); }}
                accessibilityRole="button"
              >
                {salvandoDir ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>{t("Direcionar")}</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </TecladoSeguro>
      </Modal>

      {/* ═══ ESCOLHER A TURMA DE QUEM ESTÁ NA FILA ═══ */}
      <Modal visible={!!alocarAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAlocarAlvo(null)}>
        <Pressable style={styles.modalWrap} onPress={() => setAlocarAlvo(null)} accessible={false}>
          <Pressable style={[styles.sheet, { paddingBottom: fundoSeguro }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {alocarAlvo ? nomeDaPessoa(alocarAlvo) : t("Colocar em uma turma")}
              </Text>
              <Pressable onPress={() => setAlocarAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.sheetSub}>{t("Em qual turma?")}</Text>
            {turmasAbertas.map((x) => {
              const iso = dataDaTurma(x);
              return (
                <Pressable
                  key={x.id}
                  style={styles.turmaOpcao}
                  disabled={!!processando}
                  onPress={() => { if (alocarAlvo) void alocar(alocarAlvo, x); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("Colocar em")} ${x.nome || ""}`}
                >
                  <Ionicons name="people-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.turmaOpcaoTxt} numberOfLines={1}>{x.nome || t("Turma")}</Text>
                    {iso ? <Text style={styles.sectionHint}>{dataLonga(iso)}</Text> : null}
                  </View>
                  {processando ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Stat({ valor, label, styles }: { valor: number; label: string; styles: ReturnType<typeof makeStyles> }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{valor}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Tab({ label, count, active, onPress, styles }: {
  label: string; count: number; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Text style={[styles.tabTxt, active && styles.tabTxtActive]} numberOfLines={1}>{label}</Text>
      <View style={[styles.tabCount, active && styles.tabCountActive]}>
        <Text style={[styles.tabCountTxt, active && styles.tabCountTxtActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function PessoaCard({
  nome, telefone, status, presente, indicou, observacao, processando, podeEscrever,
  acaoPrincipal, onAcaoPrincipal, acaoSecundaria, onAcaoSecundaria, colors, styles,
}: {
  nome: string;
  telefone: string | null | undefined;
  status: string | null;
  presente: boolean;
  indicou: string[];
  observacao?: string | null;
  processando: boolean;
  podeEscrever: boolean;
  acaoPrincipal: string;
  onAcaoPrincipal: () => void;
  acaoSecundaria: string | null;
  onAcaoSecundaria: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const wa = waLink(telefone);
  return (
    <View style={[styles.personCard, presente && styles.personChecked]}>
      <View style={styles.personTop}>
        <View style={[styles.avatar, presente && styles.avatarChecked]}>
          {presente ? <Ionicons name="checkmark" size={21} color="#fff" /> : <Text style={styles.avatarTxt}>{iniciais(nome)}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.personName} numberOfLines={1}>{nome}</Text>
          <View style={styles.metaRow}>
            {status ? <Text style={styles.meta}>{t(status)}</Text> : null}
            {telefone ? <Text style={styles.meta} numberOfLines={1}>{telefone}</Text> : null}
            {indicou.length ? <Text style={styles.meta} numberOfLines={1}>{indicou.join(", ")}</Text> : null}
          </View>
          {observacao ? <Text style={styles.meta} numberOfLines={2}>{observacao}</Text> : null}
        </View>
        {wa ? (
          <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${nome}`}>
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          </Pressable>
        ) : null}
      </View>

      {podeEscrever ? (
        <View style={styles.acoesRow}>
          <Pressable
            style={[styles.acaoBtn, presente && styles.acaoBtnOn]}
            disabled={processando}
            onPress={onAcaoPrincipal}
            accessibilityRole="button"
            accessibilityLabel={`${acaoPrincipal} ${nome}`}
          >
            {processando ? (
              <ActivityIndicator size="small" color={presente ? "#fff" : colors.primary} />
            ) : (
              <Ionicons
                name={presente ? "checkmark-circle" : "ellipse-outline"}
                size={17}
                color={presente ? "#fff" : colors.primary}
              />
            )}
            <Text style={[styles.acaoBtnTxt, presente && styles.acaoBtnTxtOn]}>{acaoPrincipal}</Text>
          </Pressable>
          {acaoSecundaria ? (
            <Pressable style={styles.acaoBtnGhost} onPress={onAcaoSecundaria} accessibilityRole="button" accessibilityLabel={`${acaoSecundaria} ${nome}`}>
              <Ionicons name="arrow-forward-circle-outline" size={17} color={colors.textMuted} />
              <Text style={styles.acaoBtnGhostTxt}>{acaoSecundaria}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Campo({ label, hint, obrigatorio, value, onChange, keyboard, styles }: {
  label: string; hint?: string; obrigatorio?: boolean; value: string; onChange: (v: string) => void;
  keyboard?: "default" | "phone-pad" | "number-pad"; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.fieldLabel}>
        {label}{obrigatorio ? " *" : null}
        {hint ? <Text style={styles.fieldHint}> · {hint}</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard || "default"}
        autoCapitalize={keyboard ? "none" : "words"}
        style={styles.field}
        placeholderTextColor={styles.fieldHint.color as string}
      />
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
    centerTxt: { color: c.textMuted, textAlign: "center", fontSize: font.size.md },
    retry: { flexDirection: "row", gap: 7, alignItems: "center", borderWidth: 1, borderColor: c.primary, borderRadius: radius.full, paddingHorizontal: 15, paddingVertical: 9 },
    retryTxt: { color: c.primary, fontWeight: "700" },
    content: { padding: spacing.lg, paddingBottom: 130, gap: spacing.md },

    hero: { backgroundColor: c.primary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, overflow: "hidden" },
    heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
    eyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
    heroTitle: { color: "#fff", fontFamily: BRAND_FONT, fontSize: font.size.xl, marginTop: 3 },
    drop: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
    heroDate: { color: "#fff", fontSize: font.size.sm, fontWeight: "700", textTransform: "capitalize" },
    stats: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.12)", borderRadius: radius.md, paddingVertical: spacing.sm },
    stat: { flex: 1, alignItems: "center" },
    statValue: { color: "#fff", fontFamily: BRAND_FONT, fontSize: 24 },
    statLabel: { color: "rgba(255,255,255,0.76)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 },
    statDiv: { width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.22)" },

    aviso: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: c.warning + "1A", borderColor: c.warning, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
    avisoTxt: { flex: 1, color: c.text, fontSize: font.size.sm },

    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    sectionLabel: { color: c.text, fontSize: font.size.md, fontWeight: "800" },
    sectionHint: { color: c.textMuted, fontSize: font.size.sm - 1, marginTop: 2 },
    addMini: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.primary, borderRadius: radius.full, paddingHorizontal: 13, paddingVertical: 9 },
    addMiniTxt: { color: "#fff", fontWeight: "800", fontSize: font.size.sm },

    dateRail: { gap: spacing.sm, paddingVertical: 2 },
    dateCard: { width: 62, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface, alignItems: "center", gap: 1 },
    dateCardActive: { backgroundColor: c.primary, borderColor: c.primary },
    dateWeek: { color: c.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 },
    dateDay: { color: c.text, fontFamily: BRAND_FONT, fontSize: 20 },
    dateMonth: { color: c.textMuted, fontSize: 10, textTransform: "uppercase" },
    dateSemData: { color: c.text, fontSize: 11, fontWeight: "700", textAlign: "center", paddingHorizontal: 4 },
    dateTextActive: { color: "#fff" },
    todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.primary, marginTop: 3 },

    tabs: { flexDirection: "row", gap: spacing.sm },
    tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: radius.full, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabTxt: { color: c.text, fontWeight: "700", fontSize: font.size.sm },
    tabTxtActive: { color: "#fff" },
    tabCount: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full, backgroundColor: c.surfaceAlt, alignItems: "center" },
    tabCountActive: { backgroundColor: "rgba(255,255,255,0.24)" },
    tabCountTxt: { color: c.textMuted, fontSize: 11, fontWeight: "800" },
    tabCountTxtActive: { color: "#fff" },

    search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
    searchInput: { flex: 1, color: c.text, fontSize: font.size.md, paddingVertical: 9 },

    empty: { alignItems: "center", gap: 7, paddingVertical: spacing.xl },
    emptyTitle: { color: c.text, fontWeight: "800", fontSize: font.size.md, textAlign: "center" },
    emptyTxt: { color: c.textMuted, fontSize: font.size.sm, textAlign: "center" },

    personCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md, gap: spacing.sm },
    personChecked: { borderColor: c.success },
    personTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatar: { height: 40, width: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: c.primary + "1A" },
    avatarChecked: { backgroundColor: c.success },
    avatarTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.sm },
    personName: { color: c.text, fontSize: font.size.md, fontWeight: "800" },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 2 },
    meta: { color: c.textMuted, fontSize: font.size.sm - 1 },

    acoesRow: { flexDirection: "row", gap: spacing.sm },
    acaoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: c.primary, borderRadius: radius.full, paddingVertical: 10 },
    acaoBtnOn: { backgroundColor: c.success, borderColor: c.success },
    acaoBtnTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.sm },
    acaoBtnTxtOn: { color: "#fff" },
    acaoBtnGhost: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surfaceAlt, borderRadius: radius.full, paddingVertical: 10, paddingHorizontal: spacing.md },
    acaoBtnGhostTxt: { color: c.textMuted, fontWeight: "700", fontSize: font.size.sm },

    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    sheetTitle: { flex: 1, color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    sheetSub: { color: c.textMuted, fontSize: font.size.sm },
    fieldLabel: { color: c.textMuted, fontSize: font.size.sm - 1, marginTop: spacing.xs },
    fieldHint: { color: c.textMuted, fontSize: font.size.sm - 2 },
    field: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 12, color: c.text, fontSize: font.size.md },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    option: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surfaceAlt, borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: spacing.md },
    optionActive: { backgroundColor: c.primary, borderColor: c.primary },
    optionTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    optionTxtActive: { color: "#fff" },
    motivo: { color: c.warning, fontSize: font.size.sm, fontWeight: "700" },
    saveBtn: { backgroundColor: c.primary, borderRadius: radius.full, paddingVertical: 13, alignItems: "center" },
    saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: font.size.md },
    turmaOpcao: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: spacing.md },
    turmaOpcaoTxt: { color: c.text, fontSize: font.size.md, fontWeight: "700" },
  });
}
