import { useMemo, useState } from "react";
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
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";
import { apiPost } from "@/lib/api";
import { maskDateBR, isValidDateBR, dateBRToISO } from "@/lib/validators";
import { supabase } from "@/lib/supabase";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Slot = "crianca" | "pai" | "mae";
type Parentesco = "mae" | "pai" | "outro";

const BUCKET = "kids-documentos";

export default function KidsSolicitarVinculoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [parentesco, setParentesco] = useState<Parentesco>("mae");
  const [obs, setObs] = useState("");
  const [paths, setPaths] = useState<Partial<Record<Slot, string>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Slot, string>>>({});
  const [nomes, setNomes] = useState<Partial<Record<Slot, string | null>>>({});
  const [uploading, setUploading] = useState<Slot | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pegarImagem(fonte: "camera" | "galeria") {
    const perm =
      fonte === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("Permissão necessária"), t("Permita o acesso para enviar o documento."));
      return null;
    }
    const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsEditing: false } as const;
    const res = fonte === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return null;
    return res.assets[0];
  }

  function escolherDoc(slot: Slot) {
    Alert.alert(t("Enviar documento"), t("Como você quer enviar?"), [
      { text: t("Tirar foto"), onPress: () => enviarFoto(slot, "camera") },
      { text: t("Escolher da galeria"), onPress: () => enviarFoto(slot, "galeria") },
      { text: t("Enviar arquivo (PDF)"), onPress: () => enviarArquivo(slot) },
      { text: t("Cancelar"), style: "cancel" },
    ]);
  }

  async function enviarFoto(slot: Slot, fonte: "camera" | "galeria") {
    const asset = await pegarImagem(fonte);
    if (!asset) return;
    await uploadDoc(slot, { uri: asset.uri, mimeType: asset.mimeType ?? null, name: null });
  }

  async function enviarArquivo(slot: Slot) {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      await uploadDoc(slot, { uri: a.uri, mimeType: a.mimeType ?? null, name: a.name ?? null });
    } catch {
      Alert.alert(
        t("Arquivos indisponíveis"),
        t("Atualize o app para a versão mais recente para enviar arquivos. Por enquanto, use a câmera ou a galeria.")
      );
    }
  }

  // Upload genérico (foto ou arquivo) pro bucket privado.
  async function uploadDoc(slot: Slot, file: { uri: string; mimeType: string | null; name: string | null }) {
    if (!user?.id) return;
    setUploading(slot);
    try {
      const resp = await fetch(file.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const extDoNome = file.name && file.name.includes(".") ? file.name.split(".").pop() : null;
      const extDoUri = file.uri.split("?")[0].split(".").pop();
      const ext = (extDoNome || extDoUri || "jpg").toLowerCase();
      const path = `${user.id}/${slot}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: file.mimeType ?? (ext === "pdf" ? "application/pdf" : `image/${ext}`),
        upsert: true,
      });
      if (error) throw error;
      const ehImagem = ext !== "pdf";
      setPaths((p) => ({ ...p, [slot]: path }));
      setPreviews((p) => ({ ...p, [slot]: ehImagem ? file.uri : undefined }));
      setNomes((p) => ({ ...p, [slot]: ehImagem ? null : file.name || "Documento.pdf" }));
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Falha ao enviar o documento."));
    } finally {
      setUploading(null);
    }
  }

  async function enviar() {
    if (!nome.trim()) {
      Alert.alert(t("Falta o nome"), t("Informe o nome da criança."));
      return;
    }
    if (!paths.crianca) {
      Alert.alert(t("Falta documento"), t("Envie o documento da criança."));
      return;
    }
    if (!paths.pai && !paths.mae) {
      Alert.alert(t("Falta documento"), t("Envie o documento do pai e/ou da mãe."));
      return;
    }
    let dataISO: string | null = null;
    if (nascimento.trim()) {
      if (!isValidDateBR(nascimento)) {
        Alert.alert(t("Data inválida"), t("Use o formato DD/MM/AAAA."));
        return;
      }
      dataISO = dateBRToISO(nascimento);
    }
    setEnviando(true);
    try {
      await apiPost("/app/kids/solicitar-vinculo", {
        crianca_nome: nome.trim(),
        crianca_data_nascimento: dataISO,
        parentesco,
        observacao: obs.trim() || null,
        crianca_doc_path: paths.crianca,
        doc_pai_path: paths.pai || null,
        doc_mae_path: paths.mae || null,
      });
      Alert.alert(
        t("Solicitação enviada 💙"),
        t("A equipe Kids vai conferir os documentos e liberar o vínculo. Você acompanha o resultado na tela de Check-in Kids."),
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível enviar."));
    } finally {
      setEnviando(false);
    }
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
            <Text style={styles.title}>{t("Solicitar vínculo")}</Text>
            <View style={{ width: 24 }} />
          </View>

          <Text style={styles.intro}>
            {t("Para a segurança das crianças, o vínculo é conferido pela equipe Kids. Envie os documentos da criança e do(s) responsável(is); a equipe valida e libera.")}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>{t("Nome da criança")}</Text>
            <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder={t("Nome completo")} placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>{t("Data de nascimento")}</Text>
            <TextInput
              style={styles.input}
              value={nascimento}
              onChangeText={(v) => setNascimento(maskDateBR(v))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
            />

            <Text style={styles.label}>{t("Seu parentesco")}</Text>
            <View style={styles.segment}>
              {(["mae", "pai", "outro"] as Parentesco[]).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setParentesco(p)}
                  style={[styles.segItem, parentesco === p && styles.segItemOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: parentesco === p }}
                >
                  <Text style={[styles.segTxt, parentesco === p && styles.segTxtOn]}>
                    {p === "mae" ? t("Mãe") : p === "pai" ? t("Pai") : t("Outro")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Documentos")}</Text>
            <Text style={styles.cardText}>
              {t("Pode ser foto (câmera/galeria) ou arquivo (PDF). Documento da criança é obrigatório; do pai e/ou da mãe, envie pelo menos um.")}
            </Text>
            <DocSlot label={t("Documento da criança")} slot="crianca" obrigatorio preview={previews.crianca} fileName={nomes.crianca} done={!!paths.crianca} uploading={uploading === "crianca"} onPress={escolherDoc} styles={styles} colors={colors} />
            <DocSlot label={t("Documento do pai")} slot="pai" preview={previews.pai} fileName={nomes.pai} done={!!paths.pai} uploading={uploading === "pai"} onPress={escolherDoc} styles={styles} colors={colors} />
            <DocSlot label={t("Documento da mãe")} slot="mae" preview={previews.mae} fileName={nomes.mae} done={!!paths.mae} uploading={uploading === "mae"} onPress={escolherDoc} styles={styles} colors={colors} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t("Observação (opcional)")}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={obs}
              onChangeText={setObs}
              placeholder={t("Algo que a equipe precisa saber?")}
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>

          <Text style={styles.privacidade}>
            {t("🔒 Os documentos são privados, usados só para validar o vínculo, e visíveis apenas à equipe Kids.")}
          </Text>

          <Button title={t("Enviar solicitação")} onPress={enviar} loading={enviando} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DocSlot({
  label, slot, obrigatorio, preview, fileName, done, uploading, onPress, styles, colors,
}: {
  label: string;
  slot: Slot;
  obrigatorio?: boolean;
  preview?: string;
  fileName?: string | null;
  done: boolean;
  uploading: boolean;
  onPress: (slot: Slot) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.docSlot, pressed && { opacity: 0.7 }]} onPress={() => onPress(slot)} accessibilityRole="button" accessibilityLabel={label}>
      {preview ? (
        <Image source={{ uri: preview }} style={styles.docThumb} />
      ) : (
        <View style={[styles.docThumb, styles.docThumbEmpty]}>
          <Ionicons name={done ? (fileName ? "document-text" : "checkmark") : "cloud-upload-outline"} size={22} color={done ? "#3FA66B" : colors.brandMid} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.docLabel}>
          {label}{obrigatorio ? " *" : ""}
        </Text>
        <Text style={[styles.docStatus, done && { color: "#3FA66B" }]} numberOfLines={1}>
          {uploading ? "Enviando…" : done ? (fileName ? `${fileName} ✓` : "Enviado ✓ · toque pra trocar") : "Foto ou arquivo (PDF)"}
        </Text>
      </View>
      {uploading && <ActivityIndicator color={colors.brandMid} />}
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
    card: { gap: spacing.sm, padding: spacing.lg, alignItems: "stretch", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg },
    cardTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
    cardText: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    label: { color: colors.text, fontSize: font.size.sm, fontWeight: "600", marginTop: spacing.xs },
    input: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: font.size.md,
    },
    textarea: { minHeight: 80, textAlignVertical: "top" },
    segment: { flexDirection: "row", gap: spacing.sm },
    segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", backgroundColor: colors.surface },
    segItemOn: { backgroundColor: colors.brandMid, borderColor: colors.brandMid },
    segTxt: { color: colors.text, fontWeight: "600", fontSize: font.size.md },
    segTxtOn: { color: "#ffffff" },
    docSlot: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
    docThumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface },
    docThumbEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    docLabel: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    docStatus: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
    privacidade: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.sm },
  });
