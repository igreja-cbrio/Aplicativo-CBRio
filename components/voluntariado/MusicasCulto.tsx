import { useCallback, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Linking, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useDialogo } from "@/components/ui/Dialogo";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { linkMusicaSeguro, type RepertorioLouvor, type CultoLouvor, type MusicaLouvor } from "@/lib/louvorMusicas";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export function MusicasCulto() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => estilos(c), [c]);
  const dlg = useDialogo();
  const [dados, setDados] = useState<RepertorioLouvor | null>(null);
  const [erro, setErro] = useState(false);
  const [cultoId, setCultoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [artista, setArtista] = useState("");
  const [tom, setTom] = useState("");
  const [link, setLink] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const carregar = useCallback(async () => {
    setErro(false);
    try { setDados(await apiGet<RepertorioLouvor>("/app/louvor/musicas")); }
    catch { setDados(null); setErro(true); }
  }, []);
  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  async function salvar() {
    if (trava.current || !cultoId || !titulo.trim()) return;
    if (link.trim() && !linkMusicaSeguro(link.trim())) {
      await dlg.avisar(t("Link inválido"), t("Use um link http ou https válido."));
      return;
    }
    trava.current = true; setOcupado(true);
    try {
      await apiPost("/app/louvor/musicas", { service_id: cultoId, titulo: titulo.trim(), artista: artista.trim(), tom: tom.trim(), link: link.trim() });
      setCultoId(null); setTitulo(""); setArtista(""); setTom(""); setLink("");
      await carregar();
    } catch { await dlg.avisar(t("Erro"), t("Não foi possível salvar a música. Tente novamente.")); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function remover(musica: MusicaLouvor) {
    if (trava.current) return;
    const sim = await dlg.confirmar({ titulo: t("Remover música?"), mensagem: musica.titulo, acao: t("Remover"), perigo: true });
    if (!sim || trava.current) return;
    trava.current = true; setOcupado(true);
    try { await apiDelete(`/app/louvor/musicas/${encodeURIComponent(musica.id)}`); await carregar(); }
    catch { await dlg.avisar(t("Erro"), t("Não foi possível remover a música. Tente novamente.")); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function abrir(linkOriginal: string) {
    const seguro = linkMusicaSeguro(linkOriginal);
    if (!seguro) return;
    try { await Linking.openURL(seguro); }
    catch { await dlg.avisar(t("Erro"), t("Não foi possível abrir o link.")); }
  }
  function iniciar(culto: CultoLouvor) {
    setCultoId(culto.id); setTitulo(""); setArtista(""); setTom(""); setLink("");
  }
  if (!erro && !dados?.acesso) return null;
  return <>
    <View style={s.card}>
      <Text style={s.titulo}>{t("Músicas do culto de hoje")}</Text>
      {erro ? <>
        <Text style={s.meta}>{t("Não foi possível carregar as músicas.")}</Text>
        <Button title={t("Tentar novamente")} variant="ghost" onPress={() => void carregar()} />
      </> : <>
        {!dados?.cultos.length && <Text style={s.meta}>{t("Não há culto hoje.")}</Text>}
        {dados?.cultos.map(culto => <View key={culto.id} style={s.culto}>
          <Text style={s.subtitulo}>{culto.name || culto.service_type_name || t("Culto")}</Text>
          <Text style={s.meta}>{new Date(culto.scheduled_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}</Text>
          {!culto.musicas.length && <Text style={s.meta}>{t("Nenhuma música adicionada para este culto.")}</Text>}
          {culto.musicas.map((m, i) => <View key={m.id} style={s.musica}>
            <Text style={s.subtitulo}>{i + 1}. {m.titulo}</Text>
            {!!m.artista && <Text style={s.meta}>{m.artista}</Text>}
            {!!m.tom && <Text style={s.meta}>{t("Tom: {tom}").replace("{tom}", m.tom)}</Text>}
            {!!linkMusicaSeguro(m.link) && <Pressable accessibilityRole="link" style={s.secundario} onPress={() => void abrir(m.link!)}><Text style={s.acao}>{t("Abrir link da música")}</Text></Pressable>}
            {culto.pode_editar && <Pressable accessibilityRole="button" style={s.secundario} disabled={ocupado} onPress={() => void remover(m)}><Text style={s.acao}>{t("Remover música")}</Text></Pressable>}
          </View>)}
          {culto.pode_editar && (cultoId === culto.id ? <View style={s.form}>
            <Input label={t("Título da música")} value={titulo} onChangeText={setTitulo} maxLength={200} autoCapitalize="sentences" />
            <Input label={t("Artista (opcional)")} value={artista} onChangeText={setArtista} maxLength={200} autoCapitalize="words" />
            <Input label={t("Tom (opcional)")} value={tom} onChangeText={setTom} maxLength={30} autoCapitalize="characters" />
            <Input label={t("Link da música (opcional)")} value={link} onChangeText={setLink} maxLength={2048} keyboardType="url" autoCorrect={false} />
            <Button title={t("Salvar música")} loading={ocupado} disabled={!titulo.trim()} onPress={() => void salvar()} />
            <Pressable accessibilityRole="button" style={s.secundario} disabled={ocupado} onPress={() => setCultoId(null)}><Text style={s.acao}>{t("Cancelar")}</Text></Pressable>
          </View> : <Button title={t("Adicionar música")} disabled={ocupado} onPress={() => iniciar(culto)} />)}
        </View>)}
      </>}
    </View>
    <dlg.Dialogo />
  </>;
}
const estilos = (c: Palette) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.glassBorder, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  titulo: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
  subtitulo: { color: c.text, fontSize: font.size.md, fontWeight: "700" },
  meta: { color: c.textMuted, fontSize: font.size.sm },
  culto: { gap: spacing.sm, borderTopColor: c.glassBorder, borderTopWidth: 1, paddingTop: spacing.md },
  musica: { gap: spacing.sm, paddingVertical: spacing.sm },
  form: { gap: spacing.sm },
  secundario: { minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.glassBorder, borderRadius: radius.full, paddingHorizontal: spacing.sm },
  acao: { color: c.text, fontSize: font.size.md, fontWeight: "700", textAlign: "center" },
});
