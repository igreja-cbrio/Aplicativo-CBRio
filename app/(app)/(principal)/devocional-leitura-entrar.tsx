import { ScrollView } from "@/components/navigation/DockContent";
import { Text, TextInput } from "@/components/ui/Typography";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { mensagemDoErro } from "@/lib/erroMensagem";
import { livrosDaLeitura, normalizarCodigo, resumoDosLivros } from "@/lib/leituraGrupo";
import { conviteLeitura, entrarNaLeitura, type ConviteLeitura } from "@/lib/leituraGrupoApi";

/**
 * Entrar numa leitura em grupo pelo CÓDIGO. Também é o destino do link
 * `cbrio://devocional-leitura-entrar?codigo=XXXXXX` (página cbrio.org/l/<código>).
 */
export default function EntrarLeitura() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT();
  const params = useLocalSearchParams<{ codigo?: string }>();
  const [codigo, setCodigo] = useState(normalizarCodigo(params.codigo ?? ""));
  const [convite, setConvite] = useState<ConviteLeitura | null>(null), [buscando, setBuscando] = useState(false), [naoAchou, setNaoAchou] = useState(false);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => { if (params.codigo) setCodigo(normalizarCodigo(params.codigo)); }, [params.codigo]);
  useEffect(() => {
    setConvite(null); setNaoAchou(false);
    if (codigo.length !== 6) return;
    let vivo = true;
    setBuscando(true);
    conviteLeitura(codigo).then(cv => { if (!vivo) return; setConvite(cv); setNaoAchou(!cv); })
      .catch(() => vivo && setNaoAchou(true)).finally(() => vivo && setBuscando(false));
    return () => { vivo = false; };
  }, [codigo]);

  async function entrar() {
    if (!convite) return;
    if (convite.ja_participa) return router.replace({ pathname: "/devocional-leitura", params: { leituraId: convite.id } });
    setEntrando(true);
    try {
      const id = await entrarNaLeitura(codigo);
      router.replace({ pathname: "/devocional-leitura", params: { leituraId: id } });
    } catch (e) { Alert.alert(t("Não foi possível entrar"), mensagemDoErro(e)); }
    finally { setEntrando(false); }
  }

  return <SafeAreaView style={s.safe} edges={["left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Entrar com código")}</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.muted}>{t("Digite o código de 6 letras que você recebeu.")}</Text>
      <TextInput style={s.codigo} value={codigo} onChangeText={v => setCodigo(normalizarCodigo(v))} autoCapitalize="characters" autoCorrect={false} maxLength={6} placeholder="······" placeholderTextColor={c.textMuted} />
      {buscando && <ActivityIndicator color={c.primary} />}
      {naoAchou && <Text style={s.erro}>{t("Código não encontrado. Confira com quem te convidou.")}</Text>}
      {convite && <View style={s.card}>
        <Text style={s.eyebrow}>{convite.criador_nome} {t("te chamou pra ler junto")}</Text>
        <Text style={s.cardTitle}>{convite.titulo}</Text>
        <Text style={s.muted}>{resumoDosLivros(livrosDaLeitura(convite))} · {convite.dias} {convite.dias === 1 ? t("dia") : t("dias")}{convite.fim_de_semana === false ? ` (${t("de segunda a sexta")})` : ""}</Text>
        <Text style={s.muted}>{convite.participantes} {convite.participantes === 1 ? t("pessoa") : t("pessoas")}</Text>
        <Pressable onPress={entrar} disabled={entrando} style={[s.cta, entrando && s.disabled]}><Text style={s.ctaTxt}>{convite.ja_participa ? t("Abrir leitura") : entrando ? t("Entrando...") : t("Entrar na leitura")}</Text></Pressable>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 }, muted: { color: c.textMuted, fontSize: 13, lineHeight: 19 }, erro: { color: "#A44343", fontSize: 13 },
  codigo: { backgroundColor: c.surface, color: c.text, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border, fontSize: 28, fontWeight: "900", letterSpacing: 6, textAlign: "center" },
  card: { backgroundColor: c.surface, borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: c.border }, eyebrow: { color: c.primary, fontSize: 12, fontWeight: "800" }, cardTitle: { color: c.text, fontSize: 20, fontWeight: "900" },
  cta: { backgroundColor: c.primary, padding: 15, borderRadius: 14, alignItems: "center", marginTop: 6 }, disabled: { opacity: .55 }, ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
