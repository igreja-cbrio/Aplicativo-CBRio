import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import WebView from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Typography";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { alturasOnda, htmlAudioChat, urlAnexoChat } from "@/lib/chatAudio";

export function AnexoChatEquipe({ conversa, mensagem, mime, ativo, ativar, meu = false }: { conversa: string; mensagem: string; mime: string; ativo: boolean; ativar: () => void; meu?: boolean }) {
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
  const tinta = meu ? "#ffffff" : colors.text;
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
  const html = url && audio ? htmlAudioChat(url, process.env.EXPO_PUBLIC_SUPABASE_URL, meu, tinta) : null;
  // Onda estável por mensagem (mesmo algoritmo do player): a prévia já mostra
  // o layout novo antes de carregar o áudio.
  const onda = useMemo(() => (audio ? alturasOnda(mensagem) : []), [audio, mensagem]);
  return <View style={{ width: 240, maxWidth: "100%", gap: 8 }}>
    {!ativo || falhou || (!audio && url) ? <Pressable accessibilityRole="button" accessibilityLabel={audio ? (falhou ? t("Tentar novamente") : t("Ouvir áudio")) : t("Abrir documento")} onPress={() => { if (ativo) setTentativa(n => n + 1); else ativar(); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
      {audio ? <>
        <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: tinta, alignItems: "center", justifyContent: "center", opacity: 0.9 }}>
          <Ionicons name="play" size={18} color={tinta} style={{ marginLeft: 2 }} />
        </View>
        <View style={{ flex: 1, height: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 1 }}>
          {onda.map((h, i) => <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: tinta, opacity: 0.35 }} />)}
        </View>
        {falhou ? <Text style={{ color: tinta, fontSize: 12 }}>{t("Tentar novamente")}</Text> : null}
      </> : <>
        <Ionicons name="document-outline" size={28} color={tinta} />
        <Text style={{ color: tinta, flex: 1 }}>{falhou ? t("Tentar novamente") : t("Abrir documento")}</Text>
      </>}
    </Pressable> : !url ? <ActivityIndicator accessibilityLabel={t("Carregando")} color={colors.brandMid} style={{ padding: 14 }} /> : null}
    {ativo && html && !falhou && <WebView ref={player} source={{ html }} originWhitelist={["*"]}
      style={{ height: 64, backgroundColor: "transparent" }} containerStyle={{ height: 64, flex: 0 }}
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction scrollEnabled={false} bounces={false}
      allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never" sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} incognito
      allowsAirPlayForMediaPlayback={false} allowsPictureInPictureMediaPlayback={false}
      javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={r => r.url === "about:blank"}
      onMessage={e => { if (e.nativeEvent.data === "audio-error") setFalhou(true); }}
      onError={() => setFalhou(true)} onHttpError={() => setFalhou(true)} />}
    {falhou && <Text accessibilityLiveRegion="polite" style={{ color: tinta }}>{t("Não foi possível abrir o anexo. Tente novamente.")}</Text>}
  </View>;
}
