// ============================================================================
//  CENSO · disponível só para quem ainda não respondeu
//
//  Pedido do Matheus (08/08): o censo aparece no app para quem não fez; quem já
//  fez vê um aviso de que já preencheu.
//
//  ⚠️ QUEM DECIDE É O BACKEND, e isso é deliberado. A tela não calcula nada:
//  `GET /app/censo` devolve `ja_respondeu` E a `url`, e a url só é emitida para
//  quem pode responder. Se um dia esta tela tiver um bug e ignorar a flag, ela
//  não tem para onde abrir — a trava não depende de o app estar atualizado, e é
//  bom que não dependa: OTA chega em todo mundo, mas ninguém controla quando.
//
//  ⚠️ O FORMULÁRIO NÃO É REESCRITO AQUI. São 108 perguntas com condicionais,
//  rascunho, fila offline e um bloco sensível — tudo já testado e no ar. Abrimos
//  o mesmo formulário num WebView, com um token de identidade assinado que o
//  backend emitiu para esta sessão: a pessoa não digita CPF, porque o app já
//  sabe quem ela é. Uma segunda implementação em React Native seria uma segunda
//  fonte de verdade, e a que ficasse para trás mentiria em silêncio.
// ============================================================================
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import WebView from "react-native-webview";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { apiGet } from "@/lib/api";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type CensoStatus = {
  pesquisa: { slug: string; titulo: string; subtitulo: string | null; fecha_em: string | null } | null;
  motivo?: "sem_cadastro" | "nenhuma_aberta";
  ja_respondeu?: boolean;
  respondida_em?: string | null;
  url?: string | null;
};

function dataCurta(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function CensoScreen() {
  const colors = useColors();
  const t = useT();
  // ⚠️ Insets lidos AQUI, no corpo da tela — de propósito. Dentro de um `Modal`
  // do React Native o SafeAreaView do safe-area-context não recebe inset nenhum
  // (o modal é outra hierarquia nativa, e o provider vive na raiz do app), então
  // `edges={["top"]}` não aplicava NADA: o cabeçalho com o X ficava por trás da
  // Dynamic Island. O hook, chamado fora do modal, devolve o valor certo e a
  // gente aplica na mão.
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [status, setStatus] = useState<CensoStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setStatus(await apiGet<CensoStatus>("/app/censo"));
    } catch (e) {
      // Erro de rede não pode virar "você já respondeu" nem "não tem censo":
      // as duas seriam afirmações falsas com cara de informação.
      setErro(e instanceof Error ? e.message : t("Não consegui carregar agora."));
    }
  }, []);

  // Recarrega ao voltar para a tela — inclusive depois de fechar o WebView,
  // que é exatamente quando `ja_respondeu` costuma ter mudado.
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const p = status?.pesquisa;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => subirUmNivel("/censo")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("Voltar")}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("Censo")}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {erro ? (
          <GlassCard style={styles.card}>
            <Text style={styles.titulo}>{t("Não consegui carregar")}</Text>
            <Text style={styles.texto}>{erro}</Text>
            <Button title={t("Tentar de novo")} onPress={carregar} />
          </GlassCard>
        ) : !status ? (
          <View style={styles.centro}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !p ? (
          <GlassCard style={styles.card}>
            <Ionicons name="clipboard-outline" size={30} color={colors.textMuted} />
            <Text style={styles.titulo}>{t("Nenhum censo aberto")}</Text>
            <Text style={styles.texto}>
              {status.motivo === "sem_cadastro"
                ? t("Complete seu cadastro no app para participar dos próximos censos.")
                : t("Quando a igreja abrir um novo censo, ele aparece aqui.")}
            </Text>
          </GlassCard>
        ) : status.ja_respondeu ? (
          // O aviso que o Matheus pediu. Diz a data de propósito: "você já
          // respondeu" sem quando deixa a pessoa na dúvida se foi ela mesma.
          <GlassCard style={styles.card}>
            <Ionicons name="checkmark-circle" size={34} color={colors.success} />
            <Text style={styles.titulo}>{t("Você já respondeu")}</Text>
            <Text style={styles.texto}>
              {dataCurta(status.respondida_em)
                ? `${t("Recebemos sua resposta do")} ${p.titulo} ${t("em")} ${dataCurta(status.respondida_em)}.`
                : `${t("Recebemos sua resposta do")} ${p.titulo}.`}
            </Text>
            <Text style={styles.rodape}>
              {t("Cada pessoa responde uma vez só — é o que mantém os números certos. Obrigado por ter participado.")}
            </Text>
          </GlassCard>
        ) : (
          <GlassCard style={styles.card}>
            <Ionicons name="clipboard-outline" size={34} color={colors.primary} />
            <Text style={styles.titulo}>{p.titulo}</Text>
            {!!p.subtitulo && <Text style={styles.texto}>{p.subtitulo}</Text>}
            <Text style={styles.texto}>
              {t("Seus dados de cadastro já vêm preenchidos — você não precisa digitar CPF nem nome de novo.")}
            </Text>
            {!!dataCurta(p.fecha_em) && (
              <Text style={styles.rodape}>{t("Aberto até")} {dataCurta(p.fecha_em)}.</Text>
            )}
            <Button
              title={t("Responder o censo")}
              onPress={() => setAbrindo(true)}
              disabled={!status.url}
            />
          </GlassCard>
        )}
      </ScrollView>

      {/* Modal em vez de navegar para fora: sair do app para o navegador
          perderia a sessão e faria a pessoa se identificar de novo — que é
          justamente o atrito que o token existe para remover. */}
      <Modal visible={abrindo && !!status?.url} animationType="slide" onRequestClose={() => setAbrindo(false)}>
        {/* ⚠️ `Platform.OS === "ios"` porque no Android o Modal NÃO desenha sob a
            barra de status (edge-to-edge está desligado no app.json): somar o
            inset lá criaria um vão duplicado no topo. */}
        <View style={[styles.modalSafe, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
          <View style={styles.header}>
            <Pressable onPress={() => setAbrindo(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>{p?.titulo ?? t("Censo")}</Text>
            <View style={{ width: 26 }} />
          </View>
          {!!status?.url && (
            <WebView
              source={{ uri: status.url }}
              style={{ flex: 1 }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.centro}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    modalSafe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    headerTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "600" },
    scroll: { padding: spacing.lg, gap: spacing.md },
    centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, alignItems: "flex-start" },
    titulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
    texto: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 21 },
    rodape: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19, opacity: 0.85 },
  });
}
