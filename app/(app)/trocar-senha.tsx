import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { font, spacing, type Palette } from "@/constants/theme";

export default function TrocarSenha() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { user, updatePassword } = useAuth();

  const [atual, setAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (senha.length < 8) {
      Alert.alert(t("Senha curta"), t("Use pelo menos 8 caracteres."));
      return;
    }
    if (senha !== confirma) {
      Alert.alert(t("Confira a senha"), t("As senhas digitadas não são iguais."));
      return;
    }
    if (senha === atual) {
      Alert.alert(t("Senha igual"), t("A nova senha precisa ser diferente da atual."));
      return;
    }
    setSalvando(true);
    try {
      // Confirma a senha atual antes de trocar (segurança: garante que é o dono
      // da conta). Re-sign-in não derruba a sessão — é o mesmo usuário.
      if (user?.email) {
        const { error: reauth } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: atual,
        });
        if (reauth) {
          setSalvando(false);
          Alert.alert(t("Senha atual incorreta"), t("Confira sua senha atual e tente de novo."));
          return;
        }
      }
      await updatePassword(senha);
      Alert.alert(t("Senha alterada ✅"), t("Pronto! Sua senha foi atualizada."));
      router.back();
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível trocar a senha."));
    }
    setSalvando(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("Trocar senha")}</Text>
            <View style={{ width: 24 }} />
          </View>

          <Text style={styles.texto}>{t("Escolha uma nova senha para sua conta.")}</Text>

          <Input
            label={t("Senha atual")}
            value={atual}
            onChangeText={setAtual}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
          />
          <Input
            label={t("Nova senha")}
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
          />
          <Input
            label={t("Confirmar nova senha")}
            value={confirma}
            onChangeText={setConfirma}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
          />

          <Button
            title={salvando ? t("Salvando…") : t("Salvar nova senha")}
            onPress={salvar}
            disabled={salvando}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    texto: { color: colors.textMuted, fontSize: font.size.md, marginBottom: spacing.xs },
  });
