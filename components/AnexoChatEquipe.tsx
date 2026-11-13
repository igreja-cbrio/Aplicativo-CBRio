import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import WebView from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Typography";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { htmlAudioChat, urlAnexoChat } from "@/lib/chatAudio";

export function AnexoChatEquipe({ conversa, mensagem, mime, ativo, ativar }: { conversa: string; mensagem: string; mime: string; ativo: boolean; ativar: () => void }) {
  const player = useRef<WebView>(null);
  const parar = useCallback(() => { player.current?.injectJavaScript("document.querySelector('audio')?.pause(); true;"); }, []);
  useFocusEffect(useCallback(() => parar, [parar]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", estado => { if (estado !== "active") parar(); });
    return () => { parar(); sub.remove(); };
  }, [parar]);
  const [tentativa, setTentativa] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const colors = useColors();
  const t = useT();
  const audio = mime.startsWith("audio/");
  useEffect(() => {
    let cancelado = false;
    setUrl(null); setFalhou(false);
    if (ativo) apiGet<{ anexo_url: string; anexo_mime: string }>(`/app/assistente/${encodeURIComponent(conversa)}/mensagens/${encodeURIComponent(mensagem)}/anexo`).then(async r => {
      if (cancelado) return;
      const segura = urlAnexoChat(r.anexo_url, process.env.EXPO_PUBLIC_SUPABASE_URL);
      if (!segura || r.anexo_mime !== mime) throw new Error("Anexo indisponível");
      if (audio) setUrl(segura);
      else { await Linking.openURL(segura); if (!cancelado) setUrl(segura); }
    }).catch(() => { if (!cancelado) setFalhou(true); });
    return () => { cancelado = true; };
  }, [ativo, conversa, mensagem, mime, audio, tentativa]);
  const html = url && audio ? htmlAudioChat(url, process.env.EXPO_PUBLIC_SUPABASE_URL) : null;
  return <View style={{ width: 240, maxWidth: "100%", gap: 8 }}>
    {!ativo || falhou || (!audio && url) ? <Pressable accessibilityRole="button" onPress={() => { if (ativo) setTentativa(n => n + 1); else ativar(); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
      <Ionicons name={audio ? "play-circle-outline" : "document-outline"} size={28} color={colors.text} />
      <Text style={{ color: colors.text, flex: 1 }}>{falhou ? t("Tentar novamente") : audio ? t("Ouvir áudio") : t("Abrir documento")}</Text>
    </Pressable> : !url ? <ActivityIndicator accessibilityLabel={t("Carregando")} color={colors.brandMid} style={{ padding: 14 }} /> : null}
    {ativo && html && !falhou && <WebView ref={player} source={{ html }} originWhitelist={["*"]}
      style={{ height: 56, backgroundColor: "transparent" }} containerStyle={{ height: 56, flex: 0 }}
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction scrollEnabled={false} bounces={false}
      allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never" sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} incognito
      allowsAirPlayForMediaPlayback={false} allowsPictureInPictureMediaPlayback={false}
      javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={r => r.url === "about:blank"}
      onMessage={e => { if (e.nativeEvent.data === "audio-error") setFalhou(true); }}
      onError={() => setFalhou(true)} onHttpError={() => setFalhou(true)} />}
    {falhou && <Text accessibilityLiveRegion="polite" style={{ color: colors.textMuted }}>{t("Não foi possível abrir o anexo. Tente novamente.")}</Text>}
  </View>;
}
