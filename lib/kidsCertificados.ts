// KIDS › Certificados de Apresentação de Crianças (17/11/2026).
//
// A equipe do Kids libera o certificado no ERP; o responsável AUTORIZADO
// (`kids_responsaveis.autorizado_buscar`) com a ficha do app confirmada vê aqui.
// Quem pode ver é decidido no BACKEND, a cada pedido: este arquivo só chama a
// API, confere a URL que voltou e prepara o arquivo.
//
// O PDF nunca passa por URL pública: a API devolve uma URL ASSINADA de 120 s do
// bucket privado `kids-certificados`, e o app recusa qualquer outra.
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";
import { apiGet } from "./api";
import { compartilharPdfPrivado, salvarPdfPrivado, type ResultadoSalvar } from "./pdfPrivado";

export type CertificadoKids = {
  id: string;
  crianca_id: string;
  crianca_nome: string;
  data_apresentacao: string;
  liberado_em: string;
};

const HOST = "hhntwfawfnxvuobhdfkb.supabase.co";
const PREFIXO = "/storage/v1/object/sign/kids-certificados/";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const carregarCertificadosKids = () =>
  apiGet<{ certificados: CertificadoKids[] }>("/app/kids/certificados");

/** Só aceita a URL assinada do bucket privado do certificado. */
export function urlDeCertificadoValida(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host === HOST && u.pathname.startsWith(PREFIXO);
  } catch {
    return false;
  }
}

export async function obterCertificadoUrl(id: string, modo: "ver" | "baixar") {
  const r = await apiGet<{ url: string; nome: string }>(
    `/app/kids/certificados/${encodeURIComponent(id)}/pdf?modo=${modo}`,
  );
  if (!r?.url || !urlDeCertificadoValida(r.url))
    throw new Error("Não foi possível abrir o certificado. Tente novamente.");
  return r;
}

export { destinoCertificadoKids } from "./kidsCertificadoDestino";

/** "2026-10-12" → "12 de outubro de 2026". */
export function dataPorExtenso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return "";
  return `${Number(m[3])} de ${MESES[mes - 1]} de ${m[1]}`;
}

/** Nome do arquivo: "Certificado de apresentação - Nome.pdf". */
export function nomeDoArquivo(c: Pick<CertificadoKids, "crianca_nome">) {
  const nome = String(c.crianca_nome || "").trim() || "criança";
  return `Certificado de apresentação - ${nome}.pdf`;
}

/** O certificado do push vem primeiro na lista; o resto segue a ordem da API. */
export function ordenarComDestaque(lista: CertificadoKids[], destaque?: string) {
  if (!destaque) return lista;
  const i = lista.findIndex((c) => c.id === destaque);
  if (i <= 0) return lista;
  return [lista[i], ...lista.slice(0, i), ...lista.slice(i + 1)];
}

function opcoes(c: CertificadoKids) {
  return {
    obterUrl: async () => (await obterCertificadoUrl(c.id, "baixar")).url,
    prefixo: "certificado",
    nomeArquivo: nomeDoArquivo(c),
    titulo: "Certificado de apresentação",
    erroDownload: "Não foi possível baixar o certificado. Tente novamente.",
  };
}

/**
 * Ver: abre o PDF no navegador do app (Safari embutido no iOS; aba do Chrome no
 * Android, que mostra o PDF ou o baixa, conforme a versão).
 */
export async function verCertificado(c: CertificadoKids) {
  const { url } = await obterCertificadoUrl(c.id, "ver");
  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }
  // ⚠️ NÃO esperar o navegador FECHAR: no iOS 26 a promessa do
  // SFSafariViewController pode não voltar depois do "X", e a tela ficava
  // travada com todos os botões desligados (achado no simulador em 17/11).
  // A ação termina quando o navegador ABRE; ele cobre a tela enquanto está aberto.
  WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "close" }).catch(() => {});
}

export const compartilharCertificado = (c: CertificadoKids) => compartilharPdfPrivado(opcoes(c));
export const salvarCertificado = (c: CertificadoKids): Promise<ResultadoSalvar> => salvarPdfPrivado(opcoes(c));
