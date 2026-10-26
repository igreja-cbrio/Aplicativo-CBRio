import AsyncStorage from "@react-native-async-storage/async-storage";
import { FONT_SCALES, setAppFontScale, type FontScale } from "@/lib/fontScale";
export { currentFontMultiplier } from "@/lib/fontScale";

/** Restaura antes de montar as telas; Typography assina mudanças ao vivo. */
export async function loadFontScale() {
  try {
    const value = await AsyncStorage.getItem("cbrio.fontScale") as FontScale | null;
    if (value && FONT_SCALES[value]) setAppFontScale(value);
  } catch { /* mantém tamanho padrão */ }
}
