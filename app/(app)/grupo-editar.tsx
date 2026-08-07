import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { editarGrupo, enviarCapaGrupo, removerCapaGrupo } from "@/lib/api";
import { arquivoDaCapa, capaCabe } from "@/lib/capaGrupo";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

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
      // ⚠️ só `deleted_at` (grupo apagado não existe). NÃO filtrar `ativo`: o
      // líder precisa poder editar grupo pausado — quem trava a INSCRIÇÃO é o
      // /grupo-detalhe, que é a face pública.
      .is("deleted_at", null)
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

    // ⚠️ Formato e tamanho conferidos ANTES de gastar a subida (a régua vive em
    // `lib/capaGrupo.ts`, com teste). O servidor recusa igual — isto só evita
    // mandar 3MB pra receber 400.
    const arquivo = arquivoDaCapa(asset);
    if (!arquivo) {
      setMsg({ type: "err", text: t("Use uma imagem JPG, PNG ou WEBP.") });
      return;
    }
    if (!capaCabe(asset.fileSize)) {
      setMsg({ type: "err", text: t("Imagem muito grande (máximo 4MB).") });
      return;
    }

    setUploading(true);
    try {
      // ⚠️⚠️ SAI PELO BACKEND (07/08/2026 · fecho da Onda 2). Aqui era upload
      // direto pro Storage + UPDATE direto em `mem_grupos` — e nunca gravou
      // NADA: 0 de 278 linhas com `foto_url`, 0 objetos no bucket, desde 04/06.
      // Eram dois defeitos empilhados: a policy do bucket exige
      // `is_admin_or_diretor()` (16 de 113 profiles), e o UPDATE não tinha
      // `.select()` — 0 linhas voltavam SEM erro e esta tela dizia "Capa
      // atualizada." ainda pintando a imagem. É o MESMO estrago que o `salvar()`
      // logo abaixo já teve, na Onda 1b, e que ficou pra trás aqui.
      //
      // ⚠️ Quem decide a URL final é o SERVIDOR (caminho único por upload, pra
      // o CDN não servir a capa velha por 1h). A tela aplica o que voltar.
      const url = await enviarCapaGrupo(grupo.id, arquivo);
      setField("foto_url", url);
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

  function removerCapa() {
    if (!grupo?.foto_url) return;
    Alert.alert(t("Remover a capa?"), t("O grupo volta a aparecer sem foto."), [
      { text: t("Cancelar"), style: "cancel" },
      {
        text: t("Remover"),
        style: "destructive",
        onPress: async () => {
          setMsg(null);
          setUploading(true);
          try {
            await removerCapaGrupo(grupo.id);
            setField("foto_url", null);
            setMsg({ type: "ok", text: t("Capa removida.") });
          } catch (e) {
            setMsg({
              type: "err",
              text: e instanceof Error ? `${t("Falha ao remover a capa")}: ${e.message}` : t("Falha ao remover a capa."),
            });
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  }

  async function salvar() {
    if (!grupo) return;
    setMsg(null);
    setSalvando(true);
    try {
      // ⚠️⚠️ SAI PELO BACKEND (06/08/2026 · auditoria). Aqui era UPDATE DIRETO em
      // `mem_grupos` — e a RLS de UPDATE só aceita `lider_id =
      // current_user_membro_id()` OU nível grupos >= 3, ou seja **supervisor não
      // passa**. Como o update não tinha `.select()` nem conferia linhas
      // afetadas, 0 linhas voltavam SEM erro e esta tela dizia "Grupo
      // atualizado." Medido em 06/08: o único supervisor com conta no app
      // supervisiona 8 grupos e não é líder em 7 — 7 saves que mentiam.
      //
      // O endpoint autoriza pelo MESMO critério que esta tela usa pra mostrar o
      // botão (`useAdminGrupo`), valida os campos (categoria em lista fechada —
      // é regra de negócio; horário normalizado, porque a coluna é `time`) e
      // devolve 409 quando nada é gravado, em vez de fingir sucesso.
      const salvo = await editarGrupo(grupo.id, {
        nome: grupo.nome?.trim() || null,
        categoria: grupo.categoria?.trim() || null,
        descricao: grupo.descricao?.trim() || null,
        tema: grupo.tema?.trim() || null,
        dia_semana: grupo.dia_semana,
        horario: grupo.horario?.trim() || null,
        local: grupo.local?.trim() || null,
        endereco: grupo.endereco?.trim() || null,
        bairro: grupo.bairro?.trim() || null,
      });
      // Reflete o que o servidor NORMALIZOU (ex.: "1930" virou "19:30",
      // "casais" virou "Casais") — senão a tela mostraria o que a pessoa
      // digitou e o banco teria outro valor.
      if (salvo) setGrupo((g) => (g ? { ...g, ...salvo } : g));
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
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back}>
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
      <TecladoSeguro        style={{ flex: 1 }}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("Editar grupo")}</Text>
            <View style={{ width: 24 }} />
          </View>

          <Pressable
            onPress={escolherCapa}
            disabled={uploading}
            style={styles.capaWrap}
            accessibilityRole="button"
            accessibilityLabel={grupo.foto_url ? t("Trocar a capa do grupo") : t("Escolher a capa do grupo")}
          >
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
          {/* A capa aparece no catálogo público de grupos — quem escolhe merece
              saber onde ela vai parar, e ter como desfazer. */}
          <View style={styles.capaAcoes}>
            <Text style={styles.capaAviso}>{t("A capa aparece na lista de grupos do app e do site.")}</Text>
            {!!grupo.foto_url && (
              <Pressable onPress={removerCapa} disabled={uploading} hitSlop={8} accessibilityRole="button">
                <Text style={styles.capaRemover}>{t("Remover")}</Text>
              </Pressable>
            )}
          </View>

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
      </TecladoSeguro>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    label: { color: colors.text, fontSize: font.size.sm, fontWeight: "700", marginTop: spacing.sm },
    muted: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", marginTop: spacing.lg, paddingHorizontal: spacing.lg },
    capaWrap: { position: "relative", borderRadius: radius.lg, overflow: "hidden" },
    capa: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceAlt },
    capaPlaceholder: { alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.glassBorder, borderStyle: "dashed" },
    capaHint: { color: colors.textMuted, fontSize: font.size.sm },
    capaAcoes: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: -spacing.xs },
    capaAviso: { color: colors.textMuted, fontSize: font.size.sm, flex: 1 },
    capaRemover: { color: "#ef4444", fontSize: font.size.sm, fontWeight: "700" },
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
