// NOME COMPLETO · espelho da régua do servidor (26/11/2026).
//
// No lançamento, 2 de 84 cadastros por e-mail foram recusados pelo servidor por
// causa do NOME: uma pessoa digitou só o primeiro nome, a outra abreviou ("S.").
// A conta já tinha sido criada, a recusa foi engolida e as duas caíram na tela
// de CPF sem saber por quê.
//
// Régua gêmea de `validarCamposPadrao` (backend/services/inscricaoContrato.js) e
// `temAbreviacaoNome` (backend/utils/camposContato.js) do ERP: pelo menos 5
// letras e 2 palavras; parte com "." ou de 1 letra é abreviação; conectivo passa.
// Mudou lá, muda aqui (mesma tabela de casos no teste).
//
// Régua PURA: devolve a chave de tradução do erro, ou null quando o nome serve.

const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e"]);

export const ERRO_NOME_INCOMPLETO = "Escreva seu nome completo.";
export const ERRO_NOME_ABREVIADO = "Escreva o nome completo, sem abreviações.";

export function temAbreviacaoNome(nome: string): boolean {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  return partes.some((p) => {
    const limpa = p.replace(/\./g, "");
    if (CONECTIVOS.has(limpa.toLowerCase())) return false;
    return p.includes(".") || limpa.length <= 1;
  });
}

export function erroNomeCompleto(nome: string): string | null {
  const limpo = String(nome || "").trim().replace(/\s+/g, " ");
  if (limpo.length < 5 || limpo.split(" ").length < 2) return ERRO_NOME_INCOMPLETO;
  if (temAbreviacaoNome(limpo)) return ERRO_NOME_ABREVIADO;
  return null;
}
