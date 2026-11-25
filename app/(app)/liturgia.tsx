// LITURGIA DO CULTO · fase 1 leitura (25/11/2026) · fase 2 edição (25/11/2026)
//
// Pedido do Marcos: quem está escalado precisa ver os horários e os momentos
// do culto sem abrir a escala. Abre pelo relógio no card da escala (aba
// Servir) e pelo relógio de Montar escala. Quem decide se a pessoa vê e o que
// aparece é o servidor (`/app/voluntariado/liturgia/:id`).
//
// Fase 2: a liturgia É o cronograma da Produção do sistema. Quem o servidor
// marca com `pode_editar` (escrita na Produção · "pouquíssimas pessoas") vê o
// botão Editar e muda tempos, ordem e a música de cada "Música N"; o que salva
// aqui aparece no /producao e vice-versa. Se alguém salvou no meio, o servidor
// recusa (409) e a tela recarrega em vez de sobrescrever.
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { SeletorMusicaLiturgia } from "@/components/voluntariado/SeletorMusicaLiturgia";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { apiGet, apiPut } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import {
  dividirSecoes, duracaoCurta, horaBRT, itensParaSalvar, moverItem, previstoAoEscolher, rascunhoDe, rotaLiturgia, rotuloMusica,
  type ItemLiturgia, type Liturgia, type MusicaCatalogo, type MusicaLiturgia, type RascunhoItem,
} from "@/lib/liturgia";
import { linkMusicaSeguro } from "@/lib/louvorMusicas";
import { font, radius, spacing, type Palette } from "@/constants/theme";

