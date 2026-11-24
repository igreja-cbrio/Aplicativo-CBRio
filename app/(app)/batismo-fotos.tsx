// FOTOS DO BATISMO · galeria privada do álbum (24/11/2026).
//
// O ERP publica um álbum por cerimônia; esta conta só enxerga o da data em que
// foi batizada (régua do servidor). Chega-se aqui pelo cartão de /batismo e
// pelo toque no aviso `batismo` com `album_id` (param `album`).
//
// ⚠️ Estados distintos, nunca misturados: carregando · erro (tentar de novo) ·
// sem cadastro · nenhum álbum · conflito (texto do servidor) · álbum. Erro de
// rede/503 NUNCA vira "sem fotos".
// ⚠️ As miniaturas vêm com token que vence em 2–3 h: lista velha é recarregada
// (ao focar a tela e quando uma imagem falha com 410), mantendo quantas fotos a
// pessoa já tinha rolado.
// ⚠️ Salvar: `lib/salvarFotos.ts` escolhe galeria / pasta / folha conforme o
// binário. O retorno do "Baixar" dentro do visualizador aparece NELE (diálogo
// irmão nasce atrás de <Modal> no iPhone); na grade, pelo diálogo da casa.
// ⚠️ "Encontrar minhas fotos" (busca por selfie, `components/batismo/BuscaFacial.tsx`):
// o fluxo é um modal desta tela, sem rota nova. A galeria recebe só ids e
// contagens e mostra o modo "Resultado da busca" (duas seções, com a mesma
// seleção e o mesmo download em lote). O resultado vive só na memória desta
// tela: sai do modo, troca de álbum ou sai da tela ⇒ descartado.
import { FlatList, ScrollView, DockInsetContext } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { ValorHeader } from "@/components/ui/ValorHeader";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDialogo } from "@/components/ui/Dialogo";
import { MiniaturaFoto, VisualizadorFotos, type AvisoVisualizador } from "@/components/batismo/FotosAlbum";
import { BuscaFacial } from "@/components/batismo/BuscaFacial";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  albumInicial,
  classificarErroFotos,
  formatarTamanho,
  linkDeDownload,
  listaVencida,
  listarAlbuns,
  loteGrande,
  paginaDoAlbum,
  percorrerPaginas,
  rotuloDaData,
  tamanhoSomado,
  type ErroFotos,
  type FotoAlbum,
  type RespostaAlbuns,
} from "@/lib/batismoFotos";
import { mensagemDoResumo, type ProgressoFila } from "@/lib/filaFotos";
import { buscaDisponivel, type ResultadoBusca } from "@/lib/buscaFacial";
import {
  estrategiaDoAparelho,
  novoCancelamentoSalvar,
  salvarFotos,
  type CancelamentoSalvar,
  type ResultadoSalvar,
} from "@/lib/salvarFotos";

const ROTA = "/batismo-fotos";
const COLUNAS = 3;
const VAO = 4;

type EstadoTela = { tipo: "carregando" } | { tipo: "erro" } | { tipo: "pronto"; resp: RespostaAlbuns };

type EstadoAlbum = {
  fotos: FotoAlbum[];
  cursor: string | null;
  /** Já houve ao menos uma resposta para este álbum. */
  carregou: boolean;
  carregando: boolean;
  erro: ErroFotos | null;
  /** Quando a 1ª página (os tokens mais velhos) chegou. */
  carregadaEm: number | null;
};

const ALBUM_VAZIO: EstadoAlbum = { fotos: [], cursor: null, carregou: false, carregando: false, erro: null, carregadaEm: null };

/** Linhas do modo "Resultado da busca": título de seção ou uma fileira de até 3 fotos. */
type LinhaResultado =
  | { tipo: "secao"; chave: string; secao: "suas" | "talvez"; fotos: FotoAlbum[] }
  | { tipo: "linha"; chave: string; fotos: FotoAlbum[]; inicio: number };

function Separador() {
  return <View style={{ height: VAO }} />;
}

