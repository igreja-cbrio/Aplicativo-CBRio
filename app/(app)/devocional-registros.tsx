import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useDialogo } from "@/components/ui/Dialogo";
import { excluirRegistro, listarMeusRegistros, salvarRegistroPessoal, type RegistroDevocional } from "@/lib/devocional";
import { subirUmNivel } from "@/lib/hierarquia";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";

const DESTINO: Record<string, string> = { privado: "Só para mim", grupo: "Meu grupo", servir: "Quem serve comigo", igreja: "Toda a igreja" };
const COR_FUNDO: Record<string, string> = { amarelo: "#FFF1A8", azul: "#CDE9F5", verde: "#D9EBCF", rosa: "#F5D3DD" };
export default function Registros() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT(), { membro } = useMembro();
  const params = useLocalSearchParams<{ referencia?: string; textoBiblico?: string; origem?: "biblia" | "devocional"; itemId?: string }>();
  const [registros, setRegistros] = useState<RegistroDevocional[]>([]), [referencia, setReferencia] = useState(params.referencia ?? ""), [comentario, setComentario] = useState("");
  const [editando, setEditando] = useState(Boolean(params.referencia)), [carregando, setCarregando] = useState(true), [salvando, setSalvando] = useState(false);
  const carregar = useCallback(async () => { if (!membro?.membroId) return; setRegistros(await listarMeusRegistros(membro.membroId)); setCarregando(false); }, [membro?.membroId]);
  useEffect(() => { carregar().catch(e => Alert.alert(t("Erro"), e.message)); }, [carregar, t]);
  async function salvar() {
    if (!membro?.membroId || !referencia.trim() || comentario.trim().length < 2) return Alert.alert(t("Falta pouco"), t("Informe a referência e sua anotação."));
    setSalvando(true);
    try { await salvarRegistroPessoal({ membroId: membro.membroId, origem: params.origem ?? "biblia", referencia, textoBiblico: params.textoBiblico, comentario, itemId: params.itemId }); setReferencia(""); setComentario(""); setEditando(false); await carregar(); }
    catch (e) { Alert.alert(t("Não foi possível salvar"), e instanceof Error ? e.message : t("Tente novamente.")); } finally { setSalvando(false); }
  }
  // Confirmação pelo diálogo da casa (components/ui/Dialogo.tsx), não pelo Alert
  // nativo: é a régua de test/dialogoDaCasa.test.ts — e o portão do OTA a cobra.
  const dlg = useDialogo();
  async function remover(registro: RegistroDevocional) {
    if (!(await dlg.confirmar({ titulo: t("Excluir anotação?"), mensagem: t("Essa ação não pode ser desfeita."), acao: t("Excluir"), perigo: true }))) return;
    try { await excluirRegistro(registro); await carregar(); }
    catch (e) { Alert.alert(t("Não foi possível excluir"), e instanceof Error ? e.message : t("Tente novamente.")); }
  }
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => params.referencia ? router.back() : subirUmNivel()} hitSlop={12} style={s.back}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Anotações e Marcações")}</Text><Pressable onPress={() => setEditando(v => !v)} hitSlop={10} style={s.back}><Ionicons name={editando ? "close" : "add"} size={25} color={c.primary} /></Pressable></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.intro}>{t("Suas reflexões privadas, marcações e comentários publicados ficam reunidos aqui.")}</Text>
      {editando && <View style={s.composer}><Text style={s.composerTitle}>{t("Nova anotação para mim")}</Text><TextInput style={s.input} value={referencia} onChangeText={setReferencia} placeholder={t("Referência bíblica")} placeholderTextColor={c.textMuted} />{params.textoBiblico && <Text style={s.quote}>“{params.textoBiblico.trim()}”</Text>}<TextInput style={[s.input, s.area]} value={comentario} onChangeText={setComentario} placeholder={t("Escreva o que você quer guardar")} placeholderTextColor={c.textMuted} multiline /><Pressable style={s.cta} onPress={salvar} disabled={salvando}><Text style={s.ctaText}>{salvando ? t("Salvando...") : t("Salvar para mim")}</Text></Pressable></View>}
      {carregando ? <ActivityIndicator color={c.primary} /> : registros.length === 0 ? <View style={s.empty}><Ionicons name="bookmark-outline" size={30} color={c.primary} /><Text style={s.emptyTitle}>{t("Nada guardado ainda")}</Text><Text style={s.emptyText}>{t("Toque em um versículo para anotar ou marcar.")}</Text></View> : registros.map(r => <View key={r.fonte + r.id} style={s.card}>
        <View style={s.meta}><Text style={s.date}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</Text><View style={s.destination}><Text style={s.destinationText}>{t(DESTINO[r.destino])}</Text></View></View>
        <Text style={s.ref}>{r.referencia_biblica}</Text>{r.texto_biblico && <Text style={[s.quote, r.cor ? { backgroundColor: COR_FUNDO[r.cor], color: "#263234", padding: 10, borderRadius: 8 } : undefined]}>“{r.texto_biblico}”</Text>}{r.comentario && <Text style={s.body}>{r.comentario}</Text>}
        <Pressable onPress={() => remover(r)} style={s.delete}><Ionicons name="trash-outline" size={16} color={c.danger ?? "#B45151"} /><Text style={s.deleteText}>{t("Excluir")}</Text></Pressable>
      </View>)}
    </ScrollView>
    <dlg.Dialogo />
  </SafeAreaView>;
}
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 17, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 64, gap: 12 }, intro: { color: c.textMuted, lineHeight: 21, marginBottom: 4 }, composer: { backgroundColor: c.surface, padding: 15, borderRadius: 18, gap: 10, borderWidth: 1, borderColor: c.border }, composerTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  input: { backgroundColor: c.background, color: c.text, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: c.border }, area: { minHeight: 92, textAlignVertical: "top" }, cta: { backgroundColor: c.primary, padding: 14, borderRadius: 13, alignItems: "center" }, ctaText: { color: "#fff", fontWeight: "800" },
  card: { backgroundColor: c.surface, padding: 16, borderRadius: 18, gap: 8, borderWidth: 1, borderColor: c.border }, meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, date: { color: c.textMuted, fontSize: 12 }, destination: { backgroundColor: c.background, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 }, destinationText: { color: c.textMuted, fontSize: 10, fontWeight: "800" },
  ref: { color: c.primary, fontWeight: "800" }, quote: { color: c.text, fontStyle: "italic", lineHeight: 22, borderLeftWidth: 3, borderLeftColor: c.primary, paddingLeft: 10 }, body: { color: c.text, lineHeight: 22 }, delete: { flexDirection: "row", gap: 5, alignItems: "center", alignSelf: "flex-end", paddingTop: 5 }, deleteText: { color: c.danger ?? "#B45151", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", padding: 32, gap: 7 }, emptyTitle: { color: c.text, fontSize: 18, fontWeight: "800" }, emptyText: { color: c.textMuted, textAlign: "center" },
});
