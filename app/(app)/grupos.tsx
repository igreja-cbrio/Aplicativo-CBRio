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
};

const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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
  const [cat, setCat] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mem_grupos")
      .select("id, nome, categoria, bairro, dia_semana, horario, foto_url")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome");
    setGrupos((data as Grupo[]) ?? []);

    if (membro?.membroId) {
      const { data: meus } = await supabase
        .from("mem_grupo_membros")
        .select("grupo_id")
        .eq("membro_id", membro.membroId)
        .is("deleted_at", null);
      setMeusIds((meus ?? []).map((m) => m.grupo_id as string));
    }
    setLoading(false);
  }, [membro?.membroId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const categorias = useMemo(
    () => [...new Set(grupos.map((g) => g.categoria).filter(Boolean))] as string[],
    [grupos]
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return grupos.filter((g) => {
      if (cat && g.categoria !== cat) return false;
      if (!q) return true;
      return (
        g.nome.toLowerCase().includes(q) ||
        (g.bairro ?? "").toLowerCase().includes(q)
      );
    });
  }, [grupos, busca, cat]);

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
            {[g.categoria, g.bairro, diaHorario(g.dia_semana, g.horario)]
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Grupos</Text>
          <View style={{ width: 24 }} />
        </View>

        {meusGrupos.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.section}>Meus grupos</Text>
            {meusGrupos.map((g) => (
              <GrupoCard key={`meu-${g.id}`} g={g} />
            ))}
          </View>
        )}

        <Text style={styles.section}>Encontre um grupo</Text>
        <TextInput
          style={styles.search}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome ou bairro"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />
        {categorias.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable style={[styles.chip, !cat && styles.chipSel]} onPress={() => setCat(null)}>
              <Text style={[styles.chipTxt, !cat && styles.chipTxtSel]}>Todas</Text>
            </Pressable>
            {categorias.map((c) => (
              <Pressable key={c} style={[styles.chip, cat === c && styles.chipSel]} onPress={() => setCat(c)}>
                <Text style={[styles.chipTxt, cat === c && styles.chipTxtSel]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <Text style={styles.muted}>Carregando…</Text>
        ) : filtrados.length === 0 ? (
          <Text style={styles.muted}>Nenhum grupo encontrado.</Text>
        ) : (
          filtrados.map((g) => <GrupoCard key={g.id} g={g} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
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
    chips: { gap: spacing.sm, paddingVertical: 2 },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTxt: { color: colors.text, fontSize: font.size.sm },
    chipTxtSel: { color: "#fff", fontWeight: "700" },
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
