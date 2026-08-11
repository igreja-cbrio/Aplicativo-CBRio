import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { carregarStatusInscricoes, type InscricoesStatus, type StatusInscricao } from "@/lib/inscricoesStatus";
import {
  buscarEventosAbertos,
  minhasInscricoesEventos,
  type EventoAberto,
  type MinhaInscricaoEvento,
} from "@/lib/api";
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
  href?: "/batismo" | "/grupos" | "/next" | "/voluntariado" | "/apresentacao-crianca";
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
  // ⚠⚠ ERA UM LINK MORTO, e isso foi MEDIDO (11/08/2026): a URL
  // `cbrio.org/apresentacao-criancas` **não tem rota no ERP** (0 referências em
  // `src/`) e devolvia HTTP 200 só pelo catch-all do SPA da Vercel — parecia
  // viva e não renderizava formulário nenhum. `apresentacao_bebes` tinha **0
  // linhas**: ninguém nunca conseguiu se inscrever, por porta nenhuma.
  //
  // ⚠️ O comentário antigo daqui dizia que era "porta WEB de propósito, pra não
  // criar um 2º caminho de escrita de pessoa". O racional estava certo e o fato
  // estava errado — não havia 1º caminho. Agora a porta é nativa e passa por
  // `POST /app/apresentacao-crianca`, que é o ÚNICO escritor.
  //
  // Pedido do Marcos: *"quero que tudo seja dentro do app"* + *"quando cadastrar
  // uma criança deve gerar pessoa no sistema que aparece em minha família, com as
  // regras de criança, sem CPF, identificamos pelo pai."*
  {
    label: "Apresentação de crianças",
    desc: "Apresente seu filho na igreja",
    icon: "happy",
    href: "/apresentacao-crianca",
  },
];

