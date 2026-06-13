import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { type CultoUpcoming, formatCultoDia, formatCultoHora } from "@/lib/cultos";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.round((SCREEN_W - spacing.lg * 2) * 0.74);
const DURACAO_CULTO_MIN = 120; // janela em que o culto conta como "ao vivo"

type Grupo = {
  data: string;
  itens: CultoUpcoming[];
  cor: string | null;
  has_online: boolean;
  has_kids: boolean;
  nomeBase: string;
};

/** Detecta o "tipo" do culto por prefixo do nome ("Domingo", "Bridge", etc.). */
function tipoDoCulto(nome: string | null): string {
  if (!nome) return "Culto";
  // Remove a data do fim ("Domingo 08:30 — 07/06/2026" -> "Domingo 08:30")
  const sem = nome.replace(/\s*[—–-]\s*\d{2}\/\d{2}\/\d{4}\s*$/, "").trim();
  // Primeira palavra (Domingo, Bridge, AMI, Quarta...)
  return sem.split(/\s+/)[0] || sem;
}

/** Agrupa cultos por (data + tipo). Domingo 08:30/10:00/11:30/19:00 vira 1 card. */
function agrupar(cultos: CultoUpcoming[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const c of cultos) {
    const tipo = tipoDoCulto(c.nome);
    const key = `${c.data}::${tipo.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, {
        data: c.data,
        itens: [c],
        cor: c.cor,
        has_online: !!c.has_online,
        has_kids: !!c.has_kids,
        nomeBase: tipo,
      });
    } else {
      const g = map.get(key)!;
      g.itens.push(c);
      if (c.has_online) g.has_online = true;
      if (c.has_kids) g.has_kids = true;
      if (!g.cor && c.cor) g.cor = c.cor;
    }
  }
  return [...map.values()];
}

function inicioDoCulto(c: CultoUpcoming): number {
  return new Date(`${c.data}T${c.hora}`).getTime();
}

type StatusHorario = "passado" | "ao_vivo" | "proximo" | "futuro";

/** Classifica cada horário de HOJE em relação a agora. */
function statusDosHorarios(itens: CultoUpcoming[], agora: number): Map<string, StatusHorario> {
  const ordenados = itens.slice().sort((a, b) => a.hora.localeCompare(b.hora));
  const out = new Map<string, StatusHorario>();
  let proximoMarcado = false;
  for (const c of ordenados) {
    const ini = inicioDoCulto(c);
    if (agora >= ini && agora < ini + DURACAO_CULTO_MIN * 60_000) {
      out.set(c.id, "ao_vivo");
    } else if (agora >= ini) {
      out.set(c.id, "passado");
    } else if (!proximoMarcado) {
      out.set(c.id, "proximo");
      proximoMarcado = true;
    } else {
      out.set(c.id, "futuro");
    }
  }
  return out;
}

function contagem(t: ReturnType<typeof useT>, msAte: number): string {
  const totalMin = Math.max(1, Math.round(msAte / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    return ""; // muito longe — sem countdown
  }
  if (h > 0) return `${t("começa em")} ${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${t("começa em")} ${m}min`;
}

export function ProximosCultos({ cultos }: { cultos: CultoUpcoming[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const t = useT();

  // Relógio: re-renderiza a cada 30s pro countdown/AO VIVO ficarem vivos.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!cultos.length) return null;

  const grupos = agrupar(cultos);

  // Herói: grupo de HOJE com culto ao vivo agora ou com o próximo horário
  // ainda por vir. Os demais grupos seguem no scroll horizontal.
  const hoje = new Date(agora);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hojeIso = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

  // Herói = primeiro grupo de HOJE com culto ao vivo ou próximo. Remove
  // por ÍNDICE (não por referência) pra garantir que ele não duplique
  // na lista de baixo.
  let heroiIdx = -1;
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];
    if (g.data !== hojeIso) continue;
    const st = statusDosHorarios(g.itens, agora);
    if ([...st.values()].some((s) => s === "ao_vivo" || s === "proximo")) {
      heroiIdx = i;
      break;
    }
  }
  const heroi = heroiIdx >= 0 ? grupos[heroiIdx] : null;
  const restantes = grupos.filter((_, i) => i !== heroiIdx);

  return (
    <View style={{ gap: spacing.sm, marginHorizontal: -spacing.lg }}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        <Ionicons name="calendar" size={18} color={colors.brandMid} />
        <Text style={styles.titulo}>{t("Próximos cultos")}</Text>
      </View>

      {heroi && (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <HeroiHoje grupo={heroi} agora={agora} router={router} colors={colors} styles={styles} t={t} />
        </View>
      )}

      {restantes.length > 0 && (
        <FlatList
          data={restantes.slice(0, 8)}
          keyExtractor={(g) => `${g.data}-${g.nomeBase}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W + spacing.sm}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
          renderItem={({ item }) => (
            <CultoCard grupo={item} agora={agora} hojeIso={hojeIso} router={router} colors={colors} styles={styles} t={t} />
          )}
        />
      )}
    </View>
  );
}

