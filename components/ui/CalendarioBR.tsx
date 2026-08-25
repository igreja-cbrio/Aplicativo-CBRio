import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/**
 * Calendário de escolha de data, em **JS puro**.
 *
 * ⚠️⚠️ NADA de `@react-native-community/datetimepicker` (nem qualquer picker
 * nativo): módulo nativo **não sai por OTA** — entraria só num build novo, com
 * revisão da Apple no caminho. Este componente é View/Text/Pressable, então
 * chega em quem já tem o app instalado.
 *
 * ⚠️ Toda a aritmética usa `Date` **LOCAL** (`new Date(ano, mes, dia)`) e o ISO
 * é montado por concatenação — nunca `toISOString()`, que é UTC e em fuso
 * negativo devolve o dia anterior (a armadilha já registrada na faixa etária,
 * no dia do culto e no filtro de indisponibilidade).
 */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Domingo a sábado, na ordem que `Date.getDay()` devolve.
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoDe = (ano: number, mes: number, dia: number) =>
  `${ano}-${pad(mes + 1)}-${pad(dia)}`;

type Props = {
  visivel: boolean;
  /**
   * ⚠️⚠️ Renderiza SÓ o cartão, sem `<Modal>` — é o que faz o calendário
   * funcionar quando ele é aberto de dentro de outro modal (13/08/2026).
   *
   * O relato: no iPhone, tocar em "Escolher" no modal "Bloquear datas" **não
   * abria calendário nenhum**. A causa: `<Modal>` é container NATIVO,
   * apresentado a partir do view controller da tela — um segundo modal, irmão,
   * pedido enquanto o primeiro está apresentado, nasce ATRÁS dele. (No Android
   * a pilha de Dialog perdoava, e foi por isso que passou no teste de 07/08.)
   *
   * ⇒ Quem abre calendário de dentro de um modal usa `embutido` e o renderiza
   * DENTRO da janela que já está aberta. Aninhar `<Modal>` em `<Modal>` seria a
   * outra saída, e é justamente a que não tem precedente neste repo.
   */
  embutido?: boolean;
  titulo: string;
  /** Data já escolhida, em DD/MM/AAAA (abre o calendário no mês dela). */
  valor?: string | null;
  /** `YYYY-MM-DD` — dias ANTES deste ficam desabilitados. */
  minimoISO?: string | null;
  /** `YYYY-MM-DD` — dias DEPOIS deste ficam desabilitados.
   * ⚠️ Existe porque remarcar encontro de grupo tem teto (não pode alcançar o
   * encontro seguinte). Sem o máximo, o calendário oferecia datas que o
   * servidor recusa — e a pessoa só descobre depois de escolher. */
  maximoISO?: string | null;
  /** `YYYY-MM-DD[]` — dias DENTRO da faixa que mesmo assim não podem ser
   * escolhidos.
   *
   * ⚠⚠ Diferente do mínimo/máximo, que descrevem uma FAIXA: aqui são buracos
   * no meio dela. Nasceu do encontro de grupo (25/08/2026), onde o dia que JÁ
   * TEM chamada colide com o UNIQUE (grupo_id, data) do banco — escolher um
   * deles levantava 23505 e o líder só descobria DEPOIS de salvar. */
  bloqueadasISO?: string[] | null;
  /** `YYYY-MM-DD` em BRT: marca o "hoje" e é o mês inicial quando não há valor. */
  hojeISO: string;
  onFechar: () => void;
  onEscolher: (dataBR: string) => void;
};

