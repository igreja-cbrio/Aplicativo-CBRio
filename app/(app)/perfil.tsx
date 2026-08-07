import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { GlassCard } from "@/components/ui/GlassCard";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { subirUmNivel } from "@/lib/hierarquia";
import { useMembro } from "@/lib/useMembro";
import { supabase } from "@/lib/supabase";
import { salvarPerfilMembro } from "@/lib/api";
import {
  dateBRToISO,
  isValidDateBR,
  maskCPF,
  maskDateBR,
} from "@/lib/validators";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

function isoToBR(iso?: string | null) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export default function PerfilScreen() {
  const { user } = useAuth();
  const { reload: reloadMembro } = useMembro();
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
          // Cadastro soft-deletado não serve o app (mesma régua do backend).
          .is("deleted_at", null)
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
      reloadMembro(); // atualiza o avatar compartilhado (Home, Menu, etc.)
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
    if (!name.trim()) {
      setMsg({ type: "err", text: "Informe seu nome completo." });
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

      // 2) Salva a ficha PELO BACKEND (06/08/2026 · auditoria).
      //
      // ⚠️⚠️ Aqui rodava a RPC `app_salvar_membro`, que procurava um cadastro por
      // CPF **ou telefone ou NOME EXATO** e vinculava a conta ao primeiro que
      // achasse, SEM prova de posse — qualquer pessoa logada digitava o nome de
      // um homônimo e passava a ver o grupo, o comprovante de contribuições e os
      // FILHOS NO KIDS de outra. A RPC já foi estreitada no servidor; esta tela
      // deixar de chamá-la é o que permite dropá-la de vez.
      //
      // ⚠️ CPF NÃO VAI DAQUI: vincular conta a cadastro é ato de IDENTIDADE e só
      // acontece em `/completar-cadastro` (CPF acha o cadastro → código vai pro
      // contato DO CADASTRO → quem prova posse é vinculado).
      const membroSalvo = await salvarPerfilMembro({
        nome: name.trim() || null,
        telefone: telefone.trim() || null,
        data_nascimento: nascimento ? dateBRToISO(nascimento) : null,
      });
      const vId = membroSalvo?.id || null;
      if (vId) setMembroId(vId);

      // 3) E-mail (via auth — pode exigir confirmação)
      let emailAviso = false;
      if (email.trim() && email.trim() !== user.email) {
        const { error: eErr } = await supabase.auth.updateUser(
          { email: email.trim() },
          // Sem emailRedirectTo o link de confirmação cai na site_url do
          // projeto (o sistema interno). cbrio:// traz de volta pro app.
          { emailRedirectTo: "cbrio://perfil" }
        );
        if (eErr) throw eErr;
        emailAviso = true;
      }

      // 4) Reflete o que o SERVIDOR gravou (a resposta já é a linha salva —
      //    uma consulta a menos, e sem risco de ler algo diferente do que foi
      //    gravado).
      if (membroSalvo) {
        if (membroSalvo.nome) setName(membroSalvo.nome);
        setCpf(membroSalvo.cpf ? maskCPF(membroSalvo.cpf) : cpf);
        setNascimento(isoToBR(membroSalvo.data_nascimento));
        if (membroSalvo.telefone) setTelefone(membroSalvo.telefone);
        if (membroSalvo.foto_url) setAvatarUrl((prev) => prev ?? membroSalvo.foto_url);
      }

      reloadMembro(); // propaga nome/CPF/telefone/vínculo pras outras telas
      setMsg({ type: "ok", text: "Perfil salvo." });
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
      <TecladoSeguro        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back}>
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

          {/* Cartão de Membro — saiu do menu e passou a viver aqui (pedido do
              Marcos, 04/08/2026), com a instrução de uso na própria linha:
              antes era só "Meus cartões" e ninguém sabia pra que servia. */}
          <GlassCard style={styles.cartoesCard}>
            <Pressable
              style={styles.cartoesRow}
              onPress={() => router.navigate("/cartoes")}
            >
              <Ionicons name="card-outline" size={22} color={colors.brandMid} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cartoesText}>Cartão de Membro</Text>
                <Text style={styles.cartoesHint}>
                  Apresente o QR na entrada dos cultos e eventos. Toque no cartão pra virar.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </GlassCard>

          <View style={styles.form}>
            <Input
              label="Nome completo"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <View>
              {/* ⚠️ SOMENTE LEITURA (06/08/2026): o CPF deixou de ser editável aqui
                  porque o endpoint de perfil não o aceita — trocar CPF é ato de
                  IDENTIDADE (`/completar-cadastro`, com código pro contato do
                  cadastro). Deixar o campo editável seria a tela prometendo uma
                  gravação que não acontece, que é o defeito que estamos tirando. */}
              <Input
                label="CPF"
                value={cpf}
                editable={false}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
              />
              <Text style={styles.lockHint}>
                O CPF identifica seu cadastro na CBRio e não é alterado por aqui —
                se estiver errado, fale com a secretaria.
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
      </TecladoSeguro>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },
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
    cartoesCard: { borderRadius: radius.lg },
    cartoesRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    cartoesText: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    cartoesHint: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2, lineHeight: 18 },
    form: { gap: spacing.md },
    lockHint: {
      color: colors.textMuted,
      fontSize: font.size.sm,
      marginTop: spacing.xs,
    },
    ok: { color: colors.success, fontSize: font.size.sm },
    err: { color: colors.danger, fontSize: font.size.sm },
  });
