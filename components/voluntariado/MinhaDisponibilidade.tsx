import { Text } from "@/components/ui/Typography";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { salvarDisponibilidade } from "@/lib/api";
import { alternar, SEMANAS_DO_MES, type CultoOpcao } from "@/lib/disponibilidadeSemanas";

/**
 * Semanas e cultos em que posso servir (09/11/2026 · era "Meu domingo de
 * preferência", de 24/09).
 *
 * Pedido do Marcos: (1) marcar os CULTOS em que a pessoa pode ser escalada;
 * (2) várias SEMANAS (1 e 3, 2 e 4…); (3) a 5ª semana, e o número como "a
 * N-ésima vez daquele dia no mês" — sábado + 2ª = o 2º sábado.
 *
 * ⚠️ É DISPONIBILIDADE (decisão dele): fora do que a pessoa marcou o
 * preenchimento automático não escala; quem monta à mão ainda vê, no fim e com
 * aviso. Nada marcado = disponível em tudo. Quem decide é o servidor.
 * ⚠️ Salva a cada toque (como era), um pedido por vez. Se falhar, desfaz o
 * toque e avisa. A escolha local fica na tela mesmo quando o servidor guarda
 * "tudo marcado" como vazio.
 * ⚠️ `cultos === null` = servidor sem a migration ⇒ a parte de cultos some.
 */
export function MinhaDisponibilidade({
  semanasIniciais,
  cultosIniciais,
  cultos,
}: {
  semanasIniciais: number[];
  cultosIniciais: string[];
  cultos: CultoOpcao[] | null;
}) {
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [semanas, setSemanas] = useState<number[]>(semanasIniciais);
  const [meusCultos, setMeusCultos] = useState<string[]>(cultosIniciais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Recarregou a tela com outro valor do servidor: assume o novo.
  const chaveSem = semanasIniciais.join(",");
  const chaveCul = cultosIniciais.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSemanas(semanasIniciais); }, [chaveSem]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMeusCultos(cultosIniciais); }, [chaveCul]);

  async function trocarSemana(n: number) {
    if (salvando) return;
    const anterior = semanas;
    const nova = alternar(semanas, n);
    setSemanas(nova); setErro(null); setSalvando(true);
    try { await salvarDisponibilidade({ semanas: nova }); }
    catch (e) { setSemanas(anterior); setErro(e instanceof Error && e.message ? e.message : t("Não deu pra salvar. Tente de novo.")); }
    finally { setSalvando(false); }
  }

  async function trocarCulto(id: string) {
    if (salvando) return;
    const anterior = meusCultos;
    const nova = alternar(meusCultos, id);
    setMeusCultos(nova); setErro(null); setSalvando(true);
    try { await salvarDisponibilidade({ cultos: nova }); }
    catch (e) { setMeusCultos(anterior); setErro(e instanceof Error && e.message ? e.message : t("Não deu pra salvar. Tente de novo.")); }
    finally { setSalvando(false); }
  }

  const nadaMarcado = semanas.length === 0 && (cultos === null || meusCultos.length === 0);

  return (
    <View style={styles.box}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="calendar-number-outline" size={18} color={colors.primary} />
        <Text style={styles.titulo}>{t("Quando posso servir")}</Text>
      </View>
      <Text style={styles.hint}>
        {t("Marque as semanas do mês e os cultos em que você pode ser escalado. Fora deles, a escala automática não te coloca. Sem nada marcado, você fica disponível em todos.")}
      </Text>

      <Text style={styles.rotulo}>{t("Semanas do mês")}</Text>
      <View style={styles.chips}>
        {SEMANAS_DO_MES.map((n) => {
          const ativo = semanas.includes(n);
          return (
            <Pressable
              key={n}
              onPress={() => trocarSemana(n)}
              disabled={salvando}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ativo, disabled: salvando }}
              accessibilityLabel={`${n}ª ${t("semana")}`}
              style={[styles.chip, ativo && styles.chipAtivo]}
            >
              <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>{n}ª</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.pequeno}>
        {t("A semana conta a vez daquele dia no mês: quem serve no sábado e marca a 2ª está disponível no 2º sábado. A 5ª só existe em alguns meses.")}
      </Text>

      {cultos && cultos.length > 0 && (
        <>
          <Text style={styles.rotulo}>{t("Cultos")}</Text>
          <View style={styles.chips}>
            {cultos.map((c) => {
              const ativo = meusCultos.includes(c.id);
              const hora = c.recurrence_time ? c.recurrence_time.slice(0, 5) : "";
              return (
                <Pressable
                  key={c.id}
                  onPress={() => trocarCulto(c.id)}
                  disabled={salvando}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ativo, disabled: salvando }}
                  style={[styles.chip, ativo && styles.chipAtivo]}
                >
                  <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>
                    {c.name}{hora && !c.name.includes(hora) ? ` · ${hora}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {nadaMarcado && <Text style={styles.pequeno}>{t("Hoje você está disponível em todas as semanas e cultos.")}</Text>}
      {erro && <Text style={styles.erro}>{erro}</Text>}
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
    rotulo: { color: colors.text, fontSize: font.size.sm, fontWeight: "700", marginTop: 4 },
    pequeno: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    chipAtivo: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    chipTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    chipTxtAtivo: { color: colors.primary },
    erro: { color: colors.danger, fontSize: font.size.sm },
  });
