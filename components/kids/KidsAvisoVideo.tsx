import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useIsFocused } from "@react-navigation/native";
import { Text } from "@/components/ui/Typography";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { ORIGEM_DO_PLAYER, videoSeguro } from "@/lib/videoDevocional";
import { htmlVideoAviso, proporcaoVideoAviso } from "@/lib/videoAviso";

export function KidsAvisoVideo(props: { uri: string; titulo: string }) {
  return <PlayerAviso key={props.uri} {...props} />;
}

function PlayerAviso({ uri, titulo }: { uri: string; titulo: string }) {
  const colors = useColors();
  const t = useT();
  const focado = useIsFocused();
  const web = useRef<WebView>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [tentativa, setTentativa] = useState(0);
  const [proporcao, setProporcao] = useState(9 / 16);
  const [largura, setLargura] = useState(0);
  const reproduzir = t("Reproduzir vídeo");
  const source = useMemo(() => ({ html: htmlVideoAviso(uri, titulo, reproduzir), baseUrl: ORIGEM_DO_PLAYER }), [uri, titulo, reproduzir]);

  useEffect(() => {
    if (!focado) web.current?.injectJavaScript("window.pausar&&window.pausar();true;");
  }, [focado]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estadoApp) => {
      if (estadoApp !== "active") web.current?.injectJavaScript("window.pausar&&window.pausar();true;");
    });
    return () => sub.remove();
  }, []);

  const falhou = estado === "erro" || !videoSeguro(uri);
  return <View style={s.wrap}>
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={[s.quadro, largura ? { height: Math.min(520, largura / proporcao) } : { aspectRatio: 9 / 16 }]}>
      {!falhou && <WebView
        key={tentativa}
        ref={web}
        originWhitelist={["*"]}
        source={source}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        allowsFullscreenVideo
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(r) => r.url === "about:blank" || r.url === ORIGEM_DO_PLAYER || r.url === `${ORIGEM_DO_PLAYER}/`}
        style={s.web}
        onError={() => setEstado("erro")}
        onHttpError={() => setEstado("erro")}
        onContentProcessDidTerminate={() => setEstado("erro")}
        onRenderProcessGone={() => setEstado("erro")}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.tipo === "pronto" || m.tipo === "erro" || m.tipo === "carregando") setEstado(m.tipo);
            if (m.tipo === "dimensoes") {
              const p = proporcaoVideoAviso(m.largura, m.altura);
              if (p) setProporcao(p);
            }
          } catch { /* Ignora mensagens que não são do player. */ }
        }}
      />}
      {estado === "carregando" && !falhou ? <ActivityIndicator pointerEvents="none" style={s.loading} color={colors.brandMid} /> : null}
      {falhou && <View style={s.falha}>
        <Text style={s.texto}>{t("Não foi possível carregar o vídeo. Confira sua internet e tente de novo.")}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setEstado("carregando"); setTentativa((n) => n + 1); }} style={s.botao}>
          <Text style={s.texto}>{t("Tentar novamente")}</Text>
        </Pressable>
      </View>}
    </View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { width: "100%", marginVertical: 8 },
  quadro: { width: "100%", borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
  web: { flex: 1, backgroundColor: "#000" },
  loading: { position: "absolute", alignSelf: "center", top: 16 },
  falha: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  texto: { color: "#fff", textAlign: "center" },
  botao: { minHeight: 48, paddingHorizontal: 20, justifyContent: "center", borderWidth: 1, borderColor: "#fff", borderRadius: 24 },
});
