// Escolher a música de um "Música N" da liturgia (25/11/2026).
// O catálogo é o mesmo da Produção no sistema (`louvor_repertorio`): o que se
// cadastra aqui aparece lá. Só abre para quem edita a liturgia (o servidor
// recusa os outros com 403, e a tela nem mostra o botão).
import { Text } from "@/components/ui/Typography";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { apiGet, apiPost } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { ROTA_CATALOGO_MUSICAS, type MusicaCatalogo } from "@/lib/liturgia";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = {
  visivel: boolean;
  atual: MusicaCatalogo | null;
  onEscolher: (m: MusicaCatalogo | null) => void;
  onFechar: () => void;
};

export function SeletorMusicaLiturgia({ visivel, atual, onEscolher, onFechar }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [lista, setLista] = useState<MusicaCatalogo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState<{ titulo: string; artista: string; tom: string; link: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visivel) return;
    setBusca("");
    setNova(null);
    setErro(null);
    setLista(null);
    apiGet<{ musicas: MusicaCatalogo[] }>(ROTA_CATALOGO_MUSICAS)
      .then((r) => setLista(r.musicas || []))
      .catch((e: any) => setErro(e?.status === 403 ? String(e.message) : t("Não foi possível carregar as músicas.")));
  }, [visivel, t]);

  const q = busca.trim().toLowerCase();
  const filtradas = (lista || []).filter((m) => !q || `${m.titulo} ${m.artista || ""}`.toLowerCase().includes(q));

  async function cadastrar() {
    if (!nova || !nova.titulo.trim()) {
      setErro(t("Escreva o nome da música."));
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const r = await apiPost<{ musica: MusicaCatalogo }>(ROTA_CATALOGO_MUSICAS, {
        titulo: nova.titulo.trim(),
        artista: nova.artista.trim() || null,
        tom: nova.tom.trim() || null,
        link: nova.link.trim() || null,
      });
      if (r?.musica) onEscolher(r.musica);
    } catch (e: any) {
      setErro(e?.status && e.status < 500 ? String(e.message) : t("Não foi possível cadastrar a música agora."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={onFechar}>
      <TecladoSeguro style={styles.fundo}>
        <View style={styles.folha}>
          <View style={styles.topo}>
            <Text style={styles.titulo}>{nova ? t("Cadastrar música") : t("Escolher música")}</Text>
            <Pressable onPress={onFechar} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {!!erro && <Text style={styles.erro}>{erro}</Text>}

          {nova ? (
            <View style={{ gap: spacing.sm }}>
              <TextInput value={nova.titulo} onChangeText={(v) => setNova({ ...nova, titulo: v })} placeholder={t("Nome da música")} placeholderTextColor={colors.textMuted} maxLength={200} style={styles.input} autoFocus />
              <TextInput value={nova.artista} onChangeText={(v) => setNova({ ...nova, artista: v })} placeholder={t("Artista (opcional)")} placeholderTextColor={colors.textMuted} maxLength={200} style={styles.input} />
              <TextInput value={nova.tom} onChangeText={(v) => setNova({ ...nova, tom: v })} placeholder={t("Tom (opcional)")} placeholderTextColor={colors.textMuted} maxLength={30} style={styles.input} />
              <TextInput value={nova.link} onChangeText={(v) => setNova({ ...nova, link: v })} placeholder={t("Link (opcional)")} placeholderTextColor={colors.textMuted} maxLength={2048} autoCapitalize="none" keyboardType="url" style={styles.input} />
              <Pressable onPress={cadastrar} disabled={salvando} accessibilityRole="button" style={[styles.botao, salvando && { opacity: 0.6 }]}>
                <Text style={styles.botaoTxt}>{salvando ? t("Salvando…") : t("Cadastrar e escolher")}</Text>
              </Pressable>
              <Pressable onPress={() => { setNova(null); setErro(null); }} accessibilityRole="button" style={styles.link}>
                <Text style={styles.linkTxt}>{t("Voltar para a lista")}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput value={busca} onChangeText={setBusca} placeholder={t("Buscar música ou artista")} placeholderTextColor={colors.textMuted} style={styles.input} autoCorrect={false} />
              {lista === null && !erro ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
              ) : (
                <FlatList
                  data={filtradas}
                  keyExtractor={(m) => m.id}
                  style={styles.lista}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    erro ? null : (
                      <Text style={styles.vazio}>
                        {(lista || []).length ? t("Nenhuma música com esse nome.") : t("O catálogo ainda está vazio. Cadastre a primeira.")}
                      </Text>
                    )
                  }
                  renderItem={({ item }) => (
                    <Pressable onPress={() => onEscolher(item)} accessibilityRole="button" style={[styles.linha, atual?.id === item.id && styles.linhaSel]}>
                      <Text style={styles.linhaTitulo}>{item.titulo}</Text>
                      {!!(item.artista || item.tom) && <Text style={styles.linhaSub}>{[item.artista, item.tom].filter(Boolean).join(" · ")}</Text>}
                    </Pressable>
                  )}
                />
              )}
              {!erro || lista !== null ? (
                <Pressable onPress={() => setNova({ titulo: busca.trim(), artista: "", tom: "", link: "" })} accessibilityRole="button" style={styles.link}>
                  <Text style={styles.linkTxt}>{t("Cadastrar música")}</Text>
                </Pressable>
              ) : null}
              {!!atual && (
                <Pressable onPress={() => onEscolher(null)} accessibilityRole="button" style={styles.link}>
                  <Text style={[styles.linkTxt, { color: colors.danger }]}>{t("Tirar música")}</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </TecladoSeguro>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fundo: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    folha: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
      maxHeight: "85%",
    },
    topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    titulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    erro: { color: colors.danger, fontSize: font.size.sm },
    input: {
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: font.size.md,
    },
    lista: { maxHeight: 360 },
    vazio: { color: colors.textMuted, fontSize: font.size.sm, paddingVertical: spacing.md },
    linha: { paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.md },
    linhaSel: { backgroundColor: colors.surface },
    linhaTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    linhaSub: { color: colors.textMuted, fontSize: font.size.sm },
    botao: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
    botaoTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
    link: { alignSelf: "flex-start", paddingVertical: 6 },
    linkTxt: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
  });
