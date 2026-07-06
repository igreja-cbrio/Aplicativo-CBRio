import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet, apiPost } from "@/lib/api";
import { trackTela, trackEvento, trackErro } from "@/lib/telemetria";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Culto = { id: string; nome: string; data: string; hora: string | null };
type Agora = { culto: Culto | null; canal_live: string; jaRegistrou: boolean };

const TIPOS: { key: string; label: string }[] = [
  { key: "aceitar", label: "Aceitei Jesus pela 1ª vez" },
  { key: "reconciliacao", label: "Voltei pra Deus" },
  { key: "rededicacao", label: "Redediquei minha vida" },
  { key: "batismo", label: "Quero me batizar" },
  { key: "outro", label: "Outra decisão" },
];

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ModoCulto() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [a, setA] = useState<Agora | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Anotações da pregação (locais por dia)
  const [nota, setNota] = useState("");
  const notaKey = `cbrio:nota-culto:${hojeISO()}`;

  // Decisão
  const [tipo, setTipo] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [registrou, setRegistrou] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await apiGet<Agora>("/app/culto/agora");
      setA(r);
      setRegistrou(r.jaRegistrou);
    } catch {
      /* mantém */
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      trackTela("modo-culto");
      carregar();
    }, [carregar])
  );

  useEffect(() => {
    AsyncStorage.getItem(notaKey).then((v) => v && setNota(v));
  }, [notaKey]);

  function salvarNota(txt: string) {
    setNota(txt);
    AsyncStorage.setItem(notaKey, txt).catch(() => {});
  }

  function aoVivo() {
    if (!a?.canal_live) return;
    trackEvento("culto_ao_vivo");
    Linking.openURL(a.canal_live);
  }

  async function registrar() {
    if (!tipo) return;
    setEnviando(true);
    try {
      await apiPost("/app/culto/decisao", { tipo, ambiente: online ? "online" : "presencial", observacao: obs.trim() });
      trackEvento("decisao_registrada", { tipo });
      setRegistrou(true);
    } catch (e) {
      // ⚠️ Nunca falhar em silêncio: é uma decisão de fé — o usuário PRECISA
      // saber que não foi registrada pra tentar de novo.
      trackErro("decisao_falhou", { message: e instanceof Error ? e.message : String(e) });
      Alert.alert(
        t("Não foi possível registrar"),
        t("Sua decisão não foi enviada. Verifique sua conexão e tente novamente.")
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("No culto")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {carregando ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <>
            {/* Ao vivo */}
            <Pressable style={styles.aoVivo} onPress={aoVivo} accessibilityRole="button">
              <View style={styles.aoVivoDot} />
              <Ionicons name="play-circle" size={24} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.aoVivoTitulo}>{t("Assistir ao vivo")}</Text>
                <Text style={styles.aoVivoSub}>{a?.culto?.nome || t("Transmissão da CBRio no YouTube")}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>

            {/* Decisão de fé */}
            <Text style={styles.secao}>{t("Tomei uma decisão hoje")}</Text>
            {registrou ? (
              <View style={styles.feito}>
                <Ionicons name="heart" size={28} color={colors.primary} />
                <Text style={styles.feitoTitulo}>{t("Que decisão linda! 💙")}</Text>
                <Text style={styles.feitoTxt}>{t("Recebemos seu registro. Nossa equipe vai falar com você em breve.")}</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardSub}>{t("Conta pra gente o que aconteceu no seu coração:")}</Text>
                <View style={styles.tipos}>
                  {TIPOS.map((op) => {
                    const sel = tipo === op.key;
                    return (
                      <Pressable key={op.key} onPress={() => setTipo(op.key)} style={[styles.tipo, sel && styles.tipoSel]}>
                        <Ionicons name={sel ? "radio-button-on" : "radio-button-off"} size={18} color={sel ? colors.primary : colors.textMuted} />
                        <Text style={[styles.tipoTxt, sel && { color: colors.text, fontWeight: "700" }]}>{t(op.label)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable style={styles.onlineRow} onPress={() => setOnline((v) => !v)}>
                  <Ionicons name={online ? "checkbox" : "square-outline"} size={20} color={online ? colors.primary : colors.textMuted} />
                  <Text style={styles.onlineTxt}>{t("Estou assistindo online")}</Text>
                </Pressable>

                <TextInput
                  style={styles.input}
                  value={obs}
                  onChangeText={setObs}
                  placeholder={t("Quer deixar um recado? (opcional)")}
                  placeholderTextColor={colors.textMuted}
                  multiline
                />

                <Pressable
                  style={[styles.botao, (!tipo || enviando) && { opacity: 0.5 }]}
                  onPress={registrar}
                  disabled={!tipo || enviando}
                  accessibilityRole="button"
                >
                  {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTxt}>{t("Registrar minha decisão")}</Text>}
                </Pressable>
              </View>
            )}

            {/* Anotações da pregação */}
            <Text style={styles.secao}>{t("Anotações da pregação")}</Text>
            <View style={styles.card}>
              <TextInput
                style={[styles.input, { minHeight: 140 }]}
                value={nota}
                onChangeText={salvarNota}
                placeholder={t("O que Deus falou com você hoje?")}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.notaHint}>{t("Salvo automaticamente neste aparelho.")}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: spacing.xl },
    aoVivo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#E11D48", borderRadius: radius.lg, padding: spacing.lg },
    aoVivoDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff" },
    aoVivoTitulo: { color: "#fff", fontSize: font.size.lg, fontWeight: "800" },
    aoVivoSub: { color: "rgba(255,255,255,0.9)", fontSize: font.size.sm },
    secao: { color: colors.text, fontSize: font.size.md, fontWeight: "800", marginTop: spacing.sm },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
    cardSub: { color: colors.textMuted, fontSize: font.size.sm },
    tipos: { gap: 2 },
    tipo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 10 },
    tipoSel: {},
    tipoTxt: { color: colors.textMuted, fontSize: font.size.md },
    onlineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
    onlineTxt: { color: colors.text, fontSize: font.size.sm },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: font.size.md },
    botao: { backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: 14, alignItems: "center", marginTop: 4 },
    botaoTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
    feito: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", gap: 8 },
    feitoTitulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    feitoTxt: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center" },
    notaHint: { color: colors.textMuted, fontSize: 11 },
  });
