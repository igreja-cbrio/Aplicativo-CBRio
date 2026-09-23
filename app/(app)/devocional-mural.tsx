import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { listarMural, publicarNoMural, type PostMural } from "@/lib/devocional";
import { subirUmNivel } from "@/lib/hierarquia";
import { useT } from "@/lib/i18n";

const ALCANCES: { valor: PostMural["alcance"]; rotulo: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { valor: "grupo", rotulo: "Meu grupo", icone: "people-outline" },
  { valor: "servir", rotulo: "Quem serve comigo", icone: "heart-outline" },
  { valor: "igreja", rotulo: "Toda a igreja", icone: "globe-outline" },
];
export default function Mural() {
  const c = useColors(), s = useMemo(() => css(c), [c]), { membro } = useMembro(), t = useT();
  const params = useLocalSearchParams<{ referencia?: string; textoBiblico?: string; itemId?: string }>();
  const [posts, setPosts] = useState<PostMural[]>([]), [referencia, setReferencia] = useState(params.referencia ?? ""), [texto, setTexto] = useState("");
  const [alcance, setAlcance] = useState<PostMural["alcance"]>("igreja"), [carregando, setCarregando] = useState(true), [enviando, setEnviando] = useState(false);
  async function carregar() { setPosts(await listarMural()); setCarregando(false); }
  useEffect(() => { carregar().catch(e => Alert.alert(t("Erro"), e.message)); }, [t]);
  async function publicar() {
    if (!membro?.membroId || !referencia.trim() || texto.trim().length < 2) return Alert.alert(t("Falta pouco"), t("Informe a referência e seu comentário."));
    setEnviando(true);
    try {
      await publicarNoMural({ membroId: membro.membroId, texto, alcance, referenciaBiblica: referencia, textoBiblico: params.textoBiblico, itemId: params.itemId });
      setReferencia(""); setTexto(""); await carregar();
    } catch (e) { Alert.alert(t("Não foi possível publicar"), e instanceof Error ? e.message : t("Tente novamente.")); }
    finally { setEnviando(false); }
  }
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => params.referencia ? router.back() : subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Comentários")}</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>{t("COMUNIDADE")}</Text><Text style={s.title}>{t("Comentários da comunidade")}</Text>
      <Text style={s.muted}>{t("Compartilhe com responsabilidade. Sua publicação será identificada com seu nome.")}</Text>
      <View style={s.composer}>
        {params.textoBiblico ? <View style={s.selectedVerse}><Text style={s.ref}>{referencia}</Text><Text style={s.quote}>“{params.textoBiblico.trim()}”</Text></View> :
          <TextInput style={s.input} value={referencia} onChangeText={setReferencia} placeholder={t("Referência bíblica (ex.: 1Cr 2.3)")} placeholderTextColor={c.textMuted} />}
        <TextInput style={[s.input, s.area]} value={texto} onChangeText={setTexto} placeholder={t("O que esse texto falou com você?")} placeholderTextColor={c.textMuted} multiline maxLength={1200} />
        <Text style={s.label}>{t("Quem pode ver?")}</Text>
        <View style={s.audiences}>{ALCANCES.map(a => <Pressable key={a.valor} onPress={() => setAlcance(a.valor)} style={[s.audience, alcance === a.valor && s.audienceOn]}><Ionicons name={a.icone} size={16} color={alcance === a.valor ? "#fff" : c.textMuted} /><Text style={[s.audienceText, alcance === a.valor && s.audienceTextOn]}>{t(a.rotulo)}</Text></Pressable>)}</View>
        <Pressable style={[s.cta, enviando && s.disabled]} onPress={publicar} disabled={enviando}><Text style={s.ctaText}>{enviando ? t("Publicando...") : t("Publicar comentário")}</Text></Pressable>
      </View>
      <Text style={s.feedTitle}>{t("Publicações recentes")}</Text>
      {carregando ? <ActivityIndicator color={c.primary} /> : posts.map(p => <View key={p.id} style={s.card}>
        <View style={s.authorRow}><View style={s.avatar}><Text style={s.avatarText}>{p.autor_nome?.trim().charAt(0).toUpperCase()}</Text></View><View style={s.authorText}><Text style={s.author}>{p.autor_nome}</Text><Text style={s.scope}>{t(ALCANCES.find(a => a.valor === p.alcance)?.rotulo ?? "Toda a igreja")}</Text></View></View>
        <Text style={s.ref}>{p.item_passagem || p.referencia_biblica}</Text>{p.texto_biblico && <Text style={s.quote}>“{p.texto_biblico}”</Text>}<Text style={s.body}>{p.texto}</Text>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, alignItems: "flex-start", justifyContent: "center" }, headerTitle: { flex: 1, color: c.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 64, gap: 13 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 8 }, title: { color: c.text, fontSize: 29, fontWeight: "800" }, muted: { color: c.textMuted, lineHeight: 21 },
  composer: { backgroundColor: c.surface, borderRadius: 18, padding: 15, gap: 11, borderWidth: 1, borderColor: c.border }, selectedVerse: { backgroundColor: c.background, padding: 13, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: c.primary },
  input: { backgroundColor: c.background, color: c.text, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: c.border }, area: { minHeight: 100, textAlignVertical: "top" }, label: { color: c.text, fontSize: 13, fontWeight: "800" },
  audiences: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, audience: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: c.background, borderWidth: 1, borderColor: c.border }, audienceOn: { backgroundColor: c.primary, borderColor: c.primary },
  audienceText: { color: c.textMuted, fontSize: 12, fontWeight: "700" }, audienceTextOn: { color: "#fff" }, cta: { backgroundColor: c.primary, padding: 15, borderRadius: 14, alignItems: "center" }, disabled: { opacity: .55 }, ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  feedTitle: { color: c.text, fontSize: 20, fontWeight: "800", marginTop: 8 }, card: { backgroundColor: c.surface, padding: 16, borderRadius: 18, gap: 8, borderWidth: 1, borderColor: c.border },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 }, avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }, avatarText: { color: "#fff", fontWeight: "800" }, authorText: { flex: 1 }, author: { color: c.text, fontWeight: "800" }, scope: { color: c.textMuted, fontSize: 11 }, ref: { color: c.primary, fontWeight: "800" }, quote: { color: c.text, lineHeight: 22, fontStyle: "italic" }, body: { color: c.text, lineHeight: 22 },
});
