// ============================================================================
// Máscara de CPF · fonte ÚNICA no app (25/08/2026)
//
// ⚠️⚠️ Extraída de `app/(app)/completar-cadastro.tsx`, onde era função local.
// Quando a tela de "Adicionar pessoa" do grupo passou a pedir CPF (Marcos ·
// 25/08: *"queremos cadastro completo, os mesmos campos que solicitam a
// inscrição de grupos"*), copiá-la seria a TERCEIRA cópia de máscara no
// projeto — e a lei do Contrato de Inscrição é explícita: *"NÃO recriar cópias
// locais de máscara/CPF — era assim que divergia."*
//
// ⚠️ Isto é só APRESENTAÇÃO. Quem valida o dígito verificador é o SERVIDOR
// (`utils/cpf.cpfValido`, via `inscricaoContrato.validarCamposPadrao`): CPF é a
// chave FORTE do matcher, e validar identidade no cliente é validar nada.
// ============================================================================

export const soDigitosCpf = (s: string) => String(s || '').replace(/\D/g, '');

/** `12345678909` → `123.456.789-09`. ⚠️ TRUNCA em 11 dígitos: sem isso o campo
 *  aceita 20 e o servidor recusa lá na frente, sem a pessoa saber por quê. */
export function mascararCpf(v: string): string {
  const d = soDigitosCpf(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
