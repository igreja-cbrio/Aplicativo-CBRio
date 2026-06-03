import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { criarInscricao } from "@/lib/inscricoes";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export default function VoluntariadoScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (membro) {
      setNome((v) => v || membro.nome);
      setTelefone((v) => v || membro.telefone);
      setEmail((v) => v || membro.email);
    }
  }, [membro]);

  async function enviar() {
    setError(null);
    if (!nome || !telefone) {
      setError("Preencha pelo menos nome e telefone.");
      return;
    }
    setEnviando(true);
    try {
      const partes = nome.trim().split(/\s+/);
      await criarInscricao(
        "voluntariado",
        {
          nome: partes[0],
          sobrenome: partes.slice(1).join(" "),
          nome_completo: nome.trim(),
          telefone: telefone.trim(),
          email: email.trim(),
          cpf: membro?.cpf || null,
          area_interesse: area.trim() || null,
          disponibilidade: disponibilidade.trim() || null,
          membro_id: membro?.membroId ?? null,
        },
        user?.id
      );
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="hand-left" size={28} color={colors.brandPale} />
            </View>
            <Text style={styles.title}>Voluntariado</Text>
            <Text style={styles.subtitle}>
              Sirva com a gente na CBRio. Preencha e nossa equipe entra em contato.
            </Text>
          </View>

          {enviado ? (
            <View style={styles.card}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              <Text style={styles.okTitle}>Inscrição enviada!</Text>
              <Text style={styles.okText}>
                Recebemos sua inscrição de voluntariado. Em breve a equipe da CBRio
                fala com você. 💙
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              <Input label="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" />
              <Input
                label="Telefone"
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                placeholder="+55 21 99999-9999"
              />
              <Input label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Input
                label="Área de interesse (opcional)"
                value={area}
                onChangeText={setArea}
                placeholder="Ex.: louvor, recepção, kids, mídia…"
              />
              <Input
                label="Disponibilidade (opcional)"
                value={disponibilidade}
                onChangeText={setDisponibilidade}
                placeholder="Ex.: domingos à noite"
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Button
                title="Quero ser voluntário"
                onPress={enviar}
                loading={enviando || loading}
              />
            </View>
          )}

          {/* Self-service de escalas (em breve) */}
          <View style={styles.soon}>
            <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            <Text style={styles.soonText}>
              Em breve: suas escalas e avisos quando você for escalado.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
    header: { alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
    badge: {
      width: 72,
      height: 72,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    title: { color: colors.text, fontSize: font.size.xl, fontWeight: "800" },
    subtitle: {
      color: colors.textMuted,
      fontSize: font.size.md,
      textAlign: "center",
      lineHeight: 22,
    },
    form: { gap: spacing.md },
    error: { color: colors.danger, fontSize: font.size.sm },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.sm,
    },
    okTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    okText: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    soon: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.md,
    },
    soonText: { flex: 1, color: colors.textMuted, fontSize: font.size.sm },
  });
