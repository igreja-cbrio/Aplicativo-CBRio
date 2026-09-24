// ============================================================================
// MONTAR ESCALA · por TIME, em duas etapas, num carrossel (23/09/2026)
//
// ⚠️⚠️ O redesenho pedido pelo Marcos em vídeo (03/09/2026), comparando com o
// Planning Center Services. Os pedidos dele, na ordem em que ele falou:
//   1. a aba Servir em si NÃO muda (ele recusou reordenar a hierarquia dela);
//   2. escolher o culto em DUAS ETAPAS — o TIPO ("Domingo - Manhã") e depois a
//      DATA. Só os nossos cultos (`vol_services`), não os do Services;
//   3. CARROSSEL HORIZONTAL de equipes ("sempre mostrando que existe uma nova
//      equipe aqui") — a tela antiga "descia muito";
//   4. agrupar por TIME, não por cargo ("hoje tá vendo adultos, baixistas");
//   5. a aba ORDEM DE CULTO (fica pra um PR próprio · leitura da Produção);
//   6. NÃO criar as abas TIMES, NOTES e FILES.
// Mais o que eu levantei e ele aprovou: a VAGA visível ("faltam 2", como o
// "2 Needed" do Services) e manter o arrastar pra trocar de equipe — que o
// Services não tem.
//
// ⚠️⚠️ A régua mora em `lib/escalaTimes.ts` (pura, no portão, com mutantes):
// a que time cada linha pertence, quantas vagas faltam, o que soltar o nome em
// cima de um time significa. Esta tela só DESENHA o que ela devolve.
//
// ⚠️ O dado do TIME sempre esteve no servidor: `GET /escala/:serviceId` manda
// `composicao` (equipe × posição × quantidade) desde 25/08 e `team_id` em cada
// linha. A tela lia um campo `equipes` que nunca existiu na resposta.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Modal, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from "react-native-reanimated";
import { useColors } from "@/contexts/ThemeContext";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { Linking } from "react-native";
import {
  getEscalaServicos, getEscala, buscarEscalaPool, adicionarNaEscala, removerDaEscala, moverNaEscala,
  getVoluntarioDetalhe,
  type EscalaServico, type EscalaItem, type ComposicaoItem, type PoolVoluntario, type VoluntarioDetalhe,
} from "@/lib/api";
import {
  agruparCultosPorTipo, cultoInicial, montarTimes, resumoDoCulto, destinoDoArraste, xParaCentralizar,
  semanaDoCulto, ehDomingo, filtrarPool, dividirPorVaga,
  SEM_EQUIPE, SEM_FUNCAO, SEM_TIPO, type Time, type PosicaoDoTime,
} from "@/lib/escalaTimes";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useT } from "@/lib/i18n";
import { fundoDaFolha } from "@/lib/folha";
import { useDialogo } from "@/components/ui/Dialogo";

function waLink(tel: string | null): string | null {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
}

const DIA_MS = 86400000;
// ⚠️ Recebe o tradutor por PARÂMETRO: `useT()` é hook e não pode ser chamado
// aqui dentro. A alternativa (mover a formatação pra dentro do componente)
// violaria a lei da casa — régua vive fora do .tsx, não dentro dele.
function fmtData(iso: string | null, t: (s: string) => string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  // scheduled_at vem em UTC · converte pra horário de Brasília (UTC-3, sem DST).
  const brt = new Date(d.getTime() - 3 * 3600 * 1000);
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map(t);
  const dd = String(brt.getUTCDate()).padStart(2, "0");
  const mm = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(brt.getUTCHours()).padStart(2, "0");
  const mi = String(brt.getUTCMinutes()).padStart(2, "0");
  // Rótulo relativo (Hoje/Amanhã) pra escolher o culto certo rápido.
  const hojeBrt = new Date(Date.now() - 3 * 3600 * 1000);
  const diaAlvo = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate());
  const diaHoje = Date.UTC(hojeBrt.getUTCFullYear(), hojeBrt.getUTCMonth(), hojeBrt.getUTCDate());
  const delta = Math.round((diaAlvo - diaHoje) / DIA_MS);
  const rel = delta === 0 ? t("Hoje") : delta === 1 ? t("Amanhã") : `${dias[brt.getUTCDay()]} ${dd}/${mm}`;
  return `${rel} ${hh}:${mi}`;
}
function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Onde o dedo está durante o arraste: um TIME (chip de cima) ou uma POSIÇÃO da página aberta. */
type AlvoArraste = { tipo: "time"; chave: string } | { tipo: "posicao"; time: string; chave: string };
const mesmoAlvo = (a: AlvoArraste | null, b: AlvoArraste | null) =>
  a === b || (!!a && !!b && a.tipo === b.tipo && a.chave === b.chave && (a.tipo === "time" || (b.tipo === "posicao" && a.time === b.time)));

