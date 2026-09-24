import { Platform } from "react-native";

/**
 * Fonte serifada da leitura (Bíblia · devocional): Georgia no iOS; no Android
 * "Georgia" não existe e o RN cairia na Roboto em silêncio — "serif" é o alias
 * que o Android resolve pra Noto Serif.
 * ⚠️ Vive fora de `fonteLeitura.ts` de propósito: aquele é PURO (entra no
 * portão, que roda em Node sem react-native).
 */
export const FONTE_SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" });