/** Pill de horário ciente do tempo: passado apagado, próximo em destaque. */
function HoraPill({
  culto,
  status,
  cor,
  router,
  styles,
  onLift,
  onDrop,
}: {
  culto: CultoUpcoming;
  status: StatusHorario | undefined;
  cor: string;
  router: ReturnType<typeof useRouter>;
  styles: ReturnType<typeof makeStyles>;
  onLift?: () => void;
  onDrop?: () => void;
}) {
  const passado = status === "passado";
  const destaque = status === "proximo" || status === "ao_vivo";
  return (
    <Pressable
      onPress={() => router.navigate({ pathname: "/culto-detalhe", params: { id: culto.id } })}
      onPressIn={onLift}
      onPressOut={onDrop}
      style={[
        styles.horaPill,
        destaque && { backgroundColor: cor, borderColor: cor },
        passado && styles.horaPillPassada,
      ]}
    >
      <Text
        style={[
          styles.horaTxt,
          destaque && styles.horaTxtDestaque,
          passado && styles.horaTxtPassada,
        ]}
      >
        {formatCultoHora(culto.hora)}
      </Text>
    </Pressable>
  );
}

/** Card-herói do culto de HOJE: countdown ao vivo ou badge AO VIVO. */
function HeroiHoje({
  grupo,
  agora,
  router,
  colors,
  styles,
  t,
}: {
  grupo: Grupo;
  agora: number;
  router: ReturnType<typeof useRouter>;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  t: ReturnType<typeof useT>;
}) {
  const cor = grupo.cor || colors.primary;
  const st = statusDosHorarios(grupo.itens, agora);
  const horarios = grupo.itens.slice().sort((a, b) => a.hora.localeCompare(b.hora));
  const aoVivo = horarios.find((c) => st.get(c.id) === "ao_vivo") ?? null;
  const proximo = horarios.find((c) => st.get(c.id) === "proximo") ?? null;
  const alvo = aoVivo ?? proximo ?? horarios[0];

  return (
    <GlassCard style={{ overflow: "hidden" }}>
      <Pressable
        onPress={() => router.navigate({ pathname: "/culto-detalhe", params: { id: alvo.id } })}
        style={[styles.card, styles.heroiCard]}
      >
        <View style={[styles.heroiBarra, { backgroundColor: cor }]} />
        <View style={styles.headerCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.tag, { backgroundColor: cor }]}>
              <Text style={styles.tagTxt}>{t("HOJE")}</Text>
            </View>
            {aoVivo && (
              <View style={styles.aoVivoBadge}>
                <View style={styles.aoVivoPonto} />
                <Text style={styles.aoVivoTxt}>{t("AO VIVO agora")}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.nome, styles.heroiNome]} numberOfLines={1}>
            {grupo.nomeBase}
          </Text>
          {!aoVivo && proximo && (
            <Text style={styles.countdown}>
              {contagem(t, inicioDoCulto(proximo) - agora) || formatCultoHora(proximo.hora)}
            </Text>
          )}
        </View>

        <View style={styles.horarios}>
          {horarios.map((c) => (
            <HoraPill key={c.id} culto={c} status={st.get(c.id)} cor={cor} router={router} styles={styles} />
          ))}
        </View>

        <View style={styles.feats}>
          {grupo.has_online && (
            <View style={styles.feat}>
              <Ionicons name="videocam" size={11} color={colors.brandMid} />
              <Text style={styles.featTxt}>{t("online")}</Text>
            </View>
          )}
          {grupo.has_kids && (
            <View style={styles.feat}>
              <Ionicons name="happy" size={11} color={colors.brandMid} />
              <Text style={styles.featTxt}>{t("kids")}</Text>
            </View>
          )}
        </View>

        {aoVivo && grupo.has_online && (
          <Pressable
            onPress={() => router.navigate({ pathname: "/culto-detalhe", params: { id: aoVivo.id } })}
            style={[styles.assistirBtn, { backgroundColor: cor }]}
          >
            <Ionicons name="play" size={15} color="#fff" />
            <Text style={styles.assistirTxt}>{t("Assistir online")}</Text>
          </Pressable>
        )}
      </Pressable>
    </GlassCard>
  );
}

