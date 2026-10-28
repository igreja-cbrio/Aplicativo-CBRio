import * as WebBrowser from "expo-web-browser";
import { trackEvento } from "./telemetria";

import { router } from "expo-router";
import { urlFormularioEvento, urlPublicaCbrio } from "./eventoDestino";

export function abrirFormularioInscricao(url: string): void {
  const segura = urlPublicaCbrio(url);
  if (!segura) return;
  router.navigate({ pathname: "/inscricao-formulario", params: { url: segura } } as never);
}

export async function abrirInscricaoEvento(slugOrUrl: string): Promise<void> {
  const formulario = urlFormularioEvento(slugOrUrl);
  if (formulario) {
    trackEvento("inscricao_evento_abrir", { endpoint: "/evento" });
    abrirFormularioInscricao(formulario);
    return;
  }
  // Pagamento/comprovante externo mantém o fluxo já suportado pelo provedor.
  const url = slugOrUrl;
  if (!/^https:\/\//i.test(url)) return;
  try {
    trackEvento("inscricao_evento_abrir", { endpoint: "/evento/link" });
    await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "close" });
  } catch {
    // se o browser in-app falhar, cai pro externo
    const { Linking } = await import("react-native");
    Linking.openURL(url).catch(() => {});
  }
}
