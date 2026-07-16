import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { GruposMapa } from "@/components/ui/GruposMapa";
import { useMembro } from "@/lib/useMembro";
import { supabase } from "@/lib/supabase";
import { buscarGruposPublico, type GrupoPublico } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

// Mesma fonte de dados do formulário público do site (traz líder, código,
// recorrência e faixa etária) — permite os mesmos filtros.
export type Grupo = GrupoPublico;

const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Ordem preferida de exibição das categorias na lista. Categorias fora desta
// lista aparecem depois, em ordem alfabética. A comparação é por prefixo
// normalizado (sem acento/caixa), então "Jovens", "jovem", "JOVENS" caem juntos.
const CATEGORIA_ORDEM = ["adultos", "casais", "jovens", "mulheres", "homens", "famílias", "kids", "teens"];
// Ordem canônica das recorrências (fora dela vai pro fim, alfabético).
const RECORRENCIA_ORDEM = ["diario", "semanal", "quinzenal", "mensal"];

const SEM_CATEGORIA = "Outros";

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function ordemCategoria(cat: string) {
  const n = normalizar(cat);
  const i = CATEGORIA_ORDEM.findIndex((c) => n.startsWith(normalizar(c)));
  return i === -1 ? CATEGORIA_ORDEM.length : i;
}

