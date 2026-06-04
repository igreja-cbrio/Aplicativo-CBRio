import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  useTheme,
  type ThemePreference,
  type FontScale,
} from "@/contexts/ThemeContext";
import { LANGS, useLang } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const TEMA_OPCOES: { key: ThemePreference; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "system", label: "Sistema", icon: "phone-portrait-outline" },
  { key: "light", label: "Claro", icon: "sunny-outline" },
  { key: "dark", label: "Escuro", icon: "moon-outline" },
];

const FONTE_OPCOES: { key: FontScale; label: string }[] = [
  { key: "sm", label: "Pequena" },
  { key: "md", label: "Normal" },
  { key: "lg", label: "Grande" },
  { key: "xl", label: "Muito grande" },
];

const PAGAMENTO_OPCOES = [
  { key: "pix", label: "PIX" },
  { key: "credito", label: "Cartão de crédito (em breve)", disabled: true },
  { key: "debito", label: "Cartão de débito (em breve)", disabled: true },
];

const MOTIVOS_EXCLUSAO = [
  { key: "saiu_igreja", label: "Saí da igreja" },
  { key: "trocou_igreja", label: "Mudei de igreja" },
  { key: "nao_uso_app", label: "Não uso mais o app" },
  { key: "privacidade", label: "Privacidade / dados" },
  { key: "outro", label: "Outro motivo" },
];

