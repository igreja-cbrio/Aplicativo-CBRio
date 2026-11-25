// KIDS › Mural de avisos.
import { useKidsTheme } from "@/contexts/KidsThemeContext";
import { Text } from "@/components/ui/Typography";
import { router, useLocalSearchParams } from "expo-router";
import { KidsAvisoCard } from "@/components/kids/KidsAvisoCard";
import { KidsAvisoDetalhe } from "@/components/kids/KidsAvisoDetalhe";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useT } from "@/lib/i18n";
import { KidsSecao } from "@/components/kids/KidsSecao";

export default function KidsMuralScreen() {
  const { tema } = useKidsTheme();
  const t = useT();
  const { aviso } = useLocalSearchParams<{ aviso?: string }>();
  if (aviso) return <KidsAvisoDetalhe id={aviso} />;
  return (
    <KidsSecao
      rota="/kids-mural"
      titulo={t("Mural de avisos")}
      acaoCabecalho={<Pressable onPress={() => router.navigate("/kids-eventos")} accessibilityRole="button" accessibilityLabel={t("Calendário de eventos do Kids")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: tema.fundo }}><Ionicons name="calendar-outline" size={25} color="#253D44" /></Pressable>}
      vazio={t("Nenhum aviso por enquanto.")}
      itens={(a) => a.mural.map((m) => <KidsAvisoCard key={`${m.id}:${m.foto_url || ""}`} aviso={m} />)}
    />
  );
}
