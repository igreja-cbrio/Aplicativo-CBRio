import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { carregarStatusInscricoes, type InscricoesStatus, type StatusInscricao } from "@/lib/inscricoesStatus";
import { buscarEventosAbertos, type EventoAberto } from "@/lib/api";
import { abrirInscricaoEvento } from "@/lib/eventos";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { irPara } from "@/lib/nav";
import { font, radius, spacing, type Palette } from "@/constants/theme";

function formatarDataEvento(data: string | null, hora: string | null): string | null {
  if (!data) return null;
  const d = new Date(`${data}T${(hora || "00:00").slice(0, 5)}:00`);
  if (isNaN(d.getTime())) return null;
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return hora ? `${dia} · ${hora.slice(0, 5)}` : dia;
}

function formatarValor(centavos: number | null): string | null {
  if (!centavos || centavos <= 0) return null;
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Chave = keyof InscricoesStatus;

type Item = {
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  /** Tela do app. Ausente quando a porta é web (ver `url`). */
  href?: "/batismo" | "/grupos" | "/next" | "/voluntariado";
  /** Porta PÚBLICA do sistema, aberta no navegador in-app. */
  url?: string;
  chave?: Chave;
};

const ITENS: Item[] = [
  { label: "Batismo", desc: "Acompanhe seu batismo na CBRio", icon: "water", href: "/batismo", chave: "batismo" },
  { label: "Grupos", desc: "Participe de um grupo", icon: "people", href: "/grupos", chave: "grupos" },
  { label: "NEXT", desc: "O começo da jornada", icon: "sparkles", href: "/next", chave: "next" },
  // ⚠️ "Quero servir" e não "Voluntariado": a barra de baixo já tem "Servir"
  // (a ÁREA). Aqui é a PORTA de inscrição — rótulos iguais em dois lugares
  // faziam parecer duas coisas (05/08/2026).
  { label: "Quero servir", desc: "Sirva na CBRio", icon: "hand-left", href: "/voluntariado", chave: "voluntariado" },
  // ⚠️ PORTA WEB, de propósito. O sistema tem 7 portas de inscrição e esta
  // faltava no app — foi o exemplo que o Marcos deu ("a aba de inscrições do
  // sistema consta com apresentação de bebês"). Abre o formulário público em
  // vez de reimplementar: a porta exige dado de CRIANÇA e o consentimento de
  // MENOR (LGPD art. 14 §1º) com snapshot do texto, e uma segunda
  // implementação seria um segundo caminho de escrita de pessoa — o que o
  // Contrato de porta existe pra impedir. Mesmo desenho dos "Eventos abertos".
  {
    label: "Apresentação de crianças",
    desc: "Apresente seu filho na igreja",
    icon: "happy",
    url: "https://www.cbrio.org/apresentacao-criancas",
  },
];

function StatusBadge({ status, styles, colors, t }: { status: StatusInscricao; styles: ReturnType<typeof makeStyles>; colors: Palette; t: (s: string) => string }) {
  if (status === "nenhum") return null;
  const ativo = status === "ativo";
  return (
    <View style={[styles.badge, { backgroundColor: ativo ? "rgba(63,166,107,0.16)" : "rgba(245,158,11,0.16)" }]}>
      <View style={[styles.badgeDot, { backgroundColor: ativo ? "#3FA66B" : "#F59E0B" }]} />
      <Text style={[styles.badgeTxt, { color: ativo ? "#3FA66B" : "#F59E0B" }]}>
        {ativo ? t("Inscrito") : t("Pendente")}
      </Text>
    </View>
  );
}

export default function InscricoesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const { membro } = useMembro();
  const [status, setStatus] = useState<InscricoesStatus | null>(null);
  const [eventos, setEventos] = useState<EventoAberto[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      carregarStatusInscricoes(membro?.membroId ?? null).then(setStatus).catch(() => {});
      buscarEventosAbertos().then((r) => setEventos(r.eventos || [])).catch(() => setEventos([]));
    }, [membro?.membroId])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Inscrições")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {ITENS.map((it) => {
          const st = it.chave ? status?.[it.chave] ?? "nenhum" : "nenhum";
          return (
            <Pressable
              key={it.href || it.url}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => (it.href ? irPara(it.href) : it.url && abrirInscricaoEvento(it.url))}
              accessibilityRole="button"
              accessibilityLabel={`${t(it.label)}. ${st === "ativo" ? t("Inscrito") : st === "pendente" ? t("Pendente") : t(it.desc)}`}
            >
              <View style={styles.icon}>
                <Ionicons name={it.icon} size={22} color={colors.brandMid} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.rowLabel}>{t(it.label)}</Text>
                <Text style={styles.rowDesc}>{t(it.desc)}</Text>
              </View>
              <StatusBadge status={st} styles={styles} colors={colors} t={t} />
              <Ionicons
                name={it.url ? "open-outline" : "chevron-forward"}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          );
        })}

        {/* Eventos publicados no sistema (espinha /inscricoes) */}
        {eventos && eventos.length > 0 && (
          <>
            <Text style={styles.secao}>{t("Eventos abertos")}</Text>
            {eventos.map((ev) => {
              const quando = formatarDataEvento(ev.data, ev.hora);
              const valor = ev.pago ? formatarValor(ev.valor_centavos) : null;
              return (
                <Pressable
                  key={ev.id}
                  style={({ pressed }) => [styles.eventoCard, pressed && styles.pressed]}
                  onPress={() => abrirInscricaoEvento(ev.url)}
                  accessibilityRole="button"
                  accessibilityLabel={`${ev.nome}. ${t("Toque para se inscrever")}`}
                >
                  {ev.capa_url ? (
                    <Image source={{ uri: ev.capa_url }} style={styles.eventoCapa} resizeMode="cover" />
                  ) : (
                    <View style={[styles.eventoCapa, styles.eventoCapaVazia]}>
                      <Ionicons name="calendar" size={26} color={colors.brandMid} />
                    </View>
                  )}
                  <View style={styles.eventoBody}>
                    <Text style={styles.rowLabel} numberOfLines={2}>{ev.nome}</Text>
                    <View style={styles.eventoMeta}>
                      {quando ? (
                        <View style={styles.metaChip}>
                          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                          <Text style={styles.metaTxt}>{quando}</Text>
                        </View>
                      ) : null}
                      {ev.local ? (
                        <View style={styles.metaChip}>
                          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                          <Text style={styles.metaTxt} numberOfLines={1}>{ev.local}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.eventoTags}>
                      {valor ? (
                        <View style={styles.tagPago}><Text style={styles.tagPagoTxt}>{valor}</Text></View>
                      ) : (
                        <View style={styles.tagGratis}><Text style={styles.tagGratisTxt}>{t("Gratuito")}</Text></View>
                      )}
                      {ev.tem_sorteio ? (
                        <View style={styles.tagSorteio}><Text style={styles.tagSorteioTxt}>{t("Sorteio")}</Text></View>
                      ) : null}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
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
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, marginBottom: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.lg },
    pressed: { opacity: 0.7 },
    icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center" },
    rowLabel: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    rowDesc: { color: colors.textMuted, fontSize: font.size.sm },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeTxt: { fontSize: 11, fontWeight: "700" },
    secao: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.md, marginBottom: 2 },
    eventoCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.md },
    eventoCapa: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.glass },
    eventoCapaVazia: { alignItems: "center", justifyContent: "center" },
    eventoBody: { flex: 1, gap: 5 },
    eventoMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 3, maxWidth: 160 },
    metaTxt: { color: colors.textMuted, fontSize: font.size.sm },
    eventoTags: { flexDirection: "row", gap: 6, marginTop: 1 },
    tagPago: { backgroundColor: "rgba(63,166,107,0.16)", borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
    tagPagoTxt: { color: "#3FA66B", fontSize: 11, fontWeight: "800" },
    tagGratis: { backgroundColor: colors.glass, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
    tagGratisTxt: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
    tagSorteio: { backgroundColor: "rgba(112,168,176,0.18)", borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
    tagSorteioTxt: { color: colors.brandMid, fontSize: 11, fontWeight: "700" },
  });
