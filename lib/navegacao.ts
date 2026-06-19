// Navegação · abre a rota até um destino no Google Maps ou no Waze, deixando o
// usuário escolher (Alert nativo). Usa coordenadas quando disponíveis; senão o
// endereço em texto livre.
import { Alert, Linking } from "react-native";

type Destino = { lat?: number | null; lng?: number | null; endereco?: string | null };

export function urlsRota({ lat, lng, endereco }: Destino) {
  const temCoords = lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  const q = encodeURIComponent((endereco || "").trim());
  return {
    google: temCoords
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: temCoords
      ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://waze.com/ul?q=${q}&navigate=yes`,
    temDestino: temCoords || q.length > 0,
  };
}

// Mostra a escolha Google Maps / Waze. Os rótulos de título/cancelar são
// passados já traduzidos pela tela (mantém o i18n na borda).
export function abrirRota(destino: Destino, labels?: { titulo?: string; cancelar?: string }) {
  const { google, waze, temDestino } = urlsRota(destino);
  if (!temDestino) return;
  Alert.alert(labels?.titulo || "Como chegar", undefined, [
    { text: "Google Maps", onPress: () => Linking.openURL(google) },
    { text: "Waze", onPress: () => Linking.openURL(waze) },
    { text: labels?.cancelar || "Cancelar", style: "cancel" },
  ]);
}
