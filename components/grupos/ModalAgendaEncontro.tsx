import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  /** ⚠️ A JANELA vem do SERVIDOR (`min(7 dias, véspera do próximo encontro)`).
   * O app NÃO recalcula: duas cópias da régua divergiriam, e a divergência
   * apareceria como "o calendário deixou escolher e o servidor recusou". */
  pode_remarcar?: boolean;
  remarcar_de?: string | null;
  remarcar_ate?: string | null;
  /** Cadência quinzenal/mensal sem encontro registrado: a data é palpite. */
  ancora_incerta?: boolean;
};

export function ModalAgendaEncontro({
  visivel,
  grupoId,
  grupoNome,
  ocorrencia,
  ocorrencias = [],
  onFechar,
  onSalvo,
}: {
  visivel: boolean;
  grupoId: string;
  grupoNome: string;
  /** A ocorrência com que o modal ABRE (a próxima, normalmente). */
  ocorrencia: Ocorrencia | null;
  /** ⚠️ A agenda da temporada mora AQUI dentro desde 18/08: fora, ela era um
   *  dropdown embaixo do herói repetindo a data que ele já mostrava. */
  ocorrencias?: Ocorrencia[];
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
  // Qual ocorrência está sendo editada. `null` = a que o modal abriu.
  const [trocaKey, setTrocaKey] = useState<string | null>(null);
  const [verAgenda, setVerAgenda] = useState(false);

  if (!ocorrencia) return null;

  // ⚠️ O alvo efetivo: a escolhida na lista, ou a que abriu o modal. Se a
  // troca apontar para algo que sumiu da agenda (recarregou), volta pra origem
  // em vez de renderizar vazio.
  const oc = (trocaKey && ocorrencias.find((x) => x.data_original === trocaKey)) || ocorrencia;

  // ⚠️ A janela é DO SERVIDOR. `pode_remarcar` ausente (bundle novo × backend
  // antigo) não trava a tela: cai no comportamento de antes e quem recusa é o
  // POST, com a mensagem certa.
  const podeRemarcar = oc.pode_remarcar !== false;
  const deISO = oc.remarcar_de || null;
  const ateISO = oc.remarcar_ate || null;

  const jaCancelado = oc.status === "cancelado";
  const jaRemarcado = oc.status === "remarcado";

  const limpar = () => {
    setTrocaKey(null);
    setVerAgenda(false);
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
        data_original: oc.data_original,
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
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={fechar}>
      {/* ⚠️⚠️ CENTRADO, não bottom sheet (relato do Marcos · 18/08): subindo de
          baixo, o botão de cancelar encontro ficava POR CIMA da barra de
          navegação do Android e não dava pra tocar. E o teclado, ao abrir no
          campo de motivo, cobria justamente o campo — daí o KeyboardAvoidingView
          + `automaticallyAdjustKeyboardInsets` na rolagem. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.fundo} onPress={fechar}>
          <Pressable style={styles.cartao} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingBottom: spacing.md }}
            >
            <View style={styles.cabecalho}>
              <Text style={styles.titulo}>
                {t("Encontro de")} {isoParaBR(oc.data_original)}
              </Text>
              <Pressable onPress={fechar} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.sub}>{grupoNome}</Text>

            {/* ⚠️ A AGENDA DA TEMPORADA veio pra dentro do modal (18/08): fora,
                era um dropdown embaixo do herói repetindo a data que ele já
                mostrava. Aqui ela serve pra ESCOLHER qual encontro editar, que
                é a única coisa que a lista precisa fazer. Nasce recolhida. */}
            {ocorrencias.length > 1 ? (
              <View>
                <Pressable
                  style={styles.trocar}
                  onPress={() => setVerAgenda((v) => !v)}
                  accessibilityRole="button"
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.trocarTxt}>
                    {verAgenda ? t("Esconder a agenda") : `${t("Escolher outro encontro")} (${ocorrencias.length})`}
                  </Text>
                  <Ionicons name={verAgenda ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </Pressable>

              </View>
            ) : null}

            {jaCancelado ? (
              <View style={styles.avisoBox}>
                <Text style={styles.avisoTxt}>
                  {t("Este encontro está cancelado.")}
                  {oc.motivo ? " " + t("Motivo") + ": " + oc.motivo : ""}
                </Text>
              </View>
            ) : null}
            {jaRemarcado ? (
              <View style={styles.avisoBox}>
                <Text style={styles.avisoTxt}>
                  {t("Já remarcado para")} {isoParaBR(oc.data)} {t("às")} {oc.horario}.
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

            {oc.ancora_incerta ? (
              <View style={styles.avisoBox}>
                <Text style={styles.avisoTxt}>
                  {t("Registre a presença de um encontro para o app acertar as próximas datas deste grupo.")}
                </Text>
              </View>
            ) : null}

            {!jaCancelado && !podeRemarcar ? (
              <View style={styles.avisoBox}>
                <Text style={styles.avisoTxt}>
                  {t("Este encontro está colado no seguinte — não dá para mudar a data. Se ele não vai acontecer, cancele abaixo.")}
                </Text>
              </View>
            ) : null}

            {!jaCancelado && podeRemarcar ? (
              <>
                <Text style={styles.secao}>{t("Alterar a data deste encontro")}</Text>
                {/* ⚠️ O limite é DITO, não só imposto no calendário: dia cinza
                    sem explicação lê-se como app quebrado. */}
                {ateISO ? (
                  <Text style={styles.dica}>
                    {t("Você pode mover até")} {isoParaBR(ateISO)}. {t("Para mais que isso, cancele este encontro.")}
                  </Text>
                ) : null}
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
                    minimoISO={deISO || hojeBRT()}
                    maximoISO={ateISO}
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
                  placeholder={oc.horario || "19:00"}
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
              </>
            ) : null}

            {!jaCancelado ? (
              <View style={styles.zonaAcoes}>
                {confirmando ? (
                  <>
                    {/* ⚠️ Honestidade: o app NÃO avisa os participantes. Quem
                        fala com o grupo é o líder, no WhatsApp dele — e é ele
                        que tem o contexto ("adiamos por causa do feriado"). */}
                    <Text style={styles.confirmaTxt}>
                      {t("Cancelar o encontro de")} {isoParaBR(oc.data_original)}?{" "}
                      {t("Avise o grupo — o app não manda mensagem para os participantes.")}
                    </Text>
                    <View style={styles.linhaBotoes}>
                      <Button
                        title={t("Voltar")}
                        variant="ghost"
                        onPress={() => setConfirmando(false)}
                        style={{ flex: 1 }}
                      />
                      <Pressable
                        style={styles.btnPerigo}
                        disabled={salvando}
                        onPress={() => enviar("cancelar")}
                        accessibilityRole="button"
                      >
                        <Text numberOfLines={1} style={styles.btnPerigoTxt}>
                          {salvando ? t("Cancelando...") : t("Cancelar encontro")}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  /* ⚠️ AS DUAS AÇÕES LADO A LADO (pedido do Marcos · 18/08):
                     salvar era um botão perdido no meio do formulário e
                     cancelar era um link solto embaixo — "fica ruim a
                     visualização". Agora é uma linha de rodapé.
                     ⚠️ Cancelar continua sendo CONTORNO, nunca preenchido: a
                     hierarquia tem que dizer qual é a ação esperada. E ele não
                     cancela no toque — abre a confirmação acima. */
                  <View style={styles.linhaBotoes}>
                    {podeRemarcar ? (
                      /* ⚠️ "Salvar nova data" NÃO cabe em meia largura com o
                         padding de 24 de cada lado do Button — vira duas linhas
                         dentro de uma caixa de altura fixa. Rótulo curto +
                         padding menor resolvem sem encolher fonte. */
                      <Button
                        title={t("Salvar data")}
                        loading={salvando}
                        onPress={() => enviar("remarcar")}
                        style={{ flex: 1, paddingHorizontal: spacing.sm }}
                      />
                    ) : null}
                    <Pressable
                      style={[styles.btnPerigo, !podeRemarcar && { flex: 1 }]}
                      onPress={() => setConfirmando(true)}
                      accessibilityRole="button"
                    >
                      <Text numberOfLines={1} style={styles.btnPerigoTxt}>{t("Cancelar encontro")}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}

            {erro ? <Text style={styles.erro}>{erro}</Text> : null}
            </ScrollView>

            {/* ⚠️⚠️ PAINEL, não dropdown flutuante (18/08). A versão anterior
                era `position: absolute` num wrapper de ~42px, então ela
                renderizava FORA dos limites do pai — e no Android view que
                desenha fora do pai **não recebe toque**: dava pra ver a lista e
                não dava pra rolar nem escolher. Aqui ele é filho do CARTÃO,
                cujos limites o contêm, então toque e rolagem funcionam.
                ⚠️ Um único ScrollView, sem aninhar: `nestedScrollEnabled` é só
                Android e briga com o gesto do pai. */}
            {verAgenda ? (
              <View style={styles.painelAgenda}>
                <View style={styles.painelTopo}>
                  <Text style={styles.painelTitulo}>{t("Escolher outro encontro")}</Text>
                  <Pressable onPress={() => setVerAgenda(false)} hitSlop={12} accessibilityRole="button">
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>
                <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                  <View style={styles.agendaLista}>
                    {ocorrencias.map((o) => {
                      const sel = o.data_original === oc.data_original;
                      return (
                        <Pressable
                          key={o.data_original}
                          style={[styles.agendaItem, sel && styles.agendaItemSel]}
                          onPress={() => {
                            // ⚠️ Trocar de encontro LIMPA o formulário: manter a
                            // data digitada para outro dia seria remarcar o
                            // encontro errado com o que a pessoa escreveu antes.
                            setTrocaKey(o.data_original);
                            setNovaData(null);
                            setHora("");
                            setMotivo("");
                            setCalendario(false);
                            setConfirmando(false);
                            setErro("");
                            setVerAgenda(false);
                          }}
                          accessibilityRole="button"
                        >
                          <Text
                            style={[
                              styles.agendaItemTxt,
                              o.status === "cancelado" && styles.agendaItemCancelado,
                              sel && styles.agendaItemTxtSel,
                            ]}
                          >
                            {isoParaBR(o.data)}
                            {o.horario ? ` · ${o.horario}` : ""}
                          </Text>
                          {o.status !== "normal" ? (
                            <Text style={styles.agendaItemTag}>
                              {o.status === "cancelado" ? t("cancelado") : t("remarcado")}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const criarEstilos = (c: Palette) =>
  StyleSheet.create({
    fundo: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: spacing.lg,
    },
    cartao: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      maxHeight: "82%",
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
    trocar: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingVertical: 10,
      borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border,
    },
    trocarTxt: { flex: 1, fontSize: font.size.sm, color: c.textMuted, fontWeight: "600" },
    // ⚠️ O painel é filho do CARTÃO (limites o contêm ⇒ recebe toque no
    // Android) e cobre o conteúdo — é o "fundo que sobrepõe" pedido.
    painelAgenda: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      zIndex: 30, elevation: 30,
    },
    painelTopo: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between", gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    painelTitulo: { flex: 1, fontSize: font.size.md, fontWeight: "700", color: c.text },
    agendaLista: { gap: 2 },
    agendaItem: {
      paddingVertical: 10, paddingHorizontal: spacing.sm,
      borderRadius: radius.sm, flexDirection: "row",
      alignItems: "center", justifyContent: "space-between", gap: spacing.sm,
    },
    agendaItemSel: { backgroundColor: c.glass },
    agendaItemTxt: { fontSize: font.size.sm, color: c.text },
    agendaItemTxtSel: { fontWeight: "700", color: c.brandMid },
    agendaItemCancelado: { textDecorationLine: "line-through", color: c.textMuted },
    agendaItemTag: { fontSize: font.size.sm, color: c.warning, fontWeight: "600" },
    zonaAcoes: {
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    confirmaTxt: { fontSize: font.size.sm, color: c.text, marginBottom: spacing.sm, lineHeight: 20 },
    linhaBotoes: { flexDirection: "row", gap: spacing.sm },
    erro: { fontSize: font.size.sm, color: c.danger, marginTop: spacing.md },
    // ⚠️ Espelha o `base` do Button da casa (altura 52 · raio full) pra os dois
    // ficarem do MESMO tamanho lado a lado. Com paddingVertical 14 este saía
    // mais baixo que o primário e a linha ficava desalinhada.
    btnPerigo: {
      flex: 1,
      height: 52,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    btnPerigoTxt: { fontSize: font.size.md, fontWeight: "700", color: c.danger, textAlign: "center" },
  });
