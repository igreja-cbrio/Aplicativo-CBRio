// ============================================================================
// FICHA DA PESSOA · o que as inscrições NÃO devem reperguntar (05/08/2026)
//
// Regra do Marcos: "pra entrar no app hoje a pessoa já deve ter preenchido a
// ficha de cadastro — nas inscrições ela só preenche campos A MAIS, e nunca os
// padrão que já foram preenchidos".
//
// ⚠️ Estava dentro de `components/inscricoes/SeusDados.tsx` (um .tsx que importa
// react-native), então não dava pra testar. Régua vive em `lib/` — é o que
// permite o CI travar mudança de semântica. O componente re-exporta pra não
// quebrar quem já importava de lá.
// ============================================================================

/** O mínimo pra mostrar o RESUMO em vez do formulário (nome+telefone+e-mail). */
export function fichaCompleta(
  m?: { nome?: string | null; telefone?: string | null; email?: string | null } | null
) {
  return !!(m?.nome && m.nome.trim().includes(" ") && m?.telefone && m?.email);
}

/** Campos da ficha PADRÃO que o Contrato de Inscrição exige (nome do campo → rótulo). */
export const CAMPOS_CONTRATO = {
  nome: "nome completo",
  telefone: "telefone",
  email: "e-mail",
  cpf: "CPF",
  dataNascimento: "data de nascimento",
  genero: "sexo",
} as const;

export type MembroFicha = {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  cpf?: string | null;
  dataNascimento?: string | null;
  genero?: string | null;
};

/**
 * O que falta pra a pessoa poder se inscrever em QUALQUER porta.
 * ⚠️ Espelha `validarCamposPadrao` do servidor (`exigirCpf`, `exigirEmail`,
 * `exigirNascimento` e `exigirSexo` são TRUE por padrão lá). Se esta lista
 * ficar mais frouxa que a do servidor, o app deixa a pessoa preencher um
 * formulário inteiro pra levar 400 no fim — foi o que acontecia com o CPF, que
 * barrava 50 das 75 contas na hora de pedir grupo.
 */
export function faltaNaFicha(m?: MembroFicha | null): string[] {
  const falta: string[] = [];
  if (!m) return Object.values(CAMPOS_CONTRATO);
  if (!(m.nome && m.nome.trim().includes(" "))) falta.push(CAMPOS_CONTRATO.nome);
  if (!(m.telefone && String(m.telefone).replace(/\D/g, "").length >= 10)) {
    falta.push(CAMPOS_CONTRATO.telefone);
  }
  if (!m.email) falta.push(CAMPOS_CONTRATO.email);
  if (!(m.cpf && String(m.cpf).replace(/\D/g, "").length === 11)) falta.push(CAMPOS_CONTRATO.cpf);
  if (!m.dataNascimento) falta.push(CAMPOS_CONTRATO.dataNascimento);
  if (!m.genero) falta.push(CAMPOS_CONTRATO.genero);
  return falta;
}

/** Pode inscrever direto (sem passar pelo cadastro primeiro)? */
export function podeInscrever(m?: MembroFicha | null): boolean {
  return faltaNaFicha(m).length === 0;
}
