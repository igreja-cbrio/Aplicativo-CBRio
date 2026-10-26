import { useFonts } from "expo-font";
import type { TextStyle } from "react-native";

export const FONT_MAP = {
  "Gotham-Light": require("../assets/fonts/Gotham-Light.otf"),
  "Gotham-Book": require("../assets/fonts/Gotham-Book.otf"),
  "Gotham-Medium": require("../assets/fonts/Gotham-Medium.otf"),
  "Gotham-Bold": require("../assets/fonts/Gotham-Bold.otf"),
  "Gotham-Black": require("../assets/fonts/Gotham-Black.otf"),
  "Gotham-Italic": require("../assets/fonts/Gotham-Italic.otf"),
  "Gotham-BoldItalic": require("../assets/fonts/Gotham-BoldItalic.ttf"),
  // Fonte de marca CBRio — usar em títulos/momentos de destaque
  // (ex.: hero do batismo, contagem regressiva, headers fortes). Para
  // body/UI normal, deixar a Gotham resolvida automaticamente.
  iBrand: require("../assets/fonts/iBrand.otf"),
} as const;

/** Alias semântico pra usar nos estilos: `fontFamily: BRAND_FONT`. */
export const BRAND_FONT = "iBrand" as const;

export function useFontsCbrio(): boolean {
  const [loaded] = useFonts(FONT_MAP);
  return loaded;
}

/** Resolve uma fontFamily Gotham a partir do peso + itálico do estilo. */
export function familyParaPeso(weightRaw: TextStyle["fontWeight"], italic: boolean): string {
  const w = String(weightRaw ?? "");
  // Mapa de pesos numéricos / nomes -> família real
  if (italic) {
    if (w === "bold" || w === "700" || w === "800" || w === "900") return "Gotham-BoldItalic";
    return "Gotham-Italic";
  }
  switch (w) {
    case "100":
    case "200":
    case "300":
      return "Gotham-Light";
    case "400":
    case "":
    case "normal":
      return "Gotham-Book";
    case "500":
    case "600":
      return "Gotham-Medium";
    case "700":
    case "bold":
      return "Gotham-Bold";
    case "800":
    case "900":
      return "Gotham-Black";
    default:
      return "Gotham-Book";
  }
}