export default function BatismoFotosScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const dlg = useDialogo();
  const dockInset = useContext(DockInsetContext);
  const { width } = useWindowDimensions();
  const { album: albumParam } = useLocalSearchParams<{ album?: string }>();

  const [tela, setTela] = useState<EstadoTela>({ tipo: "carregando" });
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [pag, setPag] = useState<EstadoAlbum>(ALBUM_VAZIO);
  const [puxando, setPuxando] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set());
  const [buscandoTodas, setBuscandoTodas] = useState(false);
  const [indiceVisto, setIndiceVisto] = useState<number | null>(null);
  const [progresso, setProgresso] = useState<ProgressoFila | null>(null);
  const [avisoFoto, setAvisoFoto] = useState<AvisoVisualizador | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  /** Só ids e contagens: nenhuma distância nem selfie chega aqui. */
  const [resultadoBusca, setResultadoBusca] = useState<ResultadoBusca | null>(null);

  const ativa = useRef(true);
  const geracao = useRef(0);
  const albumRef = useRef<string | null>(null);
  const pagRef = useRef(pag);
  pagRef.current = pag;
  const cancelRef = useRef<CancelamentoSalvar | null>(null);
  const salvandoRef = useRef(false);
  const recarregandoRef = useRef(false);
  const conferindoImagemRef = useRef(false);

  useEffect(
    () => () => {
      ativa.current = false;
      // Saiu da tela no meio do lote: para os downloads (o resumo não teria onde aparecer).
      cancelRef.current?.cancelar();
    },
    [],
  );

  // ── Álbuns da conta ──────────────────────────────────────────────────────
  const carregarAlbuns = useCallback(async () => {
    try {
      const resp = await listarAlbuns();
      if (!ativa.current) return;
      setTela({ tipo: "pronto", resp });
      setAlbumId((atual) => (atual && resp.albuns.some((a) => a.id === atual) ? atual : albumInicial(resp.albuns, albumParam)?.id ?? null));
    } catch {
      if (ativa.current) setTela((s) => (s.tipo === "pronto" ? s : { tipo: "erro" }));
    }
  }, [albumParam]);

  useEffect(() => {
    carregarAlbuns();
  }, [carregarAlbuns]);

  // ── Páginas do álbum escolhido ───────────────────────────────────────────
  /** Recomeça do zero, buscando até ter `quantas` fotos (mantém a posição de quem já rolou). */
  const recarregarAlbum = useCallback(async (quantas = 0) => {
    const id = albumRef.current;
    if (!id) return;
    const g = geracao.current;
    setPag((p) => ({ ...p, carregando: true, erro: null }));
    try {
      const r = await percorrerPaginas((c) => paginaDoAlbum(id, c), { fotos: [], cursor: null }, (n) => n >= quantas);
      if (!ativa.current || g !== geracao.current) return;
      setPag({ fotos: r.fotos, cursor: r.cursor, carregou: true, carregando: false, erro: null, carregadaEm: r.carregadaEm });
      setSelecionadas((s) => new Set([...s].filter((x) => r.fotos.some((f) => f.id === x))));
    } catch (e) {
      if (!ativa.current || g !== geracao.current) return;
      setPag((p) => ({ ...p, carregou: true, carregando: false, erro: classificarErroFotos(e) }));
    }
  }, []);

  /** Próxima página. Depois de um erro, só volta a buscar quando a pessoa pede (`deNovo`). */
  const carregarMais = useCallback(async (deNovo = false): Promise<number | null> => {
    const id = albumRef.current;
    const atual = pagRef.current;
    if (!id || atual.carregando || !atual.cursor || (atual.erro && !deNovo)) return null;
    const g = geracao.current;
    // Marca no ref também: dois onEndReached seguidos não buscam a mesma página duas vezes.
    pagRef.current = { ...atual, carregando: true, erro: null };
    setPag((p) => ({ ...p, carregando: true, erro: null }));
    try {
      const r = await percorrerPaginas((c) => paginaDoAlbum(id, c), { fotos: atual.fotos, cursor: atual.cursor }, () => true);
      if (!ativa.current || g !== geracao.current) return null;
      setPag((p) => ({ ...p, fotos: r.fotos, cursor: r.cursor, carregando: false }));
      return r.fotos.length;
    } catch (e) {
      if (!ativa.current || g !== geracao.current) return null;
      setPag((p) => ({ ...p, carregando: false, erro: classificarErroFotos(e) }));
      return null;
    }
  }, []);

  useEffect(() => {
    albumRef.current = albumId;
    geracao.current += 1;
    setPag(ALBUM_VAZIO);
    setSelecionando(false);
    setSelecionadas(new Set());
    setIndiceVisto(null);
    setBuscaAberta(false);
    setResultadoBusca(null);
    if (albumId) recarregarAlbum();
  }, [albumId, recarregarAlbum]);

  // Saiu da tela (outra rota por cima, outra aba): o resultado da busca não fica guardado.
  useFocusEffect(
    useCallback(
      () => () => {
        setBuscaAberta(false);
        setResultadoBusca(null);
      },
      [],
    ),
  );

  /**
   * Todas as páginas do álbum, do zero (tokens novos para a busca, que pode
   * durar minutos). Também vira a lista da grade: o resultado e o download em
   * lote precisam de todas as fotos. Lança em erro (o fluxo mostra).
   */
  const carregarTodasParaBusca = useCallback(async (): Promise<FotoAlbum[]> => {
    const id = albumRef.current;
    if (!id) throw Object.assign(new Error("Álbum não encontrado."), { status: 404 });
    // Geração nova: uma "carregar mais" em voo não sobrescreve a lista completa.
    geracao.current += 1;
    const g = geracao.current;
    const r = await percorrerPaginas((c) => paginaDoAlbum(id, c), { fotos: [], cursor: null });
    if (ativa.current && g === geracao.current) {
      setPag({ fotos: r.fotos, cursor: r.cursor, carregou: true, carregando: false, erro: null, carregadaEm: r.carregadaEm });
      setSelecionadas((s) => new Set([...s].filter((x) => r.fotos.some((f) => f.id === x))));
    }
    return r.fotos;
  }, []);

  const abrirBusca = () => {
    if (salvandoRef.current) return;
    setIndiceVisto(null);
    setSelecionando(false);
    setSelecionadas(new Set());
    setBuscaAberta(true);
  };

  const aoResultadoBusca = useCallback((r: ResultadoBusca) => {
    setBuscaAberta(false);
    setSelecionando(false);
    setSelecionadas(new Set());
    setIndiceVisto(null);
    setResultadoBusca(r);
  }, []);

  const sairDoResultado = () => {
    setResultadoBusca(null);
    setSelecionando(false);
    setSelecionadas(new Set());
    setIndiceVisto(null);
  };

  /** Tokens das miniaturas venceram (ou podem ter vencido): renova sem perder a posição. */
  const renovarLista = useCallback(async () => {
    if (recarregandoRef.current || salvandoRef.current) return;
    recarregandoRef.current = true;
    try {
      await recarregarAlbum(pagRef.current.fotos.length);
    } finally {
      recarregandoRef.current = false;
    }
  }, [recarregarAlbum]);

  useFocusEffect(
    useCallback(() => {
      if (listaVencida(pagRef.current.carregadaEm, Date.now())) renovarLista();
    }, [renovarLista]),
  );

  const aoFalharImagem = useCallback(
    async (url: string | null) => {
      if (!url) return;
      if (listaVencida(pagRef.current.carregadaEm, Date.now())) {
        renovarLista();
        return;
      }
      // Uma conferência por vez (e no máximo a cada 30 s): 410 = token vencido.
      if (conferindoImagemRef.current) return;
      conferindoImagemRef.current = true;
      try {
        const r = await fetch(url, { method: "HEAD" });
        if (r.status === 410) renovarLista();
      } catch {
        /* sem rede: a miniatura fica no ícone, e o puxar para atualizar resolve */
      } finally {
        setTimeout(() => {
          conferindoImagemRef.current = false;
        }, 30_000);
      }
    },
    [renovarLista],
  );

  /** No resultado, atualizar renova os tokens SEM encolher a lista (as fotos do resultado continuam lá). */
  const aoPuxarNoResultado = useCallback(async () => {
    setPuxando(true);
    await renovarLista();
    if (ativa.current) setPuxando(false);
  }, [renovarLista]);

  const aoPuxar = useCallback(async () => {
    setPuxando(true);
    await carregarAlbuns();
    await recarregarAlbum();
    if (ativa.current) setPuxando(false);
  }, [carregarAlbuns, recarregarAlbum]);

  // ── Seleção ──────────────────────────────────────────────────────────────
  const alternar = useCallback((id: string) => {
    setSelecionadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const aoTocarFoto = useCallback(
    (foto: FotoAlbum, indice: number) => {
      if (selecionando) alternar(foto.id);
      else {
        setAvisoFoto(null);
        setIndiceVisto(indice);
      }
    },
    [selecionando, alternar],
  );

  const aoSegurarFoto = useCallback(
    (foto: FotoAlbum) => {
      if (salvandoRef.current) return;
      setSelecionando(true);
      setSelecionadas((s) => (s.has(foto.id) ? s : new Set(s).add(foto.id)));
    },
    [],
  );

  const sairDaSelecao = () => {
    setSelecionando(false);
    setSelecionadas(new Set());
  };

  const todasSelecionadas = pag.fotos.length > 0 && !pag.cursor && pag.fotos.every((f) => selecionadas.has(f.id));

  async function selecionarTodas() {
    if (todasSelecionadas) {
      setSelecionadas(new Set());
      return;
    }
    const id = albumRef.current;
    if (!id) return;
    let fotos = pagRef.current.fotos;
    if (pagRef.current.cursor) {
      const g = geracao.current;
      setBuscandoTodas(true);
      try {
        const r = await percorrerPaginas((c) => paginaDoAlbum(id, c), { fotos, cursor: pagRef.current.cursor });
        if (!ativa.current || g !== geracao.current) return;
        fotos = r.fotos;
        setPag((p) => ({ ...p, fotos: r.fotos, cursor: r.cursor }));
      } catch {
        if (ativa.current) await dlg.avisar(t("Não foi possível carregar todas as fotos"), t("Verifique sua conexão e tente de novo."));
        return;
      } finally {
        if (ativa.current) setBuscandoTodas(false);
      }
    }
    setSelecionando(true);
    setSelecionadas(new Set(fotos.map((f) => f.id)));
  }

  // ── Salvar ───────────────────────────────────────────────────────────────
  async function baixar(fotos: FotoAlbum[], origem: "grade" | "visualizador") {
    const id = albumRef.current;
    if (!id || salvandoRef.current || fotos.length === 0) return;
    const naGrade = origem === "grade";
    const estrategia = estrategiaDoAparelho(fotos.length);
    if (estrategia === "atualizar_app") {
      await dlg.avisar(t("Atualize o app"), t("Para salvar várias de uma vez no iPhone, atualize o CBRio na App Store."));
      return;
    }
    if (estrategia === "indisponivel") {
      const msg = t("Não é possível salvar fotos neste aparelho.");
      if (naGrade) await dlg.avisar(t("Fotos do batismo"), msg);
      else setAvisoFoto({ texto: msg, erro: true });
      return;
    }
    if (naGrade && fotos.length > 1 && loteGrande(fotos)) {
      const { bytes, desconhecidas } = tamanhoSomado(fotos);
      const ok = await dlg.confirmar({
        titulo: `${t("Baixar")} ${fotos.length} ${t("fotos")}?`,
        mensagem: `${t("Cerca de")} ${formatarTamanho(bytes)}${desconhecidas ? "+" : ""}. ${t("São os arquivos originais, em alta resolução: prefira o Wi-Fi.")}`,
        acao: t("Baixar"),
      });
      if (!ok) return;
    }

    salvandoRef.current = true;
    const cancelamento = novoCancelamentoSalvar();
    cancelRef.current = cancelamento;
    setProgresso({ total: fotos.length, salvas: 0, falhas: 0, emAndamento: 0 });
    if (!naGrade) setAvisoFoto({ texto: t("Salvando…"), erro: false });
    let r: ResultadoSalvar<FotoAlbum> | null = null;
    try {
      r = await salvarFotos(fotos, {
        obterLink: (f) => linkDeDownload(id, f.id),
        cancelamento,
        aoProgredir: (p) => {
          if (ativa.current) setProgresso(p);
        },
      });
    } catch {
      r = null;
    } finally {
      salvandoRef.current = false;
      cancelRef.current = null;
      if (ativa.current) setProgresso(null);
    }
    if (!ativa.current) return;
    await informar(r, fotos, naGrade);
  }

  async function informar(r: ResultadoSalvar<FotoAlbum> | null, fotos: FotoAlbum[], naGrade: boolean) {
    const aviso = (texto: string, erro: boolean, ajustes = false) => setAvisoFoto({ texto, erro, ajustes });
    if (!r) {
      const msg = t("Não foi possível salvar agora. Tente de novo.");
      if (naGrade) await dlg.avisar(t("Fotos do batismo"), msg);
      else aviso(msg, true);
      return;
    }
    if (r.tipo === "sem_permissao") {
      const msg = t("O CBRio precisa da permissão para adicionar fotos à sua galeria. Você pode liberar nos Ajustes do aparelho.");
      if (!naGrade) {
        aviso(msg, true, true);
        return;
      }
      const abrir = await dlg.confirmar({ titulo: t("Permita salvar fotos"), mensagem: msg, acao: t("Abrir Ajustes") });
      if (abrir) Linking.openSettings().catch(() => {});
      return;
    }
    if (r.tipo === "precisa_atualizar") {
      await dlg.avisar(t("Atualize o app"), t("Para salvar várias de uma vez no iPhone, atualize o CBRio na App Store."));
      return;
    }
    if (r.tipo === "indisponivel") {
      const msg = t("Não é possível salvar fotos neste aparelho.");
      if (naGrade) await dlg.avisar(t("Fotos do batismo"), msg);
      else aviso(msg, true);
      return;
    }

    const { resumo } = r;
    // Quem fechou o seletor de pasta (ou cancelou antes de qualquer foto) desistiu: sem bronca.
    if (resumo.cancelado && resumo.salvas === 0 && resumo.falhas === 0) {
      if (!naGrade) setAvisoFoto(null);
      return;
    }
    const primeiroErro = resumo.falhou[0]?.erro;
    if (r.estrategia === "folha") {
      // A folha do sistema já foi o retorno; só fala se a foto nem chegou a ela.
      if (resumo.falhas > 0) {
        const msg = primeiroErro ? t(primeiroErro) : t("Não foi possível salvar agora. Tente de novo.");
        if (naGrade) await dlg.avisar(t("A foto não foi baixada"), msg);
        else aviso(msg, true);
      } else if (!naGrade) setAvisoFoto(null);
      return;
    }

    const texto = mensagemDoResumo(resumo, t);
    if (resumo.falhas === 0) {
      if (!naGrade) {
        aviso(texto, false);
        return;
      }
      // Cancelado no meio: o título não diz "salvas" (o texto diz quantas).
      const todas = resumo.salvas === resumo.total;
      if (todas) sairDaSelecao();
      await dlg.avisar(
        !todas ? t("Download interrompido") : r.estrategia === "pasta" ? t("Fotos salvas na pasta") : t("Fotos salvas na galeria"),
        texto,
      );
      return;
    }
    const detalhe = primeiroErro ? `\n${t(primeiroErro)}` : "";
    if (!naGrade) {
      aviso(`${texto}${detalhe}`, true);
      return;
    }
    const deNovo = await dlg.confirmar({
      titulo: t("Algumas fotos não foram salvas"),
      mensagem: `${texto}${detalhe}`,
      acao: t("Tentar de novo as que falharam"),
      cancelar: t("Agora não"),
    });
    if (deNovo && ativa.current) await baixar(resumo.falhou.map((f) => f.item), "grade");
  }

  // ── Resultado da busca ───────────────────────────────────────────────────
  const porId = useMemo(() => new Map(pag.fotos.map((f) => [f.id, f] as const)), [pag.fotos]);
  const fotosSuas = useMemo(
    () => (resultadoBusca ? resultadoBusca.suas.flatMap((id) => porId.get(id) ?? []) : []),
    [resultadoBusca, porId],
  );
  const fotosTalvez = useMemo(
    () => (resultadoBusca ? resultadoBusca.talvez.flatMap((id) => porId.get(id) ?? []) : []),
    [resultadoBusca, porId],
  );
  const fotosResultado = useMemo(() => (resultadoBusca ? [...fotosSuas, ...fotosTalvez] : null), [resultadoBusca, fotosSuas, fotosTalvez]);
  const fotosResultadoRef = useRef<FotoAlbum[] | null>(null);
  fotosResultadoRef.current = fotosResultado;
  const pelaSequencia = useMemo(() => {
    if (!resultadoBusca) return 0;
    const visiveis = new Set(fotosTalvez.map((f) => f.id));
    return resultadoBusca.pelaSequencia.filter((id) => visiveis.has(id)).length;
  }, [resultadoBusca, fotosTalvez]);

  const linhasResultado = useMemo(() => {
    const linhas: LinhaResultado[] = [];
    let inicio = 0;
    for (const [secao, fotos] of [
      ["suas", fotosSuas],
      ["talvez", fotosTalvez],
    ] as const) {
      if (fotos.length === 0) continue;
      linhas.push({ tipo: "secao", chave: `secao-${secao}`, secao, fotos });
      for (let i = 0; i < fotos.length; i += COLUNAS) {
        linhas.push({ tipo: "linha", chave: `${secao}-${i}`, fotos: fotos.slice(i, i + COLUNAS), inicio: inicio + i });
      }
      inicio += fotos.length;
    }
    return linhas;
  }, [fotosSuas, fotosTalvez]);

  /** "Selecionar todas" de uma seção: marca as da seção (ou desmarca, se já estavam todas). */
  const alternarSecao = (fotos: readonly FotoAlbum[]) => {
    if (salvandoRef.current) return;
    const todas = fotos.length > 0 && fotos.every((f) => selecionadas.has(f.id));
    setSelecionando(true);
    setSelecionadas((s) => {
      const n = new Set(s);
      for (const f of fotos) {
        if (todas) n.delete(f.id);
        else n.add(f.id);
      }
      return n;
    });
  };

  // ── Visualizador ─────────────────────────────────────────────────────────
  const irPara = useCallback(
    async (i: number) => {
      setAvisoFoto(null);
      const doResultado = fotosResultadoRef.current;
      if (doResultado) {
        if (i >= 0 && i < doResultado.length) setIndiceVisto(i);
        return;
      }
      if (i < pagRef.current.fotos.length) {
        setIndiceVisto(Math.max(0, i));
        return;
      }
      const total = await carregarMais(true);
      if (ativa.current && total != null && i < total) setIndiceVisto(i);
    },
    [carregarMais],
  );

  // ── Render ───────────────────────────────────────────────────────────────
  const lado = Math.floor((width - spacing.lg * 2 - VAO * (COLUNAS - 1)) / COLUNAS);
  const albuns = tela.tipo === "pronto" ? tela.resp.albuns : [];
  const album = albuns.find((a) => a.id === albumId) ?? null;
  const salvando = progresso !== null;
  const podeBuscar = tela.tipo === "pronto" && buscaDisponivel(tela.resp.busca_facial, album, pag.fotos);
  const selecionadasLista = useMemo(() => pag.fotos.filter((f) => selecionadas.has(f.id)), [pag.fotos, selecionadas]);
  const tamanhoSel = tamanhoSomado(selecionadasLista);

  const renderFoto = useCallback(
    ({ item, index }: { item: FotoAlbum; index: number }) => (
      <MiniaturaFoto
        foto={item}
        indice={index}
        lado={lado}
        selecionando={selecionando}
        selecionada={selecionadas.has(item.id)}
        onToque={aoTocarFoto}
        onToqueLongo={aoSegurarFoto}
        onErro={aoFalharImagem}
      />
    ),
    [lado, selecionando, selecionadas, aoTocarFoto, aoSegurarFoto, aoFalharImagem],
  );

  const cabecalho = (
    <View style={styles.cabecalho}>
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel(ROTA)} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ width: 24 }} />
      </View>
      <ValorHeader rotulo={t("Fotos do batismo")} />

      {albuns.length > 1 && (
        <View style={styles.chips} accessibilityRole="tablist">
          {albuns.map((a) => {
            const ativo = a.id === albumId;
            return (
              <Pressable
                key={a.id}
                onPress={() => !salvando && setAlbumId(a.id)}
                style={[styles.chip, ativo && styles.chipAtivo]}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativo, disabled: salvando }}
              >
                <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>{rotuloDaData(a.data_batismo)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!!album && album.situacao === "liberado" && pag.fotos.length > 0 && resultadoBusca && (
        <View style={styles.resultadoTopo}>
          <Text style={styles.resultadoTitulo}>{t("Resultado da busca")}</Text>
          <Text style={styles.sub}>
            {t("Batismo de")} {rotuloDaData(album.data_batismo)}
          </Text>
          {resultadoBusca.interrompida ? (
            <Text style={styles.resultadoLinha}>
              {t("Você parou a busca:")} {resultadoBusca.verificadas} {t("de")} {resultadoBusca.total} {t("fotos verificadas.")}
            </Text>
          ) : resultadoBusca.naoVerificadas > 0 ? (
            <Text style={styles.resultadoLinha}>
              {resultadoBusca.naoVerificadas}{" "}
              {resultadoBusca.naoVerificadas === 1 ? t("foto não pôde ser verificada.") : t("fotos não puderam ser verificadas.")}
            </Text>
          ) : null}
          {fotosSuas.length === 0 && fotosTalvez.length === 0 ? (
            <Text style={styles.resultadoVazio}>
              {t("Não encontramos você nas fotos. A busca erra em fotos molhadas, de perfil ou com o rosto coberto: vale olhar o álbum.")}
            </Text>
          ) : fotosSuas.length === 0 ? (
            <Text style={styles.resultadoVazio}>{t("Não achamos fotos suas com certeza. Veja abaixo as que podem ser você.")}</Text>
          ) : null}
          <View style={styles.ferramentas}>
            <Pressable onPress={sairDoResultado} disabled={salvando} hitSlop={6} accessibilityRole="button" style={styles.ferramenta}>
              <Ionicons name="images-outline" size={16} color={colors.brandMid} />
              <Text style={styles.ferramentaTxt}>{t("Ver o álbum todo")}</Text>
            </Pressable>
            {selecionando && (
              <Pressable onPress={sairDaSelecao} disabled={salvando} hitSlop={6} accessibilityRole="button" style={styles.ferramenta}>
                <Text style={styles.ferramentaTxt}>{t("Cancelar")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {!!album && album.situacao === "liberado" && pag.fotos.length > 0 && !resultadoBusca && (
        <>
          <Text style={styles.sub}>
            {t("Batismo de")} {rotuloDaData(album.data_batismo)}
            {album.total ? ` · ${album.total} ${album.total === 1 ? t("foto") : t("fotos")}` : ""}
          </Text>
          {podeBuscar && !selecionando && (
            <Pressable
              onPress={abrirBusca}
              disabled={salvando}
              style={({ pressed }) => [styles.botaoBusca, (pressed || salvando) && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityHint={t("Tire uma selfie e veja as fotos em que você aparece.")}
            >
              <Ionicons name="scan-outline" size={20} color="#fff" />
              <Text style={styles.botaoBuscaTxt}>{t("Encontrar minhas fotos")}</Text>
            </Pressable>
          )}
          <View style={styles.ferramentas}>
            {selecionando ? (
              <>
                <Pressable onPress={selecionarTodas} disabled={buscandoTodas || salvando} hitSlop={6} accessibilityRole="button" style={styles.ferramenta}>
                  {buscandoTodas ? <ActivityIndicator size="small" color={colors.brandMid} /> : null}
                  <Text style={styles.ferramentaTxt}>{todasSelecionadas ? t("Desmarcar todas") : t("Selecionar todas")}</Text>
                </Pressable>
                <Pressable onPress={sairDaSelecao} disabled={salvando} hitSlop={6} accessibilityRole="button" style={styles.ferramenta}>
                  <Text style={styles.ferramentaTxt}>{t("Cancelar")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.dica}>{t("Toque numa foto para ver. Segure para selecionar.")}</Text>
                <Pressable onPress={() => setSelecionando(true)} hitSlop={6} accessibilityRole="button" style={styles.ferramenta}>
                  <Text style={styles.ferramentaTxt}>{t("Selecionar")}</Text>
                </Pressable>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );

  const voltarAoBatismo = () => router.navigate("/batismo");

  /** Tudo o que não é a grade: um ScrollView com o cabeçalho e o estado. */
  function corpoSemGrade(conteudo: React.ReactNode) {
    return (
      <ScrollView
        contentContainerStyle={styles.conteudo}
        refreshControl={<RefreshControl refreshing={puxando} onRefresh={aoPuxar} tintColor={colors.brandMid} />}
      >
        {cabecalho}
        {conteudo}
      </ScrollView>
    );
  }

  let corpo: React.ReactNode;
  if (tela.tipo === "carregando") {
    corpo = corpoSemGrade(<ActivityIndicator color={colors.brandMid} style={{ marginTop: spacing.xl }} />);
  } else if (tela.tipo === "erro") {
    corpo = corpoSemGrade(
      <ErrorState
        texto={t("Não foi possível carregar as fotos agora.")}
        onRetry={() => {
          setTela({ tipo: "carregando" });
          carregarAlbuns();
        }}
      />,
    );
  } else if (tela.resp.conta === "sem_cadastro") {
    corpo = corpoSemGrade(
      <View style={styles.vazio}>
        <Ionicons name="link-outline" size={44} color={colors.textMuted} />
        <Text style={styles.vazioTitulo}>{t("Confirme seu cadastro")}</Text>
        <Text style={styles.vazioTxt}>
          {t("Para ver as fotos do seu batismo, o app precisa saber quem você é. Complete seu cadastro no perfil.")}
        </Text>
        <Button title={t("Ir para o perfil")} onPress={() => router.navigate("/perfil")} />
      </View>,
    );
  } else if (!album) {
    corpo = corpoSemGrade(
      <View style={styles.vazio}>
        <Ionicons name="images-outline" size={44} color={colors.textMuted} />
        <Text style={styles.vazioTxt}>{t("As fotos do seu batismo aparecem aqui quando a equipe publicar o álbum.")}</Text>
        <Pressable onPress={voltarAoBatismo} hitSlop={6} accessibilityRole="button">
          <Text style={styles.link}>{t("Meu batismo")}</Text>
        </Pressable>
      </View>,
    );
  } else if (pag.erro?.tipo === "conflito") {
    // Texto do SERVIDOR (ele sabe por que está em conferência); o nosso é só reserva.
    const mensagem = pag.erro.mensagem;
    corpo = corpoSemGrade(
      <View style={styles.vazio}>
        <Ionicons name="hourglass-outline" size={44} color={colors.textMuted} />
        <Text style={styles.vazioTxt}>
          {mensagem ?? t("Encontramos mais de uma data de batismo no seu cadastro. A equipe vai conferir antes de liberar as fotos.")}
        </Text>
      </View>,
    );
  } else if (!pag.carregou || (pag.carregando && pag.fotos.length === 0)) {
    corpo = corpoSemGrade(<ActivityIndicator color={colors.brandMid} style={{ marginTop: spacing.xl }} />);
  } else if (pag.erro && pag.fotos.length === 0) {
    corpo = corpoSemGrade(
      pag.erro.tipo === "sem_acesso" ? (
        <View style={styles.vazio}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
          <Text style={styles.vazioTxt}>{t("Este álbum não está disponível para a sua conta.")}</Text>
          <Pressable onPress={aoPuxar} hitSlop={6} accessibilityRole="button">
            <Text style={styles.link}>{t("Atualizar")}</Text>
          </Pressable>
        </View>
      ) : (
        <ErrorState texto={t("Não foi possível carregar as fotos agora.")} onRetry={() => recarregarAlbum()} />
      ),
    );
  } else if (pag.fotos.length === 0) {
    corpo = corpoSemGrade(
      <View style={styles.vazio}>
        <Ionicons name="images-outline" size={44} color={colors.textMuted} />
        <Text style={styles.vazioTxt}>{t("Este álbum ainda não tem fotos.")}</Text>
      </View>,
    );
  } else if (resultadoBusca) {
    corpo = (
      <FlatList
        key="resultado"
        data={linhasResultado}
        keyExtractor={(l) => l.chave}
        renderItem={({ item }) => {
          if (item.tipo === "secao") {
            const todas = item.fotos.every((f) => selecionadas.has(f.id));
            return (
              <View style={styles.secao}>
                <View style={styles.secaoLinha}>
                  <Text style={styles.secaoTitulo}>
                    {item.secao === "suas" ? t("Fotos suas") : t("Pode ser você · pouca certeza")} ({item.fotos.length})
                  </Text>
                  <Pressable onPress={() => alternarSecao(item.fotos)} disabled={salvando} hitSlop={6} accessibilityRole="button">
                    <Text style={styles.ferramentaTxt}>{todas && selecionando ? t("Desmarcar todas") : t("Selecionar todas")}</Text>
                  </Pressable>
                </View>
                {item.secao === "talvez" && pelaSequencia > 0 && (
                  <Text style={styles.dica}>{t("Algumas foram tiradas logo antes ou depois de uma foto sua.")}</Text>
                )}
              </View>
            );
          }
          return (
            <View style={styles.fileira}>
              {item.fotos.map((f, k) => (
                <MiniaturaFoto
                  key={f.id}
                  foto={f}
                  indice={item.inicio + k}
                  lado={lado}
                  selecionando={selecionando}
                  selecionada={selecionadas.has(f.id)}
                  onToque={aoTocarFoto}
                  onToqueLongo={aoSegurarFoto}
                  onErro={aoFalharImagem}
                />
              ))}
            </View>
          );
        }}
        extraData={[selecionadas, selecionando, salvando]}
        ListHeaderComponent={cabecalho}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        contentContainerStyle={[styles.conteudo, { paddingBottom: dockInset + (selecionando || salvando ? 120 : 24) }]}
        refreshControl={<RefreshControl refreshing={puxando} onRefresh={aoPuxarNoResultado} tintColor={colors.brandMid} />}
      />
    );
  } else {
    corpo = (
      <FlatList
        key="grade"
        data={pag.fotos}
        keyExtractor={(f) => f.id}
        numColumns={COLUNAS}
        renderItem={renderFoto}
        extraData={selecionadas}
        columnWrapperStyle={{ gap: VAO }}
        ItemSeparatorComponent={Separador}
        ListHeaderComponent={cabecalho}
        ListFooterComponent={
          pag.carregando ? (
            <ActivityIndicator color={colors.brandMid} style={{ marginVertical: spacing.lg }} />
          ) : pag.erro ? (
            <View style={styles.rodape}>
              <Text style={styles.erroTxt}>{t("Não foi possível carregar mais fotos.")}</Text>
              <Pressable onPress={() => carregarMais(true)} hitSlop={6} accessibilityRole="button">
                <Text style={styles.link}>{t("Tentar de novo")}</Text>
              </Pressable>
            </View>
          ) : null
        }
        onEndReached={() => carregarMais()}
        onEndReachedThreshold={0.6}
        initialNumToRender={24}
        maxToRenderPerBatch={18}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={[styles.conteudo, { paddingBottom: dockInset + (selecionando || salvando ? 120 : 24) }]}
        refreshControl={<RefreshControl refreshing={puxando} onRefresh={aoPuxar} tintColor={colors.brandMid} />}
      />
    );
  }

  const concluidas = progresso ? progresso.salvas + progresso.falhas : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {corpo}

      {/* Barra de ação: progresso do lote OU "Baixar (N)" da seleção. */}
      {salvando && progresso ? (
        <View style={[styles.barra, { bottom: dockInset + spacing.sm }]} accessibilityLiveRegion="polite">
          <View style={{ flex: 1 }}>
            <Text style={styles.barraTitulo}>
              {t("Salvando")} {Math.min(progresso.total, concluidas + 1)} {t("de")} {progresso.total}…
            </Text>
            <View style={styles.trilho}>
              <View style={[styles.trilhoCheio, { width: `${Math.round((concluidas / Math.max(1, progresso.total)) * 100)}%` }]} />
            </View>
          </View>
          <Pressable
            onPress={() => cancelRef.current?.cancelar()}
            style={({ pressed }) => [styles.barraBotaoFantasma, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Text style={styles.barraBotaoFantasmaTxt}>{t("Cancelar")}</Text>
          </Pressable>
        </View>
      ) : selecionando && selecionadasLista.length > 0 ? (
        <View style={[styles.barra, { bottom: dockInset + spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barraTitulo}>
              {selecionadasLista.length} {selecionadasLista.length === 1 ? t("foto selecionada") : t("fotos selecionadas")}
            </Text>
            <Text style={styles.barraSub}>
              {formatarTamanho(tamanhoSel.bytes)}
              {tamanhoSel.desconhecidas ? "+" : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => baixar(selecionadasLista, "grade")}
            style={({ pressed }) => [styles.barraBotao, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.barraBotaoTxt}>
              {t("Baixar")} ({selecionadasLista.length})
            </Text>
          </Pressable>
        </View>
      ) : null}

      <VisualizadorFotos
        fotos={fotosResultado ?? pag.fotos}
        indice={indiceVisto}
        temMais={fotosResultado ? false : !!pag.cursor}
        salvando={salvando}
        aviso={avisoFoto}
        onFechar={() => {
          setIndiceVisto(null);
          setAvisoFoto(null);
        }}
        onIr={irPara}
        onBaixar={(f) => baixar([f], "visualizador")}
        onAbrirAjustes={() => Linking.openSettings().catch(() => {})}
        onErroImagem={aoFalharImagem}
      />
      {buscaAberta && !!albumId && (
        <BuscaFacial
          albumId={albumId}
          totalEstimado={album?.total ?? pag.fotos.length}
          carregarTodas={carregarTodasParaBusca}
          onFechar={() => setBuscaAberta(false)}
          onResultado={aoResultadoBusca}
        />
      )}
      <dlg.Dialogo />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    conteudo: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
    cabecalho: { paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    sub: { color: colors.textMuted, fontSize: font.size.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    chipTxtAtivo: { color: "#fff" },
    ferramentas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, minHeight: 36 },
    ferramenta: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
    ferramentaTxt: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "800" },
    dica: { flex: 1, color: colors.textMuted, fontSize: 12 },
    vazio: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
    vazioTitulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    vazioTxt: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    link: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "800" },
    rodape: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
    erroTxt: { color: colors.danger, fontSize: font.size.sm, textAlign: "center" },
    barra: {
      position: "absolute",
      left: spacing.md,
      right: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    barraTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    barraSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    barraBotao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      minHeight: 44,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    },
    barraBotaoTxt: { color: "#fff", fontWeight: "800", fontSize: font.size.sm },
    barraBotaoFantasma: { paddingHorizontal: 14, minHeight: 44, justifyContent: "center" },
    barraBotaoFantasmaTxt: { color: colors.danger, fontWeight: "800", fontSize: font.size.sm },
    botaoBusca: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
    },
    botaoBuscaTxt: { color: "#fff", fontWeight: "800", fontSize: font.size.md },
    resultadoTopo: { gap: 6 },
    resultadoTitulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    resultadoLinha: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    resultadoVazio: { color: colors.text, fontSize: font.size.md, lineHeight: 22, marginTop: spacing.sm },
    secao: { gap: 4, paddingTop: spacing.md, paddingBottom: spacing.sm },
    secaoLinha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    secaoTitulo: { flex: 1, color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    fileira: { flexDirection: "row", gap: VAO, marginBottom: VAO },
    trilho: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, marginTop: 8, overflow: "hidden" },
    trilhoCheio: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  });
