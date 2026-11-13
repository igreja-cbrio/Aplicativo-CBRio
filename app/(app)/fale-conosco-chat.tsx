import { AnexoChatEquipe } from "@/components/AnexoChatEquipe";
import { Text, TextInput } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, ActivityIndicator, FlatList, Image, Keyboard, Linking, Pressable, StyleSheet, View } from "react-native";
import * as Crypto from "expo-crypto";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMembro } from "@/contexts/MembroContext";
import { HistoricoAssistente, type ConversaAssistente } from "@/components/HistoricoAssistente";
import { useDitadoAssistente } from "@/hooks/useDitadoAssistente";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useColors } from "@/contexts/ThemeContext";
import { useT, useLang } from "@/lib/i18n";
import { linkify } from "@/lib/linkify";
import { subirUmNivel } from "@/lib/hierarquia";
import { apiGet, apiPost, enviarAnexoAssistente } from "@/lib/api";
import { escolherImagem, type ArquivoImagem } from "@/lib/escolherImagem";
import {
  FRASE_PEDIR_HUMANO,
  LIMITE_DIGITANDO_MS,
  chaveConversa,
  ehLocal,
  restaurarConversa,
  serializarConversa,
  aguardandoResposta,
  maiorCriadoEm,
  maiorSequencia,
  idConversaValido,
  mensagemLocal,
  mesclarMensagens,
  limparMensagensTransitorias,
  proximoIntervalo,
  type MensagemChat,
} from "@/lib/assistenteChat";
import { criarCicloChat, persistirChat } from "@/lib/assistenteChatCiclo";
import { font, radius, spacing, type Palette } from "@/constants/theme";


type RespostaEnvio = { conversa_id: string | null; resposta: string | null; escalado: boolean; limitado?: boolean; persistido?: boolean };
type RespostaLista = { mensagens: MensagemChat[]; status?: string };

/**
 * Chat "Fale conosco" com o assistente automático. É a porta PRINCIPAL, mas:
 *  - "Falar com uma pessoa" fica SEMPRE visível (não depende de o bot falhar);
 *  - os canais diretos (WhatsApp, e-mail, Instagram, mapa) e a porta pastoral
 *    seguem em /fale-conosco ("Outros canais").
 * Atualização por POLLING adaptativo só com a tela focada (nada de websocket).
 */
