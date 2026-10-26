import { Modal } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useMemo, useState } from "react";
import { Pressable, StatusBar, StyleSheet, View } from "react-native";
import WebView, { type WebViewProps } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/lib/i18n";
import { ORIGEM_VIMEO, htmlDoVimeo, navegacaoVimeoPermitida } from "@/lib/conteudos";

/**
 * Player do módulo Conteúdos (21/10/2026) — iframe do Vimeo num WebView.
 *
 * Estrutura herdada do VideoDevocional (quadro 16:9 + tela cheia por Modal
 * nosso; o app é travado em retrato). O que muda — e por quê — está em
 * `lib/conteudos.ts`: a conta Vimeo restringe incorporação por domínio, o
 * `baseUrl` daqui é `ORIGEM_VIMEO` (www.cbrio.com.br, que o Vimeo aceita) e
 * a regra de navegação é a própria. `onPlay` dispara UMA vez por montagem
 * (telemetria de uso).
 */
export function PlayerVimeo({ vimeoId, hash, onPlay }: { vimeoId: string; hash: string | null; onPlay?: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [cheia, setCheia] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [jaTocou, setJaTocou] = useState(false);
  const htmlInline = useMemo(() => htmlDoVimeo(vimeoId, hash), [vimeoId, hash]);
  const htmlCheia = useMemo(() => htmlDoVimeo(vimeoId, hash, { tocar: true }), [vimeoId, hash]);

  function lerMensagem(raw: string) {
    try {
      const m = JSON.parse(raw);
      if (m?.evento === "erro") setFalhou(true);
      if (m?.evento === "play" && !jaTocou) {
        setJaTocou(true);
        onPlay?.();
      }
    } catch {
      /* mensagem que não é nossa */
    }
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
    onShouldStartLoadWithRequest: (req) => navegacaoVimeoPermitida(req.url, req.isTopFrame),
    onMessage: (e) => lerMensagem(e.nativeEvent.data),
  };

  return (
    <View style={s.wrap}>
      <View style={s.quadro}>
        <WebView source={{ html: htmlInline, baseUrl: ORIGEM_VIMEO }} {...propsComuns} />
        <Pressable onPress={() => setCheia(true)} style={s.expandir} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Tela cheia")}>
          <Ionicons name="expand" size={18} color="#fff" />
        </Pressable>
      </View>
      {falhou && <Text style={s.erro}>{t("Não foi possível carregar o vídeo. Confira sua internet e tente de novo.")}</Text>}

      <Modal visible={cheia} animationType="fade" onRequestClose={() => setCheia(false)} supportedOrientations={["portrait", "landscape"]} statusBarTranslucent>
        <StatusBar hidden />
        <View style={s.cheia}>
          {cheia && <WebView source={{ html: htmlCheia, baseUrl: ORIGEM_VIMEO }} {...propsComuns} />}
          <Pressable onPress={() => setCheia(false)} style={[s.fechar, { top: insets.top + 12 }]} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
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
