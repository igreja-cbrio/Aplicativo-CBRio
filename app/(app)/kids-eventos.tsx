// KIDS › Fique por dentro (eventos).
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { View } from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { KidsSecao, makeCardStyles } from "@/components/kids/KidsSecao";
import { dataBR, horaCurta } from "@/lib/kidsArea";

export default function KidsEventosScreen() {
  const colors = useColors();
  const s = useMemo(() => makeCardStyles(colors), [colors]);
  const t = useT();
  return (
    <KidsSecao
      rota="/kids-eventos"
      titulo={t("Fique por dentro")}
      vazio={t("Nenhum evento previsto por enquanto.")}
      itens={(a) => a.eventos.map((e) => {
        const quando = [dataBR(e.data), horaCurta(e.hora)].filter(Boolean).join(" · ");
        return (
          <View key={e.id} style={[s.card, e.destaque && s.cardDestaque]}>
            {e.destaque ? <Text style={s.selo}>{t("Destaque")}</Text> : null}
            <Text style={s.cardTitulo}>{e.titulo}</Text>
            {quando ? <Text style={s.meta}>{quando}</Text> : null}
            {e.local ? <Text style={s.meta}>{e.local}</Text> : null}
            {e.descricao ? <Text style={s.cardCorpo}>{e.descricao}</Text> : null}
          </View>
        );
      })}
    />
  );
}
