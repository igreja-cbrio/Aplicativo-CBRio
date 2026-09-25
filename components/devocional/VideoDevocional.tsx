import { useMemo, useRef, useState } from "react";
import { Modal, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import WebView, { type WebViewProps } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/lib/i18n";
import { htmlDoVideo, idDoYoutube, navegacaoPermitida, ORIGEM_DO_PLAYER, videoSeguro } from "@/lib/videoDevocional";

/**
 * Vídeo do devocional (25/09/2026 · pedido do Marcos: "subir vídeos nas
 * devocionais, ter uma boa visualização, colocar fullscreen").
 *
 * ⚠️ É o <video> do HTML dentro do WebView — o único player que já está no
 * binário da loja. `expo-video` seria módulo nativo e não sairia por OTA.
 *
 * ⚠️ A "tela cheia" é um Modal NOSSO, com o player ocupando a tela inteira, e
 * não o fullscreen do player: o do WebView depende de plataforma (no Android
 * só existe com `allowsFullscreenVideo`) e não dá pra garantir por código. O
 * botão de tela cheia do próprio player continua lá, como segunda porta.
 * ⚠️ O app é travado em RETRATO (app.json). Girar pra paisagem exigiria
 * `expo-screen-orientation`, que é nativo ⇒ build de loja. Vídeo deitado fica
 * com faixa preta; vídeo em pé (celular) ocupa a tela.
 *
 * ⚠️ Link do YouTube toca EMBUTIDO (IFrame API) e a navegação do frame
 * principal é barrada (`navegacaoPermitida`): tocar no logo não abre o YouTube.
 *
 * O tempo passa de um player pro outro (o inline posta `currentTime`), pra quem
 * abre a tela cheia no meio não recomeçar do zero.
 */
export function VideoDevocional({ url }: { url: string | null | undefined }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  // Link do YouTube (toca embutido, sem sair do app) ou arquivo nosso (https).
  const seguro = idDoYoutube(url) ? (url as string).trim() : videoSeguro(url);
  const inline = useRef<WebView>(null);
  const tempo = useRef(0);
  const [cheia, setCheia] = useState<number | null>(null);
  const [falhou, setFalhou] = useState(false);
  const htmlInline = useMemo(() => (seguro ? htmlDoVideo(seguro) : ""), [seguro]);
  const htmlCheia = useMemo(() => (seguro && cheia != null ? htmlDoVideo(seguro, { inicio: cheia, tocar: true }) : ""), [seguro, cheia]);

  if (!seguro) return null;

  function lerMensagem(raw: string, aoTempo: (s: number) => void) {
    try {
      const m = JSON.parse(raw);
      if (typeof m?.t === "number" && isFinite(m.t)) aoTempo(m.t);
      if (m?.erro) setFalhou(true);
    } catch { /* mensagem que não é nossa */ }
  }

  function abrirCheia() {
    inline.current?.injectJavaScript("window.pausar&&window.pausar();true;");
    setCheia(tempo.current);
  }

  function fecharCheia() {
    const s = Math.floor(tempo.current);
    setCheia(null);
    inline.current?.injectJavaScript(`window.irPara&&window.irPara(${s});true;`);
  }

  const propsComuns: Partial<WebViewProps> = {
    originWhitelist: ["*"],
    javaScriptEnabled: true,
    allowsInlineMediaPlayback: true,
    allowsFullscreenVideo: true,
    mediaPlaybackRequiresUserAction: false,
    scrollEnabled: false,
    bounces: false,
    style: s.web,
    setSupportMultipleWindows: false,
    onShouldStartLoadWithRequest: (req) => navegacaoPermitida(req.url, req.isTopFrame),
  };

  return <View style={s.wrap}>
    <View style={s.quadro}>
      <WebView ref={inline} source={{ html: htmlInline, baseUrl: ORIGEM_DO_PLAYER }} {...propsComuns}
        onMessage={(e) => lerMensagem(e.nativeEvent.data, (v) => { tempo.current = v; })} />
      <Pressable onPress={abrirCheia} style={s.expandir} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Tela cheia")}>
        <Ionicons name="expand" size={18} color="#fff" />
      </Pressable>
    </View>
    {falhou && <Text style={s.erro}>{t("Não foi possível carregar o vídeo. Confira sua internet e tente de novo.")}</Text>}

    <Modal visible={cheia != null} animationType="fade" onRequestClose={fecharCheia} supportedOrientations={["portrait", "landscape"]} statusBarTranslucent>
      <StatusBar hidden />
      <View style={s.cheia}>
        {cheia != null && <WebView source={{ html: htmlCheia, baseUrl: ORIGEM_DO_PLAYER }} {...propsComuns}
          onMessage={(e) => lerMensagem(e.nativeEvent.data, (v) => { tempo.current = v; })} />}
        <Pressable onPress={fecharCheia} style={[s.fechar, { top: insets.top + 12 }]} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  quadro: { width: "100%", aspectRatio: 16 / 9, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
  web: { flex: 1, backgroundColor: "#000" },
  expandir: { position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.55)" },
  erro: { color: "#B45309", fontSize: 13, lineHeight: 18 },
  cheia: { flex: 1, backgroundColor: "#000" },
  fechar: { position: "absolute", right: 16, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.55)" },
});