function capitalizar(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function diaHorario(dia: number | null, horario: string | null) {
  const d = dia != null && DOW[dia] ? DOW[dia] : null;
  const h = horario ? horario.slice(0, 5) : null;
  return [d, h].filter(Boolean).join(" · ");
}

// Linha de chips selecionáveis (padrão do app · sem lib de picker).
function ChipRow({
  label,
  options,
  value,
  onChange,
  colors,
}: {
  label: string;
  options: { valor: string; rotulo: string }[];
  value: string;
  onChange: (v: string) => void;
  colors: Palette;
}) {
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (options.length < 2) return null; // só mostra o filtro se há o que escolher
  const todas = [{ valor: "", rotulo: t("Todos") }, ...options];
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {todas.map((o) => {
          const sel = value === o.valor;
          return (
            <Pressable
              key={o.valor || "__all"}
              onPress={() => onChange(o.valor)}
              style={[styles.chip, sel && styles.chipSel]}
            >
              <Text style={[styles.chipTxt, sel && styles.chipTxtSel]}>{o.rotulo}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function GruposScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { membro } = useMembro();
  const t = useT();

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [meusIds, setMeusIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [view, setView] = useState<"lista" | "mapa">("lista");

  // Filtros (espelham o formulário público)
  const [searchMode, setSearchMode] = useState<"grupo" | "lider">("grupo");
  const [busca, setBusca] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fDia, setFDia] = useState("");
  const [fRecorrencia, setFRecorrencia] = useState("");
  const [fFaixa, setFFaixa] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await buscarGruposPublico();
      setFalhou(false);
      setGrupos(data ?? []);
    } catch {
      // Erro de rede/servidor NÃO pode virar "Nenhum grupo encontrado" — o
      // usuário acreditava que não havia grupos. Marca a falha pra tela avisar.
      setFalhou(true);
    }

    if (membro?.membroId) {
      const { data: meus } = await supabase
        .from("mem_grupo_membros")
        .select("grupo_id")
        .eq("membro_id", membro.membroId)
        .is("saiu_em", null)
        .is("deleted_at", null);
      setMeusIds((meus ?? []).map((m) => m.grupo_id as string));
    }
    setLoading(false);
  }, [membro?.membroId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Opções data-driven: só aparecem se existirem valores nos grupos carregados.
  const opcoes = useMemo(() => {
    const cats = new Set<string>();
    const dias = new Set<number>();
    const recs = new Set<string>();
    const faixas = new Set<string>();
    for (const g of grupos) {
      if (g.categoria?.trim()) cats.add(g.categoria.trim());
      if (g.dia_semana != null) dias.add(g.dia_semana);
      if (g.recorrencia?.trim()) recs.add(g.recorrencia.trim().toLowerCase());
      if (g.faixa_etaria?.trim()) faixas.add(g.faixa_etaria.trim());
    }
    const catOpts = [...cats]
      .sort((a, b) => {
        const oa = ordemCategoria(a);
        const ob = ordemCategoria(b);
        return oa !== ob ? oa - ob : a.localeCompare(b);
      })
      .map((c) => ({ valor: c, rotulo: c }));
    const diaOpts = [...dias]
      .sort((a, b) => a - b)
      .map((d) => ({ valor: String(d), rotulo: DOW[d] ?? String(d) }));
    const recOpts = [...recs]
      .sort((a, b) => {
        const ia = RECORRENCIA_ORDEM.indexOf(a);
        const ib = RECORRENCIA_ORDEM.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map((r) => ({ valor: r, rotulo: capitalizar(r) }));
    const faixaOpts = [...faixas].sort().map((f) => ({ valor: f, rotulo: f }));
    return { catOpts, diaOpts, recOpts, faixaOpts };
  }, [grupos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return grupos.filter((g) => {
      if (fCategoria && g.categoria !== fCategoria) return false;
      if (fDia && String(g.dia_semana) !== fDia) return false;
      if (fRecorrencia && (g.recorrencia ?? "").toLowerCase().trim() !== fRecorrencia) return false;
      if (fFaixa && g.faixa_etaria !== fFaixa) return false;
      if (q) {
        if (searchMode === "lider") {
          if (!(g.lider_nome ?? "").toLowerCase().includes(q)) return false;
        } else {
          const alvo = [g.nome, g.codigo, g.local, g.bairro, g.categoria]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!alvo.includes(q)) return false;
        }
      }
      return true;
    });
  }, [grupos, busca, searchMode, fCategoria, fDia, fRecorrencia, fFaixa]);

  const filtrosAtivos =
    (fCategoria ? 1 : 0) + (fDia ? 1 : 0) + (fRecorrencia ? 1 : 0) + (fFaixa ? 1 : 0);

  const limparFiltros = () => {
    setFCategoria("");
    setFDia("");
    setFRecorrencia("");
    setFFaixa("");
  };

  // Agrupa os grupos filtrados por categoria, na ordem preferida.
  const secoes = useMemo(() => {
    const mapa = new Map<string, Grupo[]>();
    for (const g of filtrados) {
      const chave = g.categoria?.trim() || SEM_CATEGORIA;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(g);
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => {
        if (a === SEM_CATEGORIA) return 1;
        if (b === SEM_CATEGORIA) return -1;
        const oa = ordemCategoria(a);
        const ob = ordemCategoria(b);
        return oa !== ob ? oa - ob : a.localeCompare(b);
      })
      .map(([categoria, itens]) => ({ categoria, itens }));
  }, [filtrados]);

  const meusGrupos = grupos.filter((g) => meusIds.includes(g.id));

  function GrupoCard({ g }: { g: Grupo }) {
    const dist =
      g.dist_km != null
        ? g.dist_km < 1
          ? `${Math.round(g.dist_km * 1000)} m`
          : `${g.dist_km.toFixed(1)} km`
        : null;
    const meta = [g.bairro, diaHorario(g.dia_semana, g.horario), dist].filter(Boolean).join(" • ");
    const recorrencia = g.recorrencia && g.recorrencia.toLowerCase().trim() !== "semanal"
      ? capitalizar(g.recorrencia)
      : null;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() => router.navigate({ pathname: "/grupo-detalhe", params: { id: g.id } })}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="people" size={22} color={colors.brandMid} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardNome} numberOfLines={1}>{g.nome}</Text>
            {!!g.codigo && <Text style={styles.cardCodigo}>{g.codigo}</Text>}
          </View>
          {!!g.lider_nome && (
            <Text style={styles.cardLider} numberOfLines={1}>
              {t("Líder")}: {g.lider_nome}
            </Text>
          )}
          {!!meta && <Text style={styles.cardMeta} numberOfLines={1}>{meta}</Text>}
          {!!recorrencia && (
            <View style={styles.recBadge}>
              <Text style={styles.recBadgeTxt}>{recorrencia}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Grupos")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleItem, view === "lista" && styles.toggleItemSel]}
            onPress={() => setView("lista")}
          >
            <Ionicons name="list" size={16} color={view === "lista" ? "#fff" : colors.textMuted} />
            <Text style={[styles.toggleTxt, view === "lista" && styles.toggleTxtSel]}>{t("Lista")}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleItem, view === "mapa" && styles.toggleItemSel]}
            onPress={() => setView("mapa")}
          >
            <Ionicons name="map" size={16} color={view === "mapa" ? "#fff" : colors.textMuted} />
            <Text style={[styles.toggleTxt, view === "mapa" && styles.toggleTxtSel]}>{t("Mapa")}</Text>
          </Pressable>
        </View>

        {/* Modo de busca: por grupo ou por líder (igual ao formulário público) */}
        <View style={styles.modePills}>
          <Pressable
            style={[styles.modePill, searchMode === "grupo" && styles.modePillSel]}
            onPress={() => setSearchMode("grupo")}
          >
            <Text style={[styles.modePillTxt, searchMode === "grupo" && styles.modePillTxtSel]}>
              {t("Grupo")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modePill, searchMode === "lider" && styles.modePillSel]}
            onPress={() => setSearchMode("lider")}
          >
            <Text style={[styles.modePillTxt, searchMode === "lider" && styles.modePillTxtSel]}>
              {t("Líder")}
            </Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          value={busca}
          onChangeText={setBusca}
          placeholder={searchMode === "lider" ? t("Buscar pelo nome do líder") : t("Buscar por nome, bairro ou local")}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />

        <Pressable style={styles.filterBtn} onPress={() => setFiltrosAbertos((o) => !o)}>
          <Ionicons name="options-outline" size={16} color={colors.text} />
          <Text style={styles.filterBtnTxt}>{t("Filtros")}</Text>
          {filtrosAtivos > 0 && (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountTxt}>{filtrosAtivos}</Text>
            </View>
          )}
          <Ionicons
            name={filtrosAbertos ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textMuted}
            style={{ marginLeft: "auto" }}
          />
        </Pressable>

        {filtrosAbertos && (
          <View style={styles.filtrosBox}>
            <ChipRow label={t("Categoria")} options={opcoes.catOpts} value={fCategoria} onChange={setFCategoria} colors={colors} />
            <ChipRow label={t("Dia da semana")} options={opcoes.diaOpts} value={fDia} onChange={setFDia} colors={colors} />
            <ChipRow label={t("Frequência")} options={opcoes.recOpts} value={fRecorrencia} onChange={setFRecorrencia} colors={colors} />
            <ChipRow label={t("Faixa etária")} options={opcoes.faixaOpts} value={fFaixa} onChange={setFFaixa} colors={colors} />
            {filtrosAtivos > 0 && (
              <Pressable onPress={limparFiltros} style={styles.limparBtn}>
                <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                <Text style={styles.limparTxt}>{t("Limpar filtros")}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <Text style={styles.muted}>{t("Carregando…")}</Text>
      ) : view === "mapa" ? (
        <View style={styles.mapWrap}>
          <GruposMapa
            grupos={filtrados}
            onSelect={(id) => router.navigate({ pathname: "/grupo-detalhe", params: { id } })}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={carregar} tintColor={colors.primary} />}
        >
          {meusGrupos.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.section}>{t("Meus grupos")}</Text>
              {meusGrupos.map((g) => (
                <GrupoCard key={`meu-${g.id}`} g={g} />
              ))}
            </View>
          )}

          {filtrados.length > 0 && (
            <Text style={styles.contador}>
              {filtrados.length} {filtrados.length === 1 ? t("grupo") : t("grupos")}
            </Text>
          )}

          {filtrados.length === 0 && falhou ? (
            <ErrorState onRetry={carregar} />
          ) : filtrados.length === 0 ? (
            <Text style={styles.muted}>{t("Nenhum grupo encontrado.")}</Text>
          ) : (
            secoes.map(({ categoria, itens }) => (
              <View key={categoria} style={{ gap: spacing.sm }}>
                <View style={styles.catHeader}>
                  <Text style={styles.catTitle}>{categoria === SEM_CATEGORIA ? t(SEM_CATEGORIA) : categoria}</Text>
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeTxt}>{itens.length}</Text>
                  </View>
                </View>
                {itens.map((g) => (
                  <GrupoCard key={g.id} g={g} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: spacing.md },
    mapWrap: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: 100 },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    section: { color: colors.text, fontSize: font.size.md, fontWeight: "700", marginTop: spacing.sm },
    contador: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600", marginTop: spacing.xs },
    muted: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", marginTop: spacing.lg },
    search: {
      height: 48,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: font.size.md,
    },
    // modo de busca (grupo/líder)
    modePills: {
      flexDirection: "row",
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.xs,
    },
    modePill: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    modePillSel: { backgroundColor: colors.glass },
    modePillTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    modePillTxtSel: { color: colors.text, fontWeight: "700" },
    // botão de filtros
    filterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    filterBtnTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    filterCount: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    filterCountTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
    filtrosBox: {
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.md,
    },
    filterLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    chipRow: { gap: spacing.xs, paddingRight: spacing.md },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surfaceAlt,
    },
    chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    chipTxtSel: { color: "#fff", fontWeight: "700" },
    limparBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
    limparTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    // headers de categoria
    catHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
    catTitle: { color: colors.text, fontSize: font.size.md, fontWeight: "800", textTransform: "capitalize" },
    catBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      alignItems: "center",
      justifyContent: "center",
    },
    catBadgeTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "700" },
    // toggle lista/mapa
    toggle: {
      flexDirection: "row",
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.xs,
    },
    toggleItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    toggleItemSel: { backgroundColor: colors.primary },
    toggleTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    toggleTxtSel: { color: "#fff" },
    // card do grupo
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
    },
    pressed: { opacity: 0.7 },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.glass,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cardNome: { color: colors.text, fontSize: font.size.md, fontWeight: "700", flexShrink: 1 },
    cardCodigo: { color: colors.textMuted, fontSize: 11, fontWeight: "600", fontVariant: ["tabular-nums"] },
    cardLider: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 1 },
    cardMeta: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 1 },
    recBadge: {
      alignSelf: "flex-start",
      marginTop: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
    },
    recBadgeTxt: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  });
