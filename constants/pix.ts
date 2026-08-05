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

// Chave PIX da CBRio. Trocada de CNPJ pra E-MAIL em 05/08/2026 (informada
// pelo Marcos). Fonte ÚNICA: tanto a tela simples de Generosidade quanto o
// módulo completo de doações leem daqui.
export const PIX_KEY = "pix@cbrio.com.br";
export const PIX_KEY_FORMATADA = "pix@cbrio.com.br";
export const PIX_KEY_TIPO = "E-mail";
// BR Code "copia-e-cola" completo (gere no app do banco da igreja
// pra carregar valor + dados do recebedor). Deixe vazio se for cópia
// só da chave.
export const PIX_PAYLOAD = "";
export const PIX_BENEFICIARIO = "Igreja CBRio";
export const PIX_CIDADE = "Rio de Janeiro";
export const PIX_BANCO = "—";