export default function EscalaSupervisorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: larguraTela } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const dlg = useDialogo();

  const [servicos, setServicos] = useState<EscalaServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Etapa 1 (tipo) → etapa 2 (data) → o culto.
  const [tipoSel, setTipoSel] = useState<string | null>(null);
  const [servicoSel, setServicoSel] = useState<EscalaServico | null>(null);
  const [escala, setEscala] = useState<EscalaItem[]>([]);
  const [composicao, setComposicao] = useState<ComposicaoItem[]>([]);
  const [ocultos, setOcultos] = useState(0);
  // LEITOR (24/09): todas as concessões desta pessoa são só de leitura. A tela
  // esconde o que escreve (adicionar, remover, arrastar, check-in); a trava de
  // verdade é o servidor (403 `somente_leitura`).
  const [somenteLeitura, setSomenteLeitura] = useState(false);
  // Lista do TIME no "Adicionar" (24/09): vem do servidor já ordenada pela
  // preferência de semana; a digitação filtra localmente. `null` = sem time
  // (busca geral, como antes). `foraDoTime` troca pra busca geral.
  const [poolTime, setPoolTime] = useState<PoolVoluntario[] | null>(null);
  const [poolCarregando, setPoolCarregando] = useState(false);
  const [poolErro, setPoolErro] = useState(false);
  const [foraDoTime, setForaDoTime] = useState(false);
  const [carregandoEscala, setCarregandoEscala] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  // O carrossel: qual time está na tela.
  const [timeIdx, setTimeIdx] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  // Modal de adicionar
  const [addOpen, setAddOpen] = useState(false);
  const [addTime, setAddTime] = useState<string>("");     // chave do time
  const [addPosicao, setAddPosicao] = useState<string>(""); // nome da função (chip)
  const [outraFuncao, setOutraFuncao] = useState("");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<PoolVoluntario[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscaErro, setBuscaErro] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscaSeq = useRef(0);

  // ── Drag & drop: apertar e arrastar o nome pra outro time (chips de cima)
  //    ou pra outra função (cabeçalhos da página aberta) ──
  const barraRef = useRef<View>(null);
  const barraScrollRef = useRef<ScrollView>(null);
  const barraJanela = useRef<{ x: number; y: number; h: number }>({ x: 0, y: 0, h: 0 });
  const barraScrollX = useRef(0);
  const chipLayout = useRef<Record<string, { x: number; w: number }>>({});
  const paginaRef = useRef<View>(null);
  const paginaTop = useRef(0);
  const paginaScrollY = useRef<Record<string, number>>({});
  const posLayout = useRef<Record<string, Record<string, { y: number; h: number }>>>({});
  const dragItemRef = useRef<EscalaItem | null>(null);
  const hoverRef = useRef<AlvoArraste | null>(null);
  const timeAbertoRef = useRef<string | null>(null);
  const [dragItem, setDragItem] = useState<EscalaItem | null>(null);
  const [hover, setHover] = useState<AlvoArraste | null>(null);
  // Ficha do voluntário
  const [detalhe, setDetalhe] = useState<VoluntarioDetalhe | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ghostX.value - 120 }, { translateY: ghostY.value - 22 }] }));

  // ── A árvore: tipos → cultos · times → posições → pessoas ──
  const grupos = useMemo(() => agruparCultosPorTipo(servicos), [servicos]);
  const cultosDoTipo = useMemo(() => grupos.find(g => g.tipo === tipoSel)?.cultos ?? [], [grupos, tipoSel]);
  const times = useMemo(() => montarTimes(composicao, escala), [composicao, escala]);
  const resumo = useMemo(() => resumoDoCulto(times), [times]);
  const timeAberto: Time | undefined = times[Math.min(timeIdx, Math.max(0, times.length - 1))];
  timeAbertoRef.current = timeAberto?.chave ?? null;

  function alvoNoPonto(absX: number, absY: number): AlvoArraste | null {
    const b = barraJanela.current;
    if (b.h > 0 && absY >= b.y && absY <= b.y + b.h) {
      const contentX = absX - b.x + barraScrollX.current;
      for (const [chave, z] of Object.entries(chipLayout.current)) {
        if (contentX >= z.x && contentX <= z.x + z.w) return { tipo: "time", chave };
      }
      return null;
    }
    const tc = timeAbertoRef.current;
    if (!tc) return null;
    const contentY = absY - paginaTop.current + (paginaScrollY.current[tc] || 0);
    for (const [chave, z] of Object.entries(posLayout.current[tc] || {})) {
      if (contentY >= z.y && contentY <= z.y + z.h) return { tipo: "posicao", time: tc, chave };
    }
    return null;
  }
  function iniciarDrag(item: EscalaItem, ax: number, ay: number) {
    dragItemRef.current = item; setDragItem(item);
    ghostX.value = ax; ghostY.value = ay;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    barraRef.current?.measureInWindow?.((x: number, y: number, _w: number, h: number) => { barraJanela.current = { x, y, h }; });
    paginaRef.current?.measureInWindow?.((_x: number, y: number) => { paginaTop.current = y; });
  }
  function atualizarHover(absX: number, absY: number) {
    const a = alvoNoPonto(absX, absY);
    if (!mesmoAlvo(a, hoverRef.current)) { hoverRef.current = a; setHover(a); }
  }
  async function soltarDrag() {
    const item = dragItemRef.current; const alvo = hoverRef.current;
    dragItemRef.current = null; hoverRef.current = null;
    setDragItem(null); setHover(null);
    if (!item || !alvo || !servicoSel) return;

    let patch: { team_name: string; position_name?: string | null; team_id: string | null; position_id: string | null } | null = null;
    if (alvo.tipo === "time") {
      const destino = destinoDoArraste(item, times, alvo.chave);
      const time = times.find(x => x.chave === alvo.chave);
      if (!destino || !time) return;
      // Trocar de time zera a função: "Vocal" não existe na Integração.
      patch = { team_name: destino.team_name, position_name: null, team_id: time.team_id, position_id: null };
    } else {
      const time = times.find(x => x.chave === alvo.time);
      const pos = time?.posicoes.find(p => p.chave === alvo.chave);
      if (!time || !pos || time.chave.startsWith("n:")) return;
      const jaAli = pos.pessoas.some(p => p.id === item.id);
      if (jaAli) return;
      patch = { team_name: time.nome, position_name: pos.nome, team_id: time.team_id, position_id: pos.position_id };
    }
    const { team_id, position_id, ...corpo } = patch;
    setEscala(prev => prev.map(e => e.id === item.id ? { ...e, ...corpo, team_id, position_id } : e));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try { await moverNaEscala(item.id, corpo.team_name, corpo.position_name); }
    catch (e: any) { Alert.alert(t("Erro"), e?.message || t("Erro ao mover")); carregarEscala(servicoSel.id); }
  }

  const carregarEscala = useCallback(async (serviceId: string) => {
    setCarregandoEscala(true);
    try {
      const resposta = await getEscala(serviceId);
      setEscala(resposta.escalas || []);
      setComposicao(resposta.composicao || []);
      setOcultos(resposta.ocultos || 0);
      if (typeof resposta.somente_leitura === "boolean") setSomenteLeitura(resposta.somente_leitura);
    }
    catch (e: any) { Alert.alert(t("Erro"), e?.message || t("Erro ao carregar a escala")); }
    finally { setCarregandoEscala(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selecionar(s: EscalaServico) {
    setServicoSel(s);
    setTimeIdx(0);
    pagerRef.current?.scrollTo({ x: 0, animated: false });
    carregarEscala(s.id);
  }
  function escolherTipo(tipo: string) {
    setTipoSel(tipo);
    const c = cultoInicial(grupos, tipo);
    if (c) selecionar(c);
  }

  const carregarServicos = useCallback(async (autoSel = false) => {
    try {
      const r = await getEscalaServicos();
      const lista = r.servicos || [];
      setServicos(lista);
      if (typeof r.somente_leitura === "boolean") setSomenteLeitura(r.somente_leitura);
      setErro(null);
      if (autoSel && lista.length && !servicoSel) {
        // Abre no tipo do culto MAIS PRÓXIMO, já com a data dele escolhida.
        const g = agruparCultosPorTipo(lista);
        const c = cultoInicial(g, null);
        if (c) { setTipoSel(g[0].tipo); selecionar(c); }
      }
    } catch (e: any) {
      setErro(e?.message || t("Erro ao carregar cultos"));
    } finally { setCarregando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⚠️ Recarrega ao FOCAR: escala é montada/alterada no web (Voluntariado), e a
  // pessoa volta pra esta tela esperando a versão de lá.
  useFocusEffect(useCallback(() => { carregarServicos(true); }, [carregarServicos]));

  // Se o culto escolhido sumiu da janela (passou), volta pro mais próximo do tipo.
  useEffect(() => {
    if (!servicoSel || !servicos.length) return;
    if (servicos.some(s => s.id === servicoSel.id)) return;
    const c = cultoInicial(grupos, tipoSel) ?? cultoInicial(grupos, null);
    if (c) { setTipoSel((c.service_type_name || "").trim() || SEM_TIPO); selecionar(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicos]);

  async function refrescar() {
    if (!servicoSel) return;
    setRefrescando(true);
    try {
      const resposta = await getEscala(servicoSel.id);
      setEscala(resposta.escalas || []);
      setComposicao(resposta.composicao || []);
      setOcultos(resposta.ocultos || 0);
      if (typeof resposta.somente_leitura === "boolean") setSomenteLeitura(resposta.somente_leitura);
      await carregarServicos();
    }
    catch { /* silencioso no pull */ }
    finally { setRefrescando(false); }
  }

  // ⚠️ A barra ACOMPANHA o carrossel (pedido do Marcos, 23/09): "se eu estou em
  // Cuidados, as opções ali em cima não podem estar mostrando Pastores". O chip
  // do time aberto vai pro centro da barra a cada troca de página — deslizando
  // ou tocando. A conta é pura (`xParaCentralizar`), o efeito só rola.
  useEffect(() => {
    const chave = times[timeIdx]?.chave;
    const z = chave ? chipLayout.current[chave] : undefined;
    if (!z) return;
    const x = xParaCentralizar(z.x, z.w, larguraTela);
    barraScrollRef.current?.scrollTo({ x, animated: true });
    barraScrollX.current = x;
  }, [timeIdx, times, larguraTela]);

  function irParaTime(idx: number) {
    setTimeIdx(idx);
    pagerRef.current?.scrollTo({ x: idx * larguraTela, animated: true });
  }
  function aoParar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, larguraTela));
    if (idx !== timeIdx) setTimeIdx(Math.max(0, Math.min(times.length - 1, idx)));
  }

  /** ⚠️ A ÚNICA porta que traduz as sentinelas — e só pra MOSTRAR. */
  const rotuloTime = (nome: string) => (nome === SEM_EQUIPE ? t("Sem equipe") : nome);
  const rotuloTipo = (tipo: string) => (tipo === SEM_TIPO ? t("Culto") : tipo);

  // Já escalados NO TIME destino (permite a mesma pessoa em outro time).
  const timeDoAdd = times.find(x => x.chave === addTime);
  const jaNoTime = useMemo(() => {
    const set = new Set<string>();
    for (const p of timeDoAdd?.posicoes ?? []) for (const e of p.pessoas) if (e.volunteer_id) set.add(e.volunteer_id);
    return set;
  }, [timeDoAdd]);
  // No TIME: lista do servidor (ordem = preferência) filtrada pelo que foi digitado.
  // Fora do time (ou time sem id): a busca geral de sempre.
  const noTime = !foraDoTime && !!timeDoAdd?.team_id && poolTime !== null;
  const listaAdd = noTime ? filtrarPool(poolTime ?? [], busca) : resultados;
  // A VAGA em foco (chip de função escolhido, sem texto livre): separa "quem é
  // dessa função" do "resto do time". Pedido do Marcos (24/09): "estou escalando
  // um saxofonista — primeiro os saxofonistas, abaixo outras pessoas do time".
  const posicaoDoAdd = addPosicao && !outraFuncao.trim() ? (timeDoAdd?.posicoes ?? []).find(p => p.nome === addPosicao) : undefined;
  const vagaEmFoco = noTime && addPosicao && !outraFuncao.trim() ? { id: posicaoDoAdd?.position_id ?? null, nome: addPosicao } : null;
  const secoesAdd = dividirPorVaga(listaAdd, vagaEmFoco);
  const semanaCulto = semanaDoCulto(servicoSel?.scheduled_at ?? null);
  const cultoDeDomingo = ehDomingo(servicoSel?.scheduled_at ?? null);
  const rotuloPreferencia = (v: PoolVoluntario) => {
    if (!v.rodizio_semana) return null;
    if (v.prefere_este_culto) return cultoDeDomingo ? t("prefere este domingo") : t("prefere esta semana do mês");
    return (cultoDeDomingo ? t("prefere o {n}º domingo") : t("prefere a {n}ª semana do mês")).replace("{n}", String(v.rodizio_semana));
  };

  async function carregarPoolDoTime(teamId: string | null | undefined) {
    setPoolTime(null); setPoolErro(false);
    if (!teamId || !servicoSel) return;
    setPoolCarregando(true);
    try { setPoolTime(await buscarEscalaPool("", { service_id: servicoSel.id, team_id: teamId })); }
    catch { setPoolTime([]); setPoolErro(true); }
    finally { setPoolCarregando(false); }
  }
  function alternarForaDoTime() {
    setForaDoTime(v => !v);
    setBusca(""); setResultados([]); setBuscaErro(false);
  }

  // Busca com debounce (300ms) + guarda de sequência (ignora resposta obsoleta).
  function onBusca(q: string) {
    setBusca(q);
    setBuscaErro(false);
    if (noTime) { setBuscando(false); return; }   // no time o filtro é local — nada de servidor
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    if (q.trim().length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    const seq = ++buscaSeq.current;
    buscaTimer.current = setTimeout(async () => {
      try {
        const r = await buscarEscalaPool(q.trim());
        if (seq === buscaSeq.current) { setResultados(r); setBuscaErro(false); }
      } catch {
        if (seq === buscaSeq.current) { setResultados([]); setBuscaErro(true); }
      } finally {
        if (seq === buscaSeq.current) setBuscando(false);
      }
    }, 300);
  }

  /** Abre o "Adicionar" já no time (e na função) de onde a pessoa tocou — a vaga. */
  function abrirAdd(time?: Time, posicao?: PosicaoDoTime) {
    if (somenteLeitura) return;
    const alvo = time ?? timeAberto ?? null;
    setAddTime(alvo?.chave ?? "");
    setAddPosicao(posicao?.nome ?? "");
    setOutraFuncao(""); setBusca(""); setResultados([]); setBuscaErro(false);
    setForaDoTime(false);
    setAddOpen(true);
    void carregarPoolDoTime(alvo?.team_id);
  }

  async function adicionar(vol: PoolVoluntario) {
    if (!servicoSel) return;
    const time = timeDoAdd;
    const funcao = outraFuncao.trim() || addPosicao;
    setSalvandoId(vol.id);
    try {
      const novo = await adicionarNaEscala({
        service_id: servicoSel.id, volunteer_id: vol.id,
        team_name: time && time.nome !== SEM_EQUIPE ? time.nome : undefined,
        position_name: funcao || undefined,
      });
      // Otimista: usa a resposta, sem refetch bloqueante. O servidor ainda não
      // devolve `team_id`/`position_id` — a régua resolve pelo NOME.
      setEscala(prev => [...prev, { ...novo, team_id: novo.team_id ?? time?.team_id ?? null }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setBusca(""); setResultados([]);
    } catch (e: any) {
      Alert.alert(t("Erro"), e?.message || t("Erro ao escalar"));
    } finally { setSalvandoId(null); }
  }

  async function abrirDetalhe(volId: string | null) {
    if (!volId) { Alert.alert(t("Ficha indisponível"), t("Esse voluntário ainda não tem cadastro vinculado no sistema.")); return; }
    setDetalheOpen(true); setDetalhe(null); setCarregandoDetalhe(true);
    try { setDetalhe(await getVoluntarioDetalhe(volId)); }
    catch (e: any) { Alert.alert(t("Erro"), e?.message || t("Erro ao carregar a ficha")); setDetalheOpen(false); }
    finally { setCarregandoDetalhe(false); }
  }

  // ⚠️ Diálogo da CASA, não `Alert.alert` (23/09): o Marcos viu a caixa cinza
  // do Android ao lado da folha bonita de Recusar. Seguro aqui porque NÃO há
  // <Modal> aberto quando dispara — o diálogo é irmão da tela.
  async function remover(item: EscalaItem) {
    const ok = await dlg.confirmar({
      titulo: t("Remover da escala"),
      mensagem: `${t("Tirar")} ${item.volunteer_name} ${t("da escala?")}`,
      acao: t("Remover"),
      perigo: true,
    });
    if (!ok) return;
    setRemovendoId(item.id);
    try { await removerDaEscala(item.id); setEscala(prev => prev.filter(e => e.id !== item.id)); }
    catch (e: any) { void dlg.avisar(t("Erro"), e?.message || t("Erro ao remover")); }
    finally { setRemovendoId(null); }
  }

  const statusInfo = (s: string | null) =>
    // ⚠️ `"confirmed"`/`"declined"` são ENUM DO BANCO e ficam CRUS. Traduzir a
    // comparação faria o resumo contar 0 confirmados. Só o rótulo é traduzível.
    s === "confirmed" ? { cor: colors.success, label: t("confirmado") }
    : s === "declined" ? { cor: colors.danger, label: t("recusou") }
    : { cor: colors.textMuted, label: t("pendente") };

  const rotuloVaga = (n: number) => `${n} ${n === 1 ? t("vaga em aberto") : t("vagas em aberto")}`;

  // ── Uma linha do "Adicionar" (usada pelas duas seções e pela busca geral) ──
  function renderCandidato(v: PoolVoluntario) {
    const escalado = v.id ? jaNoTime.has(v.id) : false;
    const pref = rotuloPreferencia(v);
    return (
      <Pressable key={v.id} style={styles.resultado} disabled={!!salvandoId || escalado} onPress={() => adicionar(v)} accessibilityRole="button" accessibilityLabel={`${t("Adicionar")} ${v.full_name}`}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
          <Text style={[styles.avatarTxt, { color: colors.primary }]}>{iniciais(v.full_name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pessoaNome} numberOfLines={1}>{v.full_name}</Text>
          {pref && <Text style={[styles.pequeno, { color: v.prefere_este_culto ? colors.success : colors.textMuted }]} numberOfLines={1}>{pref}</Text>}
        </View>
        {salvandoId === v.id ? <ActivityIndicator color={colors.primary} />
          : escalado ? <Text style={[styles.pequeno, { color: colors.textMuted }]}>{t("nesta equipe")}</Text>
          : <Ionicons name="add-circle" size={24} color={colors.primary} />}
      </Pressable>
    );
  }

  // ── Uma linha de pessoa (com o arraste) ──
  function renderPessoa(item: EscalaItem) {
    const si = statusInfo(item.confirmation_status);
    const pan = Gesture.Pan().enabled(!somenteLeitura).activateAfterLongPress(250)
      .onStart(e => { runOnJS(iniciarDrag)(item, e.absoluteX, e.absoluteY); })
      .onUpdate(e => { ghostX.value = e.absoluteX; ghostY.value = e.absoluteY; runOnJS(atualizarHover)(e.absoluteX, e.absoluteY); })
      .onFinalize(() => { runOnJS(soltarDrag)(); });
    const detalheTxt = item.confirmation_status === "declined" && item.recusa_motivo ? ` · ${item.recusa_motivo}` : "";
    return (
      <GestureDetector key={item.id} gesture={pan}>
        <View style={[styles.pessoa, dragItem?.id === item.id && { opacity: 0.35 }]}>
          {!somenteLeitura && <Ionicons name="reorder-three" size={18} color={colors.textMuted} />}
          <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }} onPress={() => abrirDetalhe(item.volunteer_id)} accessibilityRole="button" accessibilityLabel={`${t("Ver ficha de")} ${item.volunteer_name}`}>
            {item.foto_url ? (
              <Image source={{ uri: item.foto_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.avatar, { backgroundColor: si.cor + "22" }]}>
                <Text style={[styles.avatarTxt, { color: si.cor }]}>{iniciais(item.volunteer_name)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.pessoaNome} numberOfLines={1}>{item.volunteer_name}</Text>
              <Text style={[styles.pequeno, { color: si.cor }]} numberOfLines={1}>{si.label}{detalheTxt}</Text>
            </View>
          </Pressable>
          {removendoId === item.id ? <ActivityIndicator color={colors.textMuted} />
            : somenteLeitura ? null : <Pressable onPress={() => remover(item)} hitSlop={14} accessibilityRole="button" accessibilityLabel={`${t("Remover")} ${item.volunteer_name} ${t("da escala")}`}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>}
        </View>
      </GestureDetector>
    );
  }

  // ── Uma página do carrossel: o TIME, com posições → pessoas → vaga ──
  function renderTime(time: Time, idx: number) {
    const podeEscrever = !somenteLeitura && (!time.chave.startsWith("n:") || time.nome === SEM_EQUIPE);
    return (
      <View key={time.chave} style={{ width: larguraTela }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 110, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          onScroll={e => { paginaScrollY.current[time.chave] = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          scrollEnabled={!dragItem}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
        >
          <View style={styles.teamCard}>
            <View style={styles.teamHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                {!!time.area && <Text style={styles.teamArea} numberOfLines={1}>{time.area.toUpperCase()}</Text>}
                <Text style={styles.teamNome} numberOfLines={1}>{rotuloTime(time.nome)}</Text>
              </View>
              <Text style={styles.paginaTxt}>{idx + 1}/{times.length}</Text>
            </View>
            <View style={styles.contadores}>
              <View style={styles.contador}><Ionicons name="checkmark-circle" size={15} color={colors.success} /><Text style={[styles.contadorTxt, { color: colors.success }]}>{time.confirmados}</Text></View>
              <View style={styles.contador}><Ionicons name="close-circle" size={15} color={colors.danger} /><Text style={[styles.contadorTxt, { color: colors.danger }]}>{time.recusados}</Text></View>
              <View style={styles.contador}><Ionicons name="help-circle" size={15} color={colors.warning} /><Text style={[styles.contadorTxt, { color: colors.warning }]}>{time.pendentes}</Text></View>
              <View style={{ flex: 1 }} />
              {time.alvo > 0 && (
                time.faltam > 0
                  ? <View style={[styles.faltamBadge, { backgroundColor: colors.danger + "1F" }]}><Text style={[styles.faltamTxt, { color: colors.danger }]}>{t("faltam")} {time.faltam}</Text></View>
                  : <View style={[styles.faltamBadge, { backgroundColor: colors.success + "1F" }]}><Text style={[styles.faltamTxt, { color: colors.success }]}>{t("completa")}</Text></View>
              )}
            </View>

            {time.posicoes.length === 0 && (
              <Text style={[styles.muted, { padding: spacing.md }]}>{t("Ninguém escalado ainda. Toque em “Adicionar” pra começar.")}</Text>
            )}

            {time.posicoes.map(pos => {
              const alvoDrop = !!dragItem && hover?.tipo === "posicao" && hover.chave === pos.chave && hover.time === time.chave;
              const semFuncao = pos.chave === SEM_FUNCAO;
              if (semFuncao && pos.pessoas.length === 0) return null;
              return (
                <View key={pos.chave}
                  onLayout={e => {
                    const m = posLayout.current[time.chave] || (posLayout.current[time.chave] = {});
                    m[pos.chave] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height };
                  }}
                  style={[styles.posBloco, alvoDrop && { backgroundColor: colors.primary + "12" }]}>
                  <View style={styles.posHead}>
                    <Text style={[styles.posNome, alvoDrop && { color: colors.primary }]} numberOfLines={1}>
                      {semFuncao ? t("Sem função") : (pos.nome || t("Equipe toda"))}
                    </Text>
                    {pos.alvo > 0 && (
                      <Text style={[styles.posContagem, pos.faltam > 0 && { color: colors.danger }]}>{pos.preenchidas}/{pos.alvo}</Text>
                    )}
                  </View>
                  {pos.pessoas.map(renderPessoa)}
                  {pos.faltam > 0 && podeEscrever && (
                    <Pressable style={styles.vaga} onPress={() => abrirAdd(time, pos)} accessibilityRole="button" accessibilityLabel={`${rotuloVaga(pos.faltam)}, ${pos.nome || rotuloTime(time.nome)}`}>
                      <Ionicons name="add" size={16} color={colors.danger} />
                      <Text style={[styles.pequeno, { color: colors.danger, flex: 1 }]}>{rotuloVaga(pos.faltam)}</Text>
                      <Text style={[styles.pequeno, { color: colors.textMuted }]}>{t("preencher")}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            {podeEscrever && (
              <Pressable onPress={() => abrirAdd(time)} style={styles.addInline} accessibilityRole="button">
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={[styles.pequeno, { color: colors.primary }]}>{t("Adicionar a")} {rotuloTime(time.nome)}</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("Montar escala")}</Text>
        <View style={{ width: 26 }} />
      </View>

      {carregando ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : erro ? (
        <View style={styles.center}>
          <Text style={[styles.muted, { marginBottom: 12 }]}>{erro}</Text>
          <Pressable style={styles.retry} onPress={() => { setCarregando(true); carregarServicos(true); }} accessibilityRole="button">
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.pequeno, { color: colors.primary }]}>{t("Tentar de novo")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Etapa 1 · o TIPO de culto */}
          <View style={styles.seletor}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}>
              {grupos.length === 0 && <Text style={styles.muted}>{t("Nenhum culto próximo.")}</Text>}
              {grupos.map(g => {
                const ativo = tipoSel === g.tipo;
                return (
                  <Pressable key={g.tipo} onPress={() => escolherTipo(g.tipo)} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                    accessibilityLabel={`${t("Tipo de culto")} ${rotuloTipo(g.tipo)}`}
                    style={[styles.tipoChip, ativo && { borderColor: colors.primary, backgroundColor: colors.primary }]}>
                    <Text style={[styles.tipoChipTxt, ativo && { color: "#fff" }]} numberOfLines={1}>{rotuloTipo(g.tipo)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          {/* Etapa 2 · a DATA dentro do tipo */}
          {cultosDoTipo.length > 0 && (
            <View style={[styles.seletor, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}>
                {cultosDoTipo.map(s => {
                  const ativo = servicoSel?.id === s.id;
                  return (
                    <Pressable key={s.id} onPress={() => selecionar(s)} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                      accessibilityLabel={`${fmtData(s.scheduled_at, t)}, ${s.escalados || 0} ${t("escalados")}`}
                      style={[styles.dataChip, ativo && { borderColor: colors.primary, backgroundColor: colors.primary + "14" }]}>
                      <Text style={[styles.dataChipTxt, ativo && { color: colors.primary }]}>{fmtData(s.scheduled_at, t)}</Text>
                      <Text style={styles.dataChipSub}>{s.escalados || 0} {t("esc.")}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {!servicoSel ? (
            <View style={styles.center}><Text style={styles.muted}>{t("Escolha um culto acima pra montar a escala.")}</Text></View>
          ) : carregandoEscala && !refrescando ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Resumo do culto */}
              <View style={styles.resumo}>
                <Text style={styles.resumoTxt}>{resumo.total} {t("escalados")}</Text>
                <Text style={[styles.resumoTxt, { color: colors.success }]}>{resumo.confirmados} {t("confirmados")}</Text>
                {resumo.recusados > 0 && <Text style={[styles.resumoTxt, { color: colors.danger }]}>{resumo.recusados} {t("recusaram")}</Text>}
                {resumo.faltam > 0 && <Text style={[styles.resumoTxt, { color: colors.danger, fontWeight: "800" }]}>{t("faltam")} {resumo.faltam}</Text>}
                {ocultos > 0 && <Text style={styles.resumoTxt}>{ocultos} {t("de outras áreas")}</Text>}
              </View>
              {somenteLeitura && (
                <View style={styles.leituraBanner}>
                  <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.pequeno, { color: colors.textMuted, flex: 1 }]}>{t("Você acompanha esta escala como leitor, sem alterar.")}</Text>
                </View>
              )}

              {times.length === 0 ? (
                <View style={styles.center}><Text style={styles.muted}>{t("Nenhuma equipe neste culto ainda.")}</Text></View>
              ) : (
                <>
                  {/* Os TIMES · navegação do carrossel E alvo do arraste */}
                  <View ref={barraRef} style={[styles.barraTimes, !!dragItem && { backgroundColor: colors.primary + "0C" }]}>
                    <ScrollView ref={barraScrollRef} horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}
                      onScroll={e => { barraScrollX.current = e.nativeEvent.contentOffset.x; }} scrollEventThrottle={16}
                      scrollEnabled={!dragItem}>
                      {times.map((tm, i) => {
                        const ativo = i === timeIdx;
                        const alvoDrop = !!dragItem && hover?.tipo === "time" && hover.chave === tm.chave;
                        return (
                          <Pressable key={tm.chave} onPress={() => irParaTime(i)} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                            accessibilityLabel={`${t("Equipe")} ${rotuloTime(tm.nome)}${tm.faltam > 0 ? `, ${t("faltam")} ${tm.faltam}` : ""}`}
                            onLayout={e => { chipLayout.current[tm.chave] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width }; }}
                            style={[styles.timeChip, ativo && { borderColor: colors.primary, backgroundColor: colors.primary + "14" }, alvoDrop && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primary + "2A" }]}>
                            <Text style={[styles.timeChipTxt, (ativo || alvoDrop) && { color: colors.primary }]} numberOfLines={1}>{rotuloTime(tm.nome)}</Text>
                            {tm.faltam > 0
                              ? <View style={[styles.timeChipBadge, { backgroundColor: colors.danger }]}><Text style={styles.timeChipBadgeTxt}>{tm.faltam}</Text></View>
                              : <Text style={[styles.pequeno, { color: colors.textMuted }]}>{tm.total}</Text>}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                  <Text style={[styles.pequeno, styles.dica]} numberOfLines={1}>
                    {dragItem ? t("Solte em uma equipe ou função.") : t("Deslize pra ver as equipes. Segure um nome pra mover.")}
                  </Text>

                  {/* O carrossel */}
                  <View ref={paginaRef} style={{ flex: 1 }}>
                    <ScrollView ref={pagerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={aoParar} scrollEnabled={!dragItem} keyboardShouldPersistTaps="handled">
                      {times.map(renderTime)}
                    </ScrollView>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Fantasma que segue o dedo durante o arraste */}
          {dragItem && (
            <Animated.View pointerEvents="none" style={[styles.ghost, ghostStyle]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarTxt, { color: "#fff" }]}>{iniciais(dragItem.volunteer_name)}</Text>
              </View>
              <Text style={styles.ghostTxt} numberOfLines={1}>{dragItem.volunteer_name}</Text>
            </Animated.View>
          )}

          {servicoSel && !carregandoEscala && !dragItem && !somenteLeitura && (
            <Pressable style={styles.fab} onPress={() => abrirAdd(timeAberto)} accessibilityRole="button" accessibilityLabel={t("Adicionar voluntário")}>
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.fabTxt}>{t("Adicionar")}</Text>
            </Pressable>
          )}
        </>
      )}

      {/* Ficha do voluntário */}
      <Modal visible={detalheOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setDetalheOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoDaFolha(insets.bottom), maxHeight: "85%" }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Ficha do voluntário")}</Text>
              <Pressable onPress={() => setDetalheOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>
            {carregandoDetalhe || !detalhe ? (
              <View style={{ paddingVertical: 30 }}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <ScrollView
                automaticallyAdjustKeyboardInsets
                keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md }}>
                  <View style={[styles.avatar, { height: 48, width: 48, borderRadius: 24, backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.avatarTxt, { color: colors.primary, fontSize: font.size.md }]}>{iniciais(detalhe.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pessoaNome, { fontSize: font.size.md, fontWeight: "800" }]}>{detalhe.full_name}</Text>
                    {detalhe.equipes.length > 0 && <Text style={styles.muted} numberOfLines={2}>{detalhe.equipes.join(" · ")}</Text>}
                  </View>
                </View>

                {waLink(detalhe.telefone) ? (
                  <Pressable style={styles.waBtn} onPress={() => Linking.openURL(waLink(detalhe.telefone)!)} accessibilityRole="button">
                    <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                    <Text style={styles.waTxt}>{t("WhatsApp")} · {detalhe.telefone}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{t("Sem telefone cadastrado.")}</Text>
                )}

                <Text style={[styles.section, { fontSize: font.size.sm }]}>{t("Escalas")} ({detalhe.total_escalas})</Text>
                {detalhe.escalas.length === 0 ? <Text style={styles.muted}>{t("Nenhuma escala.")}</Text> : detalhe.escalas.map((e, i) => (
                  <View key={i} style={styles.histRow}>
                    <Text style={styles.histCulto} numberOfLines={1}>{e.culto || t("Culto")}{e.equipe ? ` · ${e.equipe}` : ""}</Text>
                    <Text style={styles.histData}>{fmtData(e.data, t)}</Text>
                  </View>
                ))}

                <Text style={[styles.section, { fontSize: font.size.sm, marginTop: spacing.md }]}>{t("Check-ins")} ({detalhe.total_checkins})</Text>
                {detalhe.checkins.length === 0 ? <Text style={styles.muted}>{t("Nenhum check-in registrado.")}</Text> : detalhe.checkins.map((c, i) => (
                  <View key={i} style={styles.histRow}>
                    <Text style={styles.histCulto} numberOfLines={1}>{c.culto || t("Culto")}</Text>
                    <Text style={styles.histData}>{fmtData(c.data, t)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de adicionar · já vem no TIME (e na FUNÇÃO) da vaga tocada */}
      <Modal visible={addOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAddOpen(false)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoDaFolha(insets.bottom) }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Adicionar voluntário")}</Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>

            <Text style={styles.sheetLabel}>{t("Equipe")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {times.filter(tm => !tm.chave.startsWith("n:") || tm.nome === SEM_EQUIPE).map(tm => {
                const ativo = addTime === tm.chave;
                return (
                  <Pressable key={tm.chave} onPress={() => { setAddTime(tm.chave); setAddPosicao(""); setForaDoTime(false); void carregarPoolDoTime(tm.team_id); }} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                    style={[styles.teamPick, ativo && { borderColor: colors.primary, backgroundColor: colors.primary + "18" }]}>
                    <Text style={[styles.pequeno, { color: ativo ? colors.primary : colors.text }]}>{rotuloTime(tm.nome)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.sheetLabel, { marginTop: 6 }]}>{t("Função")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {(timeDoAdd?.posicoes ?? []).filter(p => p.nome).map(p => {
                const ativo = !outraFuncao.trim() && addPosicao === p.nome;
                return (
                  <Pressable key={p.chave} onPress={() => { setAddPosicao(ativo ? "" : (p.nome || "")); setOutraFuncao(""); }} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                    style={[styles.teamPick, ativo && { borderColor: colors.primary, backgroundColor: colors.primary + "18" }, p.faltam > 0 && !ativo && { borderColor: colors.danger + "88" }]}>
                    <Text style={[styles.pequeno, { color: ativo ? colors.primary : colors.text }]}>
                      {p.nome}{p.faltam > 0 ? ` · ${t("faltam")} ${p.faltam}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
              {(timeDoAdd?.posicoes ?? []).filter(p => p.nome).length === 0 && (
                <Text style={styles.muted}>{t("Sem funções definidas nesta equipe.")}</Text>
              )}
            </ScrollView>
            <TextInput style={[styles.input, { marginTop: 6 }]} placeholder={t("…ou outra função (opcional)")} placeholderTextColor={colors.textMuted}
              value={outraFuncao} onChangeText={setOutraFuncao} />

            {/* Lista do TIME (24/09): o servidor manda quem prefere a semana deste
                culto primeiro. Preferência ORDENA, nunca filtra — todo mundo do
                time continua aqui. "Buscar fora do time" volta pra busca geral. */}
            {!!timeDoAdd?.team_id && (
              <View style={styles.poolTopo}>
                <Text style={[styles.pequeno, { color: colors.textMuted, flex: 1 }]}>
                  {!noTime
                    ? t("Buscando fora do time")
                    : poolErro
                      ? t("Não deu pra carregar o time. Busque pelo nome.")
                      : semanaCulto && cultoDeDomingo
                        ? t("Pessoas do time · quem prefere o {n}º domingo vem primeiro").replace("{n}", String(semanaCulto))
                        : t("Pessoas do time")}
                </Text>
                <Pressable onPress={alternarForaDoTime} hitSlop={8} accessibilityRole="button">
                  <Text style={[styles.pequeno, { color: colors.primary, fontWeight: "700" }]}>{noTime ? t("Buscar fora do time") : t("Voltar ao time")}</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder={noTime ? t("Filtrar pelo nome…") : t("Buscar voluntário pelo nome…")} placeholderTextColor={colors.textMuted}
                value={busca} onChangeText={onBusca} autoFocus autoCorrect={false} />
              {buscando && <ActivityIndicator color={colors.primary} />}
            </View>

            <ScrollView
              automaticallyAdjustKeyboardInsets
              style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {noTime && poolCarregando ? (
                <View style={{ padding: spacing.md, alignItems: "center" }}><ActivityIndicator color={colors.primary} /></View>
              ) : !noTime && busca.trim().length < 2 ? (
                <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>{t("Digite ao menos 2 letras do nome.")}</Text>
              ) : buscaErro ? (
                <Pressable style={{ padding: spacing.md, alignItems: "center" }} onPress={() => onBusca(busca)}>
                  <Text style={[styles.muted, { textAlign: "center" }]}>{t("Falha ao buscar. Toque pra tentar de novo.")}</Text>
                </Pressable>
              ) : (!buscando && listaAdd.length === 0) ? (
                <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>{noTime ? t("Ninguém do time com esse nome.") : t("Nenhum voluntário encontrado.")}</Text>
              ) : vagaEmFoco ? (
                <>
                  <Text style={styles.secaoAdd}>
                    {secoesAdd.daVaga.length
                      ? `${vagaEmFoco.nome} · ${secoesAdd.daVaga.length}`
                      : `${vagaEmFoco.nome} · ${t("ninguém do time tem essa função ainda")}`}
                  </Text>
                  {secoesAdd.daVaga.map(renderCandidato)}
                  {secoesAdd.resto.length > 0 && (
                    <Text style={[styles.secaoAdd, { marginTop: spacing.sm }]}>{t("Outras pessoas do time")} · {secoesAdd.resto.length}</Text>
                  )}
                  {secoesAdd.resto.map(renderCandidato)}
                </>
              ) : listaAdd.map(renderCandidato)}
            </ScrollView>
          </View>
        </TecladoSeguro>
      </Modal>
      {/* Diálogo da casa · IRMÃO do conteúdo (ver components/ui/Dialogo.tsx) */}
      <dlg.Dialogo />
    </SafeAreaView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    title: { color: c.text, fontSize: font.size.lg, fontWeight: "700" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    muted: { color: c.textMuted, fontSize: font.size.sm },
    pequeno: { fontSize: font.size.sm },
    retry: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.primary },
    // Etapas 1 e 2
    seletor: { paddingVertical: spacing.xs + 2 },
    tipoChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    tipoChipTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    dataChip: { minWidth: 118, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    dataChipTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    dataChipSub: { color: c.textMuted, fontSize: font.size.sm - 1, marginTop: 1 },
    // Resumo + barra de times
    leituraBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingVertical: 6 },
    secaoAdd: { color: c.textMuted, fontSize: font.size.sm - 1, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, paddingTop: 6, paddingBottom: 2 },
    poolTopo: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    resumo: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 4 },
    resumoTxt: { color: c.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    barraTimes: { paddingVertical: spacing.xs + 2, borderRadius: radius.md },
    timeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, maxWidth: 220 },
    timeChipTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700", flexShrink: 1 },
    timeChipBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
    timeChipBadgeTxt: { color: "#fff", fontSize: font.size.sm - 2, fontWeight: "800" },
    dica: { color: c.textMuted, paddingHorizontal: spacing.md, paddingBottom: 4 },
    // A página do time
    teamCard: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: "hidden", marginTop: 4 },
    teamHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 4 },
    teamArea: { color: c.textMuted, fontSize: font.size.sm - 2, fontWeight: "700", letterSpacing: 0.8 },
    teamNome: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    paginaTxt: { color: c.textMuted, fontSize: font.size.sm - 1, fontWeight: "600" },
    contadores: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    contador: { flexDirection: "row", alignItems: "center", gap: 3 },
    contadorTxt: { fontSize: font.size.sm, fontWeight: "700" },
    faltamBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    faltamTxt: { fontSize: font.size.sm - 1, fontWeight: "800" },
    posBloco: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    posHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 2 },
    posNome: { color: c.textMuted, fontSize: font.size.sm - 1, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", flex: 1 },
    posContagem: { color: c.textMuted, fontSize: font.size.sm - 1, fontWeight: "700" },
    vaga: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: spacing.md, marginVertical: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderStyle: "dashed", borderColor: c.danger + "88" },
    pessoa: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.md, paddingVertical: 8 },
    avatar: { height: 34, width: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    avatarTxt: { fontSize: font.size.sm - 1, fontWeight: "700" },
    pessoaNome: { color: c.text, fontSize: font.size.sm },
    addInline: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    fab: { position: "absolute", right: spacing.md, bottom: spacing.lg, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.full, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
    fabTxt: { color: "#fff", fontWeight: "700", fontSize: font.size.sm },
    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    sheetTitle: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    sheetLabel: { color: c.textMuted, fontSize: font.size.sm - 1, marginBottom: 2 },
    teamPick: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border },
    input: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, color: c.text, borderWidth: 1, borderColor: c.border },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 12, marginTop: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, color: c.text, paddingVertical: 10, fontSize: font.size.md },
    resultado: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    ghost: { position: "absolute", top: 0, left: 0, flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 240, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: c.surface, borderWidth: 1, borderColor: c.primary, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 999 },
    ghostTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700", flexShrink: 1 },
    section: { color: c.text, fontWeight: "700", marginBottom: 6 },
    waBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", borderRadius: radius.full, paddingVertical: 10, marginBottom: spacing.md },
    waTxt: { color: "#fff", fontWeight: "700", fontSize: font.size.sm },
    histRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    histCulto: { color: c.text, fontSize: font.size.sm, flex: 1 },
    histData: { color: c.textMuted, fontSize: font.size.sm - 1 },
  });
}
