import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import ApplePay from "../modules/apple-pay";

// API do ERP CBRio (mesma app). O .pkpass é gerado on-demand e devolvido binário.
// Usa o host canônico (www) direto: o apex cbrio.org responde 307 e o fetch do
// React Native trava no redirect de POST (perde o corpo) -> spinner infinito.
const API = "https://www.cbrio.org/api";

// fetch com timeout: sem isso, uma resposta que nunca chega prende o botão pra
// sempre. Com timeout, falha com erro claro.
async function fetchComTimeout(
  url: string,
  options: RequestInit,
  ms = 20000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Tempo esgotado ao gerar o cartão. Tente de novo.");
    }
    throw new Error("Falha de conexão ao gerar o cartão.");
  } finally {
    clearTimeout(id);
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

async function abrirPkpass(resp: Response, nome: string) {
  const ct = resp.headers.get("content-type") || "";
  if (!resp.ok || !ct.includes("pkpass")) {
    let msg = "Não foi possível gerar o cartão.";
    try {
      const j = await resp.json();
      msg = j.error || j.message || msg;
    } catch {
      /* corpo não-JSON */
    }
    throw new Error(msg);
  }
  const buf = await resp.arrayBuffer();
  const b64 = toBase64(new Uint8Array(buf));

  // iOS: abre direto a tela nativa "Adicionar à Apple Wallet" (PassKit /
  // PKAddPassesViewController) a partir do passe em base64. Adicionar um passe
  // não exige entitlement — funciona até com Apple ID gratuito.
  if (Platform.OS === "ios") {
    const podeAdicionar = await ApplePay.canAddPasses();
    if (!podeAdicionar) {
      throw new Error("Este dispositivo não suporta a Apple Wallet.");
    }
    await ApplePay.addPass(b64);
    return;
  }

  // Android (sem Apple Wallet): mantém o compartilhamento como fallback.
  const fileUri = `${FileSystem.cacheDirectory}${nome}.pkpass`;
  await FileSystem.writeAsStringAsync(fileUri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Compartilhamento indisponível neste dispositivo.");
  }
  await Sharing.shareAsync(fileUri, {
    UTI: "com.apple.pkpass",
    mimeType: "application/vnd.apple.pkpass",
  });
}

/** Cartão único (membresia) — público por CPF + data de nascimento. */
export async function adicionarWalletMembresia(
  cpf: string,
  dataNascimentoISO: string | null
) {
  const resp = await fetchComTimeout(`${API}/public/membresia/wallet/apple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cpf, data_nascimento: dataNascimentoISO }),
  });
  await abrirPkpass(resp, "cbrio-cartao");
}

/** Passe de voluntário (autenticado) — caso precise separado no futuro. */
export async function adicionarWalletVoluntario(accessToken: string) {
  const resp = await fetchComTimeout(`${API}/voluntariado/me/wallet/apple`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await abrirPkpass(resp, "cbrio-voluntario");
}
