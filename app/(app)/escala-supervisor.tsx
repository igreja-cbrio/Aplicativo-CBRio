import { DockInsetContext } from "@/components/navigation/DockContent";
import { Modal, ScrollView } from "@/components/navigation/DockContent";
import { Text, TextInput } from "@/components/ui/Typography";
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
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Keyboard, Platform, Pressable,
  RefreshControl, StyleSheet, View, useWindowDimensions,
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
  filtrarPool, dividirPorVaga, separarBuscaDoTime,
  SEM_EQUIPE, SEM_FUNCAO, SEM_TIPO, type Time, type PosicaoDoTime,
} from "@/lib/escalaTimes";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useT } from "@/lib/i18n";
import { fundoDaFolha } from "@/lib/folha";
import { useDialogo } from "@/components/ui/Dialogo";

// Teto da busca fora do time no servidor (`LIMITE_BUSCA_POOL` do escala-pool).
// Só serve pra a tela dizer "mostrando os primeiros 30" — não decide nada.
const LIMITE_BUSCA_FORA = 30;

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
  const dockInset = useContext(DockInsetContext);
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
  // (busca geral, como antes).
  const [poolTime, setPoolTime] = useState<PoolVoluntario[] | null>(null);
  const [poolCarregando, setPoolCarregando] = useState(false);
  const [poolErro, setPoolErro] = useState(false);
  // Busca UNIFICADA (16/11/2026 · print do Matheus): com o time aberto, o que se
  // digita filtra o time na hora E pergunta ao servidor (`incluir_fora`) quem
  // NÃO é do time. Quem é de fora aparece em seção própria, com aviso, e só entra
  // depois de uma confirmação na própria linha. Sumiu o "Buscar fora do time".
  const [buscaFora, setBuscaFora] = useState<PoolVoluntario[]>([]);
  // A parte "do time" da resposta do servidor: só é usada quando a lista do time
  // não carregou (aí não há filtro local pra mostrar).
  const [buscaTimeServidor, setBuscaTimeServidor] = useState<PoolVoluntario[]>([]);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  // Teclado aberto com a busca em foco: a folha COMPACTA (equipe e função viram
  // uma linha) pra lista caber acima do teclado.
  const [buscaFocada, setBuscaFocada] = useState(false);
  const [tecladoAberto, setTecladoAberto] = useState(false);
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
  // No TIME: lista do servidor (ordem = preferência) filtrada pelo que foi
  // digitado, mais quem NÃO é do time (servidor, 2+ letras). Time sem id (ou
  // "Sem equipe"): a busca geral de sempre.
  const noTime = !!timeDoAdd?.team_id;
  const buscaAtiva = busca.trim().length >= 2;
  const listaAdd = !noTime ? resultados
    : poolErro ? (buscaAtiva ? buscaTimeServidor : [])
    : filtrarPool(poolTime ?? [], busca);
  const listaFora = noTime && buscaAtiva ? buscaFora : [];
  const compacto = buscaFocada && tecladoAberto;
  const funcaoDoAdd = outraFuncao.trim() || addPosicao;
  const nomeDoTimeAdd = timeDoAdd ? rotuloTime(timeDoAdd.nome) : "";
  // A VAGA em foco (chip de função escolhido, sem texto livre): separa "quem é
  // dessa função" do "resto do time". Pedido do Marcos (24/09): "estou escalando
  // um saxofonista — primeiro os saxofonistas, abaixo outras pessoas do time".
  const posicaoDoAdd = addPosicao && !outraFuncao.trim() ? (timeDoAdd?.posicoes ?? []).find(p => p.nome === addPosicao) : undefined;
  const vagaEmFoco = noTime && addPosicao && !outraFuncao.trim() ? { id: posicaoDoAdd?.position_id ?? null, nome: addPosicao } : null;
  const secoesAdd = dividirPorVaga(listaAdd, vagaEmFoco);
  // Disponibilidade declarada (09/11/2026): o SERVIDOR decide quem cabe neste
  // culto e já ordena (quem marcou e cabe · quem não marcou · quem está fora).
  // Fora continua escalável à mão — a tela só avisa.
  const rotuloPreferencia = (v: PoolVoluntario): { txt: string; fora: boolean } | null => {
    if (v.fora_da_disponibilidade) return { txt: v.fora_motivo ? t(v.fora_motivo) : t("fora da disponibilidade"), fora: true };
    if (v.prefere_este_culto) return { txt: t("disponível neste culto"), fora: false };
    return null;
  };

  async function carregarPoolDoTime(teamId: string | null | undefined) {
    setPoolTime(null); setPoolErro(false);
    if (!teamId || !servicoSel) return;
    setPoolCarregando(true);
    try { setPoolTime(await buscarEscalaPool("", { service_id: servicoSel.id, team_id: teamId })); }
    catch { setPoolTime([]); setPoolErro(true); }
    finally { setPoolCarregando(false); }
  }
  // Zera a busca e invalida qualquer resposta ainda em voo.
  function limparBusca() {
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    buscaSeq.current++;
    setBusca(""); setResultados([]); setBuscaFora([]); setBuscaTimeServidor([]);
    setBuscaErro(false); setBuscando(false); setConfirmarId(null);
  }

  // Busca com debounce (300ms) + guarda de sequência (ignora resposta obsoleta).
  // No time, o filtro local é imediato; o servidor responde quem é de fora.
  function onBusca(q: string) {
    setBusca(q);
    setBuscaErro(false);
    setConfirmarId(null);
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    const seq = ++buscaSeq.current;
    if (q.trim().length < 2) { setResultados([]); setBuscaFora([]); setBuscaTimeServidor([]); setBuscando(false); return; }
    setBuscando(true);
    const teamId = noTime ? timeDoAdd?.team_id : null;
    const serviceId = servicoSel?.id;
    buscaTimer.current = setTimeout(async () => {
      try {
        if (teamId && serviceId) {
          const r = separarBuscaDoTime(await buscarEscalaPool(q.trim(), { service_id: serviceId, team_id: teamId, incluir_fora: true }));
          if (seq === buscaSeq.current) { setBuscaTimeServidor(r.doTime); setBuscaFora(r.fora); }
        } else {
          const r = await buscarEscalaPool(q.trim());
          if (seq === buscaSeq.current) setResultados(r);
        }
      } catch {
        if (seq === buscaSeq.current) { setResultados([]); setBuscaFora([]); setBuscaTimeServidor([]); setBuscaErro(true); }
      } finally {
        if (seq === buscaSeq.current) setBuscando(false);
      }
    }, 300);
  }

  // iOS avisa ANTES da animação (`Will`); o Android só entrega `Did` com confiança.
  useEffect(() => {
    const abrir = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const fechar = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(abrir as "keyboardDidShow", () => setTecladoAberto(true));
    const s2 = Keyboard.addListener(fechar as "keyboardDidHide", () => setTecladoAberto(false));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  /** Abre o "Adicionar" já no time (e na função) de onde a pessoa tocou — a vaga. */
  function abrirAdd(time?: Time, posicao?: PosicaoDoTime) {
    if (somenteLeitura) return;
    const alvo = time ?? timeAberto ?? null;
    setAddTime(alvo?.chave ?? "");
    setAddPosicao(posicao?.nome ?? "");
    setOutraFuncao(""); limparBusca();
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
      limparBusca();
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

  // ── Uma linha do "Adicionar" (usada pelas seções do time, pela de fora e pela busca geral) ──
  // `fora` (16/11/2026): a pessoa NÃO é do time (o servidor disse `do_time: false`).
  // A linha avisa onde ela serve e o toque não escala: abre a confirmação na
  // própria linha. Se o servidor disse `pode_escalar: false` (líder de time, regra
  // do Marcos de 30/10), a confirmação vira a explicação de como fazer.
  // ⚠️ Confirmação NA LINHA, não diálogo: esta folha é um <Modal>, e o diálogo da
  // casa (outro <Modal>) nasceria atrás dela no iOS.
  function renderCandidato(v: PoolVoluntario, opcoes?: { fora?: boolean }) {
    const fora = !!opcoes?.fora;
    const escalado = v.id ? jaNoTime.has(v.id) : false;
    const pref = rotuloPreferencia(v);
    const travado = fora && v.pode_escalar === false;
    const confirmando = fora && confirmarId === v.id;
    const times = v.times ?? [];
    const ondeServe = times.length
      ? `${t("serve em")} ${times.slice(0, 2).join(", ")}${times.length > 2 ? ` +${times.length - 2}` : ""}`
      : t("não serve em nenhum time");
    const cor = fora ? colors.warning : colors.primary;
    return (
      <View key={v.id}>
        <Pressable style={styles.resultado} disabled={!!salvandoId || escalado}
          onPress={() => (fora ? setConfirmarId(confirmando ? null : v.id) : adicionar(v))}
          accessibilityRole="button" accessibilityState={fora ? { expanded: confirmando } : undefined}
          accessibilityLabel={fora ? `${v.full_name}, ${t("Não é do time")} ${nomeDoTimeAdd}, ${ondeServe}` : `${t("Adicionar")} ${v.full_name}`}>
          <View style={[styles.avatar, { backgroundColor: cor + "22" }]}>
            <Text style={[styles.avatarTxt, { color: cor }]}>{iniciais(v.full_name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pessoaNome} numberOfLines={1}>{v.full_name}</Text>
            {fora ? (
              <Text style={[styles.pequeno, { color: colors.warning }]} numberOfLines={2}>{`${t("Não é do time")} ${nomeDoTimeAdd} · ${ondeServe}`}</Text>
            ) : pref && <Text style={[styles.pequeno, { color: pref.fora ? colors.warning : colors.success }]} numberOfLines={1}>{pref.txt}</Text>}
          </View>
          {salvandoId === v.id ? <ActivityIndicator color={colors.primary} />
            : escalado ? <Text style={[styles.pequeno, { color: colors.textMuted }]}>{t("nesta equipe")}</Text>
            : fora ? <Ionicons name={travado ? "lock-closed" : "alert-circle"} size={22} color={colors.warning} />
            : <Ionicons name="add-circle" size={24} color={colors.primary} />}
        </Pressable>
        {confirmando && (
          <View style={[styles.avisoFora, { borderColor: colors.warning + "88", backgroundColor: colors.warning + "14" }]}>
            <Text style={[styles.pequeno, { color: colors.text }]}>
              {travado
                ? `${v.full_name} ${t("não está no time")} ${nomeDoTimeAdd}. ${t("Só admin ou editor do culto escala quem não é do time. Vincule a pessoa ao time em Pessoas do Servir e escale de novo.")}`
                : `${v.full_name} ${t("não está no time")} ${nomeDoTimeAdd}. ${t("Escalar mesmo assim?")}`}
            </Text>
            <View style={styles.avisoBotoes}>
              <Pressable onPress={() => setConfirmarId(null)} style={[styles.avisoBtn, { borderColor: colors.border }]} accessibilityRole="button">
                <Text style={[styles.pequeno, { color: colors.text, fontWeight: "700" }]}>{travado ? t("Entendi") : t("Cancelar")}</Text>
              </Pressable>
              {!travado && (
                <Pressable onPress={() => { setConfirmarId(null); void adicionar(v); }} disabled={!!salvandoId}
                  style={[styles.avisoBtn, { borderColor: colors.warning, backgroundColor: colors.warning }]} accessibilityRole="button">
                  <Text style={[styles.pequeno, { color: "#fff", fontWeight: "800" }]}>{t("Escalar mesmo assim")}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
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
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: dockInset + 110, gap: 8 }}
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
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
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
            <Pressable style={[styles.fab, { bottom: dockInset + spacing.lg }]} onPress={() => abrirAdd(timeAberto)} accessibilityRole="button" accessibilityLabel={t("Adicionar voluntário")}>
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
      {/* ⚠️ (16/11/2026 · print do Matheus no iPhone) Com o teclado aberto a folha
          crescia por cima da barra de status: o "…ou outra função" ficava atrás do
          relógio e o topo sumia. Agora o fundo respeita o `insets.top` (o Modal é
          `statusBarTranslucent`), a folha encolhe (`flexShrink`) em vez de vazar, a
          lista é quem cede altura, o fundo da folha não soma o respiro da barra do
          sistema por cima do teclado e, com a busca em foco, equipe e função viram
          uma linha só. */}
      <Modal visible={addOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAddOpen(false)}>
        <TecladoSeguro style={[styles.modalWrap, { paddingTop: insets.top + spacing.sm }]}>
          <View style={[styles.sheet, styles.sheetAdd, { paddingBottom: tecladoAberto ? spacing.md : fundoDaFolha(insets.bottom) }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Adicionar voluntário")}</Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>

            {compacto ? (
              <Pressable style={styles.resumoAdd} onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel={t("Alterar equipe e função")}>
                <Ionicons name="people-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.pequeno, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {nomeDoTimeAdd || t("Escolha a equipe")}{funcaoDoAdd ? ` · ${funcaoDoAdd}` : ""}
                </Text>
                <Text style={[styles.pequeno, { color: colors.primary, fontWeight: "700" }]}>{t("Alterar")}</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.sheetLabel}>{t("Equipe")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsLinha} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} keyboardShouldPersistTaps="handled">
                  {times.filter(tm => !tm.chave.startsWith("n:") || tm.nome === SEM_EQUIPE).map(tm => {
                    const ativo = addTime === tm.chave;
                    return (
                      <Pressable key={tm.chave} onPress={() => { setAddTime(tm.chave); setAddPosicao(""); limparBusca(); void carregarPoolDoTime(tm.team_id); }} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                        style={[styles.teamPick, ativo && { borderColor: colors.primary, backgroundColor: colors.primary + "18" }]}>
                        <Text style={[styles.pequeno, { color: ativo ? colors.primary : colors.text }]}>{rotuloTime(tm.nome)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.sheetLabel, { marginTop: 6 }]}>{t("Função")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsLinha} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} keyboardShouldPersistTaps="handled">
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

                {/* Lista do TIME (24/09): o servidor manda quem pode neste culto
                    primeiro. Preferência ORDENA, nunca filtra. */}
                {noTime && !buscaAtiva && (
                  <Text style={[styles.pequeno, styles.poolTopoTxt, { color: colors.textMuted, marginTop: 8 }]}>
                    {poolErro
                      ? t("Não deu pra carregar o time. Busque pelo nome.")
                      : t("Pessoas do time · quem marcou que pode neste culto vem primeiro")}
                  </Text>
                )}
              </>
            )}

            <View style={[styles.searchBox, compacto && { marginTop: spacing.sm }]}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder={noTime ? t("Buscar pelo nome, no time ou fora dele…") : t("Buscar voluntário pelo nome…")} placeholderTextColor={colors.textMuted}
                value={busca} onChangeText={onBusca} autoFocus={!noTime} autoCorrect={false}
                onFocus={() => setBuscaFocada(true)} onBlur={() => setBuscaFocada(false)} />
              {buscando && <ActivityIndicator color={colors.primary} />}
              {!!busca && !buscando && (
                <Pressable onPress={limparBusca} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Limpar busca")}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            <ScrollView
              automaticallyAdjustKeyboardInsets
              style={styles.listaAdd} keyboardShouldPersistTaps="handled">
              {noTime && poolCarregando && !buscaAtiva ? (
                <View style={{ padding: spacing.md, alignItems: "center" }}><ActivityIndicator color={colors.primary} /></View>
              ) : !noTime && !buscaAtiva ? (
                <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>{t("Digite ao menos 2 letras do nome.")}</Text>
              ) : !noTime && buscaErro ? (
                <Pressable style={{ padding: spacing.md, alignItems: "center" }} onPress={() => onBusca(busca)}>
                  <Text style={[styles.muted, { textAlign: "center" }]}>{t("Falha ao buscar. Toque pra tentar de novo.")}</Text>
                </Pressable>
              ) : !noTime ? (
                (!buscando && listaAdd.length === 0)
                  ? <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>{t("Nenhum voluntário encontrado.")}</Text>
                  : <>{listaAdd.map(v => renderCandidato(v))}</>
              ) : (
                <>
                  {/* ── Do time ── */}
                  {vagaEmFoco ? (
                    <>
                      {(secoesAdd.daVaga.length > 0 || (!buscaAtiva && !poolErro)) && (
                        <Text style={styles.secaoAdd}>
                          {secoesAdd.daVaga.length
                            ? `${vagaEmFoco.nome} · ${secoesAdd.daVaga.length}`
                            : `${vagaEmFoco.nome} · ${t("ninguém do time tem essa função ainda")}`}
                        </Text>
                      )}
                      {secoesAdd.daVaga.map(v => renderCandidato(v))}
                      {secoesAdd.resto.length > 0 && (
                        <Text style={[styles.secaoAdd, { marginTop: spacing.sm }]}>{t("Outras pessoas do time")} · {secoesAdd.resto.length}</Text>
                      )}
                      {secoesAdd.resto.map(v => renderCandidato(v))}
                    </>
                  ) : (
                    <>
                      {buscaAtiva && listaAdd.length > 0 && (
                        <Text style={styles.secaoAdd}>{t("Pessoas do time")} · {listaAdd.length}</Text>
                      )}
                      {listaAdd.map(v => renderCandidato(v))}
                    </>
                  )}
                  {!buscaAtiva && !poolErro && !poolCarregando && listaAdd.length === 0 && (
                    <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>
                      {busca.trim() ? t("Ninguém do time com esse nome.") : t("Ninguém neste time ainda. Busque pelo nome.")}
                    </Text>
                  )}

                  {/* ── Fora do time (16/11/2026) ── */}
                  {buscaAtiva && (buscaErro ? (
                    <Pressable style={{ padding: spacing.md, alignItems: "center" }} onPress={() => onBusca(busca)}>
                      <Text style={[styles.muted, { textAlign: "center" }]}>{t("Falha ao buscar. Toque pra tentar de novo.")}</Text>
                    </Pressable>
                  ) : listaFora.length > 0 ? (
                    <>
                      <Text style={[styles.secaoAdd, { marginTop: spacing.sm, color: colors.warning }]}>{t("Fora do time")} · {listaFora.length}</Text>
                      <Text style={[styles.pequeno, { color: colors.textMuted, marginBottom: 2 }]}>
                        {listaFora.some(v => v.pode_escalar === false)
                          ? t("Não são do time. Para escalar, vincule a pessoa ao time em Pessoas do Servir.")
                          : t("Não são do time. Escalar pede confirmação.")}
                      </Text>
                      {listaFora.map(v => renderCandidato(v, { fora: true }))}
                      {listaFora.length >= LIMITE_BUSCA_FORA && (
                        <Text style={[styles.pequeno, { color: colors.textMuted, paddingVertical: 6, textAlign: "center" }]}>{t("Mostrando os primeiros 30. Digite mais letras do nome.")}</Text>
                      )}
                    </>
                  ) : !buscando && listaAdd.length === 0 ? (
                    <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>{t("Ninguém com esse nome.")}</Text>
                  ) : null)}
                </>
              )}
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
    poolTopoTxt: { flexShrink: 1 },
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
    // A folha do Adicionar ENCOLHE quando falta altura (teclado aberto): quem cede
    // é a lista (`listaAdd`), nunca o cabeçalho, que ficava atrás da barra de status.
    sheetAdd: { flexShrink: 1 },
    chipsLinha: { flexGrow: 0, flexShrink: 0 },
    listaAdd: { maxHeight: 300, minHeight: 96, flexShrink: 1, flexGrow: 0 },
    resumoAdd: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceAlt },
    avisoFora: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: 6, gap: 8 },
    avisoBotoes: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 },
    avisoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1 },
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