export default function FaleConoscoChatScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { user } = useAuth();
  const { membro } = useMembro();
  const { lang } = useLang();
  const [audioAtivo, setAudioAtivo] = useState<string | null>(null);
  useFocusEffect(useCallback(() => () => setAudioAtivo(null), []));
  useEffect(() => {
    const sub = AppState.addEventListener("change", estado => { if (estado !== "active") setAudioAtivo(null); });
    return () => sub.remove();
  }, []);
  const [historico, setHistorico] = useState(false);
  const [carregandoConversa, setCarregandoConversa] = useState(false);
  const [erroConversa, setErroConversa] = useState(false);
  const chave = user?.id ? chaveConversa(user.id) : null;
  const usuarioRef = useRef(user?.id);
  usuarioRef.current = user?.id;
  const parametros = useLocalSearchParams<{ conversa_id?: string }>();
  const destino = idConversaValido(parametros.conversa_id) ? parametros.conversa_id : null;
  const escopo = `${chave || ''}:${destino || ''}`;
  const escopoRef = useRef(escopo);
  escopoRef.current = escopo;
  const ciclo = useRef(criarCicloChat()).current;
  const restaurandoRef = useRef(true);
  const [restaurando, setRestaurando] = useState(true);

  const [msgs, setMsgs] = useState<MensagemChat[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [escalado, setEscalado] = useState(false);
  const [demorou, setDemorou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anexo, setAnexo] = useState<ArquivoImagem | null>(null);
  const [falhouFoto, setFalhouFoto] = useState(false);
  const [falhouErro, setFalhouErro] = useState<string | null>(null);

  // client_id da foto pendente: o MESMO no retry (o servidor casa a otimista por ele)
  const voz = useDitadoAssistente(setTexto, (codigo) => {
    const mensagens: Record<string, string> = {
      atualizar: t("Atualize o app na loja para usar o ditado por voz."),
      permissao: t("Permita o microfone e o reconhecimento de fala nos ajustes do celular."),
      indisponivel: t("O reconhecimento de fala não está disponível neste aparelho."),
      falha: t("Não foi possível transcrever. Tente novamente ou digite sua mensagem."),
      silencio: t("Não consegui ouvir. Toque no microfone para tentar novamente."),
    };
    setErro(mensagens[codigo]);
  });
  const cancelarVoz = voz.cancelar;
  const clientIdFoto = useRef<string | null>(null);
  const msgsRef = useRef<MensagemChat[]>([]);
  const conversaRef = useRef<string | null>(null);
  const desdeRef = useRef<string | null>(null);
  const semNovidade = useRef(0);
  const seq = useRef(0);
  const focada = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lista = useRef<FlatList<MensagemChat>>(null);
  const enviandoRef = useRef(false);
  const escaladoRef = useRef(false);
  escaladoRef.current = escalado;

  const aplicar = useCallback((recebidas: MensagemChat[]) => {
    const r = mesclarMensagens(msgsRef.current, recebidas, desdeRef.current);
    msgsRef.current = r.mensagens;
    desdeRef.current = r.desde;
    semNovidade.current = r.houveNovidade ? 0 : semNovidade.current + 1;
    setMsgs(r.mensagens);
  }, []);

  const buscar = useCallback(async () => {
    const id = conversaRef.current;
    const revisao = ciclo.atual();
    const origem = escopoRef.current;
    const usuario = usuarioRef.current;
    if (!id || !usuario) return;
    const token = ciclo.iniciarConsulta();
    if (!token) return;
    const vigente = () => ciclo.vigente(revisao) && escopoRef.current === origem && conversaRef.current === id;
    try {
      const apos = maiorSequencia(msgsRef.current);
      const q = apos !== null ? `?apos=${apos}` : "";
      const r = await apiGet<RespostaLista>(`/app/assistente/${encodeURIComponent(id)}/mensagens${q}`, { expectedUserId: usuario });
      if (!vigente()) return;
      aplicar(Array.isArray(r?.mensagens) ? r.mensagens : []);
      if (r.status === "humano") { escaladoRef.current = true; setEscalado(true); }
      setErroConversa(false);
    } catch (e: any) {
      if (!vigente()) return;
      if (e?.status === 404 || e?.status === 403) return "morta" as const;
      semNovidade.current += 1;
      return "falha" as const;
    } finally {
      ciclo.terminarConsulta(token);
    }
  }, [aplicar, ciclo]);

  const agendar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!focada.current || !conversaRef.current || restaurandoRef.current) return;
    const revisao = ciclo.atual();
    const origem = escopoRef.current;
    const espera = proximoIntervalo(semNovidade.current, aguardandoResposta(msgsRef.current, enviandoRef.current));
    timer.current = setTimeout(async () => {
      await buscar();
      if (ciclo.vigente(revisao) && escopoRef.current === origem) agendar();
    }, espera);
  }, [buscar, ciclo]);

  const guardar = useCallback((escaladoAgora: boolean) => {
    const id = conversaRef.current;
    if (!chave || !id) return;
    persistirChat(() => AsyncStorage.setItem(chave, serializarConversa({ conversa_id: id, escalado: escaladoAgora }))).catch(() => {});
  }, [chave]);

  useEffect(() => {
    const revisao = ciclo.reiniciar();
    cancelarVoz(); setHistorico(false); setErroConversa(false); setCarregandoConversa(false);
    const vigente = () => ciclo.vigente(revisao) && escopoRef.current === escopo;
    if (timer.current) clearTimeout(timer.current);
    conversaRef.current = null; desdeRef.current = null; msgsRef.current = [];
    semNovidade.current = 0; enviandoRef.current = false; escaladoRef.current = false;
    restaurandoRef.current = true;
    setAnexo(null); setFalhouFoto(false); setFalhouErro(null); clientIdFoto.current = null;
    setMsgs([]); setTexto(""); setEscalado(false); setErro(null); setEnviando(false); setRestaurando(true);
    (async () => {
      try {
        if (!chave) return;
        const raw = await persistirChat(() => AsyncStorage.getItem(chave));
        if (!vigente()) return;
        const c = destino ? { conversa_id: destino, escalado: false } : restaurarConversa(raw);
        if (!c) return;
        conversaRef.current = c.conversa_id;
        escaladoRef.current = c.escalado; setEscalado(c.escalado);
        setCarregandoConversa(true);
        const ok = await buscar();
        if (!vigente()) return;
        setErroConversa(ok === "falha");
        if (ok === "morta") {
          conversaRef.current = null; escaladoRef.current = false; setEscalado(false);
          await persistirChat(() => AsyncStorage.removeItem(chave));
        } else guardar(escaladoRef.current);
      } finally {
        if (vigente()) { restaurandoRef.current = false; setRestaurando(false); setCarregandoConversa(false); agendar(); }
      }
    })().catch(() => {});
    return () => { ciclo.reiniciar(); if (timer.current) clearTimeout(timer.current); };
  }, [chave, destino, escopo, buscar, agendar, guardar, ciclo, cancelarVoz]);

  // "Digitando…" não dura para sempre: passado o limite, troca por uma dica.
  const ultimaId = msgs[msgs.length - 1]?.id;
  useEffect(() => {
    setDemorou(false);
    if (!aguardandoResposta(msgsRef.current, enviando) || escalado) return;
    const h = setTimeout(() => setDemorou(true), LIMITE_DIGITANDO_MS);
    return () => clearTimeout(h);
  }, [ultimaId, enviando, escalado]);

  const novaConversa = useCallback(() => {
    if (enviandoRef.current || restaurandoRef.current) return;
    ciclo.reiniciar(); escaladoRef.current = false;
    cancelarVoz(); setHistorico(false); setErroConversa(false); setCarregandoConversa(false);
    if (timer.current) clearTimeout(timer.current);
    conversaRef.current = null; desdeRef.current = null; msgsRef.current = [];
    semNovidade.current = 0;
    setMsgs([]); setEscalado(false); setErro(null);
    setAnexo(null); setFalhouFoto(false); setFalhouErro(null); setTexto(""); clientIdFoto.current = null;
    if (chave) persistirChat(() => AsyncStorage.removeItem(chave)).catch(() => {});
  }, [chave, ciclo, cancelarVoz]);

  const selecionarConversa = useCallback(async (c: ConversaAssistente) => {
    if (enviandoRef.current || restaurandoRef.current || !usuarioRef.current) return;
    novaConversa();
    conversaRef.current = c.id;
    escaladoRef.current = c.status === "humano";
    setEscalado(escaladoRef.current); guardar(escaladoRef.current);
    const revisao = ciclo.atual();
    const origem = escopoRef.current;
    restaurandoRef.current = true; setRestaurando(true); setCarregandoConversa(true);
    const resultado = await buscar();
    if (!ciclo.vigente(revisao) || escopoRef.current !== origem) return;
    restaurandoRef.current = false; setRestaurando(false);
    setCarregandoConversa(false); setErroConversa(resultado === "falha");
    if (resultado === "morta") { novaConversa(); setErro(t("Conversa não encontrada.")); }
    else { if (resultado === "falha") setErro(t("Não foi possível carregar as mensagens. Tente novamente.")); agendar(); }
  }, [novaConversa, guardar, buscar, agendar, t, ciclo]);

  const anexar = useCallback(async (origem: "camera" | "galeria") => {
    if (enviandoRef.current || restaurandoRef.current) return;
    cancelarVoz(); Keyboard.dismiss();
    const revisao = ciclo.atual();
    const escopoInicial = escopoRef.current;
    const vigente = () => ciclo.vigente(revisao) && escopoRef.current === escopoInicial && !enviandoRef.current && !restaurandoRef.current;
    try {
      const f = await escolherImagem(origem, t);
      if (!f || !vigente()) return;
      clientIdFoto.current = Crypto.randomUUID();
      setFalhouFoto(false); setErro(null); setAnexo(f);
    } catch { if (vigente()) setErro(t("Não foi possível abrir a foto. Tente novamente.")); }
  }, [t, cancelarVoz, ciclo]);

  useFocusEffect(
    useCallback(() => {
      focada.current = true;
      if (conversaRef.current) { buscar().then(agendar); }
      return () => {
        focada.current = false; cancelarVoz();
        if (timer.current) clearTimeout(timer.current);
      };
    }, [buscar, agendar, cancelarVoz]),
  );

  const enviar = useCallback(async (corpo: string) => {
    const limpo = corpo.trim();
    const usuario = usuarioRef.current;
    if (!usuario || !limpo || enviandoRef.current || restaurandoRef.current || !chave) return;
    const revisao = ciclo.atual();
    const origem = escopoRef.current;
    const vigente = () => ciclo.vigente(revisao) && escopoRef.current === origem;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    // otimista: o "agora" herda o cursor (sem relógio) para cair no fim da lista
    const marca = maiorCriadoEm(msgsRef.current) ?? "1970-01-01T00:00:00Z";
    seq.current += 1;
    const local = mensagemLocal(seq.current, "membro", limpo, marca);
    msgsRef.current = [...msgsRef.current, local];
    setMsgs(msgsRef.current);
    try {
      const r = await apiPost<RespostaEnvio>("/app/assistente", {
        texto: limpo,
        ...(conversaRef.current ? { conversa_id: conversaRef.current } : {}),
      }, { expectedUserId: usuario });
      if (!vigente()) return;
      if (idConversaValido(r.conversa_id)) conversaRef.current = r.conversa_id;
      if (r.escalado) { escaladoRef.current = true; setEscalado(true); }
      guardar(!!r.escalado || escaladoRef.current);
      if ((r.limitado || r.persistido === false) && r.resposta) {
        seq.current += 1;
        msgsRef.current = msgsRef.current.map(m => m.id === local.id ? { ...m, transitoria: true } : m);
        aplicar([{ ...mensagemLocal(seq.current, "assistente", r.resposta, marca), transitoria: true }]);
      } else if (!r.limitado && r.persistido !== false) {
        msgsRef.current = limparMensagensTransitorias(msgsRef.current);
        setMsgs(msgsRef.current);
      }
      semNovidade.current = 0;
      await buscar();
    } catch (e: any) {
      if (!vigente()) return;
      msgsRef.current = msgsRef.current.filter((m) => m.id !== local.id);
      setMsgs(msgsRef.current);
      setTexto((atual) => atual || limpo);
      setErro(e?.message || t("Não foi possível enviar. Tente de novo."));
    } finally {
      if (!vigente()) return;
      enviandoRef.current = false;
      setEnviando(false);
      agendar();
    }
  }, [aplicar, buscar, agendar, guardar, t, chave, ciclo]);

  // Foto (com ou sem legenda). Caminho separado do texto puro, que segue por /app/assistente.
  const enviarComFoto = useCallback(async (arquivo: ArquivoImagem, corpo: string) => {
    const usuario = usuarioRef.current;
    if (!usuario || !chave || enviandoRef.current || restaurandoRef.current) return;
    const revisao = ciclo.atual();
    const origem = escopoRef.current;
    const vigente = () => ciclo.vigente(revisao) && escopoRef.current === origem;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    setFalhouFoto(false);
    setFalhouErro(null);
    const limpo = corpo.trim();
    if (!clientIdFoto.current) clientIdFoto.current = Crypto.randomUUID();
    const client_id = clientIdFoto.current;
    const marca = maiorCriadoEm(msgsRef.current) ?? "1970-01-01T00:00:00Z";
    seq.current += 1;
    const local = mensagemLocal(seq.current, "membro", limpo, marca, { client_id, anexo_url: arquivo.uri });
    msgsRef.current = [...msgsRef.current, local];
    setMsgs(msgsRef.current);
    try {
      const r = await enviarAnexoAssistente(arquivo, {
        texto: limpo || undefined,
        conversa_id: conversaRef.current || undefined,
        client_id,
        expectedUserId: usuario,
      });
      if (!vigente()) return;
      if (idConversaValido(r.conversa_id)) conversaRef.current = r.conversa_id;
      if (r.escalado) { escaladoRef.current = true; setEscalado(true); }
      msgsRef.current = limparMensagensTransitorias(msgsRef.current);
      setMsgs(msgsRef.current);
      guardar(!!r.escalado || escaladoRef.current);
      setAnexo(null);
      setTexto("");
      clientIdFoto.current = null;
      semNovidade.current = 0;
      await buscar();
    } catch (e: any) {
      if (!vigente()) return;
      // mantém a foto e o texto para reenviar; tira só a bolha otimista
      msgsRef.current = msgsRef.current.filter((m) => m.id !== local.id);
      setMsgs(msgsRef.current);
      setFalhouFoto(true);
      setFalhouErro(e?.message || null);
    } finally {
      if (!vigente()) return;
      enviandoRef.current = false;
      setEnviando(false);
      agendar();
    }
  }, [buscar, agendar, guardar, chave, ciclo]);

  const bloqueado = enviando || restaurando || carregandoConversa || erroConversa || !user?.id;
  const aguardando = aguardandoResposta(msgs, enviando) && !escalado;
  const digitando = aguardando && !demorou;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TecladoSeguro style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Assistente")}</Text>
          <Pressable onPress={() => { cancelarVoz(); Keyboard.dismiss(); setHistorico(true); }} disabled={enviando || restaurando}
            style={styles.back} accessibilityRole="button" accessibilityLabel={t("Histórico de conversas")}>
            <Ionicons name="time-outline" size={26} color={colors.brandMid} />
          </Pressable>
        </View>

        {escalado && (
          <View style={styles.aviso} accessibilityLiveRegion="polite">
            <Text style={styles.avisoTxt}>{t("A pessoa certa vai te responder aqui. Pode fechar a tela: a resposta fica guardada.")}</Text>
          </View>
        )}

        <FlatList
          ref={lista}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onTouchStart={() => Keyboard.dismiss()}
          onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            conversaRef.current ? <View style={styles.boasVindas}>
              {carregandoConversa || !erroConversa ? <ActivityIndicator color={colors.brandMid} accessibilityLabel={t("Carregando")} /> : <Pressable
                accessibilityRole="button" onPress={() => selecionarConversa({ id: conversaRef.current!, status: escalado ? "humano" : "bot", titulo: "", created_at: "" })}>
                <Text style={styles.link}>{t("Não foi possível carregar as mensagens. Tente novamente.")}</Text>
              </Pressable>}
            </View> : <View style={styles.boasVindas}>
              <Text style={styles.saudacao}>{membro?.nome ? t("Olá, {nome}!").replace("{nome}", membro.nome.trim()) : t("Olá!")}</Text>
              <Text style={styles.saudacao}>{t("Como posso te ajudar?")}</Text>
              <Text style={styles.vazio}>{t("Assistente automático da CBRio")}</Text>
            </View>
          }
          renderItem={({ item }) => <Bolha conversa={conversaRef.current || ""} identidade={escopo} ativo={audioAtivo === `${escopo}:${conversaRef.current}:${item.id}`} ativar={() => setAudioAtivo(`${escopo}:${conversaRef.current}:${item.id}`)} m={item} styles={styles} t={t} subindo={enviando && ehLocal(item)} />}
          ListFooterComponent={digitando ? <Text style={styles.digitando} accessibilityLiveRegion="polite">{t("Digitando…")}</Text> : null}
        />

        {aguardando && demorou ? (
          <Text style={styles.digitando} accessibilityLiveRegion="polite">
            {t("Está demorando mais que o normal. Se preferir, toque em “Falar com uma pessoa”.")}
          </Text>
        ) : null}
        {falhouFoto && anexo ? (
          <Pressable disabled={bloqueado || voz.ativo} onPress={() => enviarComFoto(anexo, texto)} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.erro} accessibilityRole="alert">{falhouErro ? `${t("Não enviou")}: ${falhouErro}. ${t("Toque para reenviar ou escolha outra foto")}` : t("Não enviou. Toque para reenviar")}</Text>
          </Pressable>
        ) : erro ? <Text style={styles.erro} accessibilityRole="alert">{erro}</Text> : null}

        {anexo ? (
          <View style={styles.previa}>
            <Image source={{ uri: anexo.uri }} style={styles.miniatura} resizeMode="cover" accessibilityIgnoresInvertColors />
            <Pressable
              style={styles.removerAnexo}
              onPress={() => { setAnexo(null); setFalhouFoto(false); clientIdFoto.current = null; }}
              disabled={enviando || restaurando}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("Remover foto")}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.apoio}>
          <Pressable style={styles.apoioPrincipal} onPress={() => { cancelarVoz(); enviar(FRASE_PEDIR_HUMANO); }}
            disabled={bloqueado || escalado || voz.ativo} accessibilityRole="button">
            <View style={styles.apoioIcone}><Ionicons name="chatbubbles-outline" size={24} color={colors.brandMid} /></View>
            <Text style={styles.apoioTexto}>{escalado ? t("Equipe CBRio") : t("Falar com uma pessoa")}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => router.navigate("/fale-conosco")} style={styles.outros} accessibilityRole="button">
            <Text style={styles.link}>{t("Outros canais")}</Text>
          </Pressable>
        </View>
        {voz.ativo ? <View style={styles.voz} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.brandMid} />
          <Text style={styles.vozTexto}>{voz.estado === "permissao" ? t("Aguardando permissão…") : voz.estado === "finalizando" ? t("Concluindo transcrição…") : t("Ouvindo… Toque em parar para revisar.")}</Text>
          <Pressable onPress={() => voz.cancelar(true)} accessibilityRole="button" style={styles.clipe} accessibilityLabel={t("Cancelar ditado")}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
        </View> : null}
        <View style={styles.compor}>
          <Pressable style={styles.clipe} onPress={() => anexar("galeria")} disabled={bloqueado || voz.ativo}
            accessibilityRole="button" accessibilityLabel={t("Escolher da galeria")}>
            <Ionicons name="add" size={28} color={colors.text} />
          </Pressable>
          <TextInput style={styles.input} value={texto} onChangeText={setTexto}
            editable={!bloqueado && !voz.ativo} placeholder={t("Pergunte algo")}
            placeholderTextColor={colors.textMuted} multiline maxLength={1000} accessibilityLabel={t("Sua mensagem")} />
          <Pressable style={styles.clipe} onPress={() => anexar("camera")} disabled={bloqueado || voz.ativo}
            accessibilityRole="button" accessibilityLabel={t("Tirar foto")}>
            <Ionicons name="camera-outline" size={25} color={colors.text} />
          </Pressable>
          <Pressable style={[styles.enviar, enviando && { opacity: 0.4 }]} disabled={bloqueado || voz.estado === "permissao" || voz.estado === "finalizando"}
            onPress={() => {
              if (voz.ativo) { voz.parar(); return; }
              if (anexo) { enviarComFoto(anexo, texto); return; }
              if (texto.trim()) { const c = texto; setTexto(""); enviar(c); return; }
              setErro(null); Keyboard.dismiss(); voz.iniciar(texto, lang === "en" ? "en-US" : lang === "es" ? "es-ES" : lang);
            }} accessibilityRole="button" accessibilityLabel={voz.ativo ? t("Parar ditado") : texto.trim() || anexo ? t("Enviar") : t("Ditar mensagem")}>
            {enviando ? <ActivityIndicator color="#fff" /> : <Ionicons name={voz.ativo ? "stop" : texto.trim() || anexo ? "arrow-up" : "mic-outline"} size={25} color="#fff" />}
          </Pressable>
        </View>
        <HistoricoAssistente aberto={historico} identidade={chave} fechar={() => setHistorico(false)} selecionar={selecionarConversa}
          nova={novaConversa} />
      </TecladoSeguro>
    </SafeAreaView>
  );
}