export default function ConfiguracoesScreen() {
  const { colors, preference, setPreference, fontScale, setFontScale } = useTheme();
  const { user, signOut } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const { lang, setLang } = useLang();
  const [pagamento, setPagamento] = useState("pix");
  const [notifAtivas, setNotifAtivas] = useState<boolean | null>(null);

  // Estado do fluxo "excluir conta"
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  // Lê permissão de push na hora que abre.
  useState(() => {
    Notifications.getPermissionsAsync().then((p) => setNotifAtivas(p.status === "granted"));
    return undefined;
  });

  async function alternarNotificacoes(valor: boolean) {
    if (!valor) {
      Alert.alert(
        "Desativar notificações",
        "Pra desativar, abra as Configurações do sistema e desligue as notificações do CBRio.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Abrir Configurações", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const req = await Notifications.requestPermissionsAsync();
    setNotifAtivas(req.status === "granted");
    if (req.status !== "granted") {
      Alert.alert(
        "Permissão necessária",
        "Você precisa autorizar as notificações nas Configurações do sistema."
      );
    }
  }

  async function confirmarExclusao() {
    if (!motivo) {
      setErroExclusao("Escolha um motivo.");
      return;
    }
    if (!user?.id) return;
    setErroExclusao(null);
    setExcluindo(true);
    try {
      // Grava o pedido de exclusão (soft delete + motivo). O sistema
      // processa de fato no backend.
      const { error: e1 } = await supabase
        .from("app_solicitacoes_exclusao")
        .insert({
          user_id: user.id,
          motivo,
          detalhe: detalhe.trim() || null,
        });
      if (e1) throw e1;

      // Marca a profile como pendente de exclusão.
      const { error: e2 } = await supabase
        .from("profiles")
        .update({ status: "excluido_solicitado" })
        .eq("id", user.id);
      // Não falha o fluxo se a coluna não existir (e2 vira erro mas seguimos).
      if (e2) console.log("[exclusao] não atualizou profiles.status:", e2.message);

      Alert.alert(
        "Solicitação registrada",
        "Recebemos seu pedido. Em breve sua conta será desativada. Vamos sentir sua falta. 💙",
        [
          {
            text: "Ok",
            onPress: async () => {
              await signOut();
            },
          },
        ]
      );
    } catch (e) {
      setErroExclusao(e instanceof Error ? e.message : "Falha ao solicitar exclusão.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Configurações</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* APARÊNCIA */}
        <Section title="Aparência" colors={colors} styles={styles}>
          <Text style={styles.label}>Tema</Text>
          <View style={styles.row}>
            {TEMA_OPCOES.map((o) => {
              const sel = preference === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={[styles.optChip, sel && styles.optChipSel]}
                  onPress={() => setPreference(o.key)}
                >
                  <Ionicons name={o.icon} size={16} color={sel ? "#fff" : colors.textMuted} />
                  <Text style={[styles.optTxt, sel && styles.optTxtSel]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Tamanho da fonte</Text>
          <View style={styles.row}>
            {FONTE_OPCOES.map((o) => {
              const sel = fontScale === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={[styles.optChip, sel && styles.optChipSel]}
                  onPress={() => setFontScale(o.key)}
                >
                  <Text style={[styles.optTxt, sel && styles.optTxtSel]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            Para o novo tamanho valer em todo o app, feche e abra o aplicativo de novo.
          </Text>
        </Section>

        {/* IDIOMA */}
        <Section title="Idioma" colors={colors} styles={styles}>
          <Text style={styles.hint}>
            Por enquanto só o português tem tradução completa; os demais
            ficam disponíveis nas próximas atualizações.
          </Text>
          {LANGS.map((o) => (
            <RadioRow
              key={o.code}
              label={`${o.bandeira}  ${o.label}${!o.pronto ? "  (em breve)" : ""}`}
              checked={lang === o.code}
              disabled={!o.pronto}
              onPress={() => o.pronto && setLang(o.code)}
              colors={colors}
              styles={styles}
            />
          ))}
        </Section>

        {/* PAGAMENTO */}
        <Section title="Forma de pagamento" colors={colors} styles={styles}>
          <Text style={styles.hint}>
            Usado para a Generosidade dentro do app (em breve).
          </Text>
          {PAGAMENTO_OPCOES.map((o) => (
            <RadioRow
              key={o.key}
              label={o.label}
              checked={pagamento === o.key}
              disabled={o.disabled}
              onPress={() => !o.disabled && setPagamento(o.key)}
              colors={colors}
              styles={styles}
            />
          ))}
        </Section>

        {/* NOTIFICAÇÕES */}
        <Section title="Notificações" colors={colors} styles={styles}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Receber notificações</Text>
              <Text style={styles.hint}>
                Escalas, pedidos de oração, novidades e mais.
              </Text>
            </View>
            <Switch
              value={!!notifAtivas}
              onValueChange={alternarNotificacoes}
              trackColor={{ true: colors.primary, false: colors.glassBorder }}
            />
          </View>
          <Button
            title="Abrir configurações do sistema"
            variant="ghost"
            onPress={() => Linking.openSettings()}
          />
        </Section>

        {/* EXCLUIR CONTA */}
        <Section title="Conta" colors={colors} styles={styles}>
          {!excluirAberto ? (
            <Pressable
              style={styles.dangerRow}
              onPress={() => setExcluirAberto(true)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={styles.dangerTxt}>Excluir minha conta</Text>
            </Pressable>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.label}>Por que você quer excluir sua conta?</Text>
              {MOTIVOS_EXCLUSAO.map((m) => (
                <RadioRow
                  key={m.key}
                  label={m.label}
                  checked={motivo === m.key}
                  onPress={() => setMotivo(m.key)}
                  colors={colors}
                  styles={styles}
                />
              ))}
              <Input
                label="Quer contar mais? (opcional)"
                value={detalhe}
                onChangeText={setDetalhe}
                placeholder="Algo que possamos melhorar"
                multiline
                numberOfLines={3}
              />
              {erroExclusao && <Text style={styles.erro}>{erroExclusao}</Text>}
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => {
                    setExcluirAberto(false);
                    setMotivo(null);
                    setDetalhe("");
                    setErroExclusao(null);
                  }}
                />
                <Button
                  title="Confirmar exclusão"
                  onPress={confirmarExclusao}
                  loading={excluindo}
                />
              </View>
              <Text style={styles.hint}>
                Você sai do app agora. Sua conta entra em processo de exclusão e
                não poderá mais ser usada.
              </Text>
            </View>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  colors,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function RadioRow({
  label,
  checked,
  disabled,
  onPress,
  colors,
  styles,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      style={[styles.radioRow, disabled && { opacity: 0.4 }]}
      onPress={() => !disabled && onPress()}
      disabled={disabled}
    >
      <View style={[styles.radio, checked && styles.radioSel]}>
        {checked && <View style={styles.radioDot} />}
      </View>
      <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.lg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    section: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    sectionTitle: { fontSize: font.size.md, fontWeight: "800", marginBottom: spacing.xs },
    label: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    hint: { color: colors.textMuted, fontSize: 12 },
    row: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
    optChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surfaceAlt,
    },
    optChipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    optTxt: { color: colors.textMuted, fontWeight: "700", fontSize: font.size.sm },
    optTxtSel: { color: "#fff" },
    switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    radioRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSel: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    radioLabel: { fontSize: font.size.md, flex: 1 },
    dangerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    dangerTxt: { color: colors.danger, fontSize: font.size.md, fontWeight: "700" },
    erro: { color: colors.danger, fontSize: font.size.sm },
  });