function StatusBadge({ status, styles, colors, t }: { status: StatusInscricao; styles: ReturnType<typeof makeStyles>; colors: Palette; t: (s: string) => string }) {
  if (status === "nenhum") return null;
  // ⚠️ `"desconhecido"` = a consulta falhou. Mostrar nada seria o mesmo que
  // dizer "você não está inscrito" — a mentira que esta mudança tira do app.
  if (status === "desconhecido") {
    return (
      <View style={[styles.badge, { backgroundColor: "rgba(148,163,184,0.16)" }]}>
        <View style={[styles.badgeDot, { backgroundColor: colors.textMuted }]} />
        <Text style={[styles.badgeTxt, { color: colors.textMuted }]}>{t("Não carregou")}</Text>
      </View>
    );
  }
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
  // ⚠️ Seletor "Todos | Meus eventos" (pedido do Marcos · 05/08/2026): NÃO é aba
  // nova — é recorte da MESMA lista. "Meus" abre a inscrição da pessoa naquele
  // evento (tela /evento), que é onde o estado dela (confirmada/pagamento/QR)
  // finalmente aparece no app.
  const [minhas, setMinhas] = useState<MinhaInscricaoEvento[] | null>(null);
  const [verMeus, setVerMeus] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregarStatusInscricoes(membro?.membroId ?? null).then(setStatus).catch(() => {});
      buscarEventosAbertos().then((r) => setEventos(r.eventos || [])).catch(() => setEventos([]));
      minhasInscricoesEventos()
        .then((r) => setMinhas(r.inscricoes || []))
        .catch(() => setMinhas([]));
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
        {((eventos && eventos.length > 0) || (minhas && minhas.length > 0)) && (
          <>
            <Text style={styles.secao}>{t("Eventos da igreja")}</Text>
            <View style={styles.segRow}>
              {[
                { k: false, label: t("Todos") },
                { k: true, label: t("Meus eventos") },
              ].map((op) => {
                const sel = verMeus === op.k;
                const n = op.k ? (minhas?.length ?? 0) : (eventos?.length ?? 0);
                return (
                  <Pressable
                    key={String(op.k)}
                    onPress={() => setVerMeus(op.k)}
                    style={[styles.segBtn, sel && styles.segBtnAtivo]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                  >
                    <Text style={[styles.segTxt, sel && styles.segTxtAtivo]}>
                      {op.label}{n ? ` (${n})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {verMeus && (minhas?.length ?? 0) === 0 ? (
              <View style={styles.vazioCard}>
                <Ionicons name="ticket-outline" size={26} color={colors.textMuted} />
                <Text style={styles.vazioTxt}>
                  {t("Você ainda não se inscreveu em nenhum evento.")}
                </Text>
              </View>
            ) : null}
            {/* ⚠️ A lista é a MESMA em "Todos" e "Meus eventos" — só o recorte
                muda. Em "Meus", a fonte é `minhas` (a tabela `inscricoes`), que é
                o que traz o estado real (confirmada/pagamento/sorteio) e não
                existia no app até 05/08/2026. */}
            {(verMeus
              ? (minhas ?? []).map((i) => ({
                  id: i.evento.id,
                  nome: i.evento.nome,
                  data: i.evento.data,
                  hora: i.evento.hora,
                  local: i.evento.local,
                  capa_url: i.evento.capa_url,
                  pago: i.evento.pago,
                  valor_centavos: i.valor_cobrado_centavos ?? null,
                  tem_sorteio: i.evento.tem_sorteio,
                  statusInsc: i.status,
                  pagamentoPendente: i.status === "recebida" && i.pagamento?.status !== "pago",
                }))
              : (eventos ?? []).map((e) => ({
                  id: e.id,
                  nome: e.nome,
                  data: e.data,
                  hora: e.hora,
                  local: e.local,
                  capa_url: e.capa_url,
                  pago: e.pago,
                  valor_centavos: e.valor_centavos,
                  tem_sorteio: e.tem_sorteio,
                  statusInsc: e.inscrito ? "inscrita" : null,
                  // ⚠️ Vaga RESERVADA não é inscrição. Isto era `false` fixo, e
                  // a aba mostrava "Inscrito" pra quem só reservou e não pagou —
                  // em evento pago, a pessoa fechava o app achando que tinha
                  // lugar. Quem decide é o backend (`pagamento_pendente`).
                  pagamentoPendente: !!e.pagamento_pendente,
                }))
            ).map((ev) => {
              const quando = formatarDataEvento(ev.data, ev.hora);
              const valor = ev.pago ? formatarValor(ev.valor_centavos) : null;
              return (
                <Pressable
                  key={ev.id}
                  style={({ pressed }) => [styles.eventoCard, pressed && styles.pressed]}
                  onPress={() =>
                    router.navigate({ pathname: "/evento", params: { id: ev.id } } as never)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${ev.nome}. ${
                    ev.statusInsc ? t("Ver minha inscrição") : t("Toque para se inscrever")
                  }`}
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
                      {ev.pagamentoPendente ? (
                        <View style={styles.tagPendente}>
                          <Text style={styles.tagPendenteTxt}>{t("Pagamento pendente")}</Text>
                        </View>
                      ) : ev.statusInsc === "cancelada" ? (
                        <View style={styles.tagPendente}>
                          <Text style={styles.tagPendenteTxt}>{t("Cancelada")}</Text>
                        </View>
                      ) : ev.statusInsc ? (
                        <View style={styles.tagInscrito}>
                          <Text style={styles.tagInscritoTxt}>{t("Inscrito")}</Text>
                        </View>
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
    vazioCard: { alignItems: "center", gap: 8, paddingVertical: spacing.lg, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg },
    vazioTxt: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", paddingHorizontal: spacing.lg },
    segRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
    segBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
    segBtnAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    segTxt: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
    segTxtAtivo: { color: "#fff" },
    tagInscrito: { backgroundColor: "rgba(63,166,107,0.16)", borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
    tagInscritoTxt: { color: "#3FA66B", fontSize: 11, fontWeight: "800" },
    tagPendente: { backgroundColor: "rgba(245,158,11,0.16)", borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
    tagPendenteTxt: { color: "#F59E0B", fontSize: 11, fontWeight: "800" },
    tagSorteio: { backgroundColor: "rgba(112,168,176,0.18)", borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
    tagSorteioTxt: { color: colors.brandMid, fontSize: 11, fontWeight: "700" },
  });
