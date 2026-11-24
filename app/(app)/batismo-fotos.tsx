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
import { FlatList, ScrollView, DockInsetContext } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { ValorHeader } from "@/components/ui/ValorHeader";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDialogo } from "@/components/ui/Dialogo";
import { MiniaturaFoto, VisualizadorFotos, type AvisoVisualizador } from "@/components/batismo/FotosAlbum";
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
    if (albumId) recarregarAlbum();
  }, [albumId, recarregarAlbum]);

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

  // ── Visualizador ─────────────────────────────────────────────────────────
  const irPara = useCallback(
    async (i: number) => {
      setAvisoFoto(null);
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

      {!!album && album.situacao === "liberado" && pag.fotos.length > 0 && (
        <>
          <Text style={styles.sub}>
            {t("Batismo de")} {rotuloDaData(album.data_batismo)}
            {album.total ? ` · ${album.total} ${album.total === 1 ? t("foto") : t("fotos")}` : ""}
          </Text>
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
  } else {
    corpo = (
      <FlatList
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
        fotos={pag.fotos}
        indice={indiceVisto}
        temMais={!!pag.cursor}
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
    trilho: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, marginTop: 8, overflow: "hidden" },
    trilhoCheio: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  });
