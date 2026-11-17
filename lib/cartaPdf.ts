import { obterCartaPdf } from "./cartaTransferencia";
import { compartilharPdfPrivado } from "./pdfPrivado";

/** URL curta da API autenticada. Cache temporário sem nome/dados da pessoa. */
export async function compartilharCartaPdf(id: string) {
  await compartilharPdfPrivado({
    obterUrl: async () => (await obterCartaPdf(id)).url,
    prefixo: "carta",
    nomeArquivo: "carta-de-transferencia.pdf",
    titulo: "Carta de transferência",
    erroDownload: "Não foi possível baixar a carta. Tente novamente.",
  });
}
