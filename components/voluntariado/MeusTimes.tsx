import { Text } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { useDialogo } from "@/components/ui/Dialogo";
import { getMeusTimes, sairDoTime, salvarCultosDoTime, type MeuTime } from "@/lib/api";
import { alternar, normalizarCultosOpcoes, type CultoOpcao } from "@/lib/disponibilidadeSemanas";

/**
 * MEUS TIMES (09/11/2026 · ideia do Marcos): *"ela vê qual time ela foi colocada
 * em qual culto, ela tem apenas duas opções: um 'x' em cima para sair do time,
 * com confirmação, e poder escolher quais cultos"* — pra servir, por exemplo, na
 * produção no sábado e na recepção no domingo.
 *
 * ⚠️ Os cultos são os do TIME (`service_type_ids`), a mesma regra que o líder
 * edita no sistema. Fora deles o preenchimento automático não escala; quem monta
 * à mão vê a pessoa no fim, com aviso. Quem decide é o servidor.
 * ⚠️ `cultos === null` = serve em todos (aparece tudo marcado). Desmarcar o
 * ÚLTIMO não é permitido: voltaria a "todos" no servidor, o oposto do que a
 * pessoa quis — pra deixar o time existe o ×.
 * ⚠️ Diálogo da casa é IRMÃO do conteúdo (ver components/ui/Dialogo.tsx).
 * Erro de carregamento não vira "sem times": diz que falhou e oferece de novo.
 */
export function MeusTimes() {
  const colors = useColors();
  const t = useT();
  const dlg = useDialogo();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [times, setTimes] = useState<MeuTime[] | null>(null);
  const [opcoes, setOpcoes] = useState<CultoOpcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await getMeusTimes();
      setTimes(r?.times ?? []);
      setOpcoes(normalizarCultosOpcoes(r?.cultos_opcoes) ?? []);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("Não conseguimos carregar seus times."));
    }
  }, [t]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function trocarCulto(time: MeuTime, cultoId: string) {
    if (ocupado) return;
    const todos = opcoes.map((o) => o.id);
    const atual = time.cultos ?? todos;
    const novo = alternar(atual, cultoId);
    if (novo.length === 0) {
      void dlg.avisar(t("Pelo menos um culto"), t("Pra deixar este time, use o × no canto do cartão."));
      return;
    }
    const anterior = times;
    // Mostra na hora; se o servidor recusar, volta.
    setTimes((l) => (l ?? []).map((x) => (x.team_id === time.team_id ? { ...x, cultos: novo.length === todos.length ? null : novo } : x)));
    setOcupado(time.team_id);
    try {
      await salvarCultosDoTime(time.team_id, novo);
    } catch (e) {
      setTimes(anterior);
      void dlg.avisar(t("Erro"), e instanceof Error && e.message ? e.message : t("Erro ao salvar os cultos"));
    } finally {
      setOcupado(null);
    }
  }

  async function sair(time: MeuTime) {
    if (ocupado) return;
    const ok = await dlg.confirmar({
      titulo: t("Sair do time?"),
      mensagem: t("Você deixa de ser escalado em {time}. Pra voltar, fale com a liderança do time.").replace("{time}", time.team_name),
      acao: t("Sair do time"),
      perigo: true,
    });
    if (!ok) return;
    setOcupado(time.team_id);
    try {
      await sairDoTime(time.team_id);
      setTimes((l) => (l ?? []).filter((x) => x.team_id !== time.team_id));
    } catch (e) {
      void dlg.avisar(t("Erro"), e instanceof Error && e.message ? e.message : t("Erro ao sair do time"));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <View style={styles.box}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="people-outline" size={18} color={colors.primary} />
        <Text style={styles.titulo}>{t("Meus times")}</Text>
      </View>
      <Text style={styles.hint}>{t("Escolha em quais cultos você serve em cada time.")}</Text>

      {erro ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.erro}>{erro}</Text>
          <Pressable onPress={carregar} hitSlop={6} accessibilityRole="button">
            <Text style={styles.link}>{t("Tentar de novo")}</Text>
          </Pressable>
        </View>
      ) : times === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : times.length === 0 ? (
        <Text style={styles.hint}>{t("Você ainda não está em nenhum time.")}</Text>
      ) : (
        times.map((time) => {
          const marcados = time.cultos ?? opcoes.map((o) => o.id);
          const salvando = ocupado === time.team_id;
          return (
            <View key={time.team_id} style={styles.card}>
              <View style={styles.cardTopo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeNome} numberOfLines={1}>{time.team_name}</Text>
                  {time.funcoes.length > 0 && (
                    <Text style={styles.funcoes} numberOfLines={2}>{time.funcoes.join(" · ")}</Text>
                  )}
                </View>
                {salvando ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Pressable
                    onPress={() => sair(time)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`${t("Sair do time")} ${time.team_name}`}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
              <View style={styles.chips}>
                {opcoes.map((o) => {
                  const ativo = marcados.includes(o.id);
                  const hora = o.recurrence_time ? o.recurrence_time.slice(0, 5) : "";
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => trocarCulto(time, o.id)}
                      disabled={!!ocupado}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: ativo, disabled: !!ocupado }}
                      style={[styles.chip, ativo && styles.chipAtivo]}
                    >
                      <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>
                        {o.name}{hora && !o.name.includes(hora) ? ` · ${hora}` : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
      <dlg.Dialogo />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    box: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    hint: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    erro: { color: colors.danger, fontSize: font.size.sm },
    link: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
    card: {
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: radius.md,
      padding: spacing.sm,
      gap: spacing.sm,
    },
    cardTopo: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    timeNome: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    funcoes: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    chipAtivo: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    chipTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    chipTxtAtivo: { color: colors.primary },
  });
