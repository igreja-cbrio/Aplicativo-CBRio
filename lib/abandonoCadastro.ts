// ABANDONO DO FORMULÁRIO DE CADASTRO, POR CAMPO (27/11/2026 · Fase 3 da entrada).
//
// No lançamento (25-26/11), 13 pessoas largaram o formulário de cadastro e não
// havia como saber em que campo. Aqui mora a conta do "onde a pessoa parou":
// o último campo tocado e quais ela chegou a tocar, quando sai sem enviar.
//
// ⚠️ SEM DADO DA PESSOA: só o NOME do campo (enum nosso). Nunca o valor
// digitado, nem o tamanho dele.
// ⚠️ As chaves do evento são as que o servidor aceita (`ALLOWED_PROPS` do ERP):
// `source`, `label`, `reason`, `action`. Chave fora da lista é descartada lá.
//
// Régua PURA (sem React, sem rede). Quem liga à tela é `lib/useAbandonoCadastro.ts`.

export type FormularioMedido = "cadastro" | "completar";
export type MotivoAbandono = "saiu" | "pausa";

export const EVENTO_ABANDONO = "cadastro_abandono";
export const EVENTO_CAMPO_INVALIDO = "cadastro_campo_invalido";

export type PropsAbandono = {
  source: FormularioMedido;
  /** Último campo tocado, ou "nenhum" (abriu e saiu sem tocar em nada). */
  label: string;
  reason: MotivoAbandono;
  /** Campos tocados, na ordem do primeiro toque, separados por vírgula. */
  action: string;
};

export type MedidorAbandono = {
  tocar(campo: string): void;
  /** O envio começou: daqui em diante sair da tela não é abandono. */
  enviar(): void;
  /** O envio falhou e a pessoa continua no formulário. */
  reabrir(): void;
  /** O evento a mandar, ou null quando não houve abandono. */
  abandono(motivo: MotivoAbandono): PropsAbandono | null;
};

// O servidor corta `action` em 160 caracteres; os nomes de campo são curtos e
// a lista dos dois formulários cabe com folga. O corte aqui é só guarda.
const MAX_ACTION = 160;

export function criarMedidorAbandono(source: FormularioMedido): MedidorAbandono {
  const tocados: string[] = [];
  let ultimo: string | null = null;
  let enviando = false;
  // Uma "pausa" por saída do app: sem isso, cada ida e volta repetiria o
  // mesmo retrato. Tocar em outro campo libera um retrato novo.
  let pausaJaContada = false;

  return {
    tocar(campo) {
      if (!campo) return;
      ultimo = campo;
      if (!tocados.includes(campo)) tocados.push(campo);
      pausaJaContada = false;
    },
    enviar() { enviando = true; },
    reabrir() { enviando = false; },
    abandono(motivo) {
      if (enviando) return null;
      if (motivo === "pausa") {
        // Sair do app sem ter tocado em nada não diz nada sobre o formulário.
        if (!ultimo || pausaJaContada) return null;
        pausaJaContada = true;
      }
      return {
        source,
        label: ultimo ?? "nenhum",
        reason: motivo,
        action: tocados.join(",").slice(0, MAX_ACTION),
      };
    },
  };
}

/** O primeiro campo vazio, na ordem da tela (para o "Preencha todos os campos"). */
export function primeiroCampoVazio(campos: readonly (readonly [string, unknown])[]): string {
  for (const [nome, valor] of campos) {
    if (valor == null || String(valor).trim() === "") return nome;
  }
  return "nenhum";
}
