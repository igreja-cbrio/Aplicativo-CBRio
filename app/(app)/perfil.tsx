import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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
  isValidCPF,
  isValidDateBR,
  maskCPF,
  maskDateBR,
  onlyDigits,
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

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [membroId, setMembroId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      // profiles (sistema): name, email, telefone, avatar_url, membro_id
      const { data: prof } = await supabase
        .from("profiles")
        .select("name, email, telefone, avatar_url, membro_id")
        .eq("id", user.id)
        .maybeSingle();
      if (prof) {
        setName(prof.name ?? "");
        setEmail(prof.email ?? user.email ?? "");
        setTelefone(prof.telefone ?? "");
        setAvatarUrl(prof.avatar_url ?? null);
        setMembroId(prof.membro_id ?? null);
      }
      // mem_membros: cpf, data_nascimento, etc. (via membro_id)
      if (prof?.membro_id != null) {
        const { data: m } = await supabase
          .from("mem_membros")
          .select("nome, cpf, data_nascimento, telefone, foto_url")
          .eq("id", prof.membro_id)
          .maybeSingle();
        if (m) {
          setCpf(m.cpf ? maskCPF(m.cpf) : "");
          setNascimento(isoToBR(m.data_nascimento));
          if (!prof.name && m.nome) setName(m.nome);
          if (!prof.telefone && m.telefone) setTelefone(m.telefone);
          if (!prof.avatar_url && m.foto_url) setAvatarUrl(m.foto_url);
        }
      }
      setLoading(false);
    })();
  }, [user?.id]);

  async function escolherFoto() {
    if (!user?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permissão necessária",
        "Permita o acesso às fotos para escolher um avatar."
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    setMsg(null);
    setUploading(true);
    try {
      const resp = await fetch(asset.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType ?? `image/${ext}`,
          upsert: true,
        });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      setAvatarUrl(publicUrl);
      setMsg({ type: "ok", text: "Foto de perfil atualizada." });
    } catch (e) {
      setMsg({
        type: "err",
        text:
          e instanceof Error
            ? `Falha ao enviar a foto: ${e.message}`
            : "Falha ao enviar a foto.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setMsg(null);
    if (!user?.id) {
      setMsg({ type: "err", text: "Faça login para editar o perfil." });
      return;
    }
    const cpfDigits = onlyDigits(cpf);
    if (!name.trim()) {
      setMsg({ type: "err", text: "Informe seu nome completo." });
      return;
    }
    if (cpf && !isValidCPF(cpf)) {
      setMsg({ type: "err", text: "CPF inválido." });
      return;
    }
    if (nascimento && !isValidDateBR(nascimento)) {
      setMsg({ type: "err", text: "Data de nascimento inválida (DD/MM/AAAA)." });
      return;
    }
    setSaving(true);
    try {
      // 1) Atualiza a própria linha em profiles (nome + telefone)
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ name: name.trim(), telefone: telefone.trim() || null })
        .eq("id", user.id);
      if (pErr) throw pErr;

      // 2) Vincula/cria/atualiza o membro no servidor (cruza CPF, telefone ou
      //    nome; contorna o RLS com segurança, só no próprio cadastro).
      const { data: vId, error: rErr } = await supabase.rpc("app_salvar_membro", {
        p_cpf: cpfDigits || null,
        p_nome: name.trim() || null,
        p_telefone: telefone.trim() || null,
        p_email: email.trim() || null,
        p_nascimento: nascimento ? dateBRToISO(nascimento) : null,
      });
      if (rErr) throw rErr;
      if (vId) setMembroId(vId as string);

      // 3) E-mail (via auth — pode exigir confirmação)
      let emailAviso = false;
      if (email.trim() && email.trim() !== user.email) {
        const { error: eErr } = await supabase.auth.updateUser({
          email: email.trim(),
        });
        if (eErr) throw eErr;
        emailAviso = true;
      }

      // 4) Recarrega os dados do membro vinculado
      if (vId) {
        const { data: m } = await supabase
          .from("mem_membros")
          .select("nome, cpf, data_nascimento, telefone, foto_url")
          .eq("id", vId as string)
          .maybeSingle();
        if (m) {
          if (m.nome) setName(m.nome);
          setCpf(m.cpf ? maskCPF(m.cpf) : cpf);
          setNascimento(isoToBR(m.data_nascimento));
          if (m.telefone) setTelefone(m.telefone);
          if (m.foto_url) setAvatarUrl((prev) => prev ?? m.foto_url);
        }
      }

      setMsg({ type: "ok", text: "Perfil salvo e vinculado ao seu cadastro." });
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
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>Meu perfil</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.avatarWrap}>
            <Pressable
              style={styles.avatar}
              onPress={escolherFoto}
              disabled={uploading || !user?.id}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <CbrioHeart size={48} color={colors.brandPale} />
              )}
              <View style={styles.avatarBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={16} color="#fff" />
                )}
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>Toque para trocar a foto</Text>
          </View>

          <Pressable
            style={styles.cartoesRow}
            onPress={() => router.navigate("/cartoes")}
          >
            <Ionicons name="card-outline" size={22} color={colors.brandMid} />
            <Text style={styles.cartoesText}>Meus cartões</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={styles.form}>
            <Input
              label="Nome completo"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <View>
              <Input
                label="CPF"
                value={cpf}
                onChangeText={(t) => setCpf(maskCPF(t))}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
              />
              <Text style={styles.lockHint}>
                Informe seu CPF e salve para vincular ao seu cadastro na CBRio.
              </Text>
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
    avatarImg: { width: 96, height: 96, borderRadius: radius.full },
    avatarBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 30,
      height: 30,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    avatarHint: { color: colors.textMuted, fontSize: font.size.sm },
    cartoesRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    cartoesText: { flex: 1, color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    form: { gap: spacing.md },
    lockHint: {
      color: colors.textMuted,
      fontSize: font.size.sm,
      marginTop: spacing.xs,
    },
    ok: { color: colors.success, fontSize: font.size.sm },
    err: { color: colors.danger, fontSize: font.size.sm },
  });
