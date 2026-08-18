import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { CalendarioBR } from "@/components/ui/CalendarioBR";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiPost } from "@/lib/api";
import { hojeBRT } from "@/lib/dataBRT";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/**
 * Modal do box "Próximo encontro" (Naná · 18/08/2026): o líder remarca a data e
 * a hora DAQUELA ocorrência, ou cancela a reunião.
 *
 * ⚠️ Altera SÓ uma ocorrência — o horário fixo do grupo continua sendo o do
 * cadastro. Mudar o horário de todas as semanas é outra coisa e vive em
 * "Editar grupo"; misturar as duas faria um adiamento pontual virar mudança
 * permanente sem ninguém perceber.
 *
 * ⚠️⚠️ O calendário entra com `embutido`: <Modal> dentro de <Modal> nasce ATRÁS
 * no iOS e a pessoa toca em "Escolher" e não vê nada (incidente de 13/08). É
 * exatamente por isso que o CalendarioBR ganhou esse modo.
 */

const isoParaBR = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return d + "/" + m + "/" + a;
};
const brParaISO = (br: string) => {
  const [d, m, a] = br.split("/");
  return a + "-" + m + "-" + d;
};

export type Ocorrencia = {
  data_original: string;
  data: string;
  horario: string;
  status: "normal" | "cancelado" | "remarcado";
  motivo?: string | null;
};

