import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { supabase } from "@/lib/supabase";
import { pedirEntrarGrupo } from "@/lib/grupos";
import { useAdminGrupo } from "@/lib/useAdminGrupo";
import { useT } from "@/lib/i18n";
import { diaHorario } from "./grupos";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type GrupoDetalhe = {
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
  lat: number | null;
  lng: number | null;
  foto_url: string | null;
};

type Estado = "carregando" | "participa" | "pendente" | "pode_pedir" | "sem_vinculo";

export default function GrupoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { membro } = useMembro();
  const { isAdmin } = useAdminGrupo(id);
  const t = useT();

  const [grupo, setGrupo] = useState<GrupoDetalhe | null>(null);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    const { data: g } = await supabase
      .from("mem_grupos")
      .select(
        "id, nome, categoria, descricao, tema, dia_semana, horario, local, endereco, bairro, lat, lng, foto_url"
      )
      .eq("id", id)
      .maybeSingle();
    setGrupo((g as GrupoDetalhe) ?? null);

    if (!membro?.membroId) {
      setEstado("sem_vinculo");
      return;
    }
    const { data: jaMembro } = await supabase
      .from("mem_grupo_membros")
      .select("id")
      .eq("grupo_id", id)
      .eq("membro_id", membro.membroId)
      .is("saiu_em", null)
      .is("deleted_at", null)
      .limit(1);
    if (jaMembro && jaMembro.length > 0) {
      setEstado("participa");
      return;
    }
    const { data: pedido } = await supabase
      .from("mem_grupo_pedidos")
      .select("id, status")
      .eq("grupo_id", id)
      .eq("membro_id", membro.membroId)
      .limit(1);
    if (pedido && pedido.length > 0 && pedido[0].status !== "recusado") {
      setEstado("pendente");
      return;
    }
    setEstado("pode_pedir");
  }, [id, membro?.membroId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function participar() {
    setErro(null);
    if (!membro?.membroId) {
      setEstado("sem_vinculo");
      return;
    }
    setEnviando(true);
    try {
      await pedirEntrarGrupo(id as string, {
        membro_id: membro.membroId,
        nome: membro.nome || "Membro",
        telefone: membro.telefone || null,
        email: membro.email || null,
      });
      setEstado("pendente");
    } catch (e) {
      const err = e as Error & { code?: number };
      if (err.code === 409) {
        // já é membro ou já tem pedido — recarrega o estado real
        await carregar();
      } else {
        setErro(err.message || t("Não foi possível enviar o pedido."));
      }
    } finally {
      setEnviando(false);
    }
  }

  function abrirMapa() {
    if (grupo?.lat && grupo?.lng) {
      Linking.openURL(`http://maps.apple.com/?ll=${grupo.lat},${grupo.lng}`);
    } else if (grupo?.endereco) {
      Linking.openURL(`http://maps.apple.com/?q=${encodeURIComponent(grupo.endereco)}`);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Grupo")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {!grupo ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {grupo.foto_url ? (
              <Image source={{ uri: grupo.foto_url }} style={styles.foto} />
            ) : (
              <View style={[styles.foto, styles.fotoPlaceholder]}>
                <Ionicons name="people" size={40} color={colors.brandMid} />
              </View>
            )}

            <Text style={styles.nome}>{grupo.nome}</Text>
            {!!grupo.categoria && <Text style={styles.categoria}>{grupo.categoria}</Text>}

            <View style={styles.infos}>
              {!!diaHorario(grupo.dia_semana, grupo.horario) && (
                <Info icon="calendar-outline" texto={diaHorario(grupo.dia_semana, grupo.horario)} styles={styles} colors={colors} />
              )}
              {!!(grupo.local || grupo.endereco || grupo.bairro) && (
                <Info
                  icon="location-outline"
                  texto={[grupo.local, grupo.endereco, grupo.bairro].filter(Boolean).join(", ")}
                  styles={styles}
                  colors={colors}
                />
              )}
              {!!grupo.tema && <Info icon="bookmark-outline" texto={grupo.tema} styles={styles} colors={colors} />}
            </View>

            {!!grupo.descricao && <Text style={styles.descricao}>{grupo.descricao}</Text>}

            {(grupo.lat || grupo.endereco) && (
              <Button title={t("Abrir no mapa")} variant="ghost" onPress={abrirMapa} />
            )}

            {estado === "participa" ? (
              <View style={styles.statusOk}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.statusOkTxt}>{t("Você participa deste grupo.")}</Text>
              </View>
            ) : estado === "pendente" ? (
              <View style={styles.statusOk}>
                <Ionicons name="time-outline" size={20} color={colors.brandMid} />
                <Text style={styles.statusOkTxt}>{t("Pedido enviado! Aguarde o contato do líder.")}</Text>
              </View>
            ) : estado === "sem_vinculo" ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.muted}>{t("Vincule seu perfil (CPF) para participar.")}</Text>
                <Button title={t("Ir para o perfil")} onPress={() => router.navigate("/perfil")} />
              </View>
            ) : (
              <Button title={t("Quero participar")} onPress={participar} loading={enviando || estado === "carregando"} />
            )}
            {erro && <Text style={styles.erro}>{erro}</Text>}

            {isAdmin && (
              <View style={styles.adminBox}>
                <Text style={styles.adminTitle}>{t("Administração")}</Text>
                <Button
                  title={t("Editar grupo")}
                  variant="ghost"
                  onPress={() =>
                    router.navigate({ pathname: "/grupo-editar", params: { id: grupo.id } })
                  }
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({
  icon,
  texto,
  styles,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  texto: string;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={colors.brandMid} />
      <Text style={styles.infoTxt}>{texto}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    foto: { width: "100%", height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
    fotoPlaceholder: { alignItems: "center", justifyContent: "center" },
    nome: { color: colors.text, fontSize: font.size.xl, fontWeight: "800" },
    categoria: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "600" },
    infos: { gap: spacing.sm, marginTop: spacing.xs },
    info: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    infoTxt: { flex: 1, color: colors.textMuted, fontSize: font.size.md },
    descricao: { color: colors.text, fontSize: font.size.md, lineHeight: 22 },
    statusOk: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.md,
    },
    statusOkTxt: { flex: 1, color: colors.text, fontSize: font.size.md },
    muted: { color: colors.textMuted, fontSize: font.size.md },
    erro: { color: colors.danger, fontSize: font.size.sm },
    adminBox: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    adminTitle: { color: colors.text, fontSize: font.size.sm, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  });
