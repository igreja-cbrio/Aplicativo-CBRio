import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import {
  meuBatismo,
  fazerCheckin,
  listarFotosBatismo,
  getBatismoAnterior,
  marcarBatismoAnterior,
  desmarcarBatismoAnterior,
  type MeuBatismo,
  type BatismoAnterior,
  type FotoBatismo,
} from "@/lib/batismo";
import { Input } from "@/components/ui/Input";
import { formatDataLonga } from "@/lib/cultos";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";
import { AnimatedCountdown } from "@/components/anim/AnimatedCountdown";
import { Breathing } from "@/components/anim/Breathing";
import ConfettiCannon from "react-native-confetti-cannon";

const { width: SCREEN_W } = Dimensions.get("window");

function diasAte(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dataIso + "T12:00:00");
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export default function BatismoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { membro, loading: loadingMembro } = useMembro();

  const [batismo, setBatismo] = useState<MeuBatismo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [fotos, setFotos] = useState<FotoBatismo[]>([]);
  const [fotosLoading, setFotosLoading] = useState(false);
  const [fotoAberta, setFotoAberta] = useState<FotoBatismo | null>(null);
  const [checkinFazendo, setCheckinFazendo] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [batismoAnt, setBatismoAnt] = useState<BatismoAnterior | null>(null);
  const [modalIgrejaAberto, setModalIgrejaAberto] = useState(false);
  const [igrejaTxt, setIgrejaTxt] = useState("");
  const [salvandoIgreja, setSalvandoIgreja] = useState(false);

  const carregar = useCallback(async () => {
    if (!membro?.membroId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const b = await meuBatismo(membro.membroId);
    setBatismo(b);
    setCarregando(false);
    if (b?.data_batismo) {
      setFotosLoading(true);
      const fs = await listarFotosBatismo(b.data_batismo);
      setFotos(fs);
      setFotosLoading(false);
    }
    // Status "já sou batizado" do membro
    const ant = await getBatismoAnterior(membro.membroId);
    setBatismoAnt(ant);
    setIgrejaTxt(ant.igreja_batismo_anterior ?? "");
  }, [membro?.membroId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function onCheckin() {
    if (!batismo) return;
    setCheckinFazendo(true);
    const resp = await fazerCheckin(batismo.id);
    setCheckinFazendo(false);
    if (resp.ok) {
      setBatismo((b) => (b ? { ...b, checkin_em: resp.checkin_em } : b));
      if (!resp.ja_checkado) setConfettiKey((k) => k + 1);
      Alert.alert(
        resp.ja_checkado ? "Check-in já feito" : "Check-in confirmado!",
        resp.ja_checkado
          ? "Você já tinha feito o check-in. Bora!"
          : "Deus te abençoe nesse dia incrível. Te vejo já! 💙"
      );
    } else {
      Alert.alert("Não foi possível fazer o check-in", resp.erro);
    }
  }

  async function baixarFoto(f: FotoBatismo) {
    try {
      const destino = (FileSystem.documentDirectory ?? "") + f.nome;
      const { uri } = await FileSystem.downloadAsync(f.url, destino);
      await Share.share({ url: uri, message: "Minha foto do batismo na CBRio 💙" });
    } catch {
      // Fallback: abre a URL no browser pra salvar.
      Linking.openURL(f.url).catch(() => {});
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
          <Text style={styles.title}>Meu batismo</Text>
          <View style={{ width: 24 }} />
        </View>

        {loadingMembro || carregando ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : !membro?.membroId ? (
          <Vazio
            icon="link-outline"
            titulo="Vincule seu perfil"
            txt="Pra acompanhar seu batismo, complete o cadastro do membro (CPF) no perfil."
            cta="Ir para o perfil"
            onPress={() => router.navigate("/perfil")}
            colors={colors}
            styles={styles}
          />
        ) : !batismo ? (
          <View style={{ gap: spacing.md }}>
            {batismoAnt?.batizado_outra_igreja && (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.cardTitle}>Já é batizado(a)</Text>
                </View>
                <Text style={styles.cardTxt}>
                  Registramos seu batismo
                  {batismoAnt.igreja_batismo_anterior ? ` em ${batismoAnt.igreja_batismo_anterior}` : ""}.
                  Você ainda pode se batizar na CBRio se quiser.
                </Text>
                <Pressable
                  onPress={async () => {
                    await desmarcarBatismoAnterior();
                    setBatismoAnt({ batizado_outra_igreja: false, igreja_batismo_anterior: null });
                    setIgrejaTxt("");
                  }}
                  hitSlop={6}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Remover este registro</Text>
                </Pressable>
              </View>
            )}
            <Vazio
              icon="water-outline"
              titulo={batismoAnt?.batizado_outra_igreja ? "Quer se batizar na CBRio?" : "Você ainda não se inscreveu"}
              txt={
                batismoAnt?.batizado_outra_igreja
                  ? "Mesmo já sendo batizado(a), você pode renovar essa decisão aqui."
                  : "O batismo é uma decisão linda. Inscreva-se e te acompanhamos até lá."
              }
              cta="Quero me batizar"
              onPress={() => router.navigate("/inscricao-batismo")}
              colors={colors}
              styles={styles}
            />
            {!batismoAnt?.batizado_outra_igreja && (
              <Pressable
                onPress={() => setModalIgrejaAberto(true)}
                style={({ pressed }) => [styles.linkAcao, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.brandMid} />
                <Text style={styles.linkAcaoTxt}>Já sou batizado(a) em outra igreja</Text>
              </Pressable>
            )}
          </View>
        ) : !batismo.data_batismo ? (
          <View style={styles.hero}>
            <Ionicons name="time-outline" size={28} color="#fff" />
            <Text style={styles.heroTitulo}>Sua inscrição foi recebida!</Text>
            <Text style={styles.heroSub}>
              Sua data ainda não foi marcada. A equipe entra em contato em breve.
            </Text>
          </View>
        ) : (
          <BatismoConteudo
            batismo={batismo}
            fotos={fotos}
            fotosLoading={fotosLoading}
            checkinFazendo={checkinFazendo}
            onCheckin={onCheckin}
            onAbrirFoto={setFotoAberta}
            colors={colors}
            styles={styles}
          />
        )}
      </ScrollView>

      {/* Modal de foto em tela cheia */}
      <Modal
        visible={!!fotoAberta}
        animationType="fade"
        onRequestClose={() => setFotoAberta(null)}
        transparent
      >
        <View style={styles.modalBg}>
          <Pressable style={styles.modalClose} onPress={() => setFotoAberta(null)} hitSlop={10}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {fotoAberta && (
            <Image source={{ uri: fotoAberta.url }} style={styles.fotoFull} resizeMode="contain" />
          )}
          {fotoAberta && (
            <Pressable
              style={styles.modalSave}
              onPress={() => baixarFoto(fotoAberta)}
              hitSlop={6}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.modalSaveTxt}>Salvar / Compartilhar</Text>
            </Pressable>
          )}
        </View>
      </Modal>

      {/* Modal pra capturar igreja onde foi batizado */}
      <Modal
        visible={modalIgrejaAberto}
        animationType="slide"
        transparent
        onRequestClose={() => setModalIgrejaAberto(false)}
      >
        <View style={styles.modalIgrejaBg}>
          <View style={styles.modalIgrejaCard}>
            <Text style={styles.cardTitle}>Você foi batizado(a) onde?</Text>
            <Text style={styles.cardTxt}>
              Conta pra gente a igreja. Isso ajuda nossa equipe a te conhecer
              melhor.
            </Text>
            <Input
              label="Nome da igreja"
              value={igrejaTxt}
              onChangeText={setIgrejaTxt}
              placeholder="Igreja anterior"
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => {
                  setModalIgrejaAberto(false);
                  setIgrejaTxt(batismoAnt?.igreja_batismo_anterior ?? "");
                }}
              />
              <Button
                title="Confirmar"
                loading={salvandoIgreja}
                onPress={async () => {
                  setSalvandoIgreja(true);
                  try {
                    await marcarBatismoAnterior(igrejaTxt);
                    setBatismoAnt({
                      batizado_outra_igreja: true,
                      igreja_batismo_anterior: igrejaTxt.trim() || null,
                    });
                    setModalIgrejaAberto(false);
                  } catch (e) {
                    Alert.alert("Erro", e instanceof Error ? e.message : "Falha ao salvar.");
                  } finally {
                    setSalvandoIgreja(false);
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {confettiKey > 0 && (
        <ConfettiCannon
          key={confettiKey}
          count={140}
          origin={{ x: SCREEN_W / 2, y: -10 }}
          fallSpeed={3500}
          fadeOut
          autoStart
          explosionSpeed={350}
        />
      )}
    </SafeAreaView>
  );
}

function BatismoConteudo({
  batismo,
  fotos,
  fotosLoading,
  checkinFazendo,
  onCheckin,
  onAbrirFoto,
  colors,
  styles,
}: {
  batismo: MeuBatismo;
  fotos: FotoBatismo[];
  fotosLoading: boolean;
  checkinFazendo: boolean;
  onCheckin: () => void;
  onAbrirFoto: (f: FotoBatismo) => void;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const dias = diasAte(batismo.data_batismo!);
  const ehHoje = dias === 0;
  const passou = dias < 0;
  const realizado = batismo.status === "realizado" || !!batismo.checkin_em || passou;

  let topo = "Faltam";
  let valor = `${Math.abs(dias)}`;
  let unidade = Math.abs(dias) === 1 ? "dia" : "dias";
  if (ehHoje) {
    topo = "É hoje!";
    valor = "🙌";
    unidade = "";
  } else if (passou) {
    topo = "Já aconteceu";
    valor = "✓";
    unidade = "";
  }

  return (
    <>
      {/* Hero com contagem regressiva — Breathing aplica scale loop sutil */}
      <Breathing>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Meu batismo</Text>
          <Text style={styles.heroTitulo}>{topo}</Text>
          {!ehHoje && !passou && (
            <View style={styles.contagemRow}>
              <AnimatedCountdown value={valor} style={styles.contagemNum} />
              <Text style={styles.contagemUni}>{unidade}</Text>
            </View>
          )}
          {(ehHoje || passou) && <Text style={styles.contagemNum}>{valor}</Text>}
          <View style={styles.heroDataRow}>
            <Ionicons name="calendar" size={16} color="#fff" />
            <Text style={styles.heroData}>{formatDataLonga(batismo.data_batismo!)}</Text>
          </View>
        </View>
      </Breathing>

      {/* Check-in (no dia) */}
      {ehHoje && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons
              name={batismo.checkin_em ? "checkmark-circle" : "qr-code-outline"}
              size={22}
              color={batismo.checkin_em ? colors.success : colors.brandMid}
            />
            <Text style={styles.cardTitle}>
              {batismo.checkin_em ? "Check-in feito" : "Faça seu check-in"}
            </Text>
          </View>
          {batismo.checkin_em ? (
            <Text style={styles.cardTxt}>
              Pronto! Te vejo já. 💙
            </Text>
          ) : (
            <>
              <Text style={styles.cardTxt}>
                Ao chegar na igreja, confirme sua presença aqui. Isso ajuda nossa
                equipe a se preparar pra você.
              </Text>
              <Button title="Fazer check-in" onPress={onCheckin} loading={checkinFazendo} />
            </>
          )}
        </View>
      )}

      {/* O que levar / dicas */}
      {!passou && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Como se preparar</Text>
          <Linha icon="shirt-outline" colors={colors} styles={styles}>
            Traga uma muda de roupa seca e toalha.
          </Linha>
          <Linha icon="time-outline" colors={colors} styles={styles}>
            Chegue 30 minutos antes pra orientação.
          </Linha>
          <Linha icon="heart-outline" colors={colors} styles={styles}>
            Convide quem te leva a viver isso de perto.
          </Linha>
          {!!batismo.tamanho_camisa && (
            <Linha icon="pricetag-outline" colors={colors} styles={styles}>
              Camisa: <Text style={{ fontWeight: "800" }}>{batismo.tamanho_camisa}</Text>
            </Linha>
          )}
        </View>
      )}

      {/* Galeria de fotos do dia */}
      {(realizado || ehHoje) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fotos do dia</Text>
          {fotosLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : fotos.length === 0 ? (
            <Text style={styles.cardTxt}>
              As fotos do dia ainda não foram publicadas. Volte mais tarde — o
              marketing posta logo depois do batismo. 📸
            </Text>
          ) : (
            <FlatList
              data={fotos}
              keyExtractor={(f) => f.nome}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 6 }}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onAbrirFoto(item)}
                  style={styles.thumb}
                >
                  <Image source={{ uri: item.url }} style={styles.thumbImg} />
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </>
  );
}

function Vazio({
  icon,
  titulo,
  txt,
  cta,
  onPress,
  styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  titulo: string;
  txt: string;
  cta: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.vazio}>
      <Ionicons name={icon} size={48} color={styles.vazioIcon.color as string} />
      <Text style={styles.vazioTitle}>{titulo}</Text>
      <Text style={styles.vazioTxt}>{txt}</Text>
      <Button title={cta} onPress={onPress} />
    </View>
  );
}

function Linha({
  icon,
  children,
  colors,
  styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.brandMid} />
      <Text style={styles.linhaTxt}>{children}</Text>
    </View>
  );
}

const THUMB = Math.floor((SCREEN_W - spacing.lg * 2 - spacing.md * 2 - 12) / 3);

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    hero: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      gap: 4,
      alignItems: "flex-start",
    },
    heroLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
    heroTitulo: { color: "#fff", fontSize: font.size.xl, fontFamily: BRAND_FONT },
    heroSub: { color: "rgba(255,255,255,0.9)", fontSize: font.size.sm, marginTop: 4 },
    contagemRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: spacing.xs },
    contagemNum: { color: "#fff", fontSize: 64, fontFamily: BRAND_FONT, lineHeight: 68 },
    contagemUni: { color: "#fff", fontSize: font.size.lg, fontWeight: "700" },
    heroDataRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
    heroData: { color: "#fff", fontSize: font.size.sm, fontWeight: "600" },
    card: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    cardTitle: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    cardTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    linhaTxt: { color: colors.text, fontSize: font.size.sm, flex: 1, lineHeight: 20 },
    vazio: {
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.xl,
    },
    vazioIcon: { color: colors.textMuted },
    vazioTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    vazioTxt: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: radius.sm,
      overflow: "hidden",
      backgroundColor: colors.surfaceAlt,
    },
    thumbImg: { width: "100%", height: "100%" },
    modalBg: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    fotoFull: { width: "100%", height: "80%" },
    modalClose: {
      position: "absolute",
      top: 60,
      right: 24,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    modalSave: {
      position: "absolute",
      bottom: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    modalSaveTxt: { color: "#fff", fontWeight: "800", fontSize: font.size.sm },
    linkAcao: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    linkAcaoTxt: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    modalIgrejaBg: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalIgrejaCard: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
    },
  });
