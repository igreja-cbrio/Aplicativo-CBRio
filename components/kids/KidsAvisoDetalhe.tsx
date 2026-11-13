import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import type { Mural } from "@/lib/kidsArea";
import { KidsAvisoCard } from "./KidsAvisoCard";
export function KidsAvisoDetalhe({ id }: { id: string }) {
  const colors=useColors(); const t=useT(); const {user}=useAuth();
  const [aviso,setAviso]=useState<Mural|null>(null);
  const [loading,setLoading]=useState(true);
  const [erro,setErro]=useState(false);
  const [indisponivel,setIndisponivel]=useState(false);
  const [retry,setRetry]=useState(0);
  useFocusEffect(useCallback(()=>{
    let ativo=true; setLoading(true); setAviso(null); setErro(false); setIndisponivel(false);
    apiGet<Mural>(`/app/kids/mural/${encodeURIComponent(id)}`).then(r=>{if(ativo)setAviso(r);}).catch((e)=>{if(ativo){setErro(true);setIndisponivel(e?.status === 404);}}).finally(()=>{if(ativo)setLoading(false);});
    return ()=>{ativo=false;setAviso(null);};
  },[id,user?.id,retry]));
  return <SafeAreaView edges={["left","right"]} style={{flex:1,backgroundColor:colors.background}}>
    <ScrollView contentContainerStyle={{padding:20,gap:16}} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>setRetry(x=>x+1)} tintColor={colors.brandMid} />}>
      <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Voltar ao mural")} onPress={()=>router.replace("/kids-mural")} style={{padding:10}}><Ionicons name="chevron-back" size={24} color={colors.text}/></Pressable>
        <Text style={{fontSize:22,fontWeight:"800",color:colors.text}}>{t("Mural de avisos")}</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.brandMid}/> : aviso ? <KidsAvisoCard key={aviso.foto_url || aviso.id} aviso={aviso}/> : <View style={{gap:16}}><Text style={{color:colors.text}}>{indisponivel ? t("Este aviso pode ter sido retirado ou não estar disponível para você.") : t("Não foi possível carregar o aviso. Confira sua conexão e tente novamente.")}</Text>{erro ? <Pressable onPress={()=>setRetry(x=>x+1)} accessibilityRole="button" style={{padding:14}}><Text style={{color:colors.brandMid}}>{t("Tentar novamente")}</Text></Pressable> : null}</View>}
    </ScrollView>
  </SafeAreaView>;
}