export function CalendarioBR({
  visivel,
  embutido,
  titulo,
  valor,
  minimoISO,
  maximoISO,
  bloqueadasISO,
  hojeISO,
  onFechar,
  onEscolher,
}: Props) {
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Set pra a checagem por célula ser O(1): o mês inteiro passa por ela.
  const indisponiveis = useMemo(
    () => new Set((bloqueadasISO || []).map((d) => String(d).slice(0, 10))),
    [bloqueadasISO]
  );

  const inicial = useMemo(() => {
    const m = (valor || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return { ano: +m[3], mes: +m[2] - 1 };
    const h = hojeISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (h) return { ano: +h[1], mes: +h[2] - 1 };
    const agora = new Date();
    return { ano: agora.getFullYear(), mes: agora.getMonth() };
  }, [valor, hojeISO]);

  const [cursor, setCursor] = useState(inicial);

  // Reabrir tem que voltar pro mês certo: sem isto o calendário guardaria o mês
  // pra onde a pessoa navegou da última vez, em outro campo.
  useEffect(() => {
    if (visivel) setCursor(inicial);
  }, [visivel, inicial]);

  const selecionadoISO = useMemo(() => {
    const m = (valor || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }, [valor]);

  const { celulas, rotuloMes } = useMemo(() => {
    const primeiroDiaSemana = new Date(cursor.ano, cursor.mes, 1).getDay();
    // Dia 0 do mês seguinte é o último dia deste — cobre bissexto sem tabela.
    const diasNoMes = new Date(cursor.ano, cursor.mes + 1, 0).getDate();
    const lista: (number | null)[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) lista.push(null);
    for (let d = 1; d <= diasNoMes; d++) lista.push(d);
    return {
      celulas: lista,
      rotuloMes: `${t(MESES[cursor.mes])} ${cursor.ano}`,
    };
  }, [cursor, t]);

  function andarMes(delta: number) {
    setCursor((c) => {
      const d = new Date(c.ano, c.mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }

  function escolher(dia: number) {
    onEscolher(`${pad(dia)}/${pad(cursor.mes + 1)}/${cursor.ano}`);
  }

  const cartao = (
    /* Toque dentro do cartão não fecha o modal. */
    <Pressable style={styles.cartao} onPress={() => {}}>
          <View style={styles.topo}>
            <Text style={styles.titulo}>{titulo}</Text>
            <Pressable onPress={onFechar} hitSlop={10} accessibilityLabel={t("Fechar")}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.navMes}>
            <Pressable
              onPress={() => andarMes(-1)}
              hitSlop={10}
              style={styles.navBtn}
              accessibilityLabel={t("Mês anterior")}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.mesLabel}>{rotuloMes}</Text>
            <Pressable
              onPress={() => andarMes(1)}
              hitSlop={10}
              style={styles.navBtn}
              accessibilityLabel={t("Próximo mês")}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.semana}>
            {DIAS_SEMANA.map((d, i) => (
              <Text key={i} style={styles.semanaLabel}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grade}>
            {celulas.map((dia, i) => {
              if (dia === null) return <View key={`v${i}`} style={styles.celula} />;
              const iso = isoDe(cursor.ano, cursor.mes, dia);
              const bloqueado =
                (!!minimoISO && iso < minimoISO) ||
                (!!maximoISO && iso > maximoISO) ||
                indisponiveis.has(iso);
              const selecionado = iso === selecionadoISO;
              const ehHoje = iso === hojeISO;
              return (
                <Pressable
                  key={iso}
                  style={styles.celula}
                  disabled={bloqueado}
                  onPress={() => escolher(dia)}
                  accessibilityRole="button"
                  accessibilityLabel={`${dia} ${t(MESES[cursor.mes])} ${cursor.ano}`}
                  accessibilityState={{ disabled: bloqueado, selected: selecionado }}
                >
                  <View
                    style={[
                      styles.diaBolha,
                      selecionado && styles.diaSelecionado,
                      !selecionado && ehHoje && styles.diaHoje,
                    ]}
                  >
                    <Text
                      style={[
                        styles.diaTexto,
                        bloqueado && styles.diaBloqueado,
                        selecionado && styles.diaTextoSelecionado,
                      ]}
                    >
                      {dia}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
    </Pressable>
  );

  if (embutido) return visivel ? cartao : null;

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
      statusBarTranslucent
    >
      <Pressable style={styles.fundo} onPress={onFechar}>{cartao}</Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fundo: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    cartao: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.md,
      gap: spacing.sm,
    },
    topo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    navMes: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.xs,
    },
    navBtn: { padding: 6 },
    mesLabel: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    semana: { flexDirection: "row" },
    semanaLabel: {
      flex: 1,
      textAlign: "center",
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    grade: { flexDirection: "row", flexWrap: "wrap" },
    // 7 colunas: 100/7 dá dízima, e arredondar pra cima estoura a linha.
    celula: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    diaBolha: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    diaSelecionado: { backgroundColor: colors.primary },
    diaHoje: { borderWidth: 1, borderColor: colors.brandMid },
    diaTexto: { color: colors.text, fontSize: font.size.sm, fontWeight: "600" },
    diaTextoSelecionado: { color: "#FFFFFF", fontWeight: "800" },
    diaBloqueado: { color: colors.textMuted, opacity: 0.35 },
  });

export default CalendarioBR;
