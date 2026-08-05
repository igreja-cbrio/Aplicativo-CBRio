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

// ⚠️ CNPJ da igreja — constante PRÓPRIA porque NÃO é a chave PIX. O
// comprovante anual de doações imprime "CNPJ <...>" e estava lendo
// PIX_KEY_FORMATADA: quando a chave virou e-mail (05/08/2026), o comprovante
// passou a dizer "CNPJ pix@cbrio.com.br". Dado fiscal não empresta constante.
export const CNPJ_IGREJA = "07.023.068/0001-35";

// Chave PIX atual da CBRio (informada pelo Marcos em 05/08/2026).
// ⚠️ NÃO É EXIBIDA EM LUGAR NENHUM hoje: o único leitor é o módulo de doações,
// que está desligado por `FEATURES.generosidade`. A tela que mostrava a chave
// foi RETIRADA no mesmo dia — mostrar chave de doação no app é o que a
// guideline 3.2.2(iv) da App Store proíbe, e o Marcos preferiu não arriscar o
// app sair do ar ("vamos pensar em uma forma de fazer isso posteriormente").
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
