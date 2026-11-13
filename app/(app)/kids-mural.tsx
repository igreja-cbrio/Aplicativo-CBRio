// KIDS › Mural de avisos.
import { useKidsTheme } from "@/contexts/KidsThemeContext";
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { KidsSecao, makeCardStyles } from "@/components/kids/KidsSecao";

export default function KidsMuralScreen() {
  const { colors, mode } = useTheme();
  const { tema } = useKidsTheme();
  const s = useMemo(() => makeCardStyles(colors, mode === "dark" ? tema.fundo : tema.tinta), [colors, tema, mode]);
  const t = useT();
  return (
    <KidsSecao
      rota="/kids-mural"
      titulo={t("Mural de avisos")}
      acaoCabecalho={<Pressable onPress={() => router.navigate("/kids-eventos")} accessibilityRole="button" accessibilityLabel={t("Calendário de eventos do Kids")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: tema.fundo }}><Ionicons name="calendar-outline" size={25} color="#253D44" /></Pressable>}
      vazio={t("Nenhum aviso por enquanto.")}
      itens={(a) => a.mural.map((m) => (
        <View key={m.id} style={[s.card, m.destaque && s.cardDestaque]}>
          {m.destaque ? <Text style={s.selo}>{t("Destaque")}</Text> : null}
          <Text style={s.cardTitulo}>{m.titulo}</Text>
          <Text style={s.cardCorpo}>{m.corpo}</Text>
        </View>
      ))}
    />
  );
}
