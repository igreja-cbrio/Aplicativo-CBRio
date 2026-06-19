import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { trackEvento } from "@/lib/telemetria";
import { abrirRota } from "@/lib/navegacao";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Material = { id: string; nome: string; comentario: string | null; url: string | null };
type Grupo = {
  id: string;
  nome: string;
  dia_semana: number | null;
  horario: string | null;
  local: string | null;
  endereco: string | null;
  bairro: string | null;
  complemento: string | null;
  lat: number | null;
  lng: number | null;
  foto_url: string | null;
  funcao: string | null;
  lider: { nome: string; telefone: string | null } | null;
  proximo_encontro: string | null;
  materiais: Material[];
};

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function quandoEncontro(g: Grupo): string {
  const partes: string[] = [];
  if (g.dia_semana != null && DIAS[g.dia_semana]) partes.push(DIAS[g.dia_semana]);
  if (g.horario) partes.push(g.horario.slice(0, 5));
  return partes.join(" · ") || "Horário a confirmar";
}

function proximoLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }) +
    " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function MeuGrupoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiGet<{ grupos: Grupo[] }>("/app/meu-grupo");
      setGrupos(r.grupos || []);
    } catch {
      setGrupos([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  function falarComLider(g: Grupo) {
    const tel = (g.lider?.telefone || "").replace(/\D/g, "");
    if (!tel) return;
    const num = tel.startsWith("55") ? tel : `55${tel}`;
    trackEvento("grupo_falar_lider", { grupo: g.id });
    Linking.openURL(`https://wa.me/${num}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Meu grupo")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {grupos === null ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : grupos.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={32} color={colors.textMuted} />
            <Text style={styles.vazio}>{t("Você ainda não está em um grupo de conexão.")}</Text>
            <Button title={t("Encontrar um grupo")} onPress={() => router.navigate("/grupos")} />
          </View>
        ) : (
          grupos.map((g) => (
            <View key={g.id} style={styles.card}>
              {g.foto_url ? <Image source={{ uri: g.foto_url }} style={styles.foto} resizeMode="cover" /> : null}
              <View style={styles.body}>
                <View style={styles.tituloRow}>
                  <Text style={styles.nome}>{g.nome}</Text>
                  {g.funcao && g.funcao !== "membro" && (
                    <View style={styles.papelBadge}><Text style={styles.papelTxt}>{g.funcao === "lider" ? t("Líder") : g.funcao === "co_lider" ? t("Co-líder") : g.funcao}</Text></View>
                  )}
                </View>

                <Linha icon="calendar-outline" texto={quandoEncontro(g)} colors={colors} styles={styles} />
                {g.local ? <Linha icon="location-outline" texto={g.local} colors={colors} styles={styles} /> : null}
                {proximoLabel(g.proximo_encontro) ? (
                  <View style={styles.proximo}>
                    <Text style={styles.proximoLabel}>{t("Próximo encontro")}</Text>
                    <Text style={styles.proximoData}>{proximoLabel(g.proximo_encontro)}</Text>
                  </View>
                ) : null}

                {g.lider?.telefone ? (
                  <Button title={`${t("Falar com")} ${g.lider.nome.split(" ")[0]}`} onPress={() => falarComLider(g)} />
                ) : g.lider?.nome ? (
                  <Text style={styles.liderInfo}>{t("Líder")}: {g.lider.nome}</Text>
                ) : null}

                {((g.lat != null && g.lng != null) || g.local || g.endereco || g.bairro) ? (
                  <Button
                    title={t("Como chegar")}
                    variant="ghost"
                    onPress={() => abrirRota(
                      { lat: g.lat, lng: g.lng, endereco: [g.local, g.endereco, g.bairro].filter(Boolean).join(", ") },
                      { titulo: t("Como chegar"), cancelar: t("Cancelar") },
                    )}
                  />
                ) : null}

                {g.materiais.length > 0 && (
                  <View style={styles.materiais}>
                    <Text style={styles.materiaisTitulo}>{t("Materiais")}</Text>
                    {g.materiais.map((m) => (
                      <Pressable
                        key={m.id}
                        style={styles.material}
                        disabled={!m.url}
                        onPress={() => { if (m.url) { trackEvento("grupo_material_aberto", { grupo: g.id }); Linking.openURL(m.url); } }}
                      >
                        <Ionicons name="document-text-outline" size={18} color={colors.brandMid} />
                        <Text style={styles.materialNome} numberOfLines={1}>{m.nome}</Text>
                        <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Linha({ icon, texto, colors, styles }: { icon: React.ComponentProps<typeof Ionicons>["name"]; texto: string; colors: Palette; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.linha}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.linhaTxt}>{texto}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center" },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, overflow: "hidden" },
    foto: { width: "100%", height: 150, backgroundColor: colors.glass },
    body: { padding: spacing.lg, gap: spacing.sm },
    tituloRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    nome: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    papelBadge: { backgroundColor: colors.glass, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    papelTxt: { color: colors.brandMid, fontSize: 11, fontWeight: "700" },
    linha: { flexDirection: "row", alignItems: "center", gap: 8 },
    linhaTxt: { color: colors.textMuted, fontSize: font.size.md },
    proximo: { backgroundColor: colors.glass, borderRadius: radius.md, padding: spacing.md, marginTop: 2 },
    proximoLabel: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    proximoData: { color: colors.text, fontSize: font.size.md, fontWeight: "600", marginTop: 2, textTransform: "capitalize" },
    liderInfo: { color: colors.textMuted, fontSize: font.size.sm },
    materiais: { gap: spacing.xs, marginTop: spacing.xs },
    materiaisTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    material: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.glassBorder },
    materialNome: { color: colors.text, fontSize: font.size.md, flex: 1 },
  });
