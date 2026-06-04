import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
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
import { font, radius, spacing, type Palette } from "@/constants/theme";

export type Grupo = {
  id: string;
  nome: string;
  categoria: string | null;
  bairro: string | null;
  dia_semana: number | null;
  horario: string | null;
  foto_url: string | null;
  lat: number | null;
  lng: number | null;
};

const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Ordem preferida de exibição das categorias na lista. Categorias fora desta
// lista aparecem depois, em ordem alfabética. A comparação é por prefixo
// normalizado (sem acento/caixa), então "Jovens", "jovem", "JOVENS" caem juntos.
const CATEGORIA_ORDEM = ["adultos", "casais", "jovens", "mulheres", "homens", "famílias", "kids", "teens"];

const SEM_CATEGORIA = "Outros";

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function ordemCategoria(cat: string) {
  const n = normalizar(cat);
  const i = CATEGORIA_ORDEM.findIndex((c) => n.startsWith(normalizar(c)));
  return i === -1 ? CATEGORIA_ORDEM.length : i;
}

export function diaHorario(dia: number | null, horario: string | null) {
  const d = dia != null && DOW[dia] ? DOW[dia] : null;
  const h = horario ? horario.slice(0, 5) : null;
  return [d, h].filter(Boolean).join(" · ");
}

export default function GruposScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { membro } = useMembro();

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [meusIds, setMeusIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [view, setView] = useState<"lista" | "mapa">("lista");

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mem_grupos")
      .select("id, nome, categoria, bairro, dia_semana, horario, foto_url, lat, lng")
      .eq("ativo", true)
      .is("deleted_at", null)
      .in("status_temporada", ["ativo", "novo", "a_confirmar"])
      .order("nome");
    setGrupos((data as Grupo[]) ?? []);

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

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter(
      (g) =>
        g.nome.toLowerCase().includes(q) ||
        (g.bairro ?? "").toLowerCase().includes(q) ||
        (g.categoria ?? "").toLowerCase().includes(q)
    );
  }, [grupos, busca]);

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
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() => router.navigate({ pathname: "/grupo-detalhe", params: { id: g.id } })}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="people" size={22} color={colors.brandMid} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNome}>{g.nome}</Text>
          <Text style={styles.cardMeta}>
            {[g.bairro, diaHorario(g.dia_semana, g.horario)]
              .filter(Boolean)
              .join(" • ")}
          </Text>
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
          <Text style={styles.title}>Grupos</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleItem, view === "lista" && styles.toggleItemSel]}
            onPress={() => setView("lista")}
          >
            <Ionicons name="list" size={16} color={view === "lista" ? "#fff" : colors.textMuted} />
            <Text style={[styles.toggleTxt, view === "lista" && styles.toggleTxtSel]}>Lista</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleItem, view === "mapa" && styles.toggleItemSel]}
            onPress={() => setView("mapa")}
          >
            <Ionicons name="map" size={16} color={view === "mapa" ? "#fff" : colors.textMuted} />
            <Text style={[styles.toggleTxt, view === "mapa" && styles.toggleTxtSel]}>Mapa</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome, bairro ou categoria"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <Text style={styles.muted}>Carregando…</Text>
      ) : view === "mapa" ? (
        <View style={styles.mapWrap}>
          <GruposMapa
            grupos={filtrados}
            onSelect={(id) => router.navigate({ pathname: "/grupo-detalhe", params: { id } })}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          {meusGrupos.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.section}>Meus grupos</Text>
              {meusGrupos.map((g) => (
                <GrupoCard key={`meu-${g.id}`} g={g} />
              ))}
            </View>
          )}

          {filtrados.length === 0 ? (
            <Text style={styles.muted}>Nenhum grupo encontrado.</Text>
          ) : (
            secoes.map(({ categoria, itens }) => (
              <View key={categoria} style={{ gap: spacing.sm }}>
                <View style={styles.catHeader}>
                  <Text style={styles.catTitle}>{categoria}</Text>
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
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md },
    mapWrap: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: 100 },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    section: { color: colors.text, fontSize: font.size.md, fontWeight: "700", marginTop: spacing.sm },
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
    catHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    catTitle: {
      color: colors.text,
      fontSize: font.size.md,
      fontWeight: "800",
      textTransform: "capitalize",
    },
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
    cardNome: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    cardMeta: { color: colors.textMuted, fontSize: font.size.sm },
  });
