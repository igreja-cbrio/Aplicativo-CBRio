import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";
import { useColors } from "@/contexts/ThemeContext";

/**
 * Player do vídeo do aviso. Usa react-native-webview (já é dependência) com <video> nativo,
 * então não exige módulo nativo novo nem rebuild. Vídeo vertical (9:16) fica contido na tela.
 */
export function KidsAvisoVideo({ uri, titulo }: { uri: string; titulo: string }) {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const src = `"${uri.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}video{width:100%;height:100%;object-fit:contain;background:#000}</style></head><body><video src=${src} controls playsinline preload="metadata"></video></body></html>`;
  return <View accessible accessibilityLabel={titulo} style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 520, borderRadius: 12, overflow: "hidden", backgroundColor: "#000", marginVertical: 8 }}>
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      allowsFullscreenVideo
      onShouldStartLoadWithRequest={(r) => r.url === "about:blank" || r.url === uri}
      javaScriptEnabled={false}
      scrollEnabled={false}
      style={{ flex: 1, backgroundColor: "#000" }}
      onLoadEnd={() => setLoading(false)}
    />
    {loading ? <ActivityIndicator style={{ position: "absolute", alignSelf: "center", top: "45%" }} color={colors.brandMid} /> : null}
  </View>;
}
