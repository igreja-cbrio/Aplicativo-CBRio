import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CalendarioBR } from "@/components/ui/CalendarioBR";
import { useColors } from "@/contexts/ThemeContext";
import {
  listarIndisponibilidades,
  adicionarIndisponibilidade,
  removerIndisponibilidade,
  type Indisponibilidade,
} from "@/lib/disponibilidade";
import { janelaIndisponibilidadeBR, type ErroJanela } from "@/lib/validators";
import { hojeBRT } from "@/lib/dataBRT";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

function fmtIso(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function isoParaBR(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function brParaISO(br: string) {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function Disponibilidade({ volProfileId }: { volProfileId: string }) {
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [itens, setItens] = useState<Indisponibilidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [calendario, setCalendario] = useState<null | "de" | "ate">(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    // ⚠️ Antes não havia try/catch: com a leitura indo pro backend (06/08), uma
    // falha de rede rejeitaria a promise, `carregando` ficaria true PRA SEMPRE e
    // a tela travaria num spinner. Erro tem que virar mensagem, não silêncio.
    try {
      const lista = await listarIndisponibilidades(volProfileId);
      setItens(lista);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não conseguimos carregar suas datas."));
    } finally {
      setCarregando(false);
    }
  }, [volProfileId, t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function fecharForm() {
    setAberto(false);
    setCalendario(null);
    setErro(null);
    setDe("");
    setAte("");
    setMotivo("");
  }

  const MENSAGEM_ERRO: Record<ErroJanela, string> = {
    de_invalida: t("Escolha a data de início."),
    ate_invalida: t("Escolha a data de fim."),
    fim_antes_do_inicio: t("A data final precisa ser igual ou depois da inicial."),
    janela_passada: t("Esse período já passou. Bloqueie datas de hoje em diante."),
  };

  async function salvar() {
    setErro(null);
    // ⚠️ A régua vive em `lib/validators` (pura, no portão do CI) — aqui só
    // traduzimos o motivo. Era esta validação que recusava TODA data futura,
    // porque usava a régua de NASCIMENTO (`isValidDateBR`).
    const janela = janelaIndisponibilidadeBR(de, ate, hojeBRT());
    if (!janela.ok) {
      setErro(MENSAGEM_ERRO[janela.erro]);
      return;
    }
    setSalvando(true);
    try {
      await adicionarIndisponibilidade(volProfileId, janela.de, janela.ate, motivo);
      fecharForm();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Falha ao salvar."));
    } finally {
      setSalvando(false);
    }
  }

  function confirmarRemocao(item: Indisponibilidade) {
    Alert.alert(
      t("Remover indisponibilidade"),
      `${t("Liberar")} ${fmtIso(item.unavailable_from)} – ${fmtIso(item.unavailable_to)}?`,
      [
        { text: t("Cancelar"), style: "cancel" },
        {
          text: t("Remover"),
          style: "destructive",
          onPress: async () => {
            await removerIndisponibilidade(item.id);
            await carregar();
          },
        },
      ]
    );
  }

  // A data final nunca pode ser antes da inicial nem antes de hoje — o
  // calendário já desabilita esses dias em vez de deixar a pessoa errar.
  const hoje = hojeBRT();
  const minimoAte = useMemo(() => {
    const isoDe = brParaISO(de);
    return isoDe && isoDe > hoje ? isoDe : hoje;
  }, [de, hoje]);

  function escolherData(dataBR: string) {
    if (calendario === "de") {
      setDe(dataBR);
      // Facilita o caso mais comum (bloquear UM dia) e conserta a janela
      // invertida na hora, em vez de esperar o erro no Salvar.
      const isoNovo = brParaISO(dataBR);
      const isoAte = brParaISO(ate);
      if (!ate || (isoNovo && isoAte && isoAte < isoNovo)) setAte(dataBR);
    } else if (calendario === "ate") {
      setAte(dataBR);
    }
    setErro(null);
    setCalendario(null);
  }

  return (
    <View style={styles.box}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="calendar-clear-outline" size={18} color={colors.brandMid} />
          <Text style={styles.titulo}>{t("Disponibilidade")}</Text>
        </View>
        {!aberto && (
          <Pressable onPress={() => setAberto(true)} hitSlop={6}>
            <Text style={styles.linkAcao}>{t("+ Bloquear datas")}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.hint}>
        {t("Por padrão você está disponível. Bloqueie as datas em que não pode servir (viagem, prova, etc.) — a coordenação não vai te escalar nesse período.")}
      </Text>

      {carregando ? (
        <ActivityIndicator color={colors.primary} />
      ) : erro && !aberto ? (
        <View style={styles.erroBox}>
          <Text style={styles.erro}>{erro}</Text>
          <Pressable onPress={carregar} hitSlop={6}>
            <Text style={styles.linkAcao}>{t("Tentar de novo")}</Text>
          </Pressable>
        </View>
      ) : itens.length === 0 ? (
        <Text style={styles.semNada}>{t("Nenhum bloqueio. Você está disponível!")}</Text>
      ) : (
        itens.map((i) => (
          <View key={i.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemPeriodo}>
                {fmtIso(i.unavailable_from)}
                {i.unavailable_from !== i.unavailable_to ? ` – ${fmtIso(i.unavailable_to)}` : ""}
              </Text>
              {!!i.reason && <Text style={styles.itemMotivo}>{i.reason}</Text>}
            </View>
            <Pressable
              onPress={() => confirmarRemocao(i)}
              hitSlop={8}
              style={({ pressed }) => [styles.removerBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}

      {/*
        ⚠️ O formulário virou MODAL (07/08). Inline, ele ficava no meio de uma
        tela longa: o teclado subia e cobria justamente o campo que estava sendo
        preenchido ("a interface é ruim de ver os dados"). Aqui ele tem a tela
        toda e o `KeyboardAvoidingView` é dele, não da tela hospedeira.
      */}
      <Modal
        visible={aberto}
        transparent
        animationType="fade"
        onRequestClose={fecharForm}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalFundo}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCartao}>
            <View style={styles.topo}>
              <Text style={styles.titulo}>{t("Bloquear datas")}</Text>
              <Pressable onPress={fecharForm} hitSlop={10} accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.form}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.row2}>
                <CampoData
                  label={t("De")}
                  valor={de}
                  onPress={() => setCalendario("de")}
                  colors={colors}
                  placeholder={t("Escolher")}
                />
                <CampoData
                  label={t("Até")}
                  valor={ate}
                  onPress={() => setCalendario("ate")}
                  colors={colors}
                  placeholder={t("Escolher")}
                />
              </View>

              <Input
                label={t("Motivo (opcional)")}
                value={motivo}
                onChangeText={setMotivo}
                placeholder={t("Viagem, prova, etc.")}
                returnKeyType="done"
              />

              {!!erro && <Text style={styles.erro}>{erro}</Text>}
            </ScrollView>

            <View style={styles.botoes}>
              <Button title={t("Cancelar")} variant="ghost" onPress={fecharForm} />
              <Button title={t("Salvar")} onPress={salvar} loading={salvando} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CalendarioBR
        visivel={calendario !== null}
        titulo={calendario === "ate" ? t("Até que dia?") : t("A partir de que dia?")}
        valor={calendario === "ate" ? ate : de}
        // Só a data FINAL tem piso: bloqueio que começou ontem e termina semana
        // que vem é legítimo, e é o fim dele que protege a escala.
        minimoISO={calendario === "ate" ? minimoAte : null}
        hojeISO={hoje}
        onFechar={() => setCalendario(null)}
        onEscolher={escolherData}
      />
    </View>
  );
}

function CampoData({
  label,
  valor,
  placeholder,
  onPress,
  colors,
}: {
  label: string;
  valor: string;
  placeholder: string;
  onPress: () => void;
  colors: Palette;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Text style={styles.campoLabel}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.campoData, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${valor || placeholder}`}
      >
        <Text style={valor ? styles.campoValor : styles.campoPlaceholder}>
          {valor || placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>
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
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    topo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    hint: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    linkAcao: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
    semNada: { color: colors.textMuted, fontSize: font.size.sm, paddingVertical: spacing.sm },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    itemPeriodo: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    itemMotivo: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    removerBtn: { padding: 6 },
    modalFundo: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    modalCartao: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "80%",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.md,
    },
    form: { gap: spacing.sm, paddingBottom: spacing.sm },
    row2: { flexDirection: "row", gap: spacing.sm },
    botoes: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    erroBox: { gap: spacing.xs, paddingVertical: spacing.sm },
    erro: { color: colors.danger, fontSize: font.size.sm },
    campoLabel: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    campoData: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: 52,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    campoValor: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    campoPlaceholder: { color: colors.textMuted, fontSize: font.size.md },
  });
