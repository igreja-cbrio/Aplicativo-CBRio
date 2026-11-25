import { useState } from "react";
import { Pressable, type StyleProp, type TextStyle } from "react-native";
import { Text } from "@/components/ui/Typography";
import { resumirTrecho } from "@/lib/trechoBiblico";
import { useT } from "@/lib/i18n";

/** Texto bíblico entre aspas, cortado em LIMITE_TRECHO com "Ver mais" / "Ver menos". */
export function TrechoBiblico({ texto, style, corLink }: { texto: string; style?: StyleProp<TextStyle>; corLink: string }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const { curto, cortado } = resumirTrecho(texto);
  if (!curto) return null;
  const completo = texto.replace(/\s+/g, " ").trim();
  return <>
    <Text style={style}>“{aberto ? completo : curto}”</Text>
    {cortado && <Pressable onPress={() => setAberto(a => !a)} hitSlop={8} accessibilityRole="button">
      <Text style={{ color: corLink, fontWeight: "800", fontSize: 13 }}>{aberto ? t("Ver menos") : t("Ver mais")}</Text>
    </Pressable>}
  </>;
}
