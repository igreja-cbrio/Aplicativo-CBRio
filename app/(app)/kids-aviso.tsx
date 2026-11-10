import { ScrollView } from "@/components/navigation/DockContent";
import { Text, TextInput } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { subirUmNivel } from "@/lib/hierarquia";
import { Checkbox } from "@/components/ui/Checkbox";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import {
  apiGet,
  cancelarAvisoNecessidade,
  criarAvisoNecessidade,
  listarCultosKids,
  type AvisoNecessidadeAtivo,
  type CultoKids,
} from "@/lib/api";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { useDialogo } from "@/components/ui/Dialogo";

// Consentimento ESPECÍFICO deste aviso (não reaproveita o da foto, eca-lgpd-v1).
const CONSENT_AVISO_VERSAO = "kids-aviso-v1";

function quando(data: string, hora: string | null): string {
  const d = data ? new Date(data.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }) : "";
  return hora ? `${d} · ${hora.slice(0, 5)}` : d;
}

export default function KidsAvisoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const dlg = useDialogo();
  const { id, filhoId, nome } = useLocalSearchParams<{ id?: string; filhoId?: string; nome?: string }>();
  const criancaId = filhoId || id;

  const [cultos, setCultos] = useState<CultoKids[] | null>(null);
  const [ativos, setAtivos] = useState<AvisoNecessidadeAtivo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [cultoId, setCultoId] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!criancaId) return;
    try {
      const [lista, det] = await Promise.all([
        listarCultosKids(),
        apiGet<{ avisos_ativos?: AvisoNecessidadeAtivo[] }>(`/app/kids/filho/${criancaId}`),
      ]);
      setCultos(lista.cultos ?? []);
      setAtivos(det.avisos_ativos ?? []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível carregar."));
    }
  }, [criancaId, t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function enviar() {
    if (!criancaId || !cultoId || !aceito || enviando) return;
    setEnviando(true);
    try {
      await criarAvisoNecessidade(criancaId, {
        culto_id: cultoId,
        nota_do_dia: nota.trim() || null,
        consentimento: true,
        consentimento_versao: CONSENT_AVISO_VERSAO,
      });
      setCultoId(null);
      setNota("");
      setAceito(false);
      await carregar();
      // Copy HONESTA: avisamos os voluntários; não prometemos preparo.
      void dlg.avisar(t("Aviso enviado"), t("Enviamos seu aviso aos voluntários do culto. Ao chegar, confirme com a liderança do Kids."));
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 409) {
        void dlg.avisar(t("Aviso já enviado"), t("Você já avisou para este culto."));
        await carregar();
      } else {
        void dlg.avisar(t("Erro"), e instanceof Error ? e.message : t("Não foi possível enviar o aviso."));
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(avisoId: string) {
    const ok = await dlg.confirmar({
      titulo: t("Cancelar aviso"),
      mensagem: t("Os voluntários deste culto deixam de ver o aviso. Cancelar mesmo?"),
      acao: t("Cancelar aviso"),
      perigo: true,
    });
    if (!ok) return;
    setCancelando(avisoId);
    try {
      await cancelarAvisoNecessidade(avisoId);
      await carregar();
    } catch (e) {
      void dlg.avisar(t("Erro"), e instanceof Error ? e.message : t("Não foi possível cancelar."));
    } finally {
      setCancelando(null);
    }
  }

  const podeEnviar = !!cultoId && aceito && !enviando;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{t("Avisar o Kids")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {nome ? <Text style={styles.sub}>{nome}</Text> : null}

        {!cultos && !erro ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : erro ? (
          <View style={styles.center}>
            <Text style={styles.vazio}>{erro}</Text>
            <Pressable onPress={() => { setErro(null); carregar(); }} style={styles.btnPrim} accessibilityRole="button">
              <Text style={styles.btnPrimTxt}>{t("Tentar novamente")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {ativos.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitulo}>{t("Avisos ativos")}</Text>
                {ativos.map((a) => (
                  <View key={a.id} style={styles.ativoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitulo}>{a.culto_nome}</Text>
                      <Text style={styles.itemSub}>{quando(a.culto_data, a.culto_hora)}</Text>
                    </View>
                    <Pressable onPress={() => cancelar(a.id)} disabled={cancelando === a.id} hitSlop={6} accessibilityRole="button">
                      {cancelando === a.id
                        ? <ActivityIndicator size="small" color={colors.danger} />
                        : <Text style={styles.cancelarTxt}>{t("Cancelar")}</Text>}
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitulo}>{t("Em qual culto?")}</Text>
              {cultos && cultos.length === 0 ? (
                <Text style={styles.vazio}>{t("Não há cultos disponíveis para avisar agora.")}</Text>
              ) : (
                cultos?.map((c) => {
                  const sel = c.id === cultoId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCultoId(sel ? null : c.id)}
                      style={[styles.cultoRow, sel && styles.cultoRowSel]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: sel }}>
                      <Ionicons name={sel ? "radio-button-on" : "radio-button-off"} size={20} color={sel ? colors.primary : colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitulo}>{c.nome}</Text>
                        <Text style={styles.itemSub}>{quando(c.data, c.hora)}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitulo}>{t("Nota do dia (opcional)")}</Text>
              <TextInput
                style={styles.input}
                value={nota}
                onChangeText={setNota}
                placeholder={t("Algo que ajude hoje: sono, medo, remédio, o que acalma…")}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitulo}>{t("Autorização de compartilhamento")}</Text>
              <Text style={styles.consentTxt}>{t("Ao enviar, estes dados serão vistos pelos voluntários do Kids deste culto.")}</Text>
              <Checkbox checked={aceito} onChange={setAceito} label={t("Li e autorizo o compartilhamento das informações de saúde da criança com os voluntários do Kids deste culto.")} />
            </View>

            <Pressable
              onPress={enviar}
              disabled={!podeEnviar}
              style={[styles.btnPrim, !podeEnviar && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !podeEnviar }}>
              {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimTxt}>{t("Enviar aviso")}</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
      <dlg.Dialogo />
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
    sub: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center" },
    center: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", paddingVertical: spacing.md },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
    cardTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    ativoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cancelarTxt: { color: colors.danger, fontSize: font.size.sm, fontWeight: "700" },
    cultoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: "transparent" },
    cultoRowSel: { borderColor: colors.primary },
    itemTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    itemSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 1 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.size.md, minHeight: 70, textAlignVertical: "top" },
    consentTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    btnPrim: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: radius.full, alignItems: "center" },
    btnPrimTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
  });
