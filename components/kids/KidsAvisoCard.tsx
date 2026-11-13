import { useState } from "react";
import { Image, Modal, Pressable, View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { useKidsTheme } from "@/contexts/KidsThemeContext";
import { useT } from "@/lib/i18n";
import { makeCardStyles } from "./KidsSecao";
import type { Mural } from "@/lib/kidsArea";

export function KidsAvisoCard({ aviso }: { aviso: Mural }) {
  const { colors, mode } = useTheme();
  const { tema } = useKidsTheme();
  const t = useT();
  const s = makeCardStyles(colors, mode === "dark" ? tema.fundo : tema.tinta);
  const [aberta,setAberta] = useState(false);
  const [erro,setErro] = useState(false);
  const [loading,setLoading] = useState(true);
  const [ratio,setRatio] = useState(1.5);
  return <View style={[s.card,aviso.destaque && s.cardDestaque]}>
    {aviso.destaque ? <Text style={s.selo}>{t("Destaque")}</Text> : null}
    <Text style={s.cardTitulo}>{aviso.titulo}</Text>
    {aviso.foto_url ? <>
      <Pressable onPress={()=>setAberta(true)} disabled={erro} accessibilityRole="button" accessibilityLabel={t("Ampliar foto do aviso")} style={{ marginVertical:8 }}>
        {!erro ? <Image source={{ uri:aviso.foto_url }} resizeMode="contain" style={{ width:"100%",aspectRatio:ratio,maxHeight:500,borderRadius:12 }} onLoad={e=>{ const {width,height}=e.nativeEvent.source; if(width && height) setRatio(width/height); setLoading(false); }} onError={()=>{setErro(true);setLoading(false);}} /> : <Text style={s.cardCorpo}>{t("Não foi possível carregar a foto. Puxe a tela para atualizar.")}</Text>}
        {loading ? <ActivityIndicator style={{position:"absolute",alignSelf:"center",top:"45%"}} color={colors.brandMid} /> : null}
      </Pressable>
      <Modal visible={aberta} transparent={false} animationType="fade" onRequestClose={()=>setAberta(false)}>
        <SafeAreaView style={{ flex:1,backgroundColor:"#10191c" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Fechar")} onPress={()=>setAberta(false)} style={{alignSelf:"flex-end",padding:16}}><Ionicons name="close" color="white" size={28} /></Pressable>
          <Image source={{uri:aviso.foto_url}} resizeMode="contain" style={{flex:1,width:"100%"}} accessibilityLabel={aviso.titulo} />
        </SafeAreaView>
      </Modal>
    </> : null}
    {aviso.corpo ? <Text style={s.cardCorpo}>{aviso.corpo}</Text> : null}
  </View>;
}
