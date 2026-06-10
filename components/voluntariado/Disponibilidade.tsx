import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useColors } from "@/contexts/ThemeContext";
import {
  listarIndisponibilidades,
  adicionarIndisponibilidade,
  removerIndisponibilidade,
  type Indisponibilidade,
} from "@/lib/disponibilidade";
import {
  dateBRToISO,
  isValidDateBR,
  maskDateBR,
} from "@/lib/validators";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

function fmtIso(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
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

  const carregar = useCallback(async () => {
    setCarregando(true);
    const lista = await listarIndisponibilidades(volProfileId);
    setItens(lista);
    setCarregando(false);
  }, [volProfileId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    setErro(null);
    if (!isValidDateBR(de)) {
      setErro(t("Data de início inválida (DD/MM/AAAA)."));
      return;
    }
    if (!isValidDateBR(ate)) {
      setErro(t("Data de fim inválida (DD/MM/AAAA)."));
      return;
    }
    const isoDe = dateBRToISO(de);
    const isoAte = dateBRToISO(ate);
    if (!isoDe || !isoAte) {
      setErro(t("Data inválida."));
      return;
    }
    if (isoAte < isoDe) {
      setErro(t("A data final precisa ser igual ou depois da inicial."));
      return;
    }
    setSalvando(true);
    try {
      await adicionarIndisponibilidade(volProfileId, isoDe, isoAte, motivo);
      setDe("");
      setAte("");
      setMotivo("");
      setAberto(false);
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

      {aberto && (
        <View style={styles.form}>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Input
                label={t("De")}
                value={de}
                onChangeText={(v) => setDe(maskDateBR(v))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t("Até")}
                value={ate}
                onChangeText={(v) => setAte(maskDateBR(v))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>
          <Input
            label={t("Motivo (opcional)")}
            value={motivo}
            onChangeText={setMotivo}
            placeholder={t("Viagem, prova, etc.")}
          />
          {!!erro && <Text style={styles.erro}>{erro}</Text>}
          <View style={styles.botoes}>
            <Button
              title={t("Cancelar")}
              variant="ghost"
              onPress={() => {
                setAberto(false);
                setErro(null);
                setDe("");
                setAte("");
                setMotivo("");
              }}
            />
            <Button title={t("Salvar")} onPress={salvar} loading={salvando} />
          </View>
        </View>
      )}
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
    form: { gap: spacing.sm, marginTop: spacing.sm },
    row2: { flexDirection: "row", gap: spacing.sm },
    botoes: { flexDirection: "row", gap: spacing.sm },
    erro: { color: colors.danger, fontSize: font.size.sm },
  });
