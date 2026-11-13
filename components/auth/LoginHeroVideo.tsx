import { useMemo, useState, type ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { htmlLoginVideo, LOGIN_VIDEO_PLAYING } from "@/lib/loginVideo";

// Pôster EMPACOTADO (hero.webp, ~156KB): a faixa nunca fica em branco, mesmo
// sem rede. O mp4 (6,7MB) vem por streaming — não entra no bundle/OTA.
const POSTER = require("@/assets/images/login-hero.webp");

/**
 * Faixa de topo do login (estilo "Hub"): pôster -> vídeo por cima quando
 * começa a tocar -> scrim para o texto ficar legível. Puramente decorativo:
 * escondido de leitores de tela e sem receber toque/foco.
 * Se o vídeo falhar (offline), o WebView fica invisível e o pôster permanece.
 */
export function LoginHeroVideo({
  height,
  paddingTop,
  children,
}: {
  height: number;
  paddingTop: number;
  children?: ReactNode;
}) {
  const [tocando, setTocando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const html = useMemo(() => htmlLoginVideo(), []);

  return (
    <View style={[styles.band, { height, paddingTop }]}>
      <Image
        source={POSTER}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {!falhou && (
        <View
          style={[StyleSheet.absoluteFill, { opacity: tocando ? 1 : 0 }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <WebView
            source={{ html }}
            style={styles.web}
            originWhitelist={["*"]}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            setSupportMultipleWindows={false}
            onMessage={(e) => {
              if (e.nativeEvent.data === LOGIN_VIDEO_PLAYING) setTocando(true);
            }}
            onError={() => setFalhou(true)}
            onHttpError={() => setFalhou(true)}
          />
        </View>
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.55)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { width: "100%", overflow: "hidden", backgroundColor: "#0b0b0b" },
  web: { flex: 1, backgroundColor: "transparent" },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
});