function CultoCard({
  grupo,
  agora,
  hojeIso,
  router,
  colors,
  styles,
  t,
}: {
  grupo: Grupo;
  agora: number;
  hojeIso: string;
  router: ReturnType<typeof useRouter>;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  t: ReturnType<typeof useT>;
}) {
  const cor = grupo.cor || colors.primary;
  const dia = formatCultoDia(grupo.data);
  const ehHoje = grupo.data === hojeIso;
  const st = ehHoje ? statusDosHorarios(grupo.itens, agora) : null;
  const horarios = grupo.itens
    .slice()
    .sort((a, b) => a.hora.localeCompare(b.hora));

  // Lift compartilhado: qualquer pill que for pressionada eleva o card todo.
  const scale = useRef(new Animated.Value(1)).current;
  function lift() {
    Animated.spring(scale, {
      toValue: 1.03,
      useNativeDriver: true,
      stiffness: 400,
      damping: 18,
      mass: 0.5,
    }).start();
  }
  function drop() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 320,
      damping: 16,
      mass: 0.5,
    }).start();
  }

  const primeiro = horarios[0];

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        {
          transform: [{ scale }],
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 10,
        },
      ]}
    >
      <GlassCard style={{ overflow: "hidden" }}>
        <Pressable
          onPress={() => primeiro && router.navigate({ pathname: "/culto-detalhe", params: { id: primeiro.id } })}
          onPressIn={lift}
          onPressOut={drop}
          style={styles.card}
        >
          <View style={[styles.heroiBarra, { backgroundColor: cor }]} />
          <View style={styles.headerCard}>
            <View style={[styles.tag, { backgroundColor: cor }]}>
              <Text style={styles.tagTxt}>{ehHoje ? t("HOJE") : dia === "Amanhã" ? t("AMANHÃ") : dia.toUpperCase()}</Text>
            </View>
            <Text style={styles.nome} numberOfLines={1}>
              {grupo.nomeBase}
            </Text>
          </View>

          <View style={styles.horarios}>
            {horarios.map((c) => (
              <HoraPill
                key={c.id}
                culto={c}
                status={st?.get(c.id)}
                cor={cor}
                router={router}
                styles={styles}
                onLift={lift}
                onDrop={drop}
              />
            ))}
          </View>

          <View style={styles.feats}>
            {grupo.has_online && (
              <View style={styles.feat}>
                <Ionicons name="videocam" size={11} color={colors.brandMid} />
                <Text style={styles.featTxt}>{t("online")}</Text>
              </View>
            )}
            {grupo.has_kids && (
              <View style={styles.feat}>
                <Ionicons name="happy" size={11} color={colors.brandMid} />
                <Text style={styles.featTxt}>{t("kids")}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    titulo: { color: colors.text, fontSize: font.size.md, fontFamily: BRAND_FONT },
    cardWrap: {
      width: CARD_W,
      borderRadius: radius.lg,
    },
    card: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    heroiCard: { paddingTop: spacing.md + 4 },
    heroiBarra: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      opacity: 0.9,
    },
    heroiNome: { fontSize: font.size.lg },
    countdown: {
      color: colors.brandMid,
      fontSize: font.size.sm,
      fontWeight: "700",
    },
    aoVivoBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(239,68,68,0.14)",
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.5)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    aoVivoPonto: { width: 6, height: 6, borderRadius: 999, backgroundColor: "#ef4444" },
    aoVivoTxt: { color: "#ef4444", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
    assistirBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.full,
      marginTop: 2,
    },
    assistirTxt: { color: "#fff", fontSize: font.size.sm, fontWeight: "800" },
    headerCard: { gap: 6 },
    tag: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    tagTxt: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
    nome: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    horarios: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    horaPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    horaPillPassada: { opacity: 0.35 },
    horaTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    horaTxtDestaque: { color: "#fff" },
    horaTxtPassada: { textDecorationLine: "line-through" },
    feats: { flexDirection: "row", gap: 8 },
    feat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
    },
    featTxt: { color: colors.brandMid, fontSize: 10, fontWeight: "700" },
  });
