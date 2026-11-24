// "ENCONTRAR MINHAS FOTOS" · busca por selfie no álbum do batismo (24/11/2026).
//
// Fluxo em tela cheia, aberto pela galeria (`/batismo-fotos`), sem rota nova:
//   1. aceite: texto do consentimento + DUAS caixas obrigatórias + aviso de dados;
//   2. POST do aceite (`registrarConsentimentoBusca`) → só com `{ ok: true }` segue;
//   3. selfie SÓ pela câmera frontal; o JPEG que o picker grava no cache é
//      apagado logo depois de ler o base64;
//   4. a lista inteira do álbum (todas as páginas) e, só então, a WebView da
//      página do modelo (`PAGINA_BUSCA_FACIAL`), pequena mas visível;
//   5. `iniciar` depois do `pronto`; cada mensagem passa por `lerMensagem`.
//
// ⚠️⚠️ PRIVACIDADE: a selfie vive SÓ em `selfieRef` (memória do RN) enquanto a
// busca existe; distâncias só em `resultadosRef`. Nada disso vai para estado
// persistido, log, telemetria ou servidor. Ao sair (fechar, voltar ao álbum,
// entregar o resultado, desmontar) tudo é descartado; a galeria recebe só ids
// e contagens (`ResultadoBusca`).
// ⚠️ O RN é o DONO da lista e dos resultados: se a WebView morrer (iOS
// `onContentProcessDidTerminate`, Android `onRenderProcessGone`) ou o app for
// para o segundo plano no meio, a WebView é recriada e recebe `iniciar` só com
// as fotos que ainda não têm resposta.
// ⚠️ Nada de diálogo da casa aqui dentro: diálogo irmão nasce ATRÁS de <Modal>
// no iPhone. Todo retorno aparece na própria tela do fluxo.
import { Modal } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useLang, useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { registrarConsentimentoBusca, type FotoAlbum } from "@/lib/batismoFotos";
import { liberarTela, manterTelaAcordada } from "@/lib/telaAcordada";
import {
  CONSENTIMENTO_CAIXA_MAIORIDADE,
  CONSENTIMENTO_CAIXA_ROSTO,
  CONSENTIMENTO_CORPO,
  CONSENTIMENTO_ITENS,
  CONSENTIMENTO_TITULO,
  ESPERA_SEM_SINAL_MS,
  MAX_RECRIACOES,
  ORIGEM_BUSCA_FACIAL,
  PAGINA_BUSCA_FACIAL,
  SCRIPT_PARAR,
  acaoDoErro,
  dataUrlDaSelfie,
  erroDaLista,
  erroDoConsentimento,
  estimativaMb,
  faixa,
  fotosParaBusca,
  lerMensagem,
  mensagemDoErro,
  navegacaoPermitida,
  pendentes,
  podeComecar,
  resumirBusca,
  scriptIniciar,
  situacaoDaBusca,
  type ErroBusca,
  type ResultadoBusca,
} from "@/lib/buscaFacial";

const TAG_TELA = "cbrio-busca-facial";

type Fase =
  | { tipo: "aceite" }
  | { tipo: "preparando"; etapa: "consentimento" | "camera" | "lista" }
  | { tipo: "buscando" }
  /** Terminou com fotos que valem "Tentar de novo" (a selfie ainda está na memória). */
  | { tipo: "revisao" }
  | { tipo: "erro"; codigo: ErroBusca };

/** Em que ponto a página está (só para o texto da tela). */
type Etapa = "abrindo" | "retomando" | "lendo_selfie" | "fotos";

