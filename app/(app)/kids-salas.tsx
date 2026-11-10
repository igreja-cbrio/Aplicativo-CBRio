// KIDS › Divisão das salas.
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { Image, View } from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { KidsSecao, makeCardStyles } from "@/components/kids/KidsSecao";
import { corValida } from "@/lib/kidsArea";

export default function KidsSalasScreen() {
  const colors = useColors();
  const s = useMemo(() => makeCardStyles(colors), [colors]);
  const t = useT();
  return (
    <KidsSecao
      rota="/kids-salas"
      titulo={t("Divisão das salas")}
      vazio={t("A divisão das salas será divulgada em breve.")}
      itens={(a) => a.salas.map((sala) => (
        <View key={sala.id} style={[s.card, s.salaRow]}>
          {sala.logo_url ? <Image source={{ uri: sala.logo_url }} style={s.salaLogo} resizeMode="contain" /> : null}
          <View style={[s.bolinha, { backgroundColor: corValida(sala.cor) }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitulo}>{sala.nome}</Text>
            {sala.faixa ? <Text style={s.meta}>{sala.faixa}</Text> : null}
          </View>
        </View>
      ))}
    />
  );
}