export function ModalAgendaEncontro({
  visivel,
  grupoId,
  grupoNome,
  ocorrencia,
  onFechar,
  onSalvo,
}: {
  visivel: boolean;
  grupoId: string;
  grupoNome: string;
  ocorrencia: Ocorrencia | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const colors = useColors();
  const t = useT();
  const styles = criarEstilos(colors);

  const [novaData, setNovaData] = useState<string | null>(null);
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [calendario, setCalendario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  if (!ocorrencia) return null;

  const jaCancelado = ocorrencia.status === "cancelado";
  const jaRemarcado = ocorrencia.status === "remarcado";

  const limpar = () => {
    setNovaData(null);
    setHora("");
    setMotivo("");
    setCalendario(false);
    setErro("");
    setConfirmando(false);
  };
  const fechar = () => {
    limpar();
    onFechar();
  };

  const enviar = async (acao: "remarcar" | "cancelar" | "desfazer") => {
    setErro("");
    setSalvando(true);
    try {
      const corpo: Record<string, unknown> = {
        data_original: ocorrencia.data_original,
        acao,
      };
      if (acao === "remarcar") {
        if (!novaData) {
          setErro(t("Escolha a nova data."));
          setSalvando(false);
          return;
        }
        corpo.nova_data = brParaISO(novaData);
        // Hora é OPCIONAL: em branco mantém a hora de sempre do grupo.
        if (hora.trim()) {
          if (!/^\d{2}:\d{2}$/.test(hora.trim())) {
            setErro(t("Horário inválido. Use HH:MM."));
            setSalvando(false);
            return;
          }
          corpo.novo_horario = hora.trim();
        }
      }
      if (acao !== "desfazer" && motivo.trim()) corpo.motivo = motivo.trim();
      await apiPost("/app/grupos/" + grupoId + "/agenda", corpo);
      limpar();
      onSalvo();
    } catch (e: any) {
      setErro(e?.message || t("Não deu para salvar. Tente de novo."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={fechar}>
      <Pressable style={styles.fundo} onPress={fechar}>
        <Pressable style={styles.cartao} onPress={(e) => e.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.cabecalho}>
              <Text style={styles.titulo}>
                {t("Encontro de")} {isoParaBR(ocorrencia.data_original)}
              </Text>
              <Pressable onPress={fechar} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.sub}>{grupoNome}</Text>

            {jaCancelado ? (
              <View style={styles.avisoBox}>
                <Text style={styles.avisoTxt}>
                  {t("Este encontro está cancelado.")}
                  {ocorrencia.motivo ? " " + t("Motivo") + ": " + ocorrencia.motivo : ""}
                </Text>
              </View>
            ) : null}
            {jaRemarcado ? (
              <View style={styles.avisoBox}>
                <Text style={styles.avisoTxt}>
                  {t("Já remarcado para")} {isoParaBR(ocorrencia.data)} {t("às")} {ocorrencia.horario}.
                </Text>
              </View>
            ) : null}

            {/* Some quando não há o que desfazer. */}
            {jaCancelado || jaRemarcado ? (
              <Button
                title={t("Voltar ao horário de sempre")}
                variant="ghost"
                loading={salvando}
                onPress={() => enviar("desfazer")}
                style={{ marginBottom: spacing.md }}
              />
            ) : null}

            {!jaCancelado ? (
              <>
                <Text style={styles.secao}>{t("Alterar a data deste encontro")}</Text>
                <Pressable style={styles.campo} onPress={() => setCalendario((v) => !v)}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                  <Text style={[styles.campoTxt, !novaData ? { color: colors.textMuted } : null]}>
                    {novaData || t("Escolher nova data")}
                  </Text>
                </Pressable>

                {calendario ? (
                  <CalendarioBR
                    visivel
                    embutido
                    titulo={t("Nova data do encontro")}
                    valor={novaData}
                    minimoISO={hojeBRT()}
                    hojeISO={hojeBRT()}
                    onFechar={() => setCalendario(false)}
                    onEscolher={(d) => {
                      setNovaData(d);
                      setCalendario(false);
                    }}
                  />
                ) : null}

                <Text style={styles.rotulo}>{t("Horário (opcional)")}</Text>
                <TextInput
                  value={hora}
                  onChangeText={setHora}
                  placeholder={ocorrencia.horario || "19:00"}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={styles.input}
                />
                <Text style={styles.dica}>
                  {t("Deixe em branco para manter o horário de sempre.")}
                </Text>

                <Text style={styles.rotulo}>{t("Motivo (opcional)")}</Text>
                <TextInput
                  value={motivo}
                  onChangeText={setMotivo}
                  placeholder={t("Ex.: feriado, viagem...")}
                  placeholderTextColor={colors.textMuted}
                  maxLength={300}
                  style={styles.input}
                />

                <Button
                  title={t("Salvar nova data")}
                  loading={salvando}
                  onPress={() => enviar("remarcar")}
                  style={{ marginTop: spacing.md }}
                />
              </>
            ) : null}

            {!jaCancelado ? (
              <View style={styles.zonaCancelar}>
                {!confirmando ? (
                  <Pressable onPress={() => setConfirmando(true)} hitSlop={8}>
                    <Text style={styles.linkCancelar}>{t("Cancelar este encontro")}</Text>
                  </Pressable>
                ) : (
                  <>
                    {/* ⚠️ Honestidade: o app NÃO avisa os participantes. Quem
                        fala com o grupo é o líder, no WhatsApp dele — e é ele
                        que tem o contexto ("adiamos por causa do feriado"). */}
                    <Text style={styles.confirmaTxt}>
                      {t("Cancelar o encontro de")} {isoParaBR(ocorrencia.data_original)}?{" "}
                      {t("Avise o grupo — o app não manda mensagem para os participantes.")}
                    </Text>
                    <View style={styles.linhaBotoes}>
                      <Button
                        title={t("Voltar")}
                        variant="ghost"
                        onPress={() => setConfirmando(false)}
                        style={{ flex: 1 }}
                      />
                      {/* ⚠️ O Button da casa só tem primary|ghost — ação
                          destrutiva usa Pressable com `danger`, como as outras
                          telas do app já fazem. */}
                      <Pressable
                        style={styles.btnPerigo}
                        disabled={salvando}
                        onPress={() => enviar("cancelar")}
                      >
                        <Text style={styles.btnPerigoTxt}>
                          {salvando ? t("Cancelando...") : t("Cancelar encontro")}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const criarEstilos = (c: Palette) =>
  StyleSheet.create({
    fundo: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    cartao: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      maxHeight: "88%",
    },
    cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    titulo: { fontSize: font.size.lg, fontWeight: "700", color: c.text, flex: 1 },
    sub: { fontSize: font.size.sm, color: c.textMuted, marginBottom: spacing.md },
    secao: { fontSize: font.size.sm, fontWeight: "700", color: c.text, marginBottom: spacing.xs },
    rotulo: { fontSize: font.size.sm, color: c.textMuted, marginTop: spacing.md, marginBottom: 4 },
    campo: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
    },
    campoTxt: { fontSize: font.size.md, color: c.text },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: font.size.md,
      color: c.text,
    },
    dica: { fontSize: font.size.sm, color: c.textMuted, marginTop: 4 },
    /* ⚠️ `warning` e não `danger`: encontro remarcado/cancelado é aviso, não
       erro — o próprio tema documenta que vermelho fica pra destruir. */
    avisoBox: {
      backgroundColor: c.glass,
      borderLeftWidth: 3,
      borderLeftColor: c.warning,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    avisoTxt: { fontSize: font.size.sm, color: c.text },
    zonaCancelar: {
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.md,
    },
    linkCancelar: { fontSize: font.size.sm, color: c.danger, fontWeight: "600", textAlign: "center" },
    confirmaTxt: { fontSize: font.size.sm, color: c.text, marginBottom: spacing.sm, lineHeight: 20 },
    linhaBotoes: { flexDirection: "row", gap: spacing.sm },
    erro: { fontSize: font.size.sm, color: c.danger, marginTop: spacing.md },
    btnPerigo: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPerigoTxt: { fontSize: font.size.md, fontWeight: "700", color: c.danger },
  });
