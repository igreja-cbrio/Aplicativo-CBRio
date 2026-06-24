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
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { useColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";
import { apiPost } from "@/lib/api";
import { maskDateBR, isValidDateBR, dateBRToISO } from "@/lib/validators";
import { supabase } from "@/lib/supabase";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Parentesco = "mae" | "pai" | "outro";

const BUCKET = "kids-documentos";
const CONSENT_VERSAO = "eca-lgpd-v1";

export default function KidsSolicitarVinculoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [parentesco, setParentesco] = useState<Parentesco>("mae");
  const [maeNome, setMaeNome] = useState("");
  const [paiNome, setPaiNome] = useState("");
  const [serie, setSerie] = useState("");
  const [temAlergia, setTemAlergia] = useState(false);
  const [alergiaQual, setAlergiaQual] = useState("");
  const [temEspectro, setTemEspectro] = useState(false);
  const [espectroQual, setEspectroQual] = useState("");
  const [temLimitacao, setTemLimitacao] = useState(false);
  const [limitacaoQual, setLimitacaoQual] = useState("");
  const [obsMedicas, setObsMedicas] = useState("");
  const [consentMkt, setConsentMkt] = useState<boolean | null>(null);
  const [obs, setObs] = useState("");

  // Foto da mãe e do pai (opcional · identificação na retirada)
  const [maeFotoPath, setMaeFotoPath] = useState<string | null>(null);
  const [maeFotoPreview, setMaeFotoPreview] = useState<string | null>(null);
  const [paiFotoPath, setPaiFotoPath] = useState<string | null>(null);
  const [paiFotoPreview, setPaiFotoPreview] = useState<string | null>(null);
  const [salvandoFotoResp, setSalvandoFotoResp] = useState<"mae" | "pai" | null>(null);

  // Foto da criança (opcional · consentimento ECA/LGPD)
  const [consentAberto, setConsentAberto] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [salvandoFoto, setSalvandoFoto] = useState(false);

  const [enviando, setEnviando] = useState(false);

  async function pegarImagem(fonte: "camera" | "galeria") {
    const perm =
      fonte === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("Permissão necessária"), t("Permita o acesso para enviar a foto."));
      return null;
    }
    const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsEditing: true, aspect: [1, 1] as [number, number] };
    const res = fonte === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return null;
    return res.assets[0];
  }

  function escolherFoto() {
    if (!aceito) return;
    Alert.alert(t("Foto da criança"), t("Como você quer enviar?"), [
      { text: t("Tirar foto"), onPress: () => enviarFoto("camera") },
      { text: t("Escolher da galeria"), onPress: () => enviarFoto("galeria") },
      { text: t("Cancelar"), style: "cancel" },
    ]);
  }

  async function enviarFoto(fonte: "camera" | "galeria") {
    if (!user?.id) return;
    const asset = await pegarImagem(fonte);
    if (!asset) return;
    setSalvandoFoto(true);
    try {
      const resp = await fetch(asset.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const ext = (asset.uri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/foto-crianca/vinculo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: asset.mimeType ?? `image/${ext}`,
        upsert: false, // bucket privado sem policy de SELECT → upsert dá RLS; path é único
      });
      if (error) throw error;
      setFotoPath(path);
      setFotoPreview(asset.uri);
      setConsentAberto(false);
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível enviar a foto."));
    } finally {
      setSalvandoFoto(false);
    }
  }

  function removerFoto() {
    setFotoPath(null);
    setFotoPreview(null);
    setAceito(false);
  }

  // Foto da mãe/pai (sem o consentimento ECA da criança · é foto de adulto)
  async function enviarFotoResp(qual: "mae" | "pai", fonte: "camera" | "galeria") {
    if (!user?.id) return;
    const asset = await pegarImagem(fonte);
    if (!asset) return;
    setSalvandoFotoResp(qual);
    try {
      const resp = await fetch(asset.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const ext = (asset.uri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/foto-responsavel/${qual}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: asset.mimeType ?? `image/${ext}`,
        upsert: false,
      });
      if (error) throw error;
      if (qual === "mae") { setMaeFotoPath(path); setMaeFotoPreview(asset.uri); }
      else { setPaiFotoPath(path); setPaiFotoPreview(asset.uri); }
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível enviar a foto."));
    } finally {
      setSalvandoFotoResp(null);
    }
  }

  function escolherFotoResp(qual: "mae" | "pai") {
    Alert.alert(qual === "mae" ? t("Foto da mãe") : t("Foto do pai"), t("Como você quer enviar?"), [
      { text: t("Tirar foto"), onPress: () => enviarFotoResp(qual, "camera") },
      { text: t("Escolher da galeria"), onPress: () => enviarFotoResp(qual, "galeria") },
      { text: t("Cancelar"), style: "cancel" },
    ]);
  }

  async function enviar() {
    if (!nome.trim()) {
      Alert.alert(t("Falta o nome"), t("Informe o nome da criança."));
      return;
    }
    if (!maeNome.trim() && !paiNome.trim()) {
      Alert.alert(t("Falta o nome dos pais"), t("Informe o nome da mãe e/ou do pai."));
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
        mae_nome: maeNome.trim() || null,
        pai_nome: paiNome.trim() || null,
        serie: serie.trim() || null,
        tem_alergia: temAlergia,
        alergia_qual: temAlergia ? alergiaQual.trim() || null : null,
        tem_espectro: temEspectro,
        espectro_qual: temEspectro ? espectroQual.trim() || null : null,
        tem_limitacao_fisica: temLimitacao,
        limitacao_fisica_qual: temLimitacao ? limitacaoQual.trim() || null : null,
        observacoes_medicas: obsMedicas.trim() || null,
        consent_marketing: consentMkt,
        foto_mae_path: maeFotoPath,
        foto_pai_path: paiFotoPath,
        observacao: obs.trim() || null,
        crianca_foto_path: fotoPath,
        foto_consentimento: !!fotoPath,
        foto_consentimento_versao: fotoPath ? CONSENT_VERSAO : null,
      });
      Alert.alert(
        t("Solicitação enviada 💙"),
        t("A equipe Kids vai conferir e liberar o vínculo. Você acompanha o resultado na tela de Check-in Kids."),
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
            {t("Para a segurança das crianças, o vínculo é conferido pela equipe Kids. Informe o nome da criança e dos pais; a equipe valida e libera.")}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>{t("Nome da criança")}</Text>
            <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder={t("Nome completo")} placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>{t("Data de nascimento (opcional)")}</Text>
            <TextInput
              style={styles.input}
              value={nascimento}
              onChangeText={(v) => setNascimento(maskDateBR(v))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
            />

            <Text style={styles.label}>{t("Série que está cursando (opcional)")}</Text>
            <TextInput
              style={styles.input}
              value={serie}
              onChangeText={setSerie}
              placeholder={t("Ex.: 3º ano do Fundamental, Maternal II")}
              placeholderTextColor={colors.textMuted}
              maxLength={80}
            />

            <Text style={[styles.label, { marginTop: spacing.sm, fontWeight: "700" }]}>{t("Saúde da criança (opcional)")}</Text>
            <Checkbox checked={temAlergia} onChange={setTemAlergia} label={t("Tem alergia")} />
            {temAlergia && (
              <TextInput style={styles.input} value={alergiaQual} onChangeText={setAlergiaQual} placeholder={t("Qual alergia?")} placeholderTextColor={colors.textMuted} maxLength={500} />
            )}
            <Checkbox checked={temEspectro} onChange={setTemEspectro} label={t("Está dentro do espectro autista")} />
            {temEspectro && (
              <TextInput style={styles.input} value={espectroQual} onChangeText={setEspectroQual} placeholder={t("Qual? (nível, observações)")} placeholderTextColor={colors.textMuted} maxLength={500} />
            )}
            <Checkbox checked={temLimitacao} onChange={setTemLimitacao} label={t("Tem alguma limitação física")} />
            {temLimitacao && (
              <TextInput style={styles.input} value={limitacaoQual} onChangeText={setLimitacaoQual} placeholder={t("Qual limitação?")} placeholderTextColor={colors.textMuted} maxLength={500} />
            )}
            <Text style={styles.label}>{t("Mais informações")}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={obsMedicas}
              onChangeText={setObsMedicas}
              placeholder={t("Medicação, cuidados, o que a equipe precisa saber...")}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Nome dos pais")}</Text>
            <Text style={styles.cardText}>{t("Informe ao menos um dos responsáveis.")}</Text>

            <Text style={styles.label}>{t("Nome da mãe")}</Text>
            <TextInput style={styles.input} value={maeNome} onChangeText={setMaeNome} placeholder={t("Nome completo")} placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>{t("Nome do pai")}</Text>
            <TextInput style={styles.input} value={paiNome} onChangeText={setPaiNome} placeholder={t("Nome completo")} placeholderTextColor={colors.textMuted} />

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

          {/* Foto da criança — opcional, com consentimento ECA/LGPD */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Foto da criança (opcional)")}</Text>
            <Text style={styles.cardText}>
              {t("Ajuda a equipe a identificar a criança na entrada e retirada. Só é enviada com sua autorização.")}
            </Text>

            {fotoPreview ? (
              <View style={styles.fotoRow}>
                <Image source={{ uri: fotoPreview }} style={styles.foto} />
                <Pressable onPress={removerFoto} hitSlop={6} style={styles.removerFoto} accessibilityRole="button">
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={styles.removerFotoTxt}>{t("Remover foto")}</Text>
                </Pressable>
              </View>
            ) : !consentAberto ? (
              <Pressable onPress={() => setConsentAberto(true)} hitSlop={6} style={styles.addFoto} accessibilityRole="button">
                <Ionicons name="camera-outline" size={16} color={colors.brandMid} />
                <Text style={styles.addFotoTxt}>{t("Adicionar foto")}</Text>
              </Pressable>
            ) : (
              <View style={styles.consent}>
                <Text style={styles.consentTitulo}>{t("Autorização de uso da imagem")}</Text>
                <Text style={styles.consentTxt}>
                  {t("Autorizo a CBRio a usar a foto do(a) meu/minha filho(a) exclusivamente para identificá-lo(a) no check-in do Kids (segurança na entrada e retirada). A imagem fica armazenada de forma privada, visível apenas a mim e à equipe do Kids autorizada — não será publicada nem compartilhada. Declaro ser o responsável legal e posso revogar esta autorização a qualquer momento, removendo a foto.")}
                </Text>
                <Text style={styles.consentLei}>{t("ECA (Lei 8.069/90, arts. 17 e 18) · LGPD (Lei 13.709/18, art. 14).")}</Text>
                <Pressable style={styles.checkRow} onPress={() => setAceito((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: aceito }}>
                  <Ionicons name={aceito ? "checkbox" : "square-outline"} size={22} color={aceito ? colors.primary : colors.textMuted} />
                  <Text style={styles.checkTxt}>{t("Li e autorizo o uso da imagem.")}</Text>
                </Pressable>
                <Pressable style={[styles.btnPrim, !aceito && styles.btnPrimOff]} onPress={escolherFoto} disabled={!aceito || salvandoFoto} accessibilityRole="button">
                  {salvandoFoto ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimTxt}>{t("Escolher foto")}</Text>}
                </Pressable>
              </View>
            )}
          </View>

          {/* Foto dos pais — opcional, pra identificação na retirada */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Foto dos pais (opcional)")}</Text>
            <Text style={styles.cardText}>
              {t("Ajuda a equipe a identificar quem pode retirar a criança. Fica privada, só a equipe Kids vê.")}
            </Text>

            <Text style={styles.label}>{t("Foto da mãe")}</Text>
            {maeFotoPreview ? (
              <View style={styles.fotoRow}>
                <Image source={{ uri: maeFotoPreview }} style={styles.foto} />
                <Pressable onPress={() => { setMaeFotoPath(null); setMaeFotoPreview(null); }} hitSlop={6} style={styles.removerFoto} accessibilityRole="button">
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={styles.removerFotoTxt}>{t("Remover foto")}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => escolherFotoResp("mae")} hitSlop={6} style={styles.addFoto} disabled={salvandoFotoResp === "mae"} accessibilityRole="button">
                {salvandoFotoResp === "mae" ? <ActivityIndicator size="small" color={colors.brandMid} /> : <Ionicons name="camera-outline" size={16} color={colors.brandMid} />}
                <Text style={styles.addFotoTxt}>{t("Adicionar foto")}</Text>
              </Pressable>
            )}

            <Text style={[styles.label, { marginTop: 12 }]}>{t("Foto do pai")}</Text>
            {paiFotoPreview ? (
              <View style={styles.fotoRow}>
                <Image source={{ uri: paiFotoPreview }} style={styles.foto} />
                <Pressable onPress={() => { setPaiFotoPath(null); setPaiFotoPreview(null); }} hitSlop={6} style={styles.removerFoto} accessibilityRole="button">
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={styles.removerFotoTxt}>{t("Remover foto")}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => escolherFotoResp("pai")} hitSlop={6} style={styles.addFoto} disabled={salvandoFotoResp === "pai"} accessibilityRole="button">
                {salvandoFotoResp === "pai" ? <ActivityIndicator size="small" color={colors.brandMid} /> : <Ionicons name="camera-outline" size={16} color={colors.brandMid} />}
                <Text style={styles.addFotoTxt}>{t("Adicionar foto")}</Text>
              </Pressable>
            )}
          </View>

          {/* Consentimento de uso de imagem em divulgação (FELCA / ECA Digital) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Uso de imagem em divulgação")}</Text>
            <Text style={styles.cardText}>
              {t("Durante o culto Kids são feitas fotos/vídeos das atividades. Você autoriza o uso da imagem do(a) seu/sua filho(a) em marketing, posts e campanhas da CBRio?")}
            </Text>
            <Text style={styles.consentLei}>
              {t("Conforme a FELCA e as diretrizes do ECA Digital (LGPD Lei 13.709/18, art. 14). Você pode alterar essa autorização quando quiser com a equipe Kids.")}
            </Text>
            <View style={styles.segment}>
              {[{ k: true, l: t("Autorizo") }, { k: false, l: t("Não autorizo") }].map((opt) => (
                <Pressable
                  key={String(opt.k)}
                  onPress={() => setConsentMkt(opt.k)}
                  style={[styles.segItem, consentMkt === opt.k && styles.segItemOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: consentMkt === opt.k }}
                >
                  <Text style={[styles.segTxt, consentMkt === opt.k && styles.segTxtOn]}>{opt.l}</Text>
                </Pressable>
              ))}
            </View>
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
            {t("🔒 Seus dados são privados, usados só para validar o vínculo, e visíveis apenas à equipe Kids.")}
          </Text>

          <Button title={t("Enviar solicitação")} onPress={enviar} loading={enviando} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    fotoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
    foto: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surface },
    addFoto: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: spacing.xs },
    addFotoTxt: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "600" },
    removerFoto: { flexDirection: "row", alignItems: "center", gap: 4 },
    removerFotoTxt: { color: colors.danger, fontSize: font.size.sm, fontWeight: "600" },
    consent: { gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.md },
    consentTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    consentTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    consentLei: { color: colors.textMuted, fontSize: 11, fontStyle: "italic" },
    checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
    checkTxt: { color: colors.text, fontSize: font.size.sm, flex: 1 },
    btnPrim: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
    btnPrimOff: { opacity: 0.5 },
    btnPrimTxt: { color: "#fff", fontWeight: "700", fontSize: font.size.md },
    privacidade: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.sm },
  });
