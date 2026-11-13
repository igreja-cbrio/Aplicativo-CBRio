import { Text, TextInput } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { linkify } from "@/lib/linkify";
import { subirUmNivel } from "@/lib/hierarquia";
import { apiGet, apiPost } from "@/lib/api";
import {
  FRASE_PEDIR_HUMANO,
  LIMITE_DIGITANDO_MS,
  chaveConversa,
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

const WHATSAPP = "https://wa.me/5521997567770";
const MARCA_WHATSAPP = "WhatsApp"; // marca, não texto de interface

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
    } catch (e: any) {
      if (!vigente()) return;
      if (e?.status === 404 || e?.status === 403) return "morta" as const;
      semNovidade.current += 1;
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
    const vigente = () => ciclo.vigente(revisao) && escopoRef.current === escopo;
    if (timer.current) clearTimeout(timer.current);
    conversaRef.current = null; desdeRef.current = null; msgsRef.current = [];
    semNovidade.current = 0; enviandoRef.current = false; escaladoRef.current = false;
    restaurandoRef.current = true;
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
        const ok = await buscar();
        if (!vigente()) return;
        if (ok === "morta") {
          conversaRef.current = null; escaladoRef.current = false; setEscalado(false);
          await persistirChat(() => AsyncStorage.removeItem(chave));
        } else guardar(escaladoRef.current);
      } finally {
        if (vigente()) { restaurandoRef.current = false; setRestaurando(false); agendar(); }
      }
    })().catch(() => {});
    return () => { ciclo.reiniciar(); if (timer.current) clearTimeout(timer.current); };
  }, [chave, destino, escopo, buscar, agendar, guardar, ciclo]);

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
    if (timer.current) clearTimeout(timer.current);
    conversaRef.current = null; desdeRef.current = null; msgsRef.current = [];
    semNovidade.current = 0;
    setMsgs([]); setEscalado(false); setErro(null);
    if (chave) persistirChat(() => AsyncStorage.removeItem(chave)).catch(() => {});
  }, [chave, ciclo]);

  useFocusEffect(
    useCallback(() => {
      focada.current = true;
      if (conversaRef.current) { buscar().then(agendar); }
      return () => {
        focada.current = false;
        if (timer.current) clearTimeout(timer.current);
      };
    }, [buscar, agendar]),
  );
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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

  const aguardando = aguardandoResposta(msgs, enviando) && !escalado;
  const digitando = aguardando && !demorou;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TecladoSeguro style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Fale conosco")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.banner} accessibilityRole="text">
          <Ionicons name="sparkles" size={16} color={colors.brandMid} />
          <Text style={styles.bannerTxt}>
            {escalado ? t("Equipe CBRio") : t("Você está falando com o assistente automático da CBRio. Para falar com uma pessoa, use o botão abaixo.")}
          </Text>
        </View>

        <View style={styles.acoes}>
          <Button
            title={t("Falar com uma pessoa")}
            variant="ghost"
            disabled={enviando || escalado || restaurando}
            onPress={() => enviar(FRASE_PEDIR_HUMANO)}
          />
          <View style={styles.links}>
            <Pressable onPress={() => router.navigate("/fale-conosco")} accessibilityRole="button" accessibilityLabel={t("Outros canais")} hitSlop={6}>
              <Text style={styles.link}>{t("Outros canais")}</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(WHATSAPP)} accessibilityRole="button" accessibilityLabel={MARCA_WHATSAPP} hitSlop={6}>
              <Text style={styles.link}>{MARCA_WHATSAPP}</Text>
            </Pressable>
            <Pressable onPress={() => router.navigate("/falar-com-a-igreja")} accessibilityRole="button" accessibilityLabel={t("Falar com a CBRio")} hitSlop={6}>
              <Text style={styles.link}>{t("Falar com um pastor")}</Text>
            </Pressable>
          </View>
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
          onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.vazio}>{t("Escreva sua dúvida (horários, eventos, grupos, batismo…) que o assistente tenta ajudar.")}</Text>
          }
          renderItem={({ item }) => <Bolha m={item} styles={styles} t={t} />}
          ListFooterComponent={digitando ? <Text style={styles.digitando} accessibilityLiveRegion="polite">{t("Digitando…")}</Text> : null}
        />

        {aguardando && demorou ? (
          <Text style={styles.digitando} accessibilityLiveRegion="polite">
            {t("Está demorando mais que o normal. Se preferir, toque em “Falar com uma pessoa”.")}
          </Text>
        ) : null}
        {msgs.length > 0 || conversaRef.current ? (
          <Pressable disabled={enviando || restaurando} onPress={novaConversa} accessibilityRole="button" accessibilityLabel={t("Nova conversa")} hitSlop={6} style={{ alignSelf: "center" }}>
            <Text style={styles.link}>{t("Nova conversa")}</Text>
          </Pressable>
        ) : null}

        {erro ? <Text style={styles.erro} accessibilityRole="alert">{erro}</Text> : null}

        <View style={styles.compor}>
          <TextInput
            style={styles.input}
            editable={!restaurando}
            value={texto}
            onChangeText={setTexto}
            placeholder={t("Sua mensagem…")}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            accessibilityLabel={t("Sua mensagem")}
          />
          <Pressable
            style={[styles.enviar, (!texto.trim() || enviando || restaurando) && { opacity: 0.4 }]}
            disabled={!texto.trim() || enviando || restaurando}
            onPress={() => { const c = texto; setTexto(""); enviar(c); }}
            accessibilityRole="button"
            accessibilityLabel={t("Enviar")}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </TecladoSeguro>
    </SafeAreaView>
  );
}

function Bolha({ m, styles, t }: { m: MensagemChat; styles: ReturnType<typeof makeStyles>; t: (s: string) => string }) {
  const meu = m.autor === "membro";
  const rotulo = m.autor === "assistente" ? t("Assistente automático") : m.autor === "equipe" ? t("Equipe CBRio") : null;
  return (
    <View style={[styles.linha, meu ? styles.linhaMeu : styles.linhaOutro]}>
      {rotulo ? <Text style={styles.rotulo}>{rotulo}</Text> : null}
      <View style={[styles.bolha, meu ? styles.bolhaMeu : styles.bolhaOutro]}>
        <Text style={meu ? styles.txtMeu : styles.txtOutro}>
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
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    banner: {
      flexDirection: "row", alignItems: "center", gap: 8, margin: spacing.lg, marginBottom: spacing.sm,
      padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    },
    bannerTxt: { flex: 1, color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    acoes: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    links: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, justifyContent: "center" },
    link: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "600" },
    aviso: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg },
    avisoTxt: { color: colors.text, fontSize: font.size.sm, lineHeight: 19 },
    lista: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
    vazio: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 21, textAlign: "center", marginTop: spacing.lg },
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
    compor: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.sm },
    input: {
      flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.text, fontSize: font.size.md, maxHeight: 120,
    },
    enviar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandMid, alignItems: "center", justifyContent: "center" },
  });
