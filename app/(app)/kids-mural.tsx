// KIDS › Mural de avisos.
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { View } from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { KidsSecao, makeCardStyles } from "@/components/kids/KidsSecao";

export default function KidsMuralScreen() {
  const colors = useColors();
  const s = useMemo(() => makeCardStyles(colors), [colors]);
  const t = useT();
  return (
    <KidsSecao
      rota="/kids-mural"
      titulo={t("Mural de avisos")}
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
