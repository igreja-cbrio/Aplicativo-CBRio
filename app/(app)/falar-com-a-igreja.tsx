// ============================================================================
// FALAR COM A CBRIO · a porta única (11/08/2026 · apontamento 14)
//
// Decisão do Marcos: *"vamos separar em duas portas então, uma que é esse contato
// SOS, que tem que ser destacado como é hoje, e a outra é o fale com a CBRio: ao
// clicar, você teria 3 opções — marcar conversa com pastor, pedir oração, e a
// terceira opção de enviar mensagem de dúvida, sugestão, pedido ou feedback."*
//
// ⚠️⚠️ O SOS NÃO ESTÁ AQUI, de propósito. Ele fica em `/cuidados`, com o destaque
// que já tem e com CVV 188 antes de qualquer formulário — é a única dessas portas
// que pode salvar alguém em minuto zero.
//
// ⚠️ O QUE ISTO SUBSTITUI: antes eram 4 portas espalhadas — pedido de oração e
// "conversar com pastor" em `/cuidados`, e o "Fale conosco" a QUATRO toques de
// distância (Menu → Ajustes → Configurações → Ajuda). Palavras dele: *"hoje vejo
// que tem muitas portas de preenchimento que podem confundir; ter uma porta só e
// a pessoa diz o que precisa faz mais sentido."*
// ============================================================================
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { criarInscricao } from "@/lib/inscricoes";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { OPCOES_PORTA, podeEnviar, type OpcaoPorta } from "@/lib/portaUnica";
import { acaoAoFechar } from "@/lib/descartarRascunho";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export default function FalarComAIgrejaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { membro } = useMembro();

  const [escolhida, setEscolhida] = useState<OpcaoPorta | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ⚠️ Voltar da escolha PERGUNTA se há texto digitado — a mesma régua do item
  // 15 (`lib/descartarRascunho.ts`). Quem escreveu um pedido de oração e toca
  // errado não deveria perder o que escreveu.
  function voltarDaEscolha() {
    const acao = acaoAoFechar({ campos: [mensagem], salvando: enviando });
    if (acao === "aguardar") return;
    if (acao === "fechar") { setEscolhida(null); setErro(null); return; }
    Alert.alert(
      t("Descartar sua mensagem?"),
      t("O que você escreveu não foi enviado."),
      [
        { text: t("Continuar escrevendo"), style: "cancel" },
        {
          text: t("Descartar"),
          style: "destructive",
          onPress: () => { setEscolhida(null); setMensagem(""); setErro(null); },
        },
      ],
    );
  }

  async function enviar() {
    if (!escolhida) return;
    setErro(null);
    if (!podeEnviar(escolhida.tipo, mensagem)) {
      setErro(t("Escreva sua mensagem antes de enviar."));
      return;
    }
    setEnviando(true);
    try {
      // ⚠️ Mesma porta de sempre (`criarInscricao`), com os tipos que já existem
      // — a fila do Cuidados no ERP continua entendendo tudo, sem migration.
      await criarInscricao(escolhida.tipo, {
        membro_id: membro?.membroId ?? null,
        nome: membro?.nome ?? null,
        telefone: membro?.telefone ?? null,
        email: membro?.email ?? null,
        mensagem: mensagem.trim() || null,
      });
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível enviar agora."));
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
            <Pressable
              onPress={() => (escolhida && !enviado ? voltarDaEscolha() : subirUmNivel())}
              hitSlop={8}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel={t("Voltar")}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("Falar com a CBRio")}</Text>
            <View style={{ width: 24 }} />
          </View>

          {enviado ? (
            <View style={styles.ok}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              <Text style={styles.okTitulo}>{t("Recebemos sua mensagem")}</Text>
              <Text style={styles.okTxt}>
                {escolhida?.ajuda ? t(escolhida.ajuda) : t("A equipe lê e responde.")}
              </Text>
              <Text style={styles.okTxt}>
                {t("Você acompanha em Cuidados, na sua lista de pedidos.")}
              </Text>
            </View>
          ) : !escolhida ? (
            <>
              <Text style={styles.intro}>{t("O que você precisa hoje?")}</Text>
              {OPCOES_PORTA.map((o) => (
                <Pressable
                  key={o.tipo}
                  style={styles.opcao}
                  onPress={() => { setEscolhida(o); setMensagem(""); setErro(null); }}
                  accessibilityRole="button"
                  accessibilityLabel={t(o.titulo)}
                >
                  <View style={styles.opcaoIcone}>
                    <Ionicons name={o.icone} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opcaoTitulo}>{t(o.titulo)}</Text>
                    <Text style={styles.opcaoAjuda}>{t(o.ajuda)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}

              {/* ⚠️ O caminho de urgência fica VISÍVEL aqui, mas mandando pra tela
                  dele — quem chegou na porta errada e está em sofrimento não pode
                  ter que voltar e procurar. */}
              <Pressable
                style={styles.urgente}
                onPress={() => subirUmNivel()}
                accessibilityRole="button"
              >
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.urgenteTxt}>
                  {t("Preciso de ajuda agora — falar com alguém imediatamente")}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.escolhidaTopo}>
                <Ionicons name={escolhida.icone} size={18} color={colors.primary} />
                <Text style={styles.escolhidaTxt}>{t(escolhida.titulo)}</Text>
              </View>
              <Text style={styles.opcaoAjuda}>{t(escolhida.ajuda)}</Text>

              <TextInput
                style={styles.textarea}
                value={mensagem}
                onChangeText={setMensagem}
                placeholder={
                  escolhida.exigeMensagem
                    ? t("Conte o que você precisa…")
                    : t("Quer adiantar algo? (opcional)")
                }
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
              />
              {erro && <Text style={styles.erro}>{erro}</Text>}
              <Button title={t("Enviar")} onPress={enviar} loading={enviando} />
            </>
          )}
        </ScrollView>
      </TecladoSeguro>
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
    opcao: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, borderColor: c.glassBorder,
    },
    opcaoIcone: {
      width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
      backgroundColor: c.primary + "18",
    },
    opcaoTitulo: { color: c.text, fontSize: font.size.md, fontWeight: "700" },
    opcaoAjuda: { color: c.textMuted, fontSize: font.size.sm, marginTop: 2 },
    urgente: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      marginTop: spacing.sm, paddingVertical: spacing.sm,
    },
    urgenteTxt: { color: c.danger, fontSize: font.size.sm, fontWeight: "700", flex: 1 },
    escolhidaTopo: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    escolhidaTxt: { color: c.text, fontSize: font.size.md, fontWeight: "700", flex: 1 },
    textarea: {
      minHeight: 130, backgroundColor: c.surface, borderRadius: radius.lg,
      borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md,
      color: c.text, fontSize: font.size.md, textAlignVertical: "top",
    },
    erro: { color: "#ef4444", fontSize: font.size.sm },
    ok: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
    okTitulo: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    okTxt: { color: c.textMuted, fontSize: font.size.sm, textAlign: "center" },
  });