function fmtDia(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = new Date(t - 3 * 3600 * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function LiturgiaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [dados, setDados] = useState<Liturgia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Edição (fase 2): rascunho local até "Salvar".
  const [rascunho, setRascunho] = useState<RascunhoItem[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [musicaDe, setMusicaDe] = useState<string | null>(null); // chave do item escolhendo música
  // Letra/cifra aberta no modo leitura: "<chave do item>:letra" ou ":cifra".
  const [textoAberto, setTextoAberto] = useState<string | null>(null);
  const editando = rascunho !== null;

  // Recarrega ao focar: a Produção ajusta o cronograma pelo sistema web.
  const carregar = useCallback(() => {
    if (!id) {
      setErro(t("Culto não encontrado."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    apiGet<Liturgia>(rotaLiturgia(String(id)))
      .then((r) => setDados(r))
      .catch((e: any) => {
        setDados(null);
        // 403/404 trazem a frase do servidor; falha de rede vira frase da casa.
        setErro(e?.status === 403 || e?.status === 404 ? String(e.message) : t("Não foi possível carregar a liturgia agora."));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  useFocusEffect(carregar);

  const secoes = dados ? dividirSecoes(dados.itens) : { culto: [], posCulto: [] };
  const total = duracaoCurta(dados?.total_previsto_seg ?? null);

  function comecarEdicao() {
    if (!dados) return;
    setErroSalvar(null);
    setRascunho(rascunhoDe(dados.itens));
  }

  function cancelarEdicao() {
    setRascunho(null);
    setErroSalvar(null);
  }

  function alterar(chave: string, patch: Partial<RascunhoItem>) {
    setRascunho((lista) => (lista ? lista.map((x) => (x.chave === chave ? { ...x, ...patch } : x)) : lista));
  }

  async function salvar() {
    if (!rascunho || !dados || !id) return;
    const corpo = itensParaSalvar(rascunho);
    if ("erro" in corpo) {
      setErroSalvar(t("Confira o tempo de “{momento}” (use minutos:segundos, como 5:30).").replace("{momento}", corpo.erro));
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      await apiPut(rotaLiturgia(String(id)), { versao: dados.versao ?? 0, itens: corpo.itens });
      setRascunho(null);
      carregar();
    } catch (e: any) {
      if (e?.status === 409) {
        // Alguém salvou (no sistema ou em outro celular): a versão da tela ficou velha.
        setRascunho(null);
        setErroSalvar(t("Alguém alterou esta liturgia enquanto você editava. Carregamos a versão atual; faça sua mudança de novo."));
        carregar();
      } else {
        setErroSalvar(e?.status && e.status < 500 ? String(e.message) : t("Não foi possível salvar a liturgia agora."));
      }
    } finally {
      setSalvando(false);
    }
  }

  // Mesma checagem do card do Louvor antes de abrir: só http(s), sem credenciais.
  function abrirLink(link: string | null) {
    const seguro = linkMusicaSeguro(link);
    if (seguro) Linking.openURL(seguro).catch(() => {});
  }

  function renderMusica(m: MusicaLiturgia, ultimo: boolean) {
    const temLink = !!linkMusicaSeguro(m.link);
    return (
      <View key={`musica-${m.ordem}`} style={[styles.item, !ultimo && styles.itemDivisor]}>
        <Text style={styles.itemHora}>{m.ordem}.</Text>
        <View style={styles.itemCorpo}>
          <Text style={styles.itemTitulo}>{m.titulo}</Text>
          {!!(m.artista || m.tom) && (
            <Text style={styles.itemDur}>
              {[m.artista, m.tom ? t("Tom: {tom}").replace("{tom}", m.tom) : null].filter(Boolean).join(" · ")}
            </Text>
          )}
          {temLink && (
            <Pressable onPress={() => abrirLink(m.link)} accessibilityRole="link" hitSlop={8} style={styles.tentar}>
              <Text style={styles.tentarTxt}>{t("Abrir link da música")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  function renderItem(item: ItemLiturgia, ultimo: boolean) {
    const hora = horaBRT(item.inicio);
    const dur = duracaoCurta(item.previsto_seg);
    const musica = item.musica ?? null;
    const chaveItem = `${item.secao}-${item.ordem}`;
    return (
      <View key={`${item.secao}-${item.ordem}`} style={[styles.item, !ultimo && styles.itemDivisor]}>
        <Text style={styles.itemHora}>{hora ?? "--:--"}</Text>
        <View style={styles.itemCorpo}>
          <View style={styles.itemLinha}>
            <Text style={styles.itemTitulo}>{item.titulo}</Text>
            {item.especial && (
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>{t("Especial")}</Text>
              </View>
            )}
          </View>
          {!!musica && (
            <View style={styles.musicaLinha}>
              <Ionicons name="musical-notes-outline" size={14} color={colors.primary} />
              <Text style={styles.musicaTxt}>{rotuloMusica(musica)}</Text>
            </View>
          )}
          {!!dur && <Text style={styles.itemDur}>{dur}</Text>}
          {!!item.observacao && <Text style={styles.itemObs}>{item.observacao}</Text>}
          {!!musica && (!!linkMusicaSeguro(musica.link) || !!musica.letra || !!musica.cifra) && (
            <View style={styles.acoesMusica}>
              {!!linkMusicaSeguro(musica.link) && (
                <Pressable onPress={() => abrirLink(musica.link)} accessibilityRole="link" hitSlop={8} style={styles.tentar}>
                  <Text style={styles.tentarTxt}>{t("Abrir link da música")}</Text>
                </Pressable>
              )}
              {!!musica.letra && (
                <Pressable onPress={() => setTextoAberto((a) => (a === `${chaveItem}:letra` ? null : `${chaveItem}:letra`))} accessibilityRole="button" hitSlop={8} style={styles.tentar}>
                  <Text style={styles.tentarTxt}>{textoAberto === `${chaveItem}:letra` ? t("Esconder letra") : t("Ver letra")}</Text>
                </Pressable>
              )}
              {!!musica.cifra && (
                <Pressable onPress={() => setTextoAberto((a) => (a === `${chaveItem}:cifra` ? null : `${chaveItem}:cifra`))} accessibilityRole="button" hitSlop={8} style={styles.tentar}>
                  <Text style={styles.tentarTxt}>{textoAberto === `${chaveItem}:cifra` ? t("Esconder cifra") : t("Ver cifra")}</Text>
                </Pressable>
              )}
            </View>
          )}
          {!!musica && textoAberto === `${chaveItem}:letra` && !!musica.letra && (
            <Text style={styles.letra} selectable>{musica.letra}</Text>
          )}
          {!!musica && textoAberto === `${chaveItem}:cifra` && !!musica.cifra && (
            <Text style={styles.cifra} selectable>{musica.cifra}</Text>
          )}
        </View>
      </View>
    );
  }

  function renderEdicao(lista: RascunhoItem[], secao: "culto" | "pos_culto") {
    const daSecao = lista.filter((x) => x.secao === secao);
    return daSecao.map((x, i) => (
      <View key={x.chave} style={[styles.editLinha, i < daSecao.length - 1 && styles.itemDivisor]}>
        <View style={styles.setas}>
          <Pressable onPress={() => setRascunho((l) => (l ? moverItem(l, x.chave, -1) : l))} disabled={i === 0} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("Subir")}>
            <Ionicons name="chevron-up" size={20} color={i === 0 ? colors.glassBorder : colors.text} />
          </Pressable>
          <Pressable onPress={() => setRascunho((l) => (l ? moverItem(l, x.chave, 1) : l))} disabled={i === daSecao.length - 1} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("Descer")}>
            <Ionicons name="chevron-down" size={20} color={i === daSecao.length - 1 ? colors.glassBorder : colors.text} />
          </Pressable>
        </View>
        <View style={styles.itemCorpo}>
          <Text style={styles.itemTitulo}>{x.titulo}</Text>
          {x.e_musica && (
            <Pressable onPress={() => setMusicaDe(x.chave)} accessibilityRole="button" style={styles.musicaLinha} hitSlop={6}>
              <Ionicons name="musical-notes-outline" size={14} color={colors.primary} />
              <Text style={[styles.musicaTxt, !x.musica && styles.musicaVazia]}>{x.musica ? rotuloMusica(x.musica) : t("Escolher música")}</Text>
            </Pressable>
          )}
        </View>
        <TextInput
          value={x.previsto}
          onChangeText={(v) => alterar(x.chave, { previsto: v.replace(/[^0-9:]/g, "").slice(0, 6) })}
          placeholder="0:00"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={t("Tempo previsto de {momento}").replace("{momento}", x.titulo)}
          style={styles.tempo}
        />
      </View>
    ));
  }

  const itemEscolhendo = rascunho?.find((x) => x.chave === musicaDe) ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TecladoSeguro style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.titulo}>{t("Liturgia do culto")}</Text>
          {dados?.pode_editar && !editando && !erro ? (
            <Pressable onPress={comecarEdicao} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Editar liturgia")}>
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </Pressable>
          ) : (
            <View style={{ width: 26 }} />
          )}
        </View>

        {!!erroSalvar && (
          <View style={styles.aviso}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.avisoTxt}>{erroSalvar}</Text>
          </View>
        )}

        {loading && !dados ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : erro ? (
          <View style={styles.card}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.textMuted} />
            <Text style={styles.cardTxt}>{erro}</Text>
            <Pressable onPress={carregar} accessibilityRole="button" style={styles.tentar}>
              <Text style={styles.tentarTxt}>{t("Tentar de novo")}</Text>
            </Pressable>
          </View>
        ) : dados && rascunho ? (
          <>
            <View style={styles.aviso}>
              <Ionicons name="sync-outline" size={18} color={colors.primary} />
              <Text style={styles.avisoTxt}>
                {dados.fonte === "padrao"
                  ? t("Este é o roteiro padrão. Ao salvar, ele vira a liturgia deste culto, também na Produção do sistema.")
                  : t("O que você salvar aqui muda também o cronograma da Produção no sistema.")}
              </Text>
            </View>
            {rascunho.some((x) => x.secao === "culto") && (
              <View style={styles.card}>
                <Text style={styles.secao}>{t("Culto")}</Text>
                {renderEdicao(rascunho, "culto")}
              </View>
            )}
            {rascunho.some((x) => x.secao === "pos_culto") && (
              <View style={styles.card}>
                <Text style={styles.secao}>{t("Pós-culto")}</Text>
                {renderEdicao(rascunho, "pos_culto")}
              </View>
            )}
            <Pressable onPress={salvar} disabled={salvando} accessibilityRole="button" style={[styles.botao, salvando && { opacity: 0.6 }]}>
              <Text style={styles.botaoTxt}>{salvando ? t("Salvando…") : t("Salvar liturgia")}</Text>
            </Pressable>
            <Pressable onPress={cancelarEdicao} disabled={salvando} accessibilityRole="button" style={styles.botaoSec}>
              <Text style={styles.botaoSecTxt}>{t("Cancelar")}</Text>
            </Pressable>
          </>
        ) : dados ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroNome}>{dados.culto.nome}</Text>
              <View style={styles.heroLinha}>
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.heroTxt}>
                  {[fmtDia(dados.culto.scheduled_at), horaBRT(dados.culto.scheduled_at)].filter(Boolean).join(" · ")}
                  {total ? ` · ${t("previsto")} ${total}` : ""}
                </Text>
              </View>
            </View>

            {dados.fonte === "padrao" && (
              <View style={styles.aviso}>
                <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.avisoTxt}>
                  {t("Roteiro padrão deste tipo de culto. A Produção ainda pode ajustar os horários.")}
                </Text>
              </View>
            )}

            {dados.fonte === "vazio" ? (
              <View style={styles.card}>
                <Text style={styles.cardTxt}>{t("A liturgia deste culto ainda não foi montada.")}</Text>
              </View>
            ) : (
              <>
                {secoes.culto.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.secao}>{t("Culto")}</Text>
                    {secoes.culto.map((it, i) => renderItem(it, i === secoes.culto.length - 1))}
                  </View>
                )}
              </>
            )}

            {/* Músicas do Louvor (25/11/2026): moram na liturgia; o card
                "Músicas do culto de hoje" continua sendo onde se adiciona. */}
            {(dados.musicas_erro || dados.musicas !== undefined) && (
              <View style={styles.card}>
                <Text style={styles.secao}>{t("Músicas")}</Text>
                {dados.musicas_erro || !dados.musicas ? (
                  <Text style={styles.cardTxt}>{t("Não foi possível carregar as músicas.")}</Text>
                ) : dados.musicas.length === 0 ? (
                  <Text style={styles.cardTxt}>{t("Nenhuma música adicionada para este culto.")}</Text>
                ) : (
                  dados.musicas.map((m, i) => renderMusica(m, i === dados.musicas!.length - 1))
                )}
              </View>
            )}

            {dados.fonte !== "vazio" && (
              <>
                {secoes.posCulto.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.secao}>{t("Pós-culto")}</Text>
                    {secoes.posCulto.map((it, i) => renderItem(it, i === secoes.posCulto.length - 1))}
                  </View>
                )}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
      </TecladoSeguro>
      <SeletorMusicaLiturgia
        visivel={!!itemEscolhendo}
        atual={itemEscolhendo?.musica ?? null}
        onFechar={() => setMusicaDe(null)}
        onEscolher={(m: MusicaCatalogo | null) => {
          if (itemEscolhendo) alterar(itemEscolhendo.chave, { musica: m, previsto: previstoAoEscolher(itemEscolhendo.previsto, m) });
          setMusicaDe(null);
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    titulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    hero: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primary, gap: spacing.xs },
    heroNome: { color: "#fff", fontSize: font.size.xl, fontWeight: "900" },
    heroLinha: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    heroTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "600", flexShrink: 1 },
    aviso: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    avisoTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20, flex: 1 },
    card: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    cardTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    secao: { color: colors.textMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
    item: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm },
    itemDivisor: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glassBorder },
    itemHora: { color: colors.primary, fontSize: font.size.md, fontWeight: "800", width: 52, fontVariant: ["tabular-nums"] },
    itemCorpo: { flex: 1, gap: 2 },
    itemLinha: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    itemTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700", flexShrink: 1 },
    itemDur: { color: colors.textMuted, fontSize: font.size.sm },
    itemObs: { color: colors.text, fontSize: font.size.sm, lineHeight: 20 },
    musicaLinha: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 2 },
    musicaTxt: { color: colors.text, fontSize: font.size.sm, flexShrink: 1 },
    musicaVazia: { color: colors.primary, fontWeight: "700" },
    tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder },
    tagTxt: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    tentar: { alignSelf: "flex-start", paddingVertical: 6 },
    acoesMusica: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md },
    letra: { color: colors.text, fontSize: font.size.sm, lineHeight: 22, marginTop: spacing.xs },
    cifra: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: spacing.xs, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
    tentarTxt: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
    editLinha: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    setas: { gap: 2 },
    tempo: {
      width: 70,
      textAlign: "center",
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.background,
      color: colors.text,
      borderRadius: radius.sm,
      paddingVertical: 8,
      fontSize: font.size.md,
      fontVariant: ["tabular-nums"],
    },
    botao: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
    botaoTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
    botaoSec: { paddingVertical: 10, alignItems: "center" },
    botaoSecTxt: { color: colors.textMuted, fontSize: font.size.md, fontWeight: "700" },
  });
