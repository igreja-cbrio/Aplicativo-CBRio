/**
 * Dados PIX da igreja CBRio — usados na aba Generosidade.
 *
 * Como atualizar:
 *  - PIX_KEY: chave estática (CNPJ/e-mail/telefone/aleatória). Aparece
 *    pra cópia rápida.
 *  - PIX_PAYLOAD: BR Code completo ("copia-e-cola" — string longa que
 *    começa com 00020126... que carrega valor + chave + dados do
 *    recebedor). Quando o usuário tocar "Copiar PIX", isso vai pra
 *    área de transferência. Também é o que vira o QR Code da tela.
 *  - PIX_BENEFICIARIO / PIX_CIDADE: metadados pra exibir.
 *
 * Se você só tem a chave (sem BR Code), pode gerar o BR Code no
 * próprio app do banco e colar aqui — assim o pagamento já vem
 * preenchido pro doador (sem precisar digitar valor).
 */

// CNPJ da CBRio (chave PIX).
export const PIX_KEY = "07023068000135";
export const PIX_KEY_FORMATADA = "07.023.068/0001-35";
export const PIX_KEY_TIPO = "CNPJ";
// BR Code "copia-e-cola" completo (gere no app do banco da igreja
// pra carregar valor + dados do recebedor). Deixe vazio se for cópia
// só da chave.
export const PIX_PAYLOAD = "";
export const PIX_BENEFICIARIO = "Igreja CBRio";
export const PIX_CIDADE = "Rio de Janeiro";
export const PIX_BANCO = "—";
