import { useEffect, useMemo, useState } from "react";
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
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import {
  dateBRToISO,
  isValidDateBR,
  maskCPF,
  maskDateBR,
} from "@/lib/validators";
import { font, radius, spacing, type Palette } from "@/constants/theme";

function isoToBR(iso?: string | null) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export default function PerfilScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, cpf, telefone, data_nascimento")
        .eq("id", user.id)
        .single();
      if (data) {
        setNome(data.nome ?? "");
        setCpf(data.cpf ? maskCPF(data.cpf) : "");
        setTelefone(data.telefone ?? "");
        setNascimento(isoToBR(data.data_nascimento));
      }
      setLoading(false);
    })();
  }, [user?.id]);

  async function handleSave() {
    setMsg(null);
    if (!user?.id) {
      setMsg({ type: "err", text: "Faça login para editar o perfil." });
      return;
    }
    if (nascimento && !isValidDateBR(nascimento)) {
      setMsg({ type: "err", text: "Data de nascimento inválida (DD/MM/AAAA)." });
      return;
    }
    setSaving(true);
    try {
      // Atualiza dados do perfil (telefone e nascimento)
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          telefone: telefone.trim() || null,
          data_nascimento: nascimento ? dateBRToISO(nascimento) : null,
        })
        .eq("id", user.id);
      if (pErr) throw pErr;

      // Atualiza e-mail (se mudou) — pode exigir confirmação por e-mail
      let emailAviso = false;
      if (email.trim() && email.trim() !== user.email) {
        const { error: eErr } = await supabase.auth.updateUser({
          email: email.trim(),
        });
        if (eErr) throw eErr;
        emailAviso = true;
      }

      setMsg({ type: "ok", text: "Perfil atualizado com sucesso." });
      if (emailAviso) {
        Alert.alert(
          "Confirme o novo e-mail",
          "Enviamos um link para o novo e-mail. A troca só conclui após a confirmação."
        );
      }
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Não foi possível salvar.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cabeçalho com voltar + avatar */}
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>Meu perfil</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <CbrioHeart size={48} color={colors.brandPale} />
            </View>
            <Text style={styles.avatarHint}>Foto de perfil em breve</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Nome completo"
              value={nome}
              onChangeText={setNome}
              editable={false}
            />
            <View>
              <Input label="CPF" value={cpf} editable={false} />
              <Text style={styles.lockHint}>O CPF não pode ser alterado.</Text>
            </View>
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <Input
              label="Telefone"
              value={telefone}
              onChangeText={setTelefone}
              placeholder="+55 21 99999-9999"
              keyboardType="phone-pad"
            />
            <Input
              label="Data de nascimento"
              value={nascimento}
              onChangeText={(t) => setNascimento(maskDateBR(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
            />

            {msg && (
              <Text style={msg.type === "ok" ? styles.ok : styles.err}>
                {msg.text}
              </Text>
            )}

            <Button
              title="Salvar alterações"
              onPress={handleSave}
              loading={saving || loading}
            />
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
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    avatarWrap: { alignItems: "center", gap: spacing.xs },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarHint: { color: colors.textMuted, fontSize: font.size.sm },
    form: { gap: spacing.md },
    lockHint: {
      color: colors.textMuted,
      fontSize: font.size.sm,
      marginTop: spacing.xs,
    },
    ok: { color: colors.success, fontSize: font.size.sm },
    err: { color: colors.danger, fontSize: font.size.sm },
  });
