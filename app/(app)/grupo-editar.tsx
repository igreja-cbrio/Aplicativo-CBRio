import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useColors } from "@/contexts/ThemeContext";
import { useAdminGrupo } from "@/lib/useAdminGrupo";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type GrupoEdit = {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  tema: string | null;
  dia_semana: number | null;
  horario: string | null;
  local: string | null;
  endereco: string | null;
  bairro: string | null;
  foto_url: string | null;
};

const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function GrupoEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { isAdmin, loading: checking } = useAdminGrupo(id);
  const t = useT();

  const [grupo, setGrupo] = useState<GrupoEdit | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    const { data } = await supabase
      .from("mem_grupos")
      .select("id, nome, categoria, descricao, tema, dia_semana, horario, local, endereco, bairro, foto_url")
      .eq("id", id)
      .maybeSingle();
    setGrupo((data as GrupoEdit) ?? null);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function setField<K extends keyof GrupoEdit>(key: K, value: GrupoEdit[K]) {
    setGrupo((g) => (g ? { ...g, [key]: value } : g));
  }

  async function escolherCapa() {
    if (!grupo) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("Permissão necessária"), t("Permita o acesso às fotos para escolher uma capa."));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setMsg(null);
    setUploading(true);
    try {
      const resp = await fetch(asset.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
      const path = `${grupo.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("grupos")
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType ?? `image/${ext}`,
          upsert: true,
        });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("grupos").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase
        .from("mem_grupos")
        .update({ foto_url: publicUrl })
        .eq("id", grupo.id);
      if (updErr) throw updErr;
      setField("foto_url", publicUrl);
      setMsg({ type: "ok", text: t("Capa atualizada.") });
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? `${t("Falha ao enviar a capa")}: ${e.message}` : t("Falha ao enviar a capa."),
      });
    } finally {
      setUploading(false);
    }
  }

  async function salvar() {
    if (!grupo) return;
    setMsg(null);
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("mem_grupos")
        .update({
          nome: grupo.nome?.trim() || null,
          categoria: grupo.categoria?.trim() || null,
          descricao: grupo.descricao?.trim() || null,
          tema: grupo.tema?.trim() || null,
          dia_semana: grupo.dia_semana,
          horario: grupo.horario?.trim() || null,
          local: grupo.local?.trim() || null,
          endereco: grupo.endereco?.trim() || null,
          bairro: grupo.bairro?.trim() || null,
        })
        .eq("id", grupo.id);
      if (error) throw error;
      setMsg({ type: "ok", text: t("Grupo atualizado.") });
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? `${t("Falha ao salvar")}: ${e.message}` : t("Falha ao salvar."),
      });
    } finally {
      setSalvando(false);
    }
  }

  if (checking || carregando) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Editar grupo")}</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={styles.muted}>{t("Você não tem permissão para editar este grupo.")}</Text>
      </SafeAreaView>
    );
  }

  if (!grupo) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.muted}>{t("Grupo não encontrado.")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("Editar grupo")}</Text>
            <View style={{ width: 24 }} />
          </View>

          <Pressable onPress={escolherCapa} style={styles.capaWrap}>
            {grupo.foto_url ? (
              <Image source={{ uri: grupo.foto_url }} style={styles.capa} />
            ) : (
              <View style={[styles.capa, styles.capaPlaceholder]}>
                <Ionicons name="image-outline" size={40} color={colors.textMuted} />
                <Text style={styles.capaHint}>{t("Toque para escolher a capa")}</Text>
              </View>
            )}
            <View style={styles.capaBadge}>
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="camera" size={18} color="#fff" />
              )}
            </View>
          </Pressable>

          <Input
            label={t("Nome")}
            value={grupo.nome ?? ""}
            onChangeText={(v) => setField("nome", v)}
            placeholder={t("Nome do grupo")}
          />
          <Input
            label={t("Categoria")}
            value={grupo.categoria ?? ""}
            onChangeText={(v) => setField("categoria", v)}
            placeholder={t("Adultos, Jovens, Casais…")}
          />
          <Input
            label={t("Tema")}
            value={grupo.tema ?? ""}
            onChangeText={(v) => setField("tema", v)}
            placeholder={t("Tema do trimestre")}
          />
          <Input
            label={t("Descrição")}
            value={grupo.descricao ?? ""}
            onChangeText={(v) => setField("descricao", v)}
            placeholder={t("Sobre o grupo")}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>{t("Dia da semana")}</Text>
          <View style={styles.diasRow}>
            {DOW.map((d, i) => {
              const sel = grupo.dia_semana === i;
              return (
                <Pressable
                  key={d}
                  onPress={() => setField("dia_semana", sel ? null : i)}
                  style={[styles.diaChip, sel && styles.diaChipSel]}
                >
                  <Text style={[styles.diaTxt, sel && styles.diaTxtSel]}>{t(d).slice(0, 3)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            label={t("Horário (HH:MM)")}
            value={grupo.horario ?? ""}
            onChangeText={(v) => setField("horario", v)}
            placeholder="19:30"
            autoCapitalize="none"
          />
          <Input
            label={t("Local")}
            value={grupo.local ?? ""}
            onChangeText={(v) => setField("local", v)}
            placeholder={t("Casa do líder, igreja, etc.")}
          />
          <Input
            label={t("Endereço")}
            value={grupo.endereco ?? ""}
            onChangeText={(v) => setField("endereco", v)}
            placeholder={t("Rua, número")}
          />
          <Input
            label={t("Bairro")}
            value={grupo.bairro ?? ""}
            onChangeText={(v) => setField("bairro", v)}
            placeholder={t("Bairro")}
          />

          {msg && (
            <Text style={msg.type === "ok" ? styles.ok : styles.erro}>{msg.text}</Text>
          )}

          <Button title={t("Salvar alterações")} onPress={salvar} loading={salvando} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    label: { color: colors.text, fontSize: font.size.sm, fontWeight: "700", marginTop: spacing.sm },
    muted: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", marginTop: spacing.lg, paddingHorizontal: spacing.lg },
    capaWrap: { position: "relative", borderRadius: radius.lg, overflow: "hidden" },
    capa: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceAlt },
    capaPlaceholder: { alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.glassBorder, borderStyle: "dashed" },
    capaHint: { color: colors.textMuted, fontSize: font.size.sm },
    capaBadge: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    diasRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
    diaChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    diaChipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    diaTxt: { color: colors.textMuted, fontWeight: "700", fontSize: font.size.sm },
    diaTxtSel: { color: "#fff" },
    ok: { color: colors.success, fontSize: font.size.sm, textAlign: "center" },
    erro: { color: "#ef4444", fontSize: font.size.sm, textAlign: "center" },
  });
