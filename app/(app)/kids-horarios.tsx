// KIDS › Horários de funcionamento.
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { View } from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { KidsSecao, makeCardStyles } from "@/components/kids/KidsSecao";

export default function KidsHorariosScreen() {
  const colors = useColors();
  const s = useMemo(() => makeCardStyles(colors), [colors]);
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
