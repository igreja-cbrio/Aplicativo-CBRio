// ════════════════════════════════════════════════════════════════════════════
//  AJUDA COM O APP · dúvida sobre o produto (Matheus · 29/08/2026)
//
//  *"no app, no menu, tivesse um botão de ajuda com app, caso a pessoa precise
//  tirar dúvidas em relação ao app, seus dados e etc, de forma mais direta e
//  prática. E aí essas dúvidas devem chegar para o meu WhatsApp. Quero o nome
//  da pessoa e a dúvida dela, com o número de celular dela."*
//
//  ⚠️⚠️ NÃO é a porta "Falar com a CBRio" (`/falar-com-a-igreja`), e a diferença
//  é de DESTINO: aquela é fila PASTORAL (Cuidados), esta é SUPORTE do produto.
//  "Meu grupo não aparece no app" não é assunto da equipe de cuidado.
//
//  ⚠️ Quem RECEBE vive no banco (`whatsapp_config.suporte_app_membro_id`) — esta
//  tela não conhece pessoa nenhuma, e é assim que tem que continuar.
// ════════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useDialogo } from "@/components/ui/Dialogo";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { apiPost } from "@/lib/api";
import { subirUmNivel } from "@/lib/hierarquia";
import { acaoAoFechar } from "@/lib/descartarRascunho";
import { trackEvento } from "@/lib/telemetria";
import Constants from "expo-constants";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/** Só dígitos — o mesmo que o servidor guarda. */
function digitos(v: string) {
  return v.replace(/\D/g, "").slice(0, 11);
}
function mascara(d: string) {
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function AjudaAppScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const dlg = useDialogo();
  const { membro } = useMembro();

  const [mensagem, setMensagem] = useState("");
  const [telefone, setTelefone] = useState(() => digitos(membro?.telefone || ""));
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function voltar() {
    const acao = acaoAoFechar({ campos: [mensagem], salvando: enviando });
    if (acao === "aguardar") return;
    if (acao === "fechar") return subirUmNivel();
    const descartar = await dlg.confirmar({
      titulo: t("Descartar sua mensagem?"),
      mensagem: t("O que você escreveu não foi enviado."),
      cancelar: t("Continuar escrevendo"),
      acao: t("Descartar"),
      perigo: true,
    });
    if (descartar) subirUmNivel();
  }

  async function enviar() {
    setErro(null);
    if (mensagem.trim().length < 5) {
      setErro(t("Escreva sua dúvida com um pouco mais de detalhe."));
      return;
    }
    setEnviando(true);
    try {
      await apiPost("/app/suporte", {
        mensagem: mensagem.trim(),
        telefone: telefone || undefined,
        // Versão do BUNDLE: é o que diz se a pessoa está num OTA antigo.
        app_versao: Constants.expoConfig?.version,
        plataforma: Platform.OS,
      });
      trackEvento("ajuda_app_enviada");
      setEnviado(true);
    } catch (e) {
      setErro((e as { message?: string })?.message || t("Não foi possível enviar agora. Tente de novo em instantes."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TecladoSeguro style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable onPress={voltar} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("Ajuda com o app")}</Text>
            <View style={{ width: 24 }} />
          </View>

          {enviado ? (
            <View style={styles.ok}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              <Text style={styles.okTitulo}>{t("Recebemos sua dúvida")}</Text>
              {/* ⚠️ NÃO promete WhatsApp: quem responde é uma pessoa, e o canal
                  depende do que estiver configurado. Prometer o que não se
                  controla é a tela afirmando o que o produto não garante. */}
              <Text style={styles.okTxt}>{t("Quem cuida do app vai te responder pelo contato que você deixou.")}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.intro}>
                {t("Dúvida sobre o aplicativo, seus dados aqui dentro ou algo que não está funcionando? Escreva abaixo — quem cuida do app recebe direto.")}
              </Text>
              {/* ⚠️ A tela DIZ que isto não é caminho pastoral e aponta o certo:
                  quem chega aqui procurando oração não pode ficar sem saída. */}
              <View style={styles.desvio}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                <Text style={styles.desvioTxt}>
                  {t("Para oração ou conversa com um pastor, use \"Falar com a CBRio\".")}
                </Text>
              </View>

              <TextInput
                style={styles.textarea}
                value={mensagem}
                onChangeText={setMensagem}
                placeholder={t("Ex.: meu grupo não aparece no app…")}
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
              />

              <Text style={styles.rotulo}>{t("Seu celular (pra te responderem)")}</Text>
              <TextInput
                style={styles.input}
                value={mascara(telefone)}
                onChangeText={(v) => setTelefone(digitos(v))}
                placeholder="(21) 99999-8888"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
              {/* ⚠️ Sem telefone NÃO trava o envio — cadastro incompleto é o
                  assunto de boa parte das dúvidas. Só avisa o efeito. */}
              {!telefone && (
                <Text style={styles.aviso}>{t("Sem celular a resposta pode demorar mais.")}</Text>
              )}

              {erro && <Text style={styles.erro}>{erro}</Text>}
              <Button title={t("Enviar")} onPress={enviar} loading={enviando} />
            </>
          )}
        </ScrollView>
      </TecladoSeguro>
      <dlg.Dialogo />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    intro: { color: c.textMuted, fontSize: font.size.md },
    desvio: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    desvioTxt: { color: c.textMuted, fontSize: font.size.sm, flex: 1 },
    textarea: {
      minHeight: 130, backgroundColor: c.surface, borderRadius: radius.lg,
      borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md,
      color: c.text, fontSize: font.size.md, textAlignVertical: "top",
    },
    rotulo: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    input: {
      backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1,
      borderColor: c.glassBorder, paddingHorizontal: spacing.md, paddingVertical: 12,
      color: c.text, fontSize: font.size.md,
    },
    aviso: { color: c.textMuted, fontSize: font.size.sm },
    erro: { color: "#ef4444", fontSize: font.size.sm },
    ok: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
    okTitulo: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    okTxt: { color: c.textMuted, fontSize: font.size.sm, textAlign: "center" },
  });
