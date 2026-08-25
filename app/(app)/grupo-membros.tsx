// ============================================================================
// GERENCIAR GRUPO · tudo o que o líder faz, num lugar só (Marcos · 05/08/2026)
//
// Pedido dele: "gerenciar grupo, aqui temos que acertar muito nessa tela,
// precisamos trazer TODO gerenciamento de um grupo pra cá — aba de membros
// (podendo gerenciar quem é líder, ou em treinamento), registro de frequências
// (com comentários do líder e uma opção de pedir ajuda), aprovação de novos
// pedidos, saídas e transferências, estudos e opção de editar o grupo".
//
// ⚠️⚠️ LAYOUT v2 · HIERARQUIA VISUAL (05/08/2026 · aprovado pelo Marcos)
// A v1 tinha DOIS protagonistas: o nome do grupo (25/800) e os três números
// (25/800) empatados no topo da escala, mais teal em 4 papéis (botão + pílula da
// aba + 5 avatares). Ele apontou: "a pessoa que abre não vê um destaque nenhum
// muito claro". O conserto NÃO foi aumentar o herói — foi rebaixar os
// concorrentes:
//   ZONA 1 · AÇÃO    → o próximo encontro é o ÚNICO elemento em 27/800 e o único
//                      bloco com moldura. Muda de cor com o estado.
//   ZONA 2 · APOIO   → os 3 números viraram UMA linha de 13,5 px.
//   ZONA 3 · DETALHE → abas silenciosas (sublinhado, não pílula cheia) + lista
//                      com avatar NEUTRO, separadas por 26 px de respiro.
// O nome do grupo aparece UMA vez (na barra), com dia/local na 2ª linha.
// Sobrou UM teal saturado na tela: o botão do herói.
// ⚠️ O botão "Inscrições do grupo" saiu do /meu-grupo — aprovar pedido agora só
// existe AQUI (a aba Pedidos). Duas portas pra mesma coisa era o que confundia.
//
// ⚠️⚠️ MUDANÇAS DE 25/08/2026 (Marcos, avaliando esta tela):
//  1. **"Co-líder" MORREU.** *"Nós não usamos o termo co-líder, pode excluir esse
//     termo, se alguém estiver com essa categoria, coloque para líder em
//     treinamento e exclua."* Quem tinha virou `lider_treinamento` (migration
//     20260825170000) e o banco recusa gravar o valor de novo.
//  2. **Líder em treinamento GERENCIA o grupo.** Quem decide é o SERVIDOR
//     (`gruposPapelApp`), não esta tela.
//  3. **Os encontros ficam À VISTA** — a semana que ninguém registrou aparece
//     como "presença não registrada" e pode ser registrada depois. Era aqui o
//     "bug" que ele viu: a tela NÃO MANDAVA A DATA e o servidor caía em "hoje",
//     então a chamada do dia 18 feita no dia 24 nascia no dia 24.
//  4. **"Registrar saída" virou "Remover do grupo"**, e as folhas subiram —
//     o botão caía onde ficam os botões do Android.
//  5. **Transferência não escolhe destino**: o líder SOLICITA e a coordenação
//     decide pra onde (vai pra Caixa de entrada do /grupos).
//  6. **"Adicionar pessoa"** no fim do roster: o líder cadastra e a pessoa já
//     nasce dentro do grupo, sem WhatsApp e sem confirmação.
//
// ⚠️ FUNÇÃO: o app dá `frequentador`, `líder em treinamento` e `líder`
// (cadastro). Quem recebe o WhatsApp do grupo é só `mem_grupos.lider_id` (lei de
// 31/07: um destinatário só, e tem que ser líder do roster) — marcar líder aqui
// NÃO muda isso. Trocar a principal é ato da coordenação.
// ⚠️ FREQUÊNCIA usa a RPC `registrar_encontro_grupo` (o mesmo escritor do web e
// do fluxo do WhatsApp) — não existe segunda régua de presença.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Modal, Platform,
  Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { acaoAoFechar } from "@/lib/descartarRascunho";
import { filtrarPorTexto } from "@/lib/buscaTexto";
import { linkDeInscricao, precisaEscolherNaLista } from "@/lib/convite";
import { subirUmNivel } from "@/lib/hierarquia";
import { hojeBRT } from "@/lib/dataBRT";
// ⚠️ A máscara do app vive em `lib/telefone` — NÃO existe `lib/inscricao` aqui
// (esse é o nome do helper do ERP). Ela TRUNCA no limite, que é o que impede o
// campo aceitar 20 dígitos e o servidor recusar lá na frente sem a pessoa saber
// por quê.
import { mascararTelefoneBR } from "@/lib/telefone";
import { mascararCpf } from "@/lib/cpf";
import {
  estadoDoEncontro, dataLonga, quandoCurto, distanciaEmTexto, horaCurta,
} from "@/lib/proximoEncontro";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { ModalAgendaEncontro } from "@/components/grupos/ModalAgendaEncontro";
import {
  getGrupoRoster, aprovarPedidoGrupo, recusarPedidoGrupo,
  mudarFuncaoMembroGrupo, registrarSaidaGrupo, transferirMembroGrupo,
  getEncontrosGrupo, registrarEncontroGrupo, pedirAjudaGrupo, getMateriaisGrupo,
  cadastrarPessoaGrupo, getAgendaGrupo, type OcorrenciaAgenda,
  type GrupoMembro, type GrupoPedido, type GrupoRoster,
  type GrupoEncontro, type GrupoMaterial, type FuncaoApp,
  type OcorrenciaEncontro,
} from "@/lib/api";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { chavesVisiveis, MARCADOR_INFO } from "@/lib/marcadoresJornada";

