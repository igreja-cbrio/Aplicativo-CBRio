import { useRef } from "react";
import { Animated, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { type CultoUpcoming, formatCultoDia, formatCultoHora } from "@/lib/cultos";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.round((SCREEN_W - spacing.lg * 2) * 0.74);

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

export function ProximosCultos({ cultos }: { cultos: CultoUpcoming[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();

  if (!cultos.length) return null;

  const grupos = agrupar(cultos);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.headerRow}>
        <Ionicons name="calendar" size={18} color={colors.brandMid} />
        <Text style={styles.titulo}>Próximos cultos</Text>
      </View>

      <FlatList
        data={grupos.slice(0, 8)}
        keyExtractor={(g) => `${g.data}-${g.nomeBase}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + spacing.sm}
        decelerationRate="fast"
        contentContainerStyle={{ paddingRight: spacing.lg }}
        ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
        renderItem={({ item }) => <CultoCard grupo={item} router={router} colors={colors} styles={styles} />}
      />
    </View>
  );
}

function CultoCard({
  grupo,
  router,
  colors,
  styles,
}: {
  grupo: Grupo;
  router: ReturnType<typeof useRouter>;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const cor = grupo.cor || colors.primary;
  const dia = formatCultoDia(grupo.data);
  const ehHoje = dia === "Hoje";
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
          <View style={styles.headerCard}>
            <View style={[styles.tag, { backgroundColor: cor }]}>
              <Text style={styles.tagTxt}>{ehHoje ? "HOJE" : dia.toUpperCase()}</Text>
            </View>
            <Text style={styles.nome} numberOfLines={1}>
              {grupo.nomeBase}
            </Text>
          </View>

          <View style={styles.horarios}>
            {horarios.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.navigate({ pathname: "/culto-detalhe", params: { id: c.id } })}
                onPressIn={lift}
                onPressOut={drop}
                style={styles.horaPill}
              >
                <Text style={styles.horaTxt}>{formatCultoHora(c.hora)}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.feats}>
            {grupo.has_online && (
              <View style={styles.feat}>
                <Ionicons name="videocam" size={11} color={colors.brandMid} />
                <Text style={styles.featTxt}>online</Text>
              </View>
            )}
            {grupo.has_kids && (
              <View style={styles.feat}>
                <Ionicons name="happy" size={11} color={colors.brandMid} />
                <Text style={styles.featTxt}>kids</Text>
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
    horaTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
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
