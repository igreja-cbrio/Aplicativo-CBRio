// Abre o formulário público de inscrição de um evento (espinha /inscricoes) num
// navegador in-app. A MESMA página do site trata inscrição gratuita e paga
// (paga → redireciona pro checkout do Asaas). Não reimplementamos o contrato de
// dados nem o PCI no app — reusamos o fluxo já validado em produção.
import * as WebBrowser from "expo-web-browser";
import { trackEvento } from "./telemetria";

const BASE_PUBLICO = "https://www.cbrio.org/evento/";

export async function abrirInscricaoEvento(slugOrUrl: string): Promise<void> {
  const url = slugOrUrl.startsWith("http") ? slugOrUrl : `${BASE_PUBLICO}${slugOrUrl}`;
  try {
    trackEvento("inscricao_evento_abrir", { endpoint: url });
    await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "close" });
  } catch {
    // se o browser in-app falhar, cai pro externo
    const { Linking } = await import("react-native");
    Linking.openURL(url).catch(() => {});
  }
}
