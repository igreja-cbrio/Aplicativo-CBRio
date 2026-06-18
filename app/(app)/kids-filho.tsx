import { useCallback, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";
import { apiGet, apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const FOTO_BUCKET = "kids-documentos";
const CONSENT_VERSAO = "eca-lgpd-v1";

type Checkin = {
  id: string;
  checkin_at: string;
  checkout_at: string | null;
  decisao: boolean;
  sala: string | null;
  cor: string | null;
  culto: string | null;
  data: string | null;
};
type Detalhe = {
  crianca: {
    id: string; nome: string; idade_meses: number | null;
    observacoes_medicas: string | null; necessidades_especiais: string | null;
    parentesco: string | null; foto_url: string | null; foto_consentida?: boolean;
  };
  sala_sugerida: { nome: string; cor: string } | null;
  total_checkins: number;
  historico: Checkin[];
};

function idadeLabel(meses: number | null): string {
  if (meses == null) return "";
  if (meses < 24) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `${Math.floor(meses / 12)} anos`;
}

export default function KidsFilhoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [consentAberto, setConsentAberto] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      setD(await apiGet<Detalhe>(`/app/kids/filho/${id}`));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível carregar."));
    }
  }, [id, t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const c = d?.crianca;

  async function pegarImagem(fonte: "camera" | "galeria") {
    const perm = fonte === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("Permissão necessária"), t("Permita o acesso para enviar a foto."));
      return null;
    }
    const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsEditing: true, aspect: [1, 1] as [number, number] };
    const res = fonte === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return null;
    return res.assets[0];
  }

  function escolherFoto() {
    if (!aceito) return;
    Alert.alert(t("Foto da criança"), t("Como você quer enviar?"), [
      { text: t("Tirar foto"), onPress: () => enviarFoto("camera") },
      { text: t("Escolher da galeria"), onPress: () => enviarFoto("galeria") },
      { text: t("Cancelar"), style: "cancel" },
    ]);
  }

  async function enviarFoto(fonte: "camera" | "galeria") {
    if (!user?.id || !id) return;
    const asset = await pegarImagem(fonte);
    if (!asset) return;
    setSalvandoFoto(true);
    try {
      const resp = await fetch(asset.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const ext = (asset.uri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/foto-crianca/${id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(FOTO_BUCKET).upload(path, arrayBuffer, {
        contentType: asset.mimeType ?? `image/${ext}`,
        upsert: true,
      });
      if (error) throw error;
      await apiPost(`/app/kids/filho/${id}/foto`, { storage_path: path, consentimento: true, versao_consentimento: CONSENT_VERSAO });
      setConsentAberto(false);
      setAceito(false);
      await carregar();
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível enviar a foto."));
    } finally {
      setSalvandoFoto(false);
    }
  }

  function removerFoto() {
    if (!id) return;
    Alert.alert(
      t("Remover foto"),
      t("Isso apaga a foto e revoga a autorização de uso da imagem. Tem certeza?"),
      [
        { text: t("Cancelar"), style: "cancel" },
        {
          text: t("Remover"),
          style: "destructive",
          onPress: async () => {
            setSalvandoFoto(true);
            try {
              await apiPost(`/app/kids/filho/${id}/foto/remover`, {});
              await carregar();
            } catch (e) {
              Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível remover."));
            } finally {
              setSalvandoFoto(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/kids"))} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{c?.nome || t("Criança")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {!d && !erro ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : erro ? (
          <View style={styles.center}><Text style={styles.vazio}>{erro}</Text></View>
        ) : c ? (
          <>
            <View style={styles.topo}>
              {c.foto_url ? (
                <Image source={{ uri: c.foto_url }} style={styles.foto} />
              ) : (
                <View style={[styles.foto, styles.fotoVazia]}><Ionicons name="happy-outline" size={36} color={colors.brandMid} /></View>
              )}
              <Text style={styles.nome}>{c.nome}</Text>
              <Text style={styles.idade}>{idadeLabel(c.idade_meses)}</Text>
              {d?.sala_sugerida && (
                <View style={[styles.salaPill, { backgroundColor: (d.sala_sugerida.cor || colors.brandMid) + "22" }]}>
                  <View style={[styles.salaDot, { backgroundColor: d.sala_sugerida.cor || colors.brandMid }]} />
                  <Text style={styles.salaTxt}>{t("Sala")}: {d.sala_sugerida.nome}</Text>
                </View>
              )}

              {/* Gestão da foto (opcional · consentimento ECA/LGPD) */}
              {c.foto_url ? (
                <Pressable onPress={removerFoto} disabled={salvandoFoto} hitSlop={6} style={styles.removerFoto} accessibilityRole="button">
                  {salvandoFoto ? <ActivityIndicator size="small" color={colors.danger} /> : <Ionicons name="trash-outline" size={15} color={colors.danger} />}
                  <Text style={styles.removerFotoTxt}>{t("Remover foto")}</Text>
                </Pressable>
              ) : !consentAberto ? (
                <Pressable onPress={() => setConsentAberto(true)} hitSlop={6} style={styles.addFoto} accessibilityRole="button">
                  <Ionicons name="camera-outline" size={16} color={colors.brandMid} />
                  <Text style={styles.addFotoTxt}>{t("Adicionar foto (opcional)")}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Bloco de consentimento — só ao adicionar foto */}
            {!c.foto_url && consentAberto && (
              <View style={styles.consent}>
                <Text style={styles.consentTitulo}>{t("Autorização de uso da imagem")}</Text>
                <Text style={styles.consentTxt}>
                  {t("Autorizo a CBRio a usar a foto do(a) meu/minha filho(a) exclusivamente para identificá-lo(a) no check-in do Kids (segurança na entrada e retirada). A imagem fica armazenada de forma privada, visível apenas a mim e à equipe do Kids autorizada — não será publicada nem compartilhada. Declaro ser o responsável legal e posso revogar esta autorização a qualquer momento, removendo a foto.")}
                </Text>
                <Text style={styles.consentLei}>{t("ECA (Lei 8.069/90, arts. 17 e 18) · LGPD (Lei 13.709/18, art. 14).")}</Text>

                <Pressable style={styles.checkRow} onPress={() => setAceito((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: aceito }}>
                  <Ionicons name={aceito ? "checkbox" : "square-outline"} size={22} color={aceito ? colors.primary : colors.textMuted} />
                  <Text style={styles.checkTxt}>{t("Li e autorizo o uso da imagem da criança.")}</Text>
                </Pressable>

                <View style={styles.consentBtns}>
                  <Pressable onPress={() => { setConsentAberto(false); setAceito(false); }} style={styles.btnGhost} accessibilityRole="button">
                    <Text style={styles.btnGhostTxt}>{t("Cancelar")}</Text>
                  </Pressable>
                  <Pressable onPress={escolherFoto} disabled={!aceito || salvandoFoto} style={[styles.btnPrim, (!aceito || salvandoFoto) && { opacity: 0.5 }]} accessibilityRole="button">
                    {salvandoFoto ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimTxt}>{t("Escolher foto")}</Text>}
                  </Pressable>
                </View>
              </View>
            )}

            {(c.observacoes_medicas || c.necessidades_especiais) && (
              <View style={styles.alerta}>
                <Ionicons name="medkit-outline" size={18} color="#B45309" />
                <View style={{ flex: 1 }}>
                  {c.observacoes_medicas ? <Text style={styles.alertaTxt}>{c.observacoes_medicas}</Text> : null}
                  {c.necessidades_especiais ? <Text style={styles.alertaTxt}>{c.necessidades_especiais}</Text> : null}
                </View>
              </View>
            )}

            <View style={styles.histHeader}>
              <Text style={styles.histTitulo}>{t("Histórico de presença")}</Text>
              {d ? <Text style={styles.histTotal}>{d.total_checkins}</Text> : null}
            </View>

            {d && d.historico.length === 0 ? (
              <Text style={styles.vazio}>{t("Nenhum check-in ainda.")}</Text>
            ) : (
              d?.historico.map((k) => (
                <View key={k.id} style={styles.item}>
                  <View style={[styles.itemDot, { backgroundColor: k.cor || colors.brandMid }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitulo}>{k.culto || t("Culto")}</Text>
                    <Text style={styles.itemSub}>
                      {k.data ? new Date(k.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                      {k.sala ? ` · ${k.sala}` : ""}
                    </Text>
                  </View>
                  {k.decisao ? <Ionicons name="heart" size={16} color="#E11D48" /> : null}
                  {k.checkout_at ? <Ionicons name="checkmark-done" size={18} color="#3FA66B" /> : <Ionicons name="time-outline" size={18} color={colors.textMuted} />}
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", flex: 1, textAlign: "center" },
    center: { alignItems: "center", paddingVertical: spacing.xl },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", paddingVertical: spacing.md },
    topo: { alignItems: "center", gap: 4 },
    foto: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
    fotoVazia: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.glassBorder },
    nome: { color: colors.text, fontSize: font.size.xl, fontWeight: "800", marginTop: spacing.xs },
    idade: { color: colors.textMuted, fontSize: font.size.md },
    salaPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, marginTop: spacing.xs },
    salaDot: { width: 8, height: 8, borderRadius: 4 },
    salaTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    addFoto: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.surface },
    addFotoTxt: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    removerFoto: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, paddingVertical: 4 },
    removerFotoTxt: { color: colors.danger, fontSize: font.size.sm, fontWeight: "600" },
    consent: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
    consentTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    consentTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    consentLei: { color: colors.textMuted, fontSize: 11, fontStyle: "italic" },
    checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
    checkTxt: { color: colors.text, fontSize: font.size.sm, flex: 1 },
    consentBtns: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", marginTop: 2 },
    btnGhost: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.full },
    btnGhostTxt: { color: colors.textMuted, fontSize: font.size.md, fontWeight: "700" },
    btnPrim: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.full },
    btnPrimTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
    alerta: { flexDirection: "row", gap: spacing.sm, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", borderRadius: radius.md, padding: spacing.md },
    alertaTxt: { color: "#92400E", fontSize: font.size.sm, lineHeight: 19 },
    histHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    histTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    histTotal: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "800" },
    item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.md, padding: spacing.md },
    itemDot: { width: 10, height: 10, borderRadius: 5 },
    itemTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    itemSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 1 },
  });
