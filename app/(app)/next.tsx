import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { Skeleton } from "@/components/anim/Skeleton";
import { useNextSync } from "@/lib/useNextSync";
import { inscreverNext, checkinNext, type NextEncontro } from "@/lib/api";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatData(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${DOW[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + "T12:00:00");
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function formatRelativo(iso: string): string {
  const d = diasAte(iso);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d > 1) return `Em ${d} dias`;
  if (d === -1) return "Ontem";
  return `Há ${Math.abs(d)} dias`;
}

export default function NextScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { me, loading, erro, recarregar } = useNextSync();

  const [inscrevendo, setInscrevendo] = useState(false);
  const [checkinId, setCheckinId] = useState<string | null>(null);

  async function inscrever() {
    setInscrevendo(true);
    try {
      const resp = await inscreverNext();
      await recarregar();
      Alert.alert(
        "Inscrição NEXT confirmada!",
        resp.jaInscrito
          ? "Você já estava inscrito(a). Te vemos lá."
          : "Tá feito. A equipe vai te receber muito bem."
      );
    } catch (e) {
      Alert.alert("Não foi possível inscrever", e instanceof Error ? e.message : "Erro.");
    } finally {
      setInscrevendo(false);
    }
  }

  async function pedirLocalizacao(): Promise<Location.LocationObject | null> {
    const { status } = await Location.getForegroundPermissionsAsync();
    let s = status;
    if (s !== "granted") {
      const r = await Location.requestForegroundPermissionsAsync();
      s = r.status;
    }
    if (s !== "granted") {
      Alert.alert(
        "Ative a localização",
        "Pra confirmar sua presença no NEXT, precisamos da sua localização.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Abrir Configurações", onPress: () => Linking.openSettings() },
        ]
      );
      return null;
    }
    try {
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch {
      Alert.alert("Falha ao obter localização", "Tente novamente.");
      return null;
    }
  }

  async function fazerCheckin(enc: NextEncontro) {
    setCheckinId(enc.id);
    try {
      const loc = await pedirLocalizacao();
      if (!loc) return;
      const resp = await checkinNext(enc.id, loc.coords.latitude, loc.coords.longitude);
      if (resp.ok) {
        Alert.alert("Presença confirmada!", "Te vejo já 💙");
        await recarregar();
        return;
      }
      if (resp.needLocation) {
        await pedirLocalizacao();
        return;
      }
      if (resp.status === 403) {
        const dist = resp.distancia_m
          ? ` (você está a ${Math.round(resp.distancia_m)}m)`
          : "";
        Alert.alert(
          "Você precisa estar na igreja",
          `O check-in só libera dentro do raio da CBRio${dist}.`
        );
        return;
      }
      Alert.alert("Não foi possível confirmar", resp.error || "Tente novamente.");
    } finally {
      setCheckinId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>NEXT</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton width="100%" height={170} borderRadius={20} />
            <Skeleton width={160} height={20} borderRadius={6} />
            <Skeleton width="100%" height={90} borderRadius={16} />
            <Skeleton width="100%" height={90} borderRadius={16} />
          </View>
        ) : !me ? (
          <View style={styles.vazio}>
            <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
            <Text style={styles.vazioTxt}>
              {erro ? erro : "Não foi possível carregar o NEXT."}
            </Text>
            <Button title="Tentar de novo" variant="ghost" onPress={recarregar} />
          </View>
        ) : !me.inscrito_next ? (
          <>
            <View style={styles.hero}>
              <Ionicons name="map" size={28} color="#fff" />
              <Text style={styles.heroTitulo}>O começo da sua jornada</Text>
              <Text style={styles.heroSub}>
                O NEXT é onde a gente te conhece e te conecta no coração da CBRio.
                São encontros pra você descobrir como dar próximos passos com Jesus.
              </Text>
            </View>
            <Button
              title="Quero participar do NEXT"
              onPress={inscrever}
              loading={inscrevendo}
            />
          </>
        ) : (
          <>
            <View style={styles.statusCard}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitulo}>Você está no NEXT 💙</Text>
                <Text style={styles.statusTxt}>
                  Veja os encontros e faça check-in no dia, quando estiver na
                  igreja.
                </Text>
              </View>
            </View>

            <Text style={styles.section}>Próximos encontros</Text>

            {me.encontros.length === 0 ? (
              <View style={styles.vazio}>
                <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
                <Text style={styles.vazioTxt}>
                  Nenhum encontro programado por enquanto.
                </Text>
              </View>
            ) : (
              me.encontros.map((enc) => {
                const confirmado = !!enc.check_in_at;
                const podeAgora = enc.pode_checkin_hoje && !confirmado;
                return (
                  <View key={enc.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.dataPill}>
                        <Text style={styles.dataPillTxt}>{formatRelativo(enc.data)}</Text>
                      </View>
                      {confirmado && (
                        <View style={styles.checkPill}>
                          <Ionicons name="checkmark-circle" size={14} color="#fff" />
                          <Text style={styles.checkPillTxt}>Presença confirmada</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardTitulo}>{enc.titulo}</Text>
                    <Text style={styles.cardData}>{formatData(enc.data)}</Text>

                    {confirmado ? null : podeAgora ? (
                      <Button
                        title={checkinId === enc.id ? "Confirmando…" : "Fazer check-in"}
                        onPress={() => fazerCheckin(enc)}
                        loading={checkinId === enc.id}
                      />
                    ) : (
                      <View style={styles.indisponivelBox}>
                        <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                        <Text style={styles.indisponivelTxt}>
                          Check-in abre no dia do encontro.
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontFamily: BRAND_FONT },
    hero: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      gap: spacing.sm,
    },
    heroTitulo: {
      color: "#fff",
      fontSize: font.size.xl,
      fontFamily: BRAND_FONT,
    },
    heroSub: { color: "rgba(255,255,255,0.95)", fontSize: font.size.sm, lineHeight: 20 },
    statusCard: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      alignItems: "flex-start",
    },
    statusTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    statusTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20, marginTop: 4 },
    section: {
      color: colors.text,
      fontSize: font.size.md,
      fontFamily: BRAND_FONT,
      marginTop: spacing.sm,
    },
    vazio: { alignItems: "center", gap: spacing.sm, padding: spacing.xl },
    vazioTxt: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center" },
    card: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    dataPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
    },
    dataPillTxt: { color: colors.text, fontSize: 11, fontWeight: "800" },
    checkPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: colors.success,
    },
    checkPillTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
    cardTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    cardData: { color: colors.textMuted, fontSize: font.size.sm },
    indisponivelBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    indisponivelTxt: { color: colors.textMuted, fontSize: font.size.sm },
  });