function Bolha({ m, styles, t, subindo, conversa, identidade, ativo, ativar }: { conversa: string; identidade: string; ativo: boolean; ativar: () => void; m: MensagemChat; styles: ReturnType<typeof makeStyles>; t: (s: string) => string; subindo?: boolean }) {
  const meu = m.autor === "membro";
  const rotulo = m.autor === "assistente" ? t("Assistente automático") : m.autor === "equipe" ? t("Equipe CBRio") : null;
  return (
    <View style={[styles.linha, meu ? styles.linhaMeu : styles.linhaOutro]}>
      {rotulo ? <Text style={styles.rotulo}>{rotulo}</Text> : null}
      <View style={[styles.bolha, meu ? styles.bolhaMeu : styles.bolhaOutro, subindo && !!m.anexo_url && { opacity: 0.6 }]}>
        {m.anexo_mime && !m.anexo_mime.startsWith("image/") ? (
          <AnexoChatEquipe key={`${identidade}:${conversa}:${m.id}`} conversa={conversa} mensagem={m.id} mime={m.anexo_mime} ativo={ativo} ativar={ativar} />
        ) : m.anexo_url ? (
          <Image
            source={{ uri: m.anexo_url }}
            style={[styles.foto, !!m.corpo && { marginBottom: 6 }]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            accessibilityLabel={t("Foto enviada")}
          />
        ) : null}
        {m.corpo ? <Text style={meu ? styles.txtMeu : styles.txtOutro}>
          {linkify(m.corpo).map((p, i) =>
            p.tipo === "link" ? (
              <Text
                key={i}
                style={meu ? styles.linkMeu : styles.linkBolha}
                accessibilityRole="link"
                onPress={() => { Promise.resolve(Linking.openURL(p.url)).catch(() => {}); }}
              >
                {p.texto}
              </Text>
            ) : (
              p.texto
            ),
          )}
        </Text> : null}
        {subindo && !!m.anexo_url ? <Text style={styles.subindo}>{t("Enviando…")}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    back: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt },
    title: { color: colors.text, fontSize: 22, fontWeight: "700" },
    link: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "600" },
    aviso: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg },
    avisoTxt: { color: colors.text, fontSize: font.size.sm, lineHeight: 19 },
    lista: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
    boasVindas: { paddingTop: 30, gap: 4 },
    saudacao: { fontSize: 29, lineHeight: 38, fontWeight: "700", color: colors.text },
    apoio: { paddingHorizontal: 20, paddingTop: 8 },
    apoioPrincipal: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 24, backgroundColor: colors.surfaceAlt },
    apoioIcone: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    apoioTexto: { flex: 1, color: colors.text, fontSize: 16 },
    outros: { alignSelf: "center", minHeight: 36, justifyContent: "center" },
    voz: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 8 },
    vozTexto: { flex: 1, color: colors.textMuted, fontSize: 13 },
    vazio: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 21, textAlign: "left", marginTop: 16 },
    linha: { maxWidth: "85%", gap: 2 },
    linhaMeu: { alignSelf: "flex-end", alignItems: "flex-end" },
    linhaOutro: { alignSelf: "flex-start", alignItems: "flex-start" },
    rotulo: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    bolha: { borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
    bolhaMeu: { backgroundColor: colors.brandMid },
    bolhaOutro: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    txtMeu: { color: "#fff", fontSize: font.size.md, lineHeight: 21 },
    txtOutro: { color: colors.text, fontSize: font.size.md, lineHeight: 21 },
    linkBolha: { color: colors.brandMid, textDecorationLine: "underline" },
    linkMeu: { color: "#fff", textDecorationLine: "underline" },
    digitando: { color: colors.textMuted, fontSize: font.size.sm, fontStyle: "italic", marginTop: spacing.xs },
    erro: { color: colors.danger, fontSize: font.size.sm, paddingHorizontal: spacing.lg },
    compor: { flexDirection: "row", alignItems: "flex-end", gap: 2, marginHorizontal: 16, marginBottom: 10, padding: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 32, backgroundColor: colors.surface },
    input: {
      flex: 1, minWidth: 0, minHeight: 48,
      paddingHorizontal: 4, paddingVertical: 13, color: colors.text, fontSize: font.size.md, maxHeight: 120,
    },
    clipe: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
    previa: { marginHorizontal: spacing.lg, marginTop: spacing.sm, width: 64, height: 64 },
    miniatura: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surface },
    removerAnexo: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
    foto: { width: 220, aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surface },
    subindo: { color: "#fff", fontSize: font.size.sm, marginTop: 4, opacity: 0.85 },
    enviar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandMid, alignItems: "center", justifyContent: "center" },
  });
