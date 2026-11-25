// KIDS › Fique por dentro (eventos).
import { useKidsTheme } from "@/contexts/KidsThemeContext";
import { Text } from "@/components/ui/Typography";
import { CalendarioEventosKids } from "@/components/kids/CalendarioEventosKids";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { KidsSecao, makeCardStyles } from "@/components/kids/KidsSecao";
import { dataBR, horaCurta } from "@/lib/kidsArea";

export default function KidsEventosScreen() {
  const [dia, setDia] = useState<string | null>(null);
  const { colors, mode } = useTheme();
  const { tema } = useKidsTheme();
  const s = useMemo(() => makeCardStyles(colors, mode === "dark" ? tema.fundo : tema.tinta), [colors, tema, mode]);
  const t = useT();
  return (
    <KidsSecao
      rota="/kids-eventos"
      titulo={t("Calendário do Kids")}
      antesDosItens={(a) => <CalendarioEventosKids eventos={a.eventos} dia={dia} escolher={setDia} />}
      vazio={t("Nenhum evento previsto por enquanto.")}
      itens={(a) => a.eventos.filter(e => !dia || e.data?.slice(0, 10) === dia).map((e) => {
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
