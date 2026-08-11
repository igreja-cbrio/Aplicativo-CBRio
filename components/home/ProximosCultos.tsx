import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { indiceDoDestaque } from "@/lib/homeCultos";
import { GlassCard } from "@/components/ui/GlassCard";
import { type CultoUpcoming, formatCultoDia, formatCultoHora } from "@/lib/cultos";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

// ⚠️ `CARD_W`/`Dimensions` saíram em 10/08 junto com o carrossel: a largura era
// congelada no import (`Dimensions.get` roda UMA vez), então o card ficava com a
// medida errada depois de girar o aparelho ou mudar a fonte do sistema. Em
// coluna o card usa 100% e o problema some junto.
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

  // `hojeIso` marca o card de hoje com a tag "HOJE" (o cálculo do herói saiu em
  // 11/08 — quem decide o destaque agora é `indiceDoDestaque`).
  const hoje = new Date(agora);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hojeIso = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

  // ⚠️⚠️ DESENHO PEDIDO PELO MARCOS (11/08/2026, 3ª rodada do apontamento 9):
  // *"a lógica do culto mais próximo ficar maior é boa, mas o culto de domingo
  // tem muitos horários e fica feio pois ele passa. Coloque o culto de domingo
  // sempre em cima para os horários ficarem certos; apenas em horário de culto
  // coloque uma tarja acima dos cultos dizendo culto ao vivo para clicar."*
  //
  // ⇒ O DOMINGO é ÂNCORA (`lib/homeCultos.ts`): fica sempre em cima, com os 4
  // horários dele juntos. Antes o destaque era o PRÓXIMO culto, então ele
  // trocava de lugar ao longo da semana e remontava o bloco inteiro.
  // ⇒ E o "ao vivo" saiu do card: virou TARJA acima de tudo. Separa as duas
  // perguntas — "quando é o culto?" (o card, estável) e "tem culto AGORA?"
  // (a tarja, que só existe na hora).
  const idxDestaque = indiceDoDestaque(grupos);
  const destaque = idxDestaque >= 0 ? grupos[idxDestaque] : null;
  const grade = grupos.filter((_, i) => i !== idxDestaque).slice(0, 3);

  // O culto que está acontecendo AGORA, em qualquer dia — é o alvo da tarja.
  let cultoAoVivo: CultoUpcoming | null = null;
  for (const g of grupos) {
    const st = statusDosHorarios(g.itens, agora);
    const achou = g.itens.find((c) => st.get(c.id) === "ao_vivo");
    if (achou) { cultoAoVivo = achou; break; }
  }

  return (
    <View style={{ gap: spacing.sm, marginHorizontal: -spacing.lg }}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        <Ionicons name="calendar" size={18} color={colors.brandMid} />
        <Text style={styles.titulo}>{t("Próximos cultos")}</Text>
      </View>

      {/* ⚠️ A TARJA só existe em horário de culto. Fora dele, nada ocupa espaço
          na Home — foi o pedido: "APENAS em horário de culto". */}
      {cultoAoVivo && (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable
            style={styles.tarjaAoVivo}
            onPress={() => router.navigate({ pathname: "/culto-detalhe", params: { id: cultoAoVivo!.id } })}
            accessibilityRole="button"
            accessibilityLabel={t("Culto ao vivo agora — abrir")}
          >
            <View style={styles.aoVivoPonto} />
            <Text style={styles.tarjaAoVivoTxt} numberOfLines={1}>{t("Culto ao vivo agora")}</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </Pressable>
        </View>
      )}

      {destaque && (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <CultoCard grupo={destaque} agora={agora} hojeIso={hojeIso} router={router} colors={colors} styles={styles} t={t} />
        </View>
      )}

      {/* ⚠️⚠️ COLUNA, NÃO CARROSSEL (10/08/2026 · apontamento 9). O Marcos:
          *"os cultos estão organizados de uma forma não tão visual, não fica
          claro quais são todos os cultos sem ter que rolar para o lado."*
          MEDIDO na semana de 10/08: **6 cultos viram 2 CARDS** (o `agrupar()`
          junta os horários do mesmo dia num card com pills). Um carrossel onde
          cabe 1,3 card, pra mostrar 2 — a rolagem lateral existia pra esconder
          nada, e ainda sugeria que havia mais coisa fora da tela.
          ⚠️ `.map()` e NÃO FlatList: a Home inteira já é um ScrollView vertical,
          e lista virtualizada dentro de scroll do mesmo eixo quebra o gesto e
          reclama em runtime. Com 2-4 itens não há o que virtualizar.
          ⚠️ O `marginHorizontal: -spacing.lg` do container faz o bloco sangrar
          pra fora (era o que o carrossel precisava) — a coluna devolve o padding
          aqui, senão os cards vazam 24px pra fora da tela. */}
      {/* ⚠️ `flex: 1` em cada um: com 3 cultos viram 3 quadrados; com 2, dois
          cartões de meia largura; com 1, um só ocupando a linha. Largura fixa de
          1/3 deixaria um quadradinho solto e torto quando a semana tem poucos
          cultos — e a semana medida em 10/08 tinha só 2 grupos de horário. */}
      {grade.length > 0 && (
        <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", gap: spacing.sm }}>
          {grade.map((item) => (
            <View key={`${item.data}-${item.nomeBase}`} style={{ flex: 1 }}>
              <CultoCard
                grupo={item}
                agora={agora}
                hojeIso={hojeIso}
                router={router}
                colors={colors}
                styles={styles}
                t={t}
                compacto
              />
            </View>
          ))}
        </View>
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
/* ⚠️ `HeroiHoje` foi REMOVIDO em 11/08/2026. Ele era o card grande de "hoje",
   que virava destaque quando havia culto ao vivo ou próximo. O Marcos trocou o
   desenho: o destaque agora é fixo no DOMINGO (`lib/homeCultos.ts`) e o "ao
   vivo" virou uma TARJA acima do bloco. Era função local, sem export e sem
   outro chamador — ver o git se precisar do visual antigo. */

function CultoCard({
  grupo,
  agora,
  hojeIso,
  router,
  colors,
  styles,
  t,
  compacto = false,
}: {
  grupo: Grupo;
  agora: number;
  hojeIso: string;
  router: ReturnType<typeof useRouter>;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  t: ReturnType<typeof useT>;
  /** Cartão da linha de baixo: menor, sem os selos de online/kids. */
  compacto?: boolean;
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
          style={[styles.card, compacto && styles.cardCompacto]}
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

          {/* ⚠️ Os selos saem no compacto: em 1/3 da largura eles quebram linha
              e desalinham a altura dos três cartões. A informação continua no
              destaque de cima e na tela do culto. */}
          {!compacto && (
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
          )}
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
      width: "100%",
      borderRadius: radius.lg,
    },
    card: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    heroiCard: { paddingTop: spacing.md + 4 },
    // ⚠️ Cartão da linha de baixo: menos respiro e altura mínima pra os três
    // ficarem do mesmo tamanho mesmo com nomes de comprimentos diferentes.
    cardCompacto: { padding: spacing.sm, gap: 6, minHeight: 96 },
    // ⚠️ Tarja de AO VIVO: some fora do horário de culto, então ela pode ser
    // vermelha e chamativa sem poluir a Home no resto da semana.
    tarjaAoVivo: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      backgroundColor: "#DC2626", borderRadius: radius.md,
      paddingVertical: 10, paddingHorizontal: spacing.md,
    },
    tarjaAoVivoTxt: { color: "#fff", fontWeight: "800", fontSize: font.size.sm, flex: 1 },
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
