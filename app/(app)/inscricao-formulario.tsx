import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, View } from "react-native";
import { Stack, router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import WebView from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { urlPublicaCbrio } from "@/lib/eventoDestino";
import { useDialogo } from "@/components/ui/Dialogo";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

/** Formulário canônico com seus uploads e aceites, sem sair da navegação do app.
 * Não injeta sessão, preenche aceites ou infere confirmação de pagamento. */
export default function InscricaoFormulario() {
  const { url, para } = useLocalSearchParams<{ url?: string; para?: string }>();
  const outraPessoa = para === "outra-pessoa";
  const inicial = typeof url === "string" ? urlPublicaCbrio(url) : null;
  const pagina = inicial;
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const web = useRef<WebView>(null);
  const podeVoltar = useRef(false);
  const perguntando = useRef(false);
  const colors = useColors();
  const t = useT();
  const dlg = useDialogo();

  const fechar = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/inscricoes");
  }, []);
  const voltar = useCallback(() => {
    if (podeVoltar.current) web.current?.goBack();
    else fechar();
  }, [fechar]);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { voltar(); return true; });
    return () => sub.remove();
  }, [voltar]));

  async function abrirExterno(destino: string) {
    let u: URL;
    try { u = new URL(destino); } catch { return; }
    if (u.username || u.password || !["https:", "tel:", "mailto:", "whatsapp:"].includes(u.protocol)) return;
    if (perguntando.current) return;
    perguntando.current = true;
    try {
      const aceito = await dlg.confirmar({
        titulo: t("Abrir link externo?"),
        mensagem: t("Este link abre fora do formulário. Seus dados preenchidos continuam aqui."),
        acao: t("Continuar"),
      });
      if (!aceito) return;
      if (u.protocol === "https:") await WebBrowser.openBrowserAsync(destino);
      else await Linking.openURL(destino);
    } catch {
      await dlg.avisar(t("Não foi possível abrir o link."));
    } finally { perguntando.current = false; }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={voltar} style={styles.action} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{t("Inscrições")}</Text>
        <Pressable onPress={fechar} style={styles.action} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>
      {outraPessoa ? <View style={[styles.aviso, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>{t("Inscrever outra pessoa")}</Text>
        <Text style={{ color: colors.textMuted }}>{t("Nome, CPF e nascimento devem ser de quem vai participar. Preencha seus dados somente nos campos de responsável, quando solicitados.")}</Text>
      </View> : null}
      <TecladoSeguro style={{ flex: 1 }}>
        {pagina ? <WebView
          key={`${pagina}:${outraPessoa}`}
          ref={web}
          incognito={outraPessoa}
          source={{ uri: pagina }}
          style={{ flex: 1, backgroundColor: colors.background }}
          // Interceptar TODOS os esquemas evita o fallback automático do WebView
          // para Linking em URLs fora da originWhitelist.
          originWhitelist={["*"]}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          onShouldStartLoadWithRequest={(request) => {
            if (urlPublicaCbrio(request.url)) return true;
            // Frames HTTPS do provedor não são navegação da pessoa.
            if (request.isTopFrame === false) return request.url.startsWith("https://");
            abrirExterno(request.url);
            return false;
          }}
          onOpenWindow={({ nativeEvent }) => {
            const interna = urlPublicaCbrio(nativeEvent.targetUrl);
            // Popups (termos/comprovantes) não substituem o formulário preenchido.
            // O navegador é reservado a links auxiliares explicitamente acionados.
            abrirExterno(interna || nativeEvent.targetUrl);
          }}
          onNavigationStateChange={(state) => { podeVoltar.current = state.canGoBack; }}
          onLoadStart={() => { setErro(false); setCarregando(true); }}
          onLoadEnd={() => setCarregando(false)}
          onError={() => { setErro(true); setCarregando(false); }}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.url === pagina && nativeEvent.statusCode >= 400) { setErro(true); setCarregando(false); }
          }}
          onContentProcessDidTerminate={() => { setErro(true); setCarregando(false); }}
          onRenderProcessGone={() => { setErro(true); setCarregando(false); }}
        /> : null}
        {carregando && pagina && !erro ? <View pointerEvents="none" style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
        </View> : null}
        {erro || !pagina ? <View style={[styles.error, { backgroundColor: colors.background }]}>
          <Text style={{ color: colors.text, textAlign: "center" }}>{t("Não foi possível carregar. Verifique sua conexão.")}</Text>
          {pagina ? <Button title={t("Tentar novamente")} onPress={() => { setErro(false); setCarregando(true); web.current?.reload(); }} /> : null}
          <Button title={t("Voltar")} onPress={fechar} />
        </View> : null}
      </TecladoSeguro>
      <dlg.Dialogo />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  aviso: { paddingHorizontal: 16, paddingVertical: 10, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  loading: { position: "absolute", top: 8, alignSelf: "center", padding: 12, borderRadius: 24, backgroundColor: "#fff" },
  error: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
});
