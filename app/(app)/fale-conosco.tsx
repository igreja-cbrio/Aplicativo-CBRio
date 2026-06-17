import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMembro } from "@/lib/useMembro";
import { criarInscricao } from "@/lib/inscricoes";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const WHATSAPP = "https://wa.me/5521997567770";
const INSTAGRAM = "https://instagram.com/igrejacbrio";
const EMAIL = "contato@cbrio.com.br";
const MAPS = "https://maps.apple.com/?q=CBRio+Barra+da+Tijuca";

export default function FaleConoscoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { user } = useAuth();
  const { membro } = useMembro();

  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!mensagem.trim()) {
      Alert.alert(t("Escreva sua mensagem"), t("Conte pra gente o que você precisa."));
      return;
    }
    setEnviando(true);
    try {
      await criarInscricao(
        "contato",
        {
          mensagem: mensagem.trim(),
          nome: membro?.nome || null,
          email: membro?.email || user?.email || null,
          telefone: membro?.telefone || null,
          membro_id: membro?.membroId ?? null,
        },
        user?.id
      );
      setMensagem("");
      Alert.alert(t("Mensagem enviada 💙"), t("Recebemos seu contato. Nossa equipe vai te responder em breve."));
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível enviar."));
    }
    setEnviando(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("Fale conosco")}</Text>
            <View style={{ width: 24 }} />
          </View>

          <Text style={styles.intro}>{t("Estamos aqui pra você. Escolha um canal ou mande uma mensagem.")}</Text>

          {/* Canais diretos */}
          <View style={styles.canais}>
            <Canal icon="logo-whatsapp" label="WhatsApp" onPress={() => Linking.openURL(WHATSAPP)} colors={colors} styles={styles} t={t} />
            <Canal icon="mail" label="E-mail" onPress={() => Linking.openURL(`mailto:${EMAIL}`)} colors={colors} styles={styles} t={t} />
            <Canal icon="logo-instagram" label="Instagram" onPress={() => Linking.openURL(INSTAGRAM)} colors={colors} styles={styles} t={t} />
            <Canal icon="location" label={t("Como chegar")} onPress={() => Linking.openURL(MAPS)} colors={colors} styles={styles} t={t} />
          </View>

          {/* Formulário · sólido (form denso com textarea não usa glass · HIG) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Mande uma mensagem")}</Text>
            <Text style={styles.cardText}>{t("Dúvida, sugestão ou pedido — escreva aqui que a gente responde.")}</Text>
            <TextInput
              style={styles.textarea}
              value={mensagem}
              onChangeText={setMensagem}
              placeholder={t("Sua mensagem…")}
              placeholderTextColor={colors.textMuted}
              multiline
              accessibilityLabel={t("Sua mensagem")}
            />
            <Button title={t("Enviar")} onPress={enviar} loading={enviando} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Canal({
  icon, label, onPress, colors, styles, t,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  t: (s: string) => string;
}) {
  return (
    <Pressable style={styles.canal} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={colors.brandMid} />
      <Text style={styles.canalTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    intro: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 21 },
    canais: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    canal: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12,
      flexGrow: 1, flexBasis: "45%", minWidth: 0, justifyContent: "center",
    },
    canalTxt: { color: colors.text, fontSize: font.size.md, fontWeight: "600", flexShrink: 1 },
    card: { gap: spacing.sm, marginTop: spacing.sm, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg },
    cardTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
    cardText: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    textarea: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.md, padding: spacing.md, color: colors.text,
      fontSize: font.size.md, minHeight: 110, textAlignVertical: "top",
    },
  });