export function BuscaFacial({
  albumId,
  totalEstimado,
  carregarTodas,
  onFechar,
  onResultado,
}: {
  albumId: string;
  /** Quantas fotos o álbum tem (para o aviso de dados). */
  totalEstimado: number;
  /** Todas as páginas do álbum, com `busca_url` novas. Lança em erro. */
  carregarTodas(): Promise<FotoAlbum[]>;
  onFechar: () => void;
  onResultado: (r: ResultadoBusca) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();

  const [fase, setFase] = useState<Fase>({ tipo: "aceite" });
  const [aceites, setAceites] = useState({ rosto: false, maioridade: false });
  const [web, setWeb] = useState({ chave: 0, montada: false });
  const [etapa, setEtapa] = useState<Etapa>("abrindo");
  const [, redesenhar] = useReducer((x: number) => x + 1, 0);

  const ativa = useRef(true);
  const ocupadoRef = useRef(false);
  const webRef = useRef<WebView | null>(null);
  /** data URL da selfie · SÓ memória, SÓ durante a busca. */
  const selfieRef = useRef<string | null>(null);
  /** O aceite desta abertura do fluxo já foi registrado (outra selfie não conta de novo no limite diário). */
  const consentiuRef = useRef(false);
  /** Todos os ids do álbum, na ordem (a sequência ±2 usa esta ordem). */
  const ordemRef = useRef<string[]>([]);
  /** id → URL de busca (só as fotos que podem ser verificadas). */
  const urlsRef = useRef<Map<string, string>>(new Map());
  const resultadosRef = useRef<Map<string, number | null>>(new Map());
  const falhasRef = useRef<Map<string, number>>(new Map());
  /** Ids mandados no `iniciar` desta WebView: mensagem com id fora daqui é descartada. */
  const loteRef = useRef<string[]>([]);
  const loteSetRef = useRef<ReadonlySet<string>>(new Set());
  const iniciouRef = useRef(false);
  const buscandoRef = useRef(false);
  const pausadaRef = useRef(false);
  const recriacoesRef = useRef(0);
  const vigiaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Ciclo de vida ────────────────────────────────────────────────────────
  function limparVigia() {
    if (vigiaRef.current) clearTimeout(vigiaRef.current);
    vigiaRef.current = null;
  }

  function descartar() {
    limparVigia();
    selfieRef.current = null;
    resultadosRef.current = new Map();
    falhasRef.current = new Map();
    urlsRef.current = new Map();
    ordemRef.current = [];
    loteRef.current = [];
    loteSetRef.current = new Set();
    buscandoRef.current = false;
    pausadaRef.current = false;
  }

  useEffect(
    () => () => {
      ativa.current = false;
      try {
        webRef.current?.injectJavaScript(SCRIPT_PARAR);
      } catch {
        /* a WebView já foi embora */
      }
      descartar();
      liberarTela(TAG_TELA);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Tela acordada só enquanto procura (se o binário tiver o módulo nativo).
  useEffect(() => {
    if (fase.tipo !== "buscando") return;
    manterTelaAcordada(TAG_TELA);
    return () => liberarTela(TAG_TELA);
  }, [fase.tipo]);

  // Segundo plano no meio da busca: para a página; na volta, recria e retoma.
  const acoesRef = useRef({ pausar: () => {}, retomar: () => {} });
  acoesRef.current = { pausar, retomar };
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (!buscandoRef.current) return;
      if (estado === "background") acoesRef.current.pausar();
      else if (estado === "active" && pausadaRef.current) acoesRef.current.retomar();
    });
    return () => sub.remove();
  }, []);

  // ── WebView ──────────────────────────────────────────────────────────────
  function pararPagina() {
    try {
      webRef.current?.injectJavaScript(SCRIPT_PARAR);
    } catch {
      /* sem WebView */
    }
  }

  function armarVigia() {
    limparVigia();
    vigiaRef.current = setTimeout(() => {
      if (ativa.current && buscandoRef.current && !pausadaRef.current) falhar("tempo");
    }, ESPERA_SEM_SINAL_MS);
  }

  /** WebView NOVA (chave nova): página do zero, sem estado de busca anterior. */
  function montarWebView(etapaInicial: Etapa) {
    iniciouRef.current = false;
    setEtapa(etapaInicial);
    setWeb((w) => ({ chave: w.chave + 1, montada: true }));
    armarVigia();
  }

  function desmontarWebView() {
    setWeb((w) => (w.montada ? { ...w, montada: false } : w));
  }

  function definirLote(ids: string[]) {
    loteRef.current = ids;
    loteSetRef.current = new Set(ids);
  }

  function iniciarLote(ids: string[], etapaInicial: Etapa = "abrindo") {
    definirLote(ids);
    buscandoRef.current = true;
    recriacoesRef.current = 0;
    setFase({ tipo: "buscando" });
    // A lista terminou de carregar com o app já em segundo plano: espera a volta.
    if (AppState.currentState === "background") {
      pausadaRef.current = true;
      setEtapa("retomando");
      return;
    }
    pausadaRef.current = false;
    montarWebView(etapaInicial);
  }

  function enviarIniciar() {
    if (iniciouRef.current) return;
    const selfie = selfieRef.current;
    if (!selfie) {
      falhar("interno");
      return;
    }
    const fotos = loteRef.current.flatMap((id) => {
      const url = urlsRef.current.get(id);
      return url ? [{ id, url }] : [];
    });
    if (fotos.length === 0) {
      concluirLote();
      return;
    }
    iniciouRef.current = true;
    webRef.current?.injectJavaScript(scriptIniciar(selfie, fotos));
  }

  function aoMensagem(e: WebViewMessageEvent) {
    if (!ativa.current || !buscandoRef.current || pausadaRef.current) return;
    if (!navegacaoPermitida(e.nativeEvent.url)) return;
    const m = lerMensagem(e.nativeEvent.data, loteSetRef.current);
    if (!m) return;
    armarVigia();
    switch (m.t) {
      case "pronto":
        enviarIniciar();
        return;
      case "modelos":
        setEtapa((et) => (et === "fotos" ? et : "lendo_selfie"));
        return;
      case "selfie":
      case "progresso":
        setEtapa("fotos");
        return;
      case "foto":
        // A primeira resposta de cada foto vale; repetição é ignorada.
        if (resultadosRef.current.has(m.id)) return;
        resultadosRef.current.set(m.id, m.d);
        falhasRef.current.delete(m.id);
        recriacoesRef.current = 0;
        setEtapa("fotos");
        redesenhar();
        return;
      case "falha_foto":
        if (resultadosRef.current.has(m.id)) return;
        falhasRef.current.set(m.id, m.status);
        redesenhar();
        return;
      case "fim":
        concluirLote();
        return;
      case "erro":
        falhar(m.codigo);
        return;
    }
  }

  /** A WebView morreu (memória, sistema): recria e manda só o que falta. */
  function aoProcessoMorrer() {
    if (!ativa.current || !buscandoRef.current || pausadaRef.current) return;
    recriacoesRef.current += 1;
    if (recriacoesRef.current > MAX_RECRIACOES) {
      falhar("interno");
      return;
    }
    const falta = pendentes(loteRef.current, resultadosRef.current, falhasRef.current);
    if (falta.length === 0) {
      concluirLote();
      return;
    }
    definirLote(falta);
    montarWebView("retomando");
  }

  function aoErroDaPagina() {
    if (!ativa.current || !buscandoRef.current || pausadaRef.current) return;
    falhar("pagina");
  }

  function pausar() {
    if (!buscandoRef.current || pausadaRef.current) return;
    pausadaRef.current = true;
    pararPagina();
    limparVigia();
    desmontarWebView();
  }

  function retomar() {
    if (!ativa.current) return;
    pausadaRef.current = false;
    const falta = pendentes(loteRef.current, resultadosRef.current, falhasRef.current);
    if (falta.length === 0) {
      concluirLote();
      return;
    }
    iniciarLote(falta, "retomando");
  }

  // ── Fim, erro, entrega ───────────────────────────────────────────────────
  function comBusca(): ReadonlySet<string> {
    return new Set(urlsRef.current.keys());
  }

  function concluirLote() {
    limparVigia();
    buscandoRef.current = false;
    pausadaRef.current = false;
    desmontarWebView();
    const s = situacaoDaBusca(ordemRef.current, comBusca(), resultadosRef.current, falhasRef.current);
    if (s.retentaveis.length > 0) {
      setFase({ tipo: "revisao" });
      return;
    }
    entregar(false);
  }

  /** Entrega só ids e contagens à galeria e descarta selfie e distâncias. */
  function entregar(interrompida: boolean) {
    const r = resumirBusca(ordemRef.current, comBusca(), resultadosRef.current, falhasRef.current, interrompida);
    pararPagina();
    descartar();
    onResultado(r);
  }

  function falhar(codigo: ErroBusca) {
    pararPagina();
    limparVigia();
    buscandoRef.current = false;
    pausadaRef.current = false;
    desmontarWebView();
    // Só os erros passageiros guardam a selfie (para "Tentar de novo" retomar de onde parou).
    if (acaoDoErro(codigo) !== "recomecar") selfieRef.current = null;
    setFase({ tipo: "erro", codigo });
  }

  function parar() {
    entregar(true);
  }

  /**
   * X / voltar do Android. Busca em andamento ou já terminada NÃO é jogada fora
   * (cada uma conta no limite diário do servidor): vira o resultado até ali.
   * Antes disso, fecha e descarta.
   */
  function fechar() {
    if (fase.tipo === "buscando") {
      entregar(true);
      return;
    }
    if (fase.tipo === "revisao") {
      entregar(false);
      return;
    }
    pararPagina();
    descartar();
    onFechar();
  }

  /** "Voltar ao álbum" da tela de erro: sai sem resultado. */
  function sair() {
    pararPagina();
    descartar();
    onFechar();
  }

  // ── Começo: aceite → selfie → lista → busca ─────────────────────────────
  function aplicarLista(lista: readonly FotoAlbum[], manterResultados: boolean) {
    ordemRef.current = lista.map((f) => f.id);
    urlsRef.current = new Map(fotosParaBusca(lista).map((f) => [f.id, f.url] as const));
    if (!manterResultados) {
      resultadosRef.current = new Map();
      falhasRef.current = new Map();
    }
  }

  async function prepararEComecar() {
    setFase({ tipo: "preparando", etapa: "lista" });
    let lista: FotoAlbum[];
    try {
      lista = await carregarTodas();
    } catch (e) {
      if (ativa.current) falhar(erroDaLista(e));
      return;
    }
    if (!ativa.current) return;
    aplicarLista(lista, false);
    const ids = [...urlsRef.current.keys()];
    if (ids.length === 0) {
      falhar("indisponivel");
      return;
    }
    iniciarLote(ids);
  }

  async function tirarSelfie() {
    if (!podeComecar(aceites) || ocupadoRef.current) return;
    ocupadoRef.current = true;
    try {
      if (!consentiuRef.current) {
        setFase({ tipo: "preparando", etapa: "consentimento" });
        try {
          await registrarConsentimentoBusca(albumId, lang);
        } catch (e) {
          if (ativa.current) falhar(erroDoConsentimento(e));
          return;
        }
        if (!ativa.current) return;
        consentiuRef.current = true;
      }

      setFase({ tipo: "preparando", etapa: "camera" });
      let permitida = false;
      try {
        permitida = (await ImagePicker.requestCameraPermissionsAsync()).granted;
      } catch {
        permitida = false;
      }
      if (!ativa.current) return;
      if (!permitida) {
        falhar("camera_negada");
        return;
      }

      let res: ImagePicker.ImagePickerResult;
      try {
        // SÓ câmera frontal, nunca a galeria: a busca é pelo rosto de quem está com o celular.
        res = await ImagePicker.launchCameraAsync({
          cameraType: ImagePicker.CameraType.front,
          quality: 0.5,
          base64: true,
          exif: false,
        });
      } catch {
        if (ativa.current) falhar("camera");
        return;
      }
      const asset = res.canceled ? undefined : res.assets?.[0];
      let selfie: string | null = null;
      try {
        selfie = asset ? dataUrlDaSelfie(asset.base64) : null;
      } finally {
        // O picker grava o JPEG no cache mesmo com base64: apaga já (o texto promete que não fica).
        if (asset?.uri) await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
      }
      if (!ativa.current) return;
      if (!asset) {
        setFase({ tipo: "aceite" });
        return;
      }
      if (!selfie) {
        falhar("camera");
        return;
      }
      selfieRef.current = selfie;
      await prepararEComecar();
    } finally {
      ocupadoRef.current = false;
    }
  }

  /** "Tentar de novo" de um erro passageiro: retoma de onde parou (mesma selfie). */
  function tentarDeNovo() {
    if (selfieRef.current && urlsRef.current.size > 0) {
      const falta = pendentes(loteRef.current, resultadosRef.current, falhasRef.current);
      if (falta.length === 0) concluirLote();
      else iniciarLote(falta, "retomando");
      return;
    }
    if (selfieRef.current) {
      prepararEComecar();
      return;
    }
    setFase({ tipo: "aceite" });
  }

  /** "Tentar de novo" só nas fotos que não puderam ser verificadas. */
  async function tentarDeNovoFalhas() {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    try {
      const s = situacaoDaBusca(ordemRef.current, comBusca(), resultadosRef.current, falhasRef.current);
      if (s.recarregarLista) {
        // 410 = link vencido: páginas de novo antes, para ter `busca_url` novas.
        setFase({ tipo: "preparando", etapa: "lista" });
        try {
          const lista = await carregarTodas();
          if (!ativa.current) return;
          aplicarLista(lista, true);
        } catch (e) {
          if (ativa.current) falhar(erroDaLista(e));
          return;
        }
      }
      for (const id of s.retentaveis) falhasRef.current.delete(id);
      const ids = s.retentaveis.filter((id) => urlsRef.current.has(id));
      if (ids.length === 0) {
        entregar(false);
        return;
      }
      iniciarLote(ids);
    } finally {
      ocupadoRef.current = false;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  let feitas = 0;
  let encontradas = 0;
  for (const id of urlsRef.current.keys()) {
    if (resultadosRef.current.has(id)) {
      feitas += 1;
      if (faixa(resultadosRef.current.get(id)) === "forte") encontradas += 1;
    } else if (falhasRef.current.has(id)) {
      feitas += 1;
    }
  }
  const total = urlsRef.current.size;
  const mb = estimativaMb(totalEstimado);
  const fotosEncontradas = (n: number) => `${n} ${n === 1 ? t("foto encontrada") : t("fotos encontradas")}`;

  function conteudo() {
    switch (fase.tipo) {
      case "aceite":
        return (
          <ScrollView contentContainerStyle={[styles.rolagem, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.iconeTopo}>
              <Ionicons name="scan-outline" size={40} color={colors.brandMid} />
            </View>
            <Text style={styles.titulo}>{t(CONSENTIMENTO_TITULO)}</Text>
            <Text style={styles.texto}>
              {t("Tire uma selfie e o app separa as fotos do álbum em que você parece estar, para você não precisar procurar uma a uma.")}
            </Text>

            <View style={styles.aceite} accessibilityRole="summary">
              <Text style={styles.aceiteCorpo}>{t(CONSENTIMENTO_CORPO)}</Text>
              {CONSENTIMENTO_ITENS.map((item) => (
                <View key={item} style={styles.item}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.brandMid} style={{ marginTop: 1 }} />
                  <Text style={styles.itemTxt}>{t(item)}</Text>
                </View>
              ))}
              <View style={styles.caixas}>
                <Checkbox checked={aceites.rosto} onChange={(v) => setAceites((a) => ({ ...a, rosto: v }))} label={t(CONSENTIMENTO_CAIXA_ROSTO)} />
                <Checkbox
                  checked={aceites.maioridade}
                  onChange={(v) => setAceites((a) => ({ ...a, maioridade: v }))}
                  label={t(CONSENTIMENTO_CAIXA_MAIORIDADE)}
                />
              </View>
            </View>

            {mb > 0 && (
              <View style={styles.dados}>
                <Ionicons name="wifi-outline" size={18} color={colors.textMuted} />
                <Text style={styles.dadosTxt}>
                  {t("Vai usar cerca de")} {mb} MB {t("de internet. Prefira o Wi-Fi.")}
                </Text>
              </View>
            )}

            <Button
              title={t("Tirar selfie")}
              onPress={tirarSelfie}
              disabled={!podeComecar(aceites)}
              accessibilityState={{ disabled: !podeComecar(aceites) }}
            />
            <Text style={styles.nota}>{t("Deixe o app aberto nesta tela até a busca terminar.")}</Text>
          </ScrollView>
        );

      case "preparando":
        return (
          <View style={styles.centro}>
            <ActivityIndicator color={colors.brandMid} size="large" />
            <Text style={styles.texto}>
              {fase.etapa === "consentimento"
                ? t("Registrando sua autorização…")
                : fase.etapa === "camera"
                  ? t("Abrindo a câmera…")
                  : t("Carregando as fotos do álbum…")}
            </Text>
          </View>
        );

      case "buscando": {
        const naFoto = etapa === "fotos";
        const pct = total > 0 ? Math.round((Math.min(feitas, total) / total) * 100) : 0;
        return (
          <View style={styles.centro} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.brandMid} size="large" />
            <Text style={styles.tituloBusca}>
              {naFoto
                ? `${t("Procurando você…")} ${Math.min(feitas, total)} ${t("de")} ${total}`
                : etapa === "lendo_selfie"
                  ? t("Lendo a selfie…")
                  : etapa === "retomando"
                    ? t("Retomando a busca…")
                    : t("Preparando a busca…")}
            </Text>
            <View style={styles.trilho}>
              <View style={[styles.trilhoCheio, { width: `${pct}%` }]} />
            </View>
            {naFoto && <Text style={styles.texto}>{`${fotosEncontradas(encontradas)} ${t("até agora")}`}</Text>}
            <Text style={styles.nota}>
              {t("Deixe o app aberto nesta tela. Se ele for para o segundo plano, a busca continua de onde parou quando você voltar.")}
            </Text>
            <Pressable onPress={parar} style={({ pressed }) => [styles.botaoParar, pressed && { opacity: 0.7 }]} accessibilityRole="button">
              <Ionicons name="stop-circle-outline" size={20} color={colors.danger} />
              <Text style={styles.botaoPararTxt}>{t("Parar")}</Text>
            </Pressable>
          </View>
        );
      }

      case "revisao": {
        const s = situacaoDaBusca(ordemRef.current, comBusca(), resultadosRef.current, falhasRef.current);
        return (
          <View style={styles.centro}>
            <Ionicons name="checkmark-done-outline" size={44} color={colors.brandMid} />
            <Text style={styles.tituloBusca}>{t("A busca terminou.")}</Text>
            <Text style={styles.texto}>{fotosEncontradas(encontradas)}.</Text>
            <Text style={styles.texto}>
              {s.naoVerificadas} {s.naoVerificadas === 1 ? t("foto não pôde ser verificada.") : t("fotos não puderam ser verificadas.")}{" "}
              {t("Quer tentar de novo só nelas?")}
            </Text>
            <Button title={t("Tentar de novo")} onPress={tentarDeNovoFalhas} style={styles.botaoLargo} />
            <Button title={t("Ver resultado")} variant="ghost" onPress={() => entregar(false)} style={styles.botaoLargo} />
          </View>
        );
      }

      case "erro": {
        const acao = acaoDoErro(fase.codigo);
        const temAlgo = resultadosRef.current.size > 0;
        return (
          <View style={styles.centro}>
            <Ionicons name="alert-circle-outline" size={44} color={colors.textMuted} />
            <Text style={styles.texto}>{t(mensagemDoErro(fase.codigo))}</Text>
            {acao === "selfie" && <Button title={t("Tirar outra selfie")} onPress={tirarSelfie} style={styles.botaoLargo} />}
            {acao === "recomecar" && <Button title={t("Tentar de novo")} onPress={tentarDeNovo} style={styles.botaoLargo} />}
            {acao === "ajustes" && (
              <>
                <Button title={t("Abrir Ajustes")} onPress={() => Linking.openSettings().catch(() => {})} style={styles.botaoLargo} />
                <Button title={t("Tentar de novo")} variant="ghost" onPress={() => setFase({ tipo: "aceite" })} style={styles.botaoLargo} />
              </>
            )}
            {temAlgo && acao !== "selfie" && (
              <Button title={t("Ver o que foi encontrado")} variant="ghost" onPress={() => entregar(true)} style={styles.botaoLargo} />
            )}
            <Pressable onPress={sair} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>{t("Voltar ao álbum")}</Text>
            </Pressable>
          </View>
        );
      }
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={fechar} presentationStyle="fullScreen" statusBarTranslucent>
      <View style={[styles.fundo, { paddingTop: insets.top }]}>
        <View style={styles.topo}>
          <Pressable onPress={fechar} hitSlop={10} style={styles.fechar} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.topoTitulo}>{t("Encontrar minhas fotos")}</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={{ flex: 1 }}>{conteudo()}</View>

        {/* A página do modelo: montada de verdade (1×1, quase transparente) só
            DEPOIS do aceite e da selfie. Fora da tela ou com tamanho zero o iOS
            pode pausar o JavaScript dela. */}
        {fase.tipo === "buscando" && web.montada && (
          <View style={styles.caixaWeb} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <WebView
              key={web.chave}
              ref={webRef}
              source={{ uri: PAGINA_BUSCA_FACIAL }}
              originWhitelist={[ORIGEM_BUSCA_FACIAL]}
              onShouldStartLoadWithRequest={(req) => navegacaoPermitida(req.url)}
              javaScriptEnabled
              onMessage={aoMensagem}
              onError={aoErroDaPagina}
              onHttpError={aoErroDaPagina}
              onContentProcessDidTerminate={aoProcessoMorrer}
              onRenderProcessGone={aoProcessoMorrer}
              setSupportMultipleWindows={false}
              javaScriptCanOpenWindowsAutomatically={false}
              allowsLinkPreview={false}
              allowFileAccess={false}
              scrollEnabled={false}
              style={styles.web}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fundo: { flex: 1, backgroundColor: colors.background },
    topo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.glassBorder,
    },
    fechar: { width: 32 },
    topoTitulo: { flex: 1, textAlign: "center", color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    rolagem: { padding: spacing.lg, gap: spacing.md },
    iconeTopo: { alignItems: "center", marginTop: spacing.sm },
    titulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    texto: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22, textAlign: "center" },
    aceite: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    aceiteCorpo: { color: colors.text, fontSize: font.size.md, lineHeight: 22, fontWeight: "600" },
    item: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    itemTxt: { flex: 1, color: colors.text, fontSize: font.size.sm, lineHeight: 20 },
    caixas: { gap: spacing.md, marginTop: spacing.sm },
    dados: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    dadosTxt: { flex: 1, color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    nota: { color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: "center" },
    centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.xl },
    tituloBusca: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    trilho: { alignSelf: "stretch", height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
    trilhoCheio: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    botaoParar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 20,
      minHeight: 44,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    botaoPararTxt: { color: colors.danger, fontWeight: "800", fontSize: font.size.md },
    botaoLargo: { alignSelf: "stretch" },
    link: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "800", marginTop: spacing.sm },
    caixaWeb: { position: "absolute", left: spacing.md, bottom: spacing.md, width: 1, height: 1, opacity: 0.02, overflow: "hidden" },
    web: { width: 1, height: 1, backgroundColor: "transparent" },
  });
