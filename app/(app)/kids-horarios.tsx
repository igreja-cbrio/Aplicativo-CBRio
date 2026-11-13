// KIDS › Horários de funcionamento.
import { useKidsTheme } from "@/contexts/KidsThemeContext";
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { KidsSecao, makeCardStyles } from "@/components/kids/KidsSecao";

export default function KidsHorariosScreen() {
  const { colors, mode } = useTheme();
  const { tema } = useKidsTheme();
  const s = useMemo(() => makeCardStyles(colors, mode === "dark" ? tema.fundo : tema.tinta), [colors, tema, mode]);
  const t = useT();
  return (
    <KidsSecao
      rota="/kids-horarios"
      titulo={t("Horários de funcionamento")}
      vazio={t("Os horários serão divulgados em breve.")}
      itens={(a) => [...a.horarios].sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0)).map((h) => (
        <View key={h.id} style={s.card}>
          <Text style={s.cardTitulo}>{h.rotulo}</Text>
          {h.descricao ? <Text style={s.cardCorpo}>{h.descricao}</Text> : null}
        </View>
      ))}
    />
  );
}