type Aba = "membros" | "frequencia" | "pedidos" | "estudos";
// ⚠️ SEM ÍCONE e com rótulo curto: 4 abas em 328 dp dão ~80 dp cada, e ícone
// (16) + gap (4) comiam o texto — era isso que fazia "Frequência" estourar e
// "Estudos" encostar na borda. A referência (Mobbin/Fluent) diz o mesmo: não
// misturar texto e ícone no mesmo controle.
const ABAS: { k: Aba; label: string }[] = [
  { k: "membros", label: "Pessoas" },
  { k: "frequencia", label: "Encontros" },
  { k: "pedidos", label: "Pedidos" },
  { k: "estudos", label: "Estudos" },
];

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// ⚠️ `co_lider`/`colider` continuam no mapa só pra LER dado histórico (bundle
// velho em cache, resposta de backend antigo): eles mostram o rótulo NOVO. Chave
// sem rótulo viraria "co_lider" cru na tela, que é pior que um nome atualizado.
const FUNCAO: Record<string, string> = {
  lider: "Líder", co_lider: "Líder em treinamento", colider: "Líder em treinamento",
  lider_treinamento: "Líder em treinamento", supervisor: "Supervisor",
  coordenador: "Coordenador", membro: "Membro", frequentador: "Frequentador",
  visitante: "Visitante",
};
// ⚠️ `quando()` local e `DESTAQUE` saíram na v2: quem monta "Terça, 20h" agora é
// `quandoCurto` (lib/proximoEncontro · testado no portão), e o único selo da
// lista é "Principal" — dar badge colorido a todo papel era mais um chamariz
// competindo com o herói.
function waLink(tel: string | null): string | null {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
}
function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default function GrupoMembrosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // ⚠️⚠️ ITEM 4 do Marcos (25/08): *"mudar o nome do texto para 'Remover do
  // grupo' e subir um pouco pois esse botão fica onde está os botões do android,
  // dificultando."*
  //
  // ⚠️ As 5 folhas usavam o inset cru somado a um respiro pequeno. O PISO existe
  // porque dentro de um `<Modal>` do Android o inset pode chegar 0 (a folha é
  // outra janela) — e aí a última linha encosta na barra de navegação. Um piso
  // é o conserto MONOTÔNICO: mais folga embaixo = botão mais alto, qualquer que
  // seja a causa real (inset 0, gesture bar fina de 24 dp ou barra de 3 botões
  // de 48 dp). Diagnosticar QUAL das três é no aparelho dele exigiria o
  // aparelho; o piso resolve as três.
  // ⚠️ Se o inset vier correto (48), isso dá 48+24 = 72 dp de folga: bastante,
  // mas o pedido foi literalmente "subir um pouco".
  const fundoSeguro = spacing.lg + Math.max(insets.bottom, spacing.lg);
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ id: string; nome?: string }>();
  const grupoId = String(params.id || "");

  const [data, setData] = useState<GrupoRoster | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [recusaAlvo, setRecusaAlvo] = useState<GrupoPedido | null>(null);
  const [motivo, setMotivo] = useState("");

  const [aba, setAba] = useState<Aba>("membros");
  // Membros · ações por participante
  const [acaoAlvo, setAcaoAlvo] = useState<GrupoMembro | null>(null);
  const [saidaAlvo, setSaidaAlvo] = useState<GrupoMembro | null>(null);
  const [saidaMotivo, setSaidaMotivo] = useState("");
  const [transferirAlvo, setTransferirAlvo] = useState<GrupoMembro | null>(null);
  const [transfMotivo, setTransfMotivo] = useState("");
  // "Adicionar pessoa" (pedido do Pr. Nélio e da Natasha · 25/08)
  const [addAberto, setAddAberto] = useState(false);
  const [addNome, setAddNome] = useState("");
  const [addTel, setAddTel] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addNasc, setAddNasc] = useState("");
  const [addSexo, setAddSexo] = useState<"" | "masculino" | "feminino">("");
  const [addCpf, setAddCpf] = useState("");
  const [addEndereco, setAddEndereco] = useState("");
  const [addVisitante, setAddVisitante] = useState(false);
  // ⚠️⚠️ LGPD · o líder está DECLARANDO por outra pessoa. O aceite é obrigatório
  // (é a base legal do tratamento) e o opt-in de WhatsApp é opt-in de verdade —
  // default false, como manda o Contrato de Inscrição (D4).
  const [addTermos, setAddTermos] = useState(false);
  const [addOptin, setAddOptin] = useState(false);
  const [addSalvando, setAddSalvando] = useState(false);
  // Agenda (recorrência + exceções) — o líder gerencia a temporada inteira aqui.
  const [agenda, setAgenda] = useState<OcorrenciaAgenda[] | null>(null);
  const [agendaAviso, setAgendaAviso] = useState<string | null>(null);
  // ⚠️ `undefined` = agenda ainda não chegou (o herói calcula local e a tela
  // não fica vazia). `null` = chegou e NÃO há anterior pendente.
  const [agendaAnterior, setAgendaAnterior] = useState<string | null | undefined>(undefined);
  const [agendaAlvo, setAgendaAlvo] = useState<OcorrenciaAgenda | null>(null);
  // Frequência
  const [encontros, setEncontros] = useState<GrupoEncontro[] | null>(null);
  // ⚠️⚠️ A TIMELINE e a DATA ALVO são o conserto do item 3. `ocorrencias === null`
  // = o servidor não mandou (backend antigo, ou a agenda falhou) ⇒ a aba cai na
  // lista crua, o comportamento de antes. Nunca afirma "não houve encontro".
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaEncontro[] | null>(null);
  const [ocorrenciasAviso, setOcorrenciasAviso] = useState<string | null>(null);
  // ⚠️ A data que a chamada vai GRAVAR. `null` = hoje (o caminho do herói, que
  // é registrar o encontro de agora). Preenchida = o líder tocou numa semana
  // atrasada da timeline — e é o que impede a chamada do dia 18 nascer no 24.
  const [chamadaData, setChamadaData] = useState<string | null>(null);
  // ⚠️ A ocorrência PASSADA que o líder tocou (Marcos · 25/08): *"a pessoa clica
  // em um encontro passado, altera data ou registra que encontro não aconteceu,
  // registra presença e fica naquele encontro."* Abre o MESMO modal da agenda,
  // em `modo="passado"` — um modal, dois modos.
  const [ocorrenciaAlvo, setOcorrenciaAlvo] = useState<OcorrenciaEncontro | null>(null);
  const [chamadaAberta, setChamadaAberta] = useState(false);
  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const [tema, setTema] = useState("");
  const [comentario, setComentario] = useState("");
  const [salvandoChamada, setSalvandoChamada] = useState(false);
  const [buscaChamada, setBuscaChamada] = useState("");
  // ⚠️ `useRef` e não `useState`: isto não pinta nada na tela, e como state
  // dispararia um render a cada abertura do modal sem mudar um pixel.
  const presentesIniciais = useRef(0);
  // Ajuda
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [ajudaMsg, setAjudaMsg] = useState("");
  const [enviandoAjuda, setEnviandoAjuda] = useState(false);
  // Estudos
  const [materiais, setMateriais] = useState<GrupoMaterial[] | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setErro(null);
    try {
      const r = await getGrupoRoster(grupoId);
      setData(r);
      setErro(null);
    } catch (e: any) {
      const status = (e as { status?: number })?.status;
      setErro(status === 403 ? t("Você não gerencia este grupo.") : (e?.message || t("Erro ao carregar o grupo.")));
      if (data === null) setData({ grupo: null as any, membros: [], pendentes: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId, t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // ⚠️ Cada aba puxa o SEU dado só quando é aberta — a tela de gerenciar tem 4
  // fontes e carregar as 4 no mount deixaria o líder esperando pelo que ele nem
  // vai olhar.
  // ⚠️ ENCONTROS saíram do lazy: o herói da tela (zona 1) precisa deles pra saber
  // se faltou registrar. Carregar só ao abrir a aba faria o herói afirmar
  // "próximo encontro" num grupo atrasado — dizer a coisa errada com confiança é
  // pior do que esperar 300 ms. `materiais` segue lazy (só a aba Estudos usa).
  useEffect(() => {
    if (encontros === null) {
      getEncontrosGrupo(grupoId)
        .then((r) => {
          setEncontros(r.encontros || []);
          // ⚠️ `undefined` (backend antigo) e `null` (o servidor tentou e não
          // conseguiu) caem no MESMO lugar de propósito: sem timeline, a aba
          // mostra a lista crua. O que muda é o aviso — só o segundo caso tem
          // motivo pra explicar.
          setOcorrencias(r.ocorrencias ?? null);
          setOcorrenciasAviso(r.ocorrencias_aviso || null);
        })
        .catch(() => { setEncontros([]); setOcorrencias(null); });
    }
    // ⚠️ A agenda NÃO é lazy de aba: ela vive no topo da tela (pedido do Marcos
    // · 18/08 — "gerenciar tudo na mesma tela"). Erro NÃO vira agenda vazia:
    // "não há encontro marcado" e "a consulta falhou" levam a decisões opostas.
    if (agenda === null) {
      getAgendaGrupo(grupoId)
        .then((r) => {
          setAgenda(r.ocorrencias || []);
          setAgendaAviso(r.aviso || null);
          // `anterior` ausente no payload (backend antigo) = não sei ⇒ undefined.
          setAgendaAnterior(r.anterior === undefined ? undefined : (r.anterior?.data ?? null));
        })
        .catch((e: any) => { setAgenda([]); setAgendaAviso(e?.message || t("Não consegui carregar a agenda agora.")); });
    }
    if (aba === "estudos" && materiais === null) {
      getMateriaisGrupo(grupoId).then((r) => setMateriais(r.materiais || [])).catch(() => setMateriais([]));
    }
  }, [aba, grupoId, encontros, materiais, agenda, t]);

  async function aplicarFuncao(m: GrupoMembro, funcao: FuncaoApp) {
    setAcaoAlvo(null);
    setProcessandoId(m.id);
    try {
      await mudarFuncaoMembroGrupo(grupoId, m.id, funcao);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await carregar(true);
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível mudar a função."));
    } finally { setProcessandoId(null); }
  }

  async function confirmarSaida() {
    const m = saidaAlvo;
    if (!m) return;
    setProcessandoId(m.id);
    try {
      await registrarSaidaGrupo(grupoId, m.id, saidaMotivo.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSaidaAlvo(null); setSaidaMotivo("");
      await carregar(true);
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível registrar a saída."));
    } finally { setProcessandoId(null); }
  }

  async function confirmarTransferencia() {
    const m = transferirAlvo;
    if (!m) return;
    setProcessandoId(m.id);
    try {
      const r = await transferirMembroGrupo(grupoId, m.id, transfMotivo.trim() || undefined);
      setTransferirAlvo(null);
      setTransfMotivo("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // ⚠️ Dois toques não são erro: o servidor devolve o MESMO pedido. A tela
      // diz isso em vez de fingir que abriu outro.
      Alert.alert(
        r?.ja_pedido ? t("Já estava solicitado") : t("Transferência solicitada"),
        r?.ja_pedido
          ? t("A coordenação já tem este pedido na fila.")
          : t("A coordenação vai escolher o grupo e falar com a pessoa. Ela continua no seu grupo até lá."),
      );
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível solicitar a transferência."));
    } finally { setProcessandoId(null); }
  }


  /**
   * ⚠️ Fechar SÓ pergunta quando há trabalho a perder — a régua vive em
   * `lib/descartarRascunho.ts` (pura, no portão, com mutante).
   *
   * Na chamada, "trabalho" não é ter gente marcada: ela NASCE com todo mundo
   * marcado. O sinal é ter MEXIDO — desmarcado alguém — ou ter digitado tema ou
   * comentário. Sem essa distinção, o app perguntaria em toda saída e a pessoa
   * aprenderia a dispensar a pergunta no automático, que é o oposto de proteger.
   */
  function fecharChamada() {
    const mexeuNaChamada = presentes.size !== presentesIniciais.current;
    const acao = acaoAoFechar({
      campos: [tema, comentario],
      mudouAlgo: mexeuNaChamada,
      salvando: salvandoChamada,
    });
    // Está gravando: não fecha nem pergunta. Fechar no meio do envio deixa a
    // pessoa sem saber se salvou — e ela tenta de novo, duplicando a chamada.
    if (acao === "aguardar") return;
    if (acao === "fechar") { setChamadaAberta(false); return; }
    Alert.alert(
      t("Descartar a frequência?"),
      t("Você marcou presenças que ainda não foram salvas."),
      [
        { text: t("Continuar preenchendo"), style: "cancel" },
        { text: t("Descartar"), style: "destructive", onPress: () => setChamadaAberta(false) },
      ],
    );
  }

  function fecharAjuda() {
    const acao = acaoAoFechar({ campos: [ajudaMsg], salvando: enviandoAjuda });
    if (acao === "aguardar") return;
    if (acao === "fechar") { setAjudaAberta(false); return; }
    Alert.alert(
      t("Descartar sua mensagem?"),
      t("O que você escreveu não foi enviado."),
      [
        { text: t("Continuar escrevendo"), style: "cancel" },
        { text: t("Descartar"), style: "destructive", onPress: () => setAjudaAberta(false) },
      ],
    );
  }

  /**
   * `data` = a ocorrência que está sendo registrada (ISO). `null` = hoje, que é
   * o caminho do herói ("registrar presença" do encontro de agora).
   *
   * ⚠️⚠️ É ESTE PARÂMETRO o conserto do defeito relatado: sem ele, o `POST` caía
   * em `hojeBRT()` no servidor e a chamada do dia 18 feita no dia 24 nascia com
   * a data 24.
   */
  // ⚠️ O parâmetro NÃO pode se chamar `data`: esse é o nome do estado do ROSTER
  // nesta tela (`const [data, setData] = useState<GrupoRoster>`), e sombreá-lo
  // fazia a chamada nascer VAZIA (a lista de presentes vinha de `data.membros`).
  // O typecheck pegou; sem tipos, teria virado "a chamada não marca ninguém".
  function abrirChamada(dataAlvo: string | null = null) {
    setChamadaData(dataAlvo);
    // Começa com TODO MUNDO marcado: na prática o líder desmarca quem faltou, e
    // é bem menos toque do que marcar 12 pessoas uma a uma.
    const todos = new Set((data?.membros || []).map((m) => m.membro_id).filter(Boolean) as string[]);
    setPresentes(todos);
    // ⚠️ Guarda o TAMANHO inicial pra saber depois se a pessoa mexeu na chamada.
    // Não dá pra usar "tem gente marcada" como sinal: a chamada NASCE com todo
    // mundo marcado, então isso perguntaria sempre — e pergunta que aparece à
    // toa se aprende a dispensar no automático.
    presentesIniciais.current = todos.size;
    setTema(""); setComentario(""); setBuscaChamada(""); setChamadaAberta(true);
  }

  async function salvarChamada() {
    setSalvandoChamada(true);
    try {
      const r = await registrarEncontroGrupo(grupoId, {
        // ⚠️ `undefined` (não `null`) quando é hoje: o servidor tem o default
        // BRT correto, e mandar a data calculada no APARELHO reintroduziria o
        // risco de fuso que a régua do servidor já resolve.
        data: chamadaData || undefined,
        tema: tema.trim() || undefined,
        observacoes: comentario.trim() || undefined,
        presentes: [...presentes],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setChamadaAberta(false);
      const dataRegistrada = chamadaData;
      setChamadaData(null);
      setEncontros(null); // força recarregar o histórico E a timeline
      setOcorrencias(null);
      await carregar(true); // o contador de presenças do roster mudou
      // ⚠️ A confirmação DIZ a data quando não é hoje: é o que dá ao líder a
      // prova de que a chamada atrasada foi gravada no dia certo — a dúvida que
      // gerou o relato dele.
      Alert.alert(
        t("Frequência registrada"),
        `${r.presentes} ${r.presentes === 1 ? t("presente") : t("presentes")}`
        + (dataRegistrada ? ` ${t("em")} ${dataRegistrada.split("-").reverse().join("/")}.` : "."),
      );
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível registrar."));
    } finally { setSalvandoChamada(false); }
  }

  function limparAdd() {
    setAddNome(""); setAddTel(""); setAddEmail(""); setAddNasc("");
    setAddSexo(""); setAddCpf(""); setAddEndereco("");
    setAddVisitante(false); setAddTermos(false); setAddOptin(false);
  }

  // ⚠️⚠️ O MESMO conjunto do formulário público de grupos (Marcos · 25/08:
  // *"queremos cadastro completo, os mesmos campos que solicitam a inscrição de
  // grupos"*): nome completo · celular · nascimento · sexo · CPF · e-mail. Quem
  // valida DE VERDADE é o servidor (`inscricaoContrato.validarCamposPadrao`) —
  // isto aqui só decide quando o botão acende, pra a pessoa não tocar e levar
  // erro. As duas réguas podem discordar em casos de borda (DV do CPF, nome
  // abreviado), e nesse caso quem manda é o servidor, que devolve o campo.
  const addPodeEnviar = addNome.trim().split(/\s+/).filter(Boolean).length >= 2
    && addNome.trim().length >= 5
    && addTel.replace(/\D/g, "").length >= 10
    && /^\d{4}-\d{2}-\d{2}$/.test(addNasc.trim())
    && !!addSexo
    && addCpf.replace(/\D/g, "").length === 11
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.trim())
    && addTermos;

  async function salvarPessoaNova() {
    setAddSalvando(true);
    try {
      const r = await cadastrarPessoaGrupo(grupoId, {
        nome: addNome.trim(),
        telefone: addTel.trim(),
        email: addEmail.trim(),
        data_nascimento: addNasc.trim(),
        genero: addSexo || undefined,
        cpf: addCpf.trim(),
        endereco: addEndereco.trim() || undefined,
        whatsapp_optin: addOptin,
        funcao: addVisitante ? "visitante" : "frequentador",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAddAberto(false);
      limparAdd();
      await carregar(true);
      // ⚠️⚠️ A tela DIZ quando o matcher LIGOU numa pessoa que já existia. Sem
      // isso o líder acha que não funcionou e tenta de novo com outro nome — que
      // é exatamente o comportamento que fabrica duplicata na base.
      Alert.alert(
        r?.ja_no_grupo ? t("Já estava no grupo") : t("Pronto!"),
        r?.ja_no_grupo
          ? `${r.nome} ${t("já faz parte deste grupo.")}`
          : r?.pessoa_nova === false
            ? `${r.nome} ${t("já tinha cadastro na igreja e entrou no grupo.")}`
            : `${r?.nome || t("A pessoa")} ${t("entrou no grupo.")}`,
      );
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível cadastrar."));
    } finally { setAddSalvando(false); }
  }

  async function enviarAjuda() {
    setEnviandoAjuda(true);
    try {
      await pedirAjudaGrupo(grupoId, ajudaMsg.trim());
      setAjudaAberta(false); setAjudaMsg("");
      Alert.alert(t("Enviado"), t("A coordenação de Grupos recebeu seu pedido e vai falar com você."));
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível enviar."));
    } finally { setEnviandoAjuda(false); }
  }

  async function refrescar() {
    setRefrescando(true);
    try { await carregar(true); } finally { setRefrescando(false); }
  }

  function aceitar(p: GrupoPedido) {
    Alert.alert(t("Aceitar inscrição"), `${t("Aprovar")} ${p.nome}?`, [
      { text: t("Cancelar"), style: "cancel" },
      {
        text: t("Aceitar"),
        onPress: async () => {
          setProcessandoId(p.id);
          try {
            await aprovarPedidoGrupo(p.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await carregar(true); // atualiza roster + pendentes
          } catch (e: any) {
            Alert.alert(t("Erro"), e?.message || t("Não foi possível aprovar."));
          } finally { setProcessandoId(null); }
        },
      },
    ]);
  }
  async function confirmarRecusa() {
    const p = recusaAlvo;
    if (!p) return;
    setProcessandoId(p.id);
    try {
      await recusarPedidoGrupo(p.id, motivo.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setRecusaAlvo(null); setMotivo("");
      await carregar(true);
    } catch (e: any) {
      Alert.alert(t("Erro"), e?.message || t("Não foi possível recusar."));
    } finally { setProcessandoId(null); }
  }

  const grupo = data?.grupo;
  // ⚠️ A líder PRINCIPAL é `mem_grupos.lider_id`, NÃO quem tem `funcao='lider'`
  // no roster: função é cadastro (vários podem ter, e nenhum recebe mensagem por
  // isso). Só a principal recebe o WhatsApp do grupo e por isso é a única
  // protegida aqui — antes a tela escondia as ações de todos os líderes.
  const liderPrincipalId = grupo?.lider_id || null;
  const membros = data?.membros || [];
  // ⚠️ Só a CHAMADA filtra — a lista principal da tela continua inteira. E a
  // busca ignora acento: quem digita no meio do encontro escreve "joao", não
  // "João" (ver `lib/buscaTexto.ts`).
  const membrosFiltrados = useMemo(
    () => filtrarPorTexto(membros, buscaChamada, (m) => m.nome),
    [membros, buscaChamada],
  );
  const pendentes = data?.pendentes || [];
  const nome = grupo?.nome || params.nome || t("Grupo");
  const quandoTxt = quandoCurto(grupo?.dia_semana, grupo?.horario);
  const ondeTxt = grupo?.local || grupo?.bairro || "";
  const subBarra = [quandoTxt, ondeTxt].filter(Boolean).join("  ·  ");

  // ── ZONA 1 · quem é o herói ────────────────────────────────────────────
  // ⚠️ `encontros === null` = ainda carregando: o herói NÃO afirma atraso nesse
  // instante (afirmar "faltou registrar" sem ter lido os encontros seria mentir
  // com confiança). Enquanto isso, mostra o próximo encontro.
  const heroPronto = encontros !== null;
  // ⚠️⚠️ O herói bebe da AGENDA DO SERVIDOR quando ela chega: era ele que
  // continuava cobrando a chamada de um encontro que o líder já tinha
  // remarcado (relato do Marcos · 18/08). Duas contas para "quando é o
  // encontro" sempre divergem — esta tela passa a ter uma só.
  const proximoDaAgendaOc = agenda?.find((o) => o.status !== "cancelado") || null;
  const proximoDaAgenda = proximoDaAgendaOc?.data;
  const estado = estadoDoEncontro({
    diaSemana: grupo?.dia_semana,
    encontros: (encontros || []).map((e) => ({ data: e.data, presentes: e.presentes })),
    hoje: hojeBRT(),
    ultimaISO: agendaAnterior,
    proximaISO: proximoDaAgenda,
  });
  const semGente = membros.length === 0;

  // ── ZONA 2 · presença média (últimos 6 encontros ÷ roster ativo) ───────
  // Visitante faz `presentes` passar do nº de membros, então o teto é 100%.
  const ultimos = (encontros || []).slice(0, 6);
  const mediaPresentes = ultimos.length
    ? ultimos.reduce((s, e) => s + (e.presentes || 0), 0) / ultimos.length
    : null;
  const pctPresenca =
    mediaPresentes != null && membros.length
      ? Math.min(100, Math.round((mediaPresentes / membros.length) * 100))
      : null;

  async function convidar() {
    // ⚠️⚠️ LINK DO PRÓPRIO GRUPO (10/08/2026 · apontamento 2). O comentário que
    // estava aqui dizia que "a página não aceita parâmetro de grupo" — FALSO, e
    // conferido em produção: `?grupo=<id>` responde 200 e o ERP já usa isso no
    // popup do mapa. Comentário desatualizado é pior que ausente: impediu o
    // conserto por meses.
    // ⚠️ A régua (`lib/convite.ts`) decide, porque 9 dos 102 grupos ativos são
    // "por convite do líder" e o backend responde 403 a link neles — mandar o
    // link específico desses recusaria todo mundo.
    // ⚠️ E o TEXTO acompanha o link: com link direto, "é só entrar por aqui";
    // com link geral, a pessoa PRECISA saber que tem que achar o grupo na lista.
    const link = linkDeInscricao(grupo);
    const comoEntrar = precisaEscolherNaLista(grupo)
      ? t("Se inscreva aqui e escolha o nosso grupo na lista")
      : t("É só se inscrever por aqui");
    try {
      await Share.share({
        message: `${t("Vem pro nosso grupo de conexão")} "${nome}"${quandoTxt ? ` (${quandoTxt})` : ""}! ${comoEntrar}: ${link}`,
      });
    } catch { /* a pessoa cancelou o compartilhamento */ }
  }

  /** Herói: rótulo, cor, texto grande, legenda e a ação que CABE no estado. */
  function heroi() {
    if (!heroPronto || estado.tipo === "sem_dia") {
      return {
        variante: "normal" as const,
        icone: "time-outline" as const,
        rotulo: t("Encontro do grupo"),
        grande: quandoTxt || t("Sem dia definido"),
        legenda: heroPronto
          ? t("Registre quando o grupo se reunir")
          : t("Carregando os encontros…"),
        acao: semGente ? ("convidar" as const) : ("chamada" as const),
      };
    }
    if (estado.tipo === "atrasado") {
      return {
        variante: "atencao" as const,
        icone: "alert-circle-outline" as const,
        rotulo: t("Faltou registrar"),
        grande: dataLonga(estado.data),
        legenda: `${distanciaEmTexto(-estado.dias)} · ${t("sem isso a coordenação não vê a frequência")}`,
        acao: "chamada" as const,
      };
    }
    if (estado.tipo === "registrado") {
      const total = membros.length;
      return {
        variante: "feito" as const,
        icone: "checkmark-circle-outline" as const,
        rotulo: t("Encontro registrado"),
        grande:
          estado.presentes != null
            ? `${estado.presentes}${total ? ` ${t("de")} ${total}` : ""} ${estado.presentes === 1 ? t("presente") : t("presentes")}`
            : dataLonga(estado.data),
        legenda: `${dataLonga(estado.data)}${estado.proxima ? ` · ${t("próximo")}: ${dataLonga(estado.proxima)}` : ""}`,
        // ⚠️ Quando nada é preciso, nada grita: a ação vira secundária.
        acao: "ver" as const,
      };
    }
    return {
      variante: "normal" as const,
      icone: "time-outline" as const,
      rotulo: semGente ? t("Primeiro encontro") : t("Próximo encontro"),
      grande: dataLonga(estado.data),
      legenda: semGente
        ? `${quandoTxt ? quandoTxt.split(", ")[1] || "" : ""} ${t("· comece convidando as pessoas")}`.trim()
        : [quandoTxt.split(", ")[1], distanciaEmTexto(estado.dias)].filter(Boolean).join(" · "),
      acao: semGente ? ("convidar" as const) : ("chamada" as const),
    };
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── barra de cima: o nome vive AQUI (uma vez), com dia/local embaixo ── */}
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel()} hitSlop={12} style={styles.hIcone} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.hMeio}>
          <Text style={styles.hNome} numberOfLines={1}>{nome}</Text>
          {!!subBarra && <Text style={styles.hSub} numberOfLines={1}>{subBarra}</Text>}
        </View>
        {/* ⚠️ EDITAR fica no cabeçalho, não como aba: é a única ação que abre
            OUTRA tela (/grupo-editar, que já existia e trata endereço, dia,
            categoria e foto). Virar aba daria a impressão de que o formulário
            está aqui dentro. */}
        <Pressable
          onPress={() => router.navigate({ pathname: "/grupo-editar", params: { id: grupoId } } as never)}
          hitSlop={12}
          style={styles.hIcone}
          accessibilityRole="button"
          accessibilityLabel={t("Editar grupo")}
        >
          <Ionicons name="create-outline" size={23} color={colors.text} />
        </Pressable>
      </View>

      {data === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary}/>}
        >
          {erro && !grupo ? (
            <View style={[styles.center, { paddingTop: spacing.xl }]}>
              <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
              <Text style={styles.muted}>{erro}</Text>
            </View>
          ) : (
            <>
              {/* ═══════════ ZONA 1 · AÇÃO (o único protagonista) ═══════════ */}
              {(() => {
                const h = heroi();
                return (
                  <View style={[styles.hero, h.variante === "atencao" && styles.heroAtencao, h.variante === "feito" && styles.heroFeito]}>
                    <View style={styles.heroRotLinha}>
                      <View style={styles.heroRot}>
                        <Ionicons
                          name={h.icone}
                          size={14}
                          color={h.variante === "atencao" ? colors.warning : h.variante === "feito" ? colors.success : colors.brandMid}
                        />
                        <Text
                          style={[
                            styles.heroRotTxt,
                            h.variante === "atencao" && { color: colors.warning },
                            h.variante === "feito" && { color: colors.success },
                          ]}
                        >
                          {h.rotulo}
                        </Text>
                      </View>
                      {/* ⚠️ A agenda mora AQUI, no canto do herói (pedido do
                          Marcos · 18/08): o box separado embaixo REPETIA a data
                          que o herói já diz em corpo 28 — "deixa muita
                          informação". Ação secundária no canto, e a agenda da
                          temporada foi pra DENTRO do modal. */}
                      {proximoDaAgendaOc ? (
                        <Pressable
                          style={styles.heroAcao}
                          onPress={() => setAgendaAlvo(proximoDaAgendaOc)}
                          accessibilityRole="button"
                          hitSlop={8}
                        >
                          <Ionicons name="create-outline" size={15} color={colors.textMuted} />
                          <Text style={styles.heroAcaoTxt}>{t("Alterar data")}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <View>
                      <Text style={styles.heroGrande}>{h.grande}</Text>
                      {!!h.legenda && <Text style={styles.heroSub}>{h.legenda}</Text>}
                    </View>
                    {h.acao === "convidar" ? (
                      <Pressable style={[styles.heroBtn, styles.heroBtnCheio]} onPress={convidar} accessibilityRole="button">
                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                        <Text style={styles.heroBtnTxt}>{t("Convidar pelo WhatsApp")}</Text>
                      </Pressable>
                    ) : h.acao === "ver" ? (
                      <Pressable style={[styles.heroBtn, styles.heroBtnGhost]} onPress={() => setAba("frequencia")} accessibilityRole="button">
                        <Ionicons name="list-outline" size={18} color={colors.text} />
                        <Text style={[styles.heroBtnTxt, { color: colors.text }]}>{t("Ver os encontros")}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.heroBtn, h.variante === "atencao" ? styles.heroBtnAtencao : styles.heroBtnCheio]}
                        onPress={() => abrirChamada(null)}
                        disabled={semGente}
                        accessibilityRole="button"
                      >
                        <Ionicons name="checkmark-circle" size={18} color={h.variante === "atencao" ? "#22160A" : "#fff"} />
                        <Text style={[styles.heroBtnTxt, h.variante === "atencao" && { color: "#22160A" }]}>
                          {h.variante === "atencao" ? t("Registrar agora") : t("Registrar presença")}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })()}

              {/* ⚠️ O box da agenda MORREU (18/08): repetia a data que o
                  herói já mostra em corpo 28, com um dropdown embaixo — "deixa
                  muita informação". A ação foi pro canto do herói e a agenda da
                  temporada, pra dentro do modal.
                  ⚠️ Só o AVISO sobrevive, e como uma linha fina: erro de
                  carregamento não pode virar silêncio — "sem encontro marcado"
                  e "a consulta falhou" levam a decisões opostas. */}
              {agendaAviso ? (
                <Text style={styles.agendaAvisoLinha}>{agendaAviso}</Text>
              ) : null}

              {/* ═══════════ ZONA 2 · APOIO (era 3 × 25/800) ═══════════ */}
              <View style={styles.apoio}>
                <Text style={styles.apoioTxt} numberOfLines={1}>
                  {semGente ? (
                    t("Nenhum membro ainda")
                  ) : (
                    <>
                      <Text style={styles.apoioNum}>{membros.length}</Text>
                      {` ${membros.length === 1 ? t("membro") : t("membros")}`}
                      {pctPresenca != null && (
                        <>
                          {"   ·   "}
                          <Text style={styles.apoioNum}>{pctPresenca}%</Text>
                          {` ${t("de presença")}`}
                        </>
                      )}
                    </>
                  )}
                </Text>
                {pendentes.length > 0 && (
                  <Pressable style={styles.pastilha} onPress={() => setAba("pedidos")} accessibilityRole="button">
                    <Text style={styles.pastilhaTxt}>
                      {pendentes.length} {pendentes.length === 1 ? t("pedido") : t("pedidos")}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* ═══════════ ZONA 3 · DETALHE (26 dp de respiro acima) ═══════════ */}
              <View style={styles.zona3}>
                {/* abas silenciosas: trilho de 1 px + sublinhado de 2 px */}
                <View style={styles.abasRow}>
                  {ABAS.map((op) => {
                    const sel = aba === op.k;
                    const badge = op.k === "pedidos" ? pendentes.length : 0;
                    return (
                      <Pressable
                        key={op.k}
                        onPress={() => setAba(op.k)}
                        style={styles.abaBtn}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: sel }}
                      >
                        <View style={styles.abaConteudo}>
                          <Text style={[styles.abaTxt, sel && styles.abaTxtAtiva]} numberOfLines={1}>{t(op.label)}</Text>
                          {badge > 0 && <Text style={styles.abaBadgeTxt}>{badge}</Text>}
                        </View>
                        {sel && <View style={styles.abaMarca} />}
                      </Pressable>
                    );
                  })}
                </View>

                {/* ─── PEDIDOS ─── */}
                {aba === "pedidos" && (
                  pendentes.length === 0 ? (
                    <View style={styles.vazio}>
                      <Text style={styles.vazioTit}>{t("Nenhum pedido esperando")}</Text>
                      <Text style={styles.vazioTxt}>{t("Quando alguém se inscrever no seu grupo, aparece aqui e você recebe um WhatsApp.")}</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.secLabel}>{t("Esperando você")}</Text>
                      {pendentes.map((p) => {
                        const wa = waLink(p.telefone);
                        const proc = processandoId === p.id;
                        return (
                          <View key={p.id} style={styles.pedido}>
                            <View style={styles.pedidoTopo}>
                              <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{iniciais(p.nome)}</Text></View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.nome} numberOfLines={1}>{p.nome}</Text>
                                {p.telefone ? <Text style={styles.pequeno} numberOfLines={1}>{p.telefone}</Text> : p.email ? <Text style={styles.pequeno} numberOfLines={1}>{p.email}</Text> : null}
                              </View>
                              {wa ? (
                                <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${p.nome}`}>
                                  <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                                </Pressable>
                              ) : null}
                            </View>
                            {/* ⚠️ O fluxo certo é LIGAR antes de decidir (pedido do
                                Pr. Nélio, no template do WhatsApp) — e recusar aqui
                                DEVOLVE pra triagem, não avisa a pessoa. */}
                            <Text style={styles.pequeno}>{t("Ligue antes de decidir — recusar devolve pra coordenação realocar.")}</Text>
                            <View style={styles.acoes}>
                              <Pressable style={[styles.btn, styles.btnRecusar]} disabled={proc} onPress={() => { setRecusaAlvo(p); setMotivo(""); }} accessibilityRole="button">
                                <Ionicons name="close" size={18} color={colors.danger} />
                                <Text style={[styles.btnTxt, { color: colors.danger }]}>{t("Recusar")}</Text>
                              </Pressable>
                              <Pressable style={[styles.btn, styles.btnAceitar]} disabled={proc} onPress={() => aceitar(p)} accessibilityRole="button">
                                {proc ? <ActivityIndicator color="#fff" size="small" /> : (
                                  <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Aceitar")}</Text></>
                                )}
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )
                )}

                {/* ─── PESSOAS ─── */}
                {aba === "membros" && (
                  semGente ? (
                    <>
                      <View style={styles.vazio}>
                        <Text style={styles.vazioTit}>{t("Ninguém no grupo ainda")}</Text>
                        <Text style={styles.vazioTxt}>{t("Quem pedir para entrar aparece em Pedidos, e você recebe um WhatsApp.")}</Text>
                      </View>
                      {/* ⚠️⚠️ ITEM 6 (Pr. Nélio e Natasha · 25/08): *"abaixo da
                          última pessoa do grupo, colocar como se fosse mais uma
                          linha, na foto um botão de '+' e no nome escrito
                          Adicionar pessoa."* É de propósito uma LINHA DO ROSTER,
                          não um botão flutuante: o líder está olhando a lista e
                          percebendo quem falta nela. */}
                      <Pressable style={styles.linha} onPress={() => setAddAberto(true)} accessibilityRole="button">
                        <View style={[styles.avatarSm, styles.avatarAdd]}>
                          <Ionicons name="add" size={20} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.nome, { color: colors.primary }]}>{t("Adicionar pessoa")}</Text>
                          <Text style={styles.pequeno} numberOfLines={1}>{t("Entra no grupo na hora, sem esperar aprovação")}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </Pressable>
                      <Pressable style={styles.discreta} onPress={convidar} accessibilityRole="button">
                        <Ionicons name="person-add-outline" size={17} color={colors.textMuted} />
                        <Text style={styles.discretaTxt}>{t("Convidar alguém pelo WhatsApp")}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      {membros.map((m: GrupoMembro) => {
                        const wa = waLink(m.telefone);
                        const fLabel = m.funcao ? (FUNCAO[m.funcao] || null) : null;
                        const ehPrincipal = !!m.membro_id && !!liderPrincipalId && m.membro_id === liderPrincipalId;
                        const detalhe = [
                          ehPrincipal ? t("Recebe os avisos no WhatsApp") : fLabel ? t(fLabel) : null,
                          m.presencas != null ? `${m.presencas} ${m.presencas === 1 ? t("presença") : t("presenças")}` : null,
                        ].filter(Boolean).join(" · ");
                        return (
                          <View key={m.id} style={styles.linha}>
                            {/* avatar NEUTRO: 5 círculos teal eram 5 chamarizes —
                                o olho tem que ler NOMES, não bolinhas. */}
                            <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{iniciais(m.nome)}</Text></View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.nome} numberOfLines={1}>{m.nome}</Text>
                              {!!detalhe && <Text style={styles.pequeno} numberOfLines={1}>{detalhe}</Text>}
                              {/* Jornada · o pedido do Pr. Nélio (13/08/2026).
                                  Chips DISCRETOS de propósito: o comentário do
                                  avatar acima vale aqui também — o olho tem que
                                  ler NOMES. Cor só no texto, fundo neutro.
                                  ⚠️ Sem chip NÃO significa "não fez" — significa
                                  que o sistema não tem registro. Por isso a tela
                                  não escreve nada quando a lista está vazia. */}
                              {(() => {
                                const chaves = chavesVisiveis(m.marcadores);
                                if (!chaves.length) return null;
                                return (
                                  <View style={styles.marcLinha}>
                                    {chaves.map((c) => (
                                      <View key={c} style={styles.marcChip}>
                                        <Text style={[styles.marcTxt, { color: MARCADOR_INFO[c].cor }]}>
                                          {t(MARCADOR_INFO[c].curto)}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                );
                              })()}
                            </View>
                            {ehPrincipal && (
                              <View style={styles.papelBadge}><Text style={styles.papelTxt}>{t("Principal")}</Text></View>
                            )}
                            {wa ? (
                              <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${m.nome}`}>
                                <Ionicons name="logo-whatsapp" size={21} color="#25D366" />
                              </Pressable>
                            ) : null}
                            {/* ⚠️ Só a LÍDER PRINCIPAL não tem menu: mudar a função
                                ou registrar a saída dela mexeria em quem recebe o
                                WhatsApp do grupo, e isso é da coordenação. Os
                                outros líderes (cadastro) têm as ações normais. */}
                            {!ehPrincipal && (
                              <Pressable onPress={() => setAcaoAlvo(m)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("Opções de")} ${m.nome}`}>
                                {processandoId === m.id
                                  ? <ActivityIndicator size="small" color={colors.primary} />
                                  : <Ionicons name="ellipsis-vertical" size={19} color={colors.textMuted} />}
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                      {/* ⚠️⚠️ ITEM 6 (Pr. Nélio e Natasha · 25/08): *"abaixo da
                          última pessoa do grupo, colocar como se fosse mais uma
                          linha, na foto um botão de '+' e no nome escrito
                          Adicionar pessoa."* É de propósito uma LINHA DO ROSTER,
                          não um botão flutuante: o líder está olhando a lista e
                          percebendo quem falta nela. */}
                      <Pressable style={styles.linha} onPress={() => setAddAberto(true)} accessibilityRole="button">
                        <View style={[styles.avatarSm, styles.avatarAdd]}>
                          <Ionicons name="add" size={20} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.nome, { color: colors.primary }]}>{t("Adicionar pessoa")}</Text>
                          <Text style={styles.pequeno} numberOfLines={1}>{t("Entra no grupo na hora, sem esperar aprovação")}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </Pressable>
                      <Pressable style={styles.discreta} onPress={convidar} accessibilityRole="button">
                        <Ionicons name="person-add-outline" size={17} color={colors.textMuted} />
                        <Text style={styles.discretaTxt}>{t("Convidar alguém pelo WhatsApp")}</Text>
                      </Pressable>
                    </>
                  )
                )}

                {/* ─── ENCONTROS ─── */}
                {/* ⚠️⚠️ ITEM 3 do Marcos (25/08): *"vale a pena sempre manter os
                    encontros à vista: se a pessoa passar 1 semana e não
                    registrar, ele entra automaticamente como presença não
                    registrada e pode ser registrada posteriormente se o líder
                    quiser."*

                    O que a aba mostrava antes: SÓ os encontros registrados. A
                    semana que ninguém preencheu simplesmente não existia na
                    tela — então registrar "a de trás" só dava pelo botão do
                    herói, que grava HOJE. Era daí que vinha a chamada do dia 18
                    nascendo no dia 24.

                    ⚠️ `ocorrencias === null` = o servidor não mandou a timeline
                    (backend antigo, ou a agenda falhou). Aí a aba cai na LISTA
                    CRUA, que é o comportamento de antes — nunca afirma que não
                    houve encontro. */}
                {aba === "frequencia" && (
                  <>
                    {encontros === null ? (
                      <View style={{ paddingVertical: spacing.lg }}><ActivityIndicator color={colors.primary} /></View>
                    ) : ocorrencias ? (
                      ocorrencias.length === 0 ? (
                        <View style={styles.vazio}>
                          <Text style={styles.vazioTit}>{t("Nenhum encontro ainda")}</Text>
                          <Text style={styles.vazioTxt}>{t("Quando o grupo se reunir, registre a presença aqui.")}</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.secLabel}>{t("Encontros")}</Text>
                          {ocorrencias.map((o) => {
                            const [ano, mes, dia] = String(o.data).split("-");
                            const pendente = o.status === "nao_registrado";
                            const cancelado = o.status === "cancelado";
                            return (
                              <Pressable
                                key={`${o.data}_${o.encontro_id || o.data_original}`}
                                style={[styles.evento, pendente && styles.eventoPendente]}
                                // ⚠️ Avulso NÃO abre o modal: ele não vem da
                                // recorrência, então não existe `data_original`
                                // pra escrever exceção — o POST recusaria.
                                onPress={o.avulso ? undefined : () => setOcorrenciaAlvo(o)}
                                accessibilityRole={o.avulso ? undefined : "button"}
                                accessibilityLabel={o.avulso ? undefined : `${t("Gerenciar o encontro de")} ${o.data.split("-").reverse().join("/")}`}>
                                <View style={[styles.eventoData, pendente && styles.eventoDataPendente]}>
                                  <Text style={[styles.eventoDia, pendente && styles.eventoDiaPendente]}>{dia}</Text>
                                  <Text style={[styles.eventoMes, pendente && styles.eventoDiaPendente]}>
                                    {MESES_CURTOS[Number(mes) - 1] || mes}
                                  </Text>
                                </View>
                                <View style={{ flex: 1, gap: 3 }}>
                                  {cancelado ? (
                                    <>
                                      {/* ⚠️ Cancelado NÃO é pendência: o líder decidiu
                                          que não haveria encontro. Cobrar chamada dele
                                          seria cobrar uma reunião que não houve. */}
                                      <Text style={styles.eventoCancelado}>{t("Encontro cancelado")}</Text>
                                      {!!o.motivo && <Text style={styles.eventoObs}>{o.motivo}</Text>}
                                    </>
                                  ) : pendente ? (
                                    <>
                                      <Text style={styles.eventoPendenteTxt}>{t("Presença não registrada")}</Text>
                                      {/* ⚠️⚠️ A data ESTIMADA é DITA na linha, não
                                          só dentro do modal: em grupo quinzenal/
                                          mensal sem encontro registrado ela foi
                                          calculada pelo início da temporada, e
                                          apresentá-la como fato seria afirmar o
                                          que não se sabe. */}
                                      <Text style={styles.pequeno}>
                                        {o.data_estimada
                                          ? t("Data estimada — toque para corrigir ou registrar")
                                          : t("Toque para registrar ou marcar que não aconteceu")}
                                      </Text>
                                    </>
                                  ) : (
                                    <>
                                      <Text style={styles.eventoPres}>
                                        <Text style={styles.eventoPresN}>{o.presentes ?? 0}</Text>
                                        {membros.length ? ` ${t("de")} ${membros.length}` : ""}
                                        {` ${o.presentes === 1 ? t("presente") : t("presentes")}`}
                                      </Text>
                                      {!!o.tema && <Text style={styles.eventoTema}>{o.tema}</Text>}
                                      {!!o.observacoes && <Text style={styles.eventoObs}>{o.observacoes}</Text>}
                                      {!!o.registrado_por_nome && <Text style={styles.pequeno}>{t("por")} {o.registrado_por_nome}</Text>}
                                      {/* ⚠️ Chamada gravada FORA da recorrência
                                          aparece marcada — inclusive as que nasceram
                                          com a data errada antes deste conserto.
                                          Esconder faria o trabalho do líder desaparecer
                                          da tela, que é pior que o defeito original. */}
                                      {o.avulso && <Text style={styles.pequeno}>{t("fora do dia habitual do grupo")}</Text>}
                                    </>
                                  )}
                                </View>
                                {pendente ? (
                                  <Pressable
                                    style={styles.registrarBtn}
                                    onPress={() => abrirChamada(o.data)}
                                    disabled={semGente}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${t("Registrar presença de")} ${dia}/${mes}`}>
                                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                                    <Text style={styles.registrarBtnTxt}>{t("Registrar")}</Text>
                                  </Pressable>
                                ) : o.avulso ? null : (
                                  /* ⚠️ Afordância ESCRITA, não só um chevron: a
                                     lição de 18/08 é que "nem quem pediu achou"
                                     um lápis cinza de 18px sozinho. */
                                  <View style={styles.gerenciarDica}>
                                    <Text style={styles.gerenciarDicaTxt}>{t("Gerenciar")}</Text>
                                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                                  </View>
                                )}
                              </Pressable>
                            );
                          })}
                        </>
                      )
                    ) : encontros.length === 0 ? (
                      <View style={styles.vazio}>
                        <Text style={styles.vazioTit}>{t("Nenhum encontro registrado")}</Text>
                        <Text style={styles.vazioTxt}>{t("Ao registrar, a coordenação passa a ver a frequência do grupo.")}</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.secLabel}>{t("Últimos encontros")}</Text>
                        {encontros.map((e) => {
                          const [ano, mes, dia] = String(e.data).split("-");
                          return (
                            <View key={e.id} style={styles.evento}>
                              <View style={styles.eventoData}>
                                <Text style={styles.eventoDia}>{dia}</Text>
                                <Text style={styles.eventoMes}>{MESES_CURTOS[Number(mes) - 1] || mes}</Text>
                              </View>
                              <View style={{ flex: 1, gap: 3 }}>
                                <Text style={styles.eventoPres}>
                                  <Text style={styles.eventoPresN}>{e.presentes}</Text>
                                  {membros.length ? ` ${t("de")} ${membros.length}` : ""}
                                  {` ${e.presentes === 1 ? t("presente") : t("presentes")}`}
                                </Text>
                                {!!e.tema && <Text style={styles.eventoTema}>{e.tema}</Text>}
                                {!!e.observacoes && <Text style={styles.eventoObs}>{e.observacoes}</Text>}
                                {!!e.registrado_por_nome && <Text style={styles.pequeno}>{t("por")} {e.registrado_por_nome}</Text>}
                              </View>
                            </View>
                          );
                        })}
                      </>
                    )}
                    {/* ⚠️ Erro NUNCA vira silêncio: "não consegui montar a agenda"
                        e "não houve encontro" levam a decisões opostas. */}
                    {!!ocorrenciasAviso && (
                      <Text style={styles.agendaAvisoLinha}>{ocorrenciasAviso}</Text>
                    )}
                    {/* ⚠️ "Preciso de ajuda" é ação RARA: linha discreta no rodapé,
                        não card do tamanho do botão principal. Card com seta do
                        mesmo peso é o que faz tudo parecer igualmente importante. */}
                    <Pressable style={styles.discreta} onPress={() => { setAjudaMsg(""); setAjudaAberta(true); }} accessibilityRole="button">
                      <Ionicons name="help-buoy-outline" size={17} color={colors.textMuted} />
                      <Text style={[styles.discretaTxt, { flex: 1 }]}>{t("Preciso de ajuda com o grupo")}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  </>
                )}

                {/* ─── ESTUDOS ─── */}
                {aba === "estudos" && (
                  materiais === null ? (
                    <View style={{ paddingVertical: spacing.lg }}><ActivityIndicator color={colors.primary} /></View>
                  ) : materiais.length === 0 ? (
                    <View style={styles.vazio}>
                      <Text style={styles.vazioTit}>{t("Nenhum estudo publicado")}</Text>
                      <Text style={styles.vazioTxt}>{t("A coordenação publica os materiais no sistema e eles aparecem aqui.")}</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.secLabel}>{t("Material do grupo")}</Text>
                      {materiais.map((mt) => (
                        <Pressable
                          key={mt.id}
                          style={styles.linha}
                          disabled={!mt.url}
                          onPress={() => mt.url && Linking.openURL(mt.url)}
                          accessibilityRole="button"
                        >
                          <View style={styles.avatarDoc}>
                            <Ionicons name={mt.estudo_semana ? "bookmark" : "document-text-outline"} size={18} color={colors.textMuted} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.nome} numberOfLines={2}>{mt.nome}</Text>
                            {(mt.etiquetas || []).length > 0 && (
                              <Text style={styles.pequeno} numberOfLines={1}>{(mt.etiquetas || []).join(", ")}</Text>
                            )}
                          </View>
                          {mt.estudo_semana && (
                            <View style={styles.papelBadge}><Text style={styles.papelTxt}>{t("Da semana")}</Text></View>
                          )}
                          {mt.url ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
                        </Pressable>
                      ))}
                    </>
                  )
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ═══ Ações do participante (função · transferir · saída) ═══ */}
      <Modal visible={!!acaoAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAcaoAlvo(null)}>
        <Pressable style={styles.modalWrap} onPress={() => setAcaoAlvo(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: fundoSeguro }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{acaoAlvo?.nome}</Text>
              <Pressable onPress={() => setAcaoAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.sheetLabel}>{t("Função no grupo")}</Text>
            {([
              { v: "frequentador" as FuncaoApp, l: "Frequentador", i: "person-outline" as const },
              // ⚠️⚠️ "Líder em treinamento" agora GERENCIA o grupo (Marcos ·
              // 25/08). O rótulo diz isso na linha abaixo, senão o líder não tem
              // como saber que está dando acesso de gestão.
              { v: "lider_treinamento" as FuncaoApp, l: "Líder em treinamento", i: "school-outline" as const },
              // ⚠️ "Co-líder" SAIU: o termo foi aposentado e o banco recusa o
              // valor. NÃO reintroduzir.
              // ⚠️ "Líder" aqui é CADASTRO (podem ser vários) — quem recebe as
              // mensagens do grupo é só a líder PRINCIPAL (`mem_grupos.lider_id`),
              // e ela nem aparece com este menu. Marcar alguém como líder aqui
              // NÃO faz o WhatsApp do grupo passar a ir pra essa pessoa.
              { v: "lider" as FuncaoApp, l: "Líder (cadastro)", i: "star-outline" as const },
            ]).map((op) => {
              // ⚠️ `co_lider`/`colider` de dado histórico acendem a linha de
              // "líder em treinamento": é nela que a pessoa está agora.
              const atual = acaoAlvo?.funcao === op.v
                || (op.v === "lider_treinamento"
                  && (acaoAlvo?.funcao === "co_lider" || acaoAlvo?.funcao === "colider"));
              return (
                <Pressable key={op.v} style={styles.acaoItem} disabled={atual} onPress={() => acaoAlvo && aplicarFuncao(acaoAlvo, op.v)} accessibilityRole="button">
                  <Ionicons name={op.i} size={20} color={atual ? colors.primary : colors.text} />
                  <Text style={[styles.acaoTxt, atual && { color: colors.primary }]}>{t(op.l)}</Text>
                  {atual && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
            {/* ⚠️ A distinção que o Marcos pediu (05/08): marcar líder aqui é
                CADASTRO — a mensagem do grupo continua indo só pra principal. */}
            <Text style={styles.pequeno}>
              {t("Líder e líder em treinamento podem gerenciar este grupo. As mensagens do grupo no WhatsApp continuam indo só pra líder principal — trocar quem é a principal é com a coordenação.")}
            </Text>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />

            <Pressable style={styles.acaoItem} onPress={() => { const m = acaoAlvo; setAcaoAlvo(null); setTransfMotivo(""); setTransferirAlvo(m); }} accessibilityRole="button">
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.text} />
              <Text style={styles.acaoTxt}>{t("Solicitar transferência")}</Text>
            </Pressable>
            {/* ⚠️ ITEM 4: era "Registrar saída do grupo". O nome novo é o do
                Marcos, e diz o que a ação FAZ da perspectiva de quem clica. */}
            <Pressable style={styles.acaoItem} onPress={() => { const m = acaoAlvo; setAcaoAlvo(null); setSaidaMotivo(""); setSaidaAlvo(m); }} accessibilityRole="button">
              <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
              <Text style={[styles.acaoTxt, styles.acaoTxtPerigo]}>{t("Remover do grupo")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ Saída ═══ */}
      <Modal visible={!!saidaAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setSaidaAlvo(null)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoSeguro }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Remover do grupo")}</Text>
              <Pressable onPress={() => setSaidaAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {saidaAlvo && <Text style={[styles.muted, { marginBottom: spacing.xs }]}>{t("Remover")} {saidaAlvo.nome} {t("deste grupo?")}</Text>}
            {/* Saída é reversível e não apaga ninguém — a pessoa continua no
                sistema e pode entrar de novo (mesma régua do "confira a lista"). */}
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
              {t("A pessoa continua cadastrada e pode voltar depois. Ela não recebe aviso automático.")}
            </Text>
            <Text style={styles.sheetLabel}>{t("Motivo (opcional)")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex.: mudou de bairro, entrou em outro grupo…")}
              placeholderTextColor={colors.textMuted}
              value={saidaMotivo}
              onChangeText={setSaidaMotivo}
              multiline
            />
            <Pressable style={[styles.btn, styles.btnRecusarSolido, { marginTop: spacing.md }]} disabled={!!processandoId} onPress={confirmarSaida} accessibilityRole="button">
              {processandoId ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Remover do grupo")}</Text>}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

      {/* ═══ Gerenciar um encontro que JÁ PASSOU (25/08) ═══ */}
      {/* ⚠️⚠️ É o MESMO modal do box "Próximo encontro", em `modo="passado"`.
          As duas telas escrevem no MESMO endpoint (`/agenda`) e a única
          diferença é a janela de datas e o vocabulário — duas telas divergiriam
          no primeiro ajuste, e a divergência apareceria como "no futuro deu, no
          passado não". */}
      <ModalAgendaEncontro
        visivel={!!ocorrenciaAlvo}
        modo="passado"
        grupoId={grupoId}
        grupoNome={nome}
        /* ⚠️⚠️ MAPEAMENTO EXPLÍCITO, nunca `as any`: os dois vocabulários de
           `status` são DIFERENTES (aqui é "a chamada foi feita?"; no modal é "há
           exceção de agenda?"). O cast compilava e escondia o efeito real — o
           modal nunca veria `remarcado` e o botão de DESFAZER a correção não
           apareceria. */
        ocorrencia={ocorrenciaAlvo ? {
          data_original: ocorrenciaAlvo.data_original,
          data: ocorrenciaAlvo.data,
          horario: ocorrenciaAlvo.horario || "",
          status: ocorrenciaAlvo.cancelado
            ? "cancelado"
            : ocorrenciaAlvo.remarcado ? "remarcado" : "normal",
          motivo: ocorrenciaAlvo.motivo,
          data_estimada: ocorrenciaAlvo.data_estimada,
          registrado: ocorrenciaAlvo.registrado,
          pode_corrigir: ocorrenciaAlvo.pode_corrigir,
          corrigir_de: ocorrenciaAlvo.corrigir_de,
          corrigir_ate: ocorrenciaAlvo.corrigir_ate,
        } : null}
        onFechar={() => setOcorrenciaAlvo(null)}
        onRegistrarPresenca={(dataISO) => { setOcorrenciaAlvo(null); abrirChamada(dataISO); }}
        onSalvo={() => {
          setOcorrenciaAlvo(null);
          // ⚠️ Recarrega a timeline E o histórico: corrigir a data move a
          // chamada junto no servidor, então os dois mudaram.
          setEncontros(null);
          setOcorrencias(null);
          setAgenda(null);
        }}
      />

      {/* ═══ Adicionar pessoa · item 6 (25/08) ═══ */}
      {/* ⚠️⚠️ ELA NASCE APROVADA: sem pedido, sem WhatsApp, sem confirmação
          (*"se for criado ali, ela não passa por whatsapp e confirmação
          nenhuma"*). Quem decide é o líder, com a pessoa na frente dele.
          ⚠️ Obrigatórios só NOME e CELULAR. O resto é opcional de propósito:
          quem preenche está no meio de um encontro, no celular, POR OUTRA
          PESSOA — exigir 6 campos faz o líder não usar a tela, e aí a pessoa
          não entra em lugar nenhum. Cadastro incompleto aparece na fila de
          "faltam dados" da coordenação, que existe justamente pra isso.
          ⚠️ Folha ALTA + TecladoSeguro: são 5 campos e o teclado cobriria os
          últimos (mesma lição do campo de motivo da agenda, 18/08). */}
      <Modal visible={addAberto} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAddAberto(false)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, styles.sheetAlta, { paddingBottom: fundoSeguro }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Adicionar pessoa")}</Text>
              <Pressable onPress={() => setAddAberto(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ flex: 1 }}>
              <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
                {t("A pessoa entra no grupo na hora. Ela não recebe mensagem nem precisa confirmar.")}
              </Text>

              <Text style={styles.sheetLabel}>{t("Nome completo")} *</Text>
              {/* ⚠️ Nome COMPLETO e SEM ABREVIAÇÃO é exigência do Contrato de
                  Inscrição (28/07) e o servidor recusa "Ana P." — por isso o
                  placeholder pede os dois nomes em vez de só "Nome". */}
              <TextInput
                style={styles.inputLinha}
                placeholder={t("Nome e sobrenome, sem abreviar")}
                placeholderTextColor={colors.textMuted}
                value={addNome}
                onChangeText={setAddNome}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <Text style={styles.sheetLabel}>{t("Celular com DDD")} *</Text>
              <TextInput
                style={styles.inputLinha}
                placeholder="(21) 99999-9999"
                placeholderTextColor={colors.textMuted}
                value={addTel}
                onChangeText={(v) => setAddTel(mascararTelefoneBR(v))}
                keyboardType="phone-pad"
              />

              <Text style={styles.sheetLabel}>{t("E-mail")} *</Text>
              <TextInput
                style={styles.inputLinha}
                placeholder="email@exemplo.com"
                placeholderTextColor={colors.textMuted}
                value={addEmail}
                onChangeText={setAddEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.sheetLabel}>{t("CPF")} *</Text>
              {/* ⚠️ O CPF é a chave FORTE do matcher: é ele que faz o cadastro
                  novo LIGAR na pessoa que já está na base em vez de duplicar. É
                  por isso que ele é obrigatório aqui, e não enfeite. */}
              <TextInput
                style={styles.inputLinha}
                placeholder="000.000.000-00"
                placeholderTextColor={colors.textMuted}
                value={addCpf}
                onChangeText={(v) => setAddCpf(mascararCpf(v))}
                keyboardType="number-pad"
                maxLength={14}
              />

              <Text style={styles.sheetLabel}>{t("Data de nascimento")} *</Text>
              <TextInput
                style={styles.inputLinha}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={addNasc}
                onChangeText={setAddNasc}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoCorrect={false}
              />

              {/* ⚠️ Sexo em branco fica em branco — NUNCA chutado pelo nome (a
                  lei de 10/08 proíbe gravar sexo por palpite, e é ele que decide
                  em qual grupo a pessoa pode entrar). E só masculino/feminino:
                  é o vocabulário da coluna (Contrato de Inscrição · 28/07). */}
              <Text style={styles.sheetLabel}>{t("Sexo")} *</Text>
              <View style={styles.chips}>
                {([["masculino", "Masculino"], ["feminino", "Feminino"]] as const).map(([v, l]) => (
                  <Pressable
                    key={v}
                    style={[styles.chip, addSexo === v && styles.chipAtivo]}
                    onPress={() => setAddSexo(addSexo === v ? "" : v)}
                    accessibilityRole="button">
                    <Text style={[styles.chipTxt, addSexo === v && styles.chipTxtAtivo]}>{t(l)}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sheetLabel}>{t("Endereço (opcional)")}</Text>
              <TextInput
                style={styles.inputLinha}
                placeholder={t("Rua, número, bairro")}
                placeholderTextColor={colors.textMuted}
                value={addEndereco}
                onChangeText={setAddEndereco}
                autoCapitalize="words"
              />

              {/* ⚠️⚠️ LGPD · VOCÊ ESTÁ DECLARANDO POR OUTRA PESSOA, e o texto diz
                  isso. No formulário público quem marca a caixa é a própria
                  pessoa; aqui é o líder. O servidor grava o consentimento com o
                  prefixo "DECLARADO PRESENCIALMENTE POR <líder>" — gravar como
                  aceite do titular seria fabricar prova legal (mesma decisão do
                  link do voluntário · 14/08). */}
              <Pressable
                style={[styles.chip, styles.chipLargo, addTermos && styles.chipAtivo]}
                onPress={() => setAddTermos(v => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: addTermos }}>
                <Ionicons
                  name={addTermos ? "checkbox" : "square-outline"}
                  size={18}
                  color={addTermos ? colors.primary : colors.textMuted} />
                <Text style={[styles.chipTxt, styles.chipTxtQuebra, addTermos && styles.chipTxtAtivo]}>
                  {t("Confirmo que a pessoa está aqui comigo e autorizou o cadastro dos dados dela na igreja (LGPD)")} *
                </Text>
              </Pressable>

              <Pressable
                style={[styles.chip, styles.chipLargo, addOptin && styles.chipAtivo]}
                onPress={() => setAddOptin(v => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: addOptin }}>
                <Ionicons
                  name={addOptin ? "checkbox" : "square-outline"}
                  size={18}
                  color={addOptin ? colors.primary : colors.textMuted} />
                <Text style={[styles.chipTxt, styles.chipTxtQuebra, addOptin && styles.chipTxtAtivo]}>
                  {t("Ela autorizou receber mensagens da igreja no WhatsApp")}
                </Text>
              </Pressable>

              {/* ⚠️ Adicionar alguém DE PROPÓSITO é participação, não visita — daí
                  o default. `visitante` só quando o líder DECLARA (lei de 14/08:
                  "quem o líder realmente identifica como visitante, deve ser
                  visitante"). */}
              <Pressable
                style={[styles.chip, styles.chipLargo, addVisitante && styles.chipAtivo]}
                onPress={() => setAddVisitante(v => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: addVisitante }}>
                <Ionicons
                  name={addVisitante ? "checkbox" : "square-outline"}
                  size={18}
                  color={addVisitante ? colors.primary : colors.textMuted} />
                <Text style={[styles.chipTxt, addVisitante && styles.chipTxtAtivo]}>
                  {t("É visitante (veio conhecer)")}
                </Text>
              </Pressable>
            </ScrollView>
            <Pressable
              style={[styles.btn, styles.btnAceitar, { marginTop: spacing.sm, flexGrow: 0 }]}
              disabled={addSalvando || !addPodeEnviar}
              onPress={salvarPessoaNova}
              accessibilityRole="button">
              {addSalvando
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Adicionar ao grupo")}</Text>}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

      {/* ═══ Transferência · SOLICITAÇÃO, sem destino (item 5 · 25/08) ═══ */}
      {/* ⚠️⚠️ A lista de grupos MORREU aqui. Antes o líder escolhia entre os
          grupos que ELE gerencia — e o destino certo raramente é um deles (é o
          que estiver mais perto da pessoa, na categoria dela). Quem enxerga a
          malha inteira é a coordenação, e é ela que decide agora. */}
      <Modal visible={!!transferirAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setTransferirAlvo(null)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoSeguro }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Solicitar transferência")}</Text>
              <Pressable onPress={() => setTransferirAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
              {transferirAlvo?.nome} {t("vai para a fila da coordenação, que escolhe o grupo novo. Ela continua no seu grupo até isso ser resolvido.")}
            </Text>
            {/* ⚠️ O motivo é OPCIONAL, mas é o insumo principal de quem vai
                decidir o destino — daí o exemplo no placeholder em vez de um
                rótulo genérico. */}
            <Text style={styles.sheetLabel}>{t("Por quê? (opcional, ajuda a escolher o grupo)")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex.: mudou pra Barra, o horário não dá mais, quer um grupo de casais…")}
              placeholderTextColor={colors.textMuted}
              value={transfMotivo}
              onChangeText={setTransfMotivo}
              multiline
            />
            <Pressable style={[styles.btn, styles.btnAceitar, { marginTop: spacing.md, flexGrow: 0 }]} disabled={!!processandoId} onPress={confirmarTransferencia} accessibilityRole="button">
              {processandoId ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Solicitar transferência")}</Text>}
            </Pressable>
            <Text style={[styles.pequeno, { marginTop: spacing.xs }]}>
              {t("Ninguém recebe mensagem automática — a coordenação fala com a pessoa.")}
            </Text>
          </View>
        </TecladoSeguro>
      </Modal>

      {/* ═══ Chamada (frequência) ═══ */}
      {/* ⚠️⚠️ FECHAR PERGUNTA QUANDO HÁ TRABALHO A PERDER (10/08 · item 15).
          O Marcos descreveu como "ao clicar fora ele apenas sai" — a causa real
          é o BOTÃO VOLTAR do Android (`onRequestClose`), porque estes modais não
          fecham por toque no backdrop. O efeito é o mesmo: a chamada inteira
          some com um toque errado. */}
      <Modal visible={chamadaAberta} animationType="slide" transparent statusBarTranslucent onRequestClose={fecharChamada}>
        <TecladoSeguro style={styles.modalWrap}>
          {/* ⚠️⚠️ ALTURA DA CHAMADA (10/08/2026 · apontamento 1). O Marcos:
              *"é muito ruim esse modal de subir e descer pra encontrar as
              pessoas, pode fazer todas as pessoas aparecerem na tela e fica
              maior."*
              MEDIDO (1.433 vínculos ativos, 93 grupos com roster): mediana 9,
              p75 15, p90 23, **máximo 57**. Com a janela de 320px cabiam ~8
              nomes ⇒ só **47% dos grupos** cabiam sem rolar. Com a folha
              inteira, **87%**.
              ⚠️ Pros 13% restantes altura NÃO basta — daí a busca abaixo.
              ⚠️ `flex: 1` em vez de outro número fixo: `applyFontScale`
              multiplica o tamanho do texto no boot, então qualquer teto em
              pixels cabe menos nomes com fonte grande e o defeito volta. */}
          <View style={[styles.sheet, styles.sheetAlta, { paddingBottom: fundoSeguro }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Frequência de hoje")}</Text>
              <Pressable onPress={fecharChamada} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {/* ⚠️ A busca só aparece em roster grande: em grupo de 7 pessoas
                ela seria um campo a mais pra ignorar, e ainda roubaria altura da
                lista — que é justamente o que estamos devolvendo. O corte em 12
                fica entre a mediana (9) e o p75 (15). */}
            {membros.length > 12 && (
              <TextInput
                style={styles.input}
                placeholder={t("Buscar pessoa…")}
                placeholderTextColor={colors.textMuted}
                value={buscaChamada}
                onChangeText={setBuscaChamada}
                autoCorrect={false}
              />
            )}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              style={{ flex: 1 }}>
              {/* Todos começam MARCADOS — o líder desmarca quem faltou (bem menos
                  toque do que marcar 12 pessoas). */}
              {membrosFiltrados.length === 0 && (
                <Text style={styles.chamadaVazio}>{t("Ninguém com esse nome no grupo.")}</Text>
              )}
              {membrosFiltrados.map((m) => {
                const mid = m.membro_id;
                if (!mid) return null;
                const on = presentes.has(mid);
                return (
                  <Pressable
                    key={m.id}
                    style={styles.chamadaLinha}
                    onPress={() => setPresentes((s) => { const n = new Set(s); if (on) n.delete(mid); else n.add(mid); return n; })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? colors.primary : colors.textMuted} />
                    <Text style={styles.chamadaNome} numberOfLines={1}>{m.nome}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {/* ⚠️ Fora do ScrollView de propósito: tema, comentário e Salvar
                ficam ANCORADOS. Com 57 nomes, deixá-los rolar junto tiraria o
                botão de salvar da tela — a pessoa marcaria a chamada inteira e
                não acharia como gravar. */}
            <Text style={styles.sheetLabel}>{t("Tema do encontro (opcional)")}</Text>
            <TextInput style={styles.input} placeholder={t("Ex.: Estudo 3 — Perdão")} placeholderTextColor={colors.textMuted} value={tema} onChangeText={setTema} />
            <Text style={styles.sheetLabel}>{t("Comentário do líder (opcional)")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Como foi o encontro? Algo que a coordenação precisa saber?")}
              placeholderTextColor={colors.textMuted}
              value={comentario}
              onChangeText={setComentario}
              multiline
            />
            {/* ⚠️⚠️ `flexGrow: 0` NÃO É ENFEITE (regressão de 10/08, achada pelo
                Marcos: "o botão de registrar presentes ficou gigantesco").
                `styles.btn` tem `flex: 1` porque foi desenhado pra DOIS botões
                lado a lado (aceitar/recusar) dividindo a largura. Enquanto a
                folha tinha altura de conteúdo, esse `flex: 1` era inofensivo.
                Quando a folha virou `flex: 1` pra a lista crescer, o botão
                passou a absorver TODA a sobra vertical. */}
            <Pressable style={[styles.btn, styles.btnAceitar, { marginTop: spacing.md, flexGrow: 0 }]} disabled={salvandoChamada} onPress={salvarChamada} accessibilityRole="button">
              {salvandoChamada ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={[styles.btnTxt, { color: "#fff" }]}>
                  {t("Salvar")} · {presentes.size} {presentes.size === 1 ? t("presente") : t("presentes")}
                </Text>
              )}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

      {/* ═══ Pedir ajuda ═══ */}
      <Modal visible={ajudaAberta} animationType="slide" transparent statusBarTranslucent onRequestClose={fecharAjuda}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoSeguro }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Preciso de ajuda")}</Text>
              <Pressable onPress={fecharAjuda} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
              {t("A coordenação de Grupos recebe seu pedido com o nome do grupo e fala com você.")}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex.: preciso de apoio com uma situação no grupo…")}
              placeholderTextColor={colors.textMuted}
              value={ajudaMsg}
              onChangeText={setAjudaMsg}
              multiline
            />
            <Pressable style={[styles.btn, styles.btnAceitar, { marginTop: spacing.md }]} disabled={enviandoAjuda || ajudaMsg.trim().length < 5} onPress={enviarAjuda} accessibilityRole="button">
              {enviandoAjuda ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Enviar pedido")}</Text>}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

      <ModalAgendaEncontro
        visivel={!!agendaAlvo}
        grupoId={grupoId}
        grupoNome={data?.grupo?.nome || String(params.nome || "")}
        ocorrencia={agendaAlvo}
        ocorrencias={agenda || []}
        onFechar={() => setAgendaAlvo(null)}
        onSalvo={() => {
          setAgendaAlvo(null);
          // recarrega a agenda INTEIRA: uma exceção muda a lista e o herói
          setAgenda(null);
          setAgendaAnterior(undefined);
        }}
      />

    </SafeAreaView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: 40 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
    muted: { color: c.textMuted, fontSize: font.size.md, textAlign: "center" },
    pequeno: { color: c.textMuted, fontSize: 12.5 },

    // ── barra de cima · 2 linhas: o nome do grupo aparece UMA vez no app ───
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs, paddingTop: 2, paddingBottom: spacing.md },
    hIcone: { width: 40, alignItems: "center", justifyContent: "center" },
    hMeio: { flex: 1, alignItems: "center", gap: 1, paddingHorizontal: 2 },
    hNome: { color: c.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
    hSub: { color: c.textMuted, fontSize: 11.5 },

    // ═══ ZONA 1 · o ÚNICO bloco com moldura e o único 27/800 da tela ══════
    hero: {
      backgroundColor: c.primary + "22",
      borderWidth: 1, borderColor: c.brandMid + "5C",
      borderRadius: 22, padding: spacing.md, gap: 13,
    },
    heroAtencao: { backgroundColor: c.warning + "22", borderColor: c.warning + "70" },
    heroFeito: { backgroundColor: c.success + "1F", borderColor: c.success + "66" },
    heroRot: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroRotTxt: { color: c.brandMid, fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1 },
    heroGrande: { color: c.text, fontSize: 27, fontWeight: "800", letterSpacing: -0.7, lineHeight: 31 },
    heroSub: { color: c.textMuted, fontSize: 13.5, marginTop: 3 },
    heroBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      minHeight: 48, borderRadius: 14, paddingHorizontal: spacing.md,
    },
    heroBtnCheio: { backgroundColor: c.primary },
    heroBtnAtencao: { backgroundColor: c.warning },
    heroBtnGhost: { borderWidth: 1, borderColor: c.glassBorder },
    heroBtnTxt: { color: "#fff", fontSize: 15.5, fontWeight: "700" },

    // ═══ ZONA 2 · os números como linha de apoio (eram 3 × 25/800) ════════
    // ── Agenda ────────────────────────────────────────────────────────────
    heroRotLinha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    heroAcao: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2, paddingLeft: 8 },
    heroAcaoTxt: { fontSize: font.size.sm, color: c.textMuted, fontWeight: "600" },
    agendaAvisoLinha: { fontSize: font.size.sm, color: c.warning, marginTop: spacing.sm },
    apoio: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: 13, paddingHorizontal: 4 },
    apoioTxt: { flex: 1, color: c.textMuted, fontSize: 13.5 },
    apoioNum: { color: c.text, fontWeight: "700" },
    pastilha: {
      backgroundColor: c.warning + "29", borderWidth: 1, borderColor: c.warning + "66",
      borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    },
    pastilhaTxt: { color: c.warning, fontSize: 12.5, fontWeight: "700" },

    // ═══ ZONA 3 · o respiro de 26 dp é o que separa as zonas ══════════════
    zona3: { marginTop: 26 },
    abasRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    abaBtn: { flex: 1, minHeight: 40, justifyContent: "flex-end", alignItems: "center" },
    abaConteudo: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 9 },
    abaTxt: { color: c.textMuted, fontSize: 13.5, fontWeight: "600" },
    abaTxtAtiva: { color: c.text, fontWeight: "700" },
    abaBadgeTxt: { color: c.warning, fontSize: 11, fontWeight: "800" },
    abaMarca: { position: "absolute", bottom: -StyleSheet.hairlineWidth, left: 6, right: 6, height: 2, borderRadius: 2, backgroundColor: c.primary },

    secLabel: { color: c.textMuted, fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, paddingTop: 14, paddingBottom: 2 },

    // listas sem borda: só separador (a moldura é privilégio do herói)
    linha: {
      flexDirection: "row", alignItems: "center", gap: 11, minHeight: 56, paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    nome: { color: c.text, fontSize: font.size.md, fontWeight: "600" },

    // marcadores de jornada · fundo neutro, cor só no texto (ver o comentário
    // do avatar logo abaixo: a linha é pra ler NOME, não enfeite)
    marcLinha: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
    marcChip: {
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1.5,
    },
    marcTxt: { fontSize: 10, fontWeight: "700" },

    // avatar NEUTRO de propósito: 5 círculos teal eram 5 chamarizes.
    avatarSm: {
      height: 36, width: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
      backgroundColor: c.surfaceAlt,
    },
    avatarSmTxt: { color: c.textMuted, fontWeight: "800", fontSize: 12.5 },
    avatarDoc: { height: 36, width: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceAlt },
    papelBadge: { borderWidth: 1, borderColor: c.border, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2.5 },
    papelTxt: { color: c.textMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },

    // timeline de encontros
    evento: {
      flexDirection: "row", gap: 12, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    eventoData: { width: 42, alignItems: "center" },
    eventoDia: { color: c.text, fontSize: 17, fontWeight: "800" },
    eventoMes: { color: c.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 },
    eventoPres: { color: c.text, fontSize: 14.5, fontWeight: "700" },
    eventoPresN: { color: c.success },
    eventoTema: { color: c.text, fontSize: 13.5, opacity: 0.82 },
    eventoObs: { color: c.textMuted, fontSize: 13, fontStyle: "italic", borderLeftWidth: 2, borderLeftColor: c.border, paddingLeft: 9 },

    // pedido
    pedido: { paddingVertical: 13, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    pedidoTopo: { flexDirection: "row", alignItems: "center", gap: 11 },

    // estado vazio · sem caixa cinza (o vazio não precisa de moldura) e com ação
    vazio: { alignItems: "center", gap: 7, paddingTop: 30, paddingBottom: 14, paddingHorizontal: spacing.md },
    vazioTit: { color: c.text, fontSize: 15.5, fontWeight: "700", textAlign: "center" },
    vazioTxt: { color: c.textMuted, fontSize: 13.5, textAlign: "center", maxWidth: 280, lineHeight: 19 },

    // linha discreta (convidar · pedir ajuda) — ação rara, peso de ação rara
    discreta: {
      flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 13, marginTop: 2,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },
    discretaTxt: { color: c.textMuted, fontSize: 13.5 },

    // ── usados pelos MODAIS (chamada · saída · transferir · ajuda · recusa) ──
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md, gap: spacing.sm },
    cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatar: { height: 44, width: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.primary + "22" },
    avatarTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.md },
    membroCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    nomeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    linhaTxt: { color: c.textMuted, fontSize: font.size.sm },
    acoes: { flexDirection: "row", gap: spacing.sm },
    btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderRadius: radius.full },
    btnTxt: { fontWeight: "700", fontSize: font.size.sm },
    btnRecusar: { borderWidth: 1, borderColor: c.danger },
    btnAceitar: { backgroundColor: c.primary },
    btnRecusarSolido: { backgroundColor: c.danger },
    acaoItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 14 },
    acaoTxt: { color: c.text, fontSize: font.size.md, fontWeight: "600" },
    acaoTxtPerigo: { color: c.danger },
    // ⚠️ `flex: 1` e não outro teto fixo — ver o comentário no modal.
    sheetAlta: { flex: 1, maxHeight: "94%" },
    chamadaVazio: { color: c.textMuted, fontSize: font.size.sm, textAlign: "center", paddingVertical: 24 },
    chamadaLinha: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    chamadaNome: { color: c.text, fontSize: font.size.md, flex: 1 },
    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    // ── Timeline dos encontros (item 3) ────────────────────────────────────
    // ⚠️ A ocorrência pendente é ÂMBAR, nunca vermelha: é pendência, não erro
    // nem decisão contra ninguém — a mesma leitura do `sem_contato` do ERP.
    eventoPendente: { borderStyle: "dashed", borderColor: c.warning },
    eventoDataPendente: { backgroundColor: c.warning + "1c" },
    eventoDiaPendente: { color: c.warning },
    eventoPendenteTxt: { color: c.warning, fontSize: font.size.md, fontWeight: "700" },
    eventoCancelado: { color: c.textMuted, fontSize: font.size.md, fontWeight: "600" },
    registrarBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingVertical: 8, paddingHorizontal: 10,
      borderRadius: radius.full, borderWidth: 1, borderColor: c.primary,
    },
    registrarBtnTxt: { color: c.primary, fontSize: font.size.sm, fontWeight: "700" },
    gerenciarDica: { flexDirection: "row", alignItems: "center", gap: 2 },
    gerenciarDicaTxt: { color: c.textMuted, fontSize: font.size.sm - 1 },
    // ── Adicionar pessoa (item 6) ─────────────────────────────────────────
    avatarAdd: { backgroundColor: c.primary + "1c", borderWidth: 1, borderColor: c.primary + "55" },
    // ⚠️ Input de UMA LINHA: o `styles.input` da tela é multiline (minHeight 70,
    // textAlignVertical top) porque nasceu pro campo de motivo. Reusá-lo aqui
    // daria 5 caixas de 70 px e o formulário não caberia na folha.
    inputLinha: {
      backgroundColor: c.surfaceAlt, borderRadius: radius.sm,
      paddingHorizontal: 12, paddingVertical: 10, color: c.text,
      borderWidth: 1, borderColor: c.border, marginBottom: spacing.sm,
    },
    chips: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
    chip: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingVertical: 9, paddingHorizontal: 14,
      borderRadius: radius.full, borderWidth: 1, borderColor: c.border,
    },
    chipLargo: { alignSelf: "flex-start", marginBottom: spacing.sm },
    chipAtivo: { borderColor: c.primary, backgroundColor: c.primary + "14" },
    chipTxt: { color: c.text, fontSize: font.size.sm },
    chipTxtAtivo: { color: c.primary, fontWeight: "700" },
    // ⚠️ O texto do consentimento é longo de propósito (é prova legal, não
    // rótulo): sem `flex: 1` ele estoura a linha do chip e sai da folha.
    chipTxtQuebra: { flex: 1, lineHeight: 18 },
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    sheetTitle: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    sheetLabel: { color: c.textMuted, fontSize: font.size.sm - 1, marginBottom: 4 },
    input: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, color: c.text, borderWidth: 1, borderColor: c.border, minHeight: 70, textAlignVertical: "top" },
  });
}
