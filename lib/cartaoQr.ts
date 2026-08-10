// ============================================================================
// POR QUE O QR DO CARTÃO NÃO APARECE (10/08/2026 · Onda B)
//
// ⚠️⚠️ O DEFEITO: a tela mostrava `"QR indisponível"` e parava aí. Três estados
// muito diferentes davam a MESMA frase, e nenhum dizia o que fazer:
//   · a pessoa não tem cadastro vinculado;
//   · o cadastro existe mas está **sem CPF** — e é o caso da MAIORIA:
//     medido em 10/08, **26 das 54 contas do app com cadastro não têm CPF**;
//   · a chamada falhou (a tela fazia `const { data: tk } = await supabase.rpc(...)`
//     **descartando o erro**, então falha de rede virava "não disponível").
//
// ⚠️ A RPC `app_meu_qrcode` devolve NULL quando não acha CPF (ela junta
// `profiles` → `mem_membros` e sai por `if v_cpf is null then return null`).
// Ou seja: NULL é resposta legítima, não erro — e é por isso que distinguir
// importa. O QR mapeia token → CPF e é o mesmo lido pelos leitores de membresia
// e de check-in; sem CPF não existe QR possível, então a tela precisa PEDIR o
// CPF, não anunciar indisponibilidade.
// ============================================================================

export type EstadoQr =
  /** Tem token: pode desenhar o QR. */
  | "ok"
  /** Conta sem cadastro vinculado — o caminho é completar o cadastro. */
  | "sem_vinculo"
  /** Cadastro existe mas sem CPF — é o caso da maioria hoje. */
  | "sem_cpf"
  /** A chamada falhou (rede, cota, servidor). Tentar de novo resolve. */
  | "erro";

/**
 * Classifica o estado do QR a partir do que a tela conseguiu apurar.
 *
 * ⚠️ A ORDEM é o ponto: `erro` vem PRIMEIRO. Se a chamada falhou, não se sabe
 * nada sobre CPF nem vínculo — dizer "complete seu CPF" pra quem teve timeout
 * manda a pessoa mexer num cadastro que já está certo. É a mesma lei do
 * `lib/falhaDeLeitura.ts`: "não consegui perguntar" ≠ "a resposta é não".
 */
export function estadoDoQr(args: {
  token: string | null | undefined;
  membroId: string | null | undefined;
  cpf: string | null | undefined;
  falhou: boolean;
}): EstadoQr {
  if (args.falhou) return "erro";
  if (args.token && String(args.token).trim()) return "ok";
  if (!args.membroId) return "sem_vinculo";
  if (!temCpf(args.cpf)) return "sem_cpf";
  // Vinculado, com CPF, sem token e sem erro: a RPC devolveu vazio sem motivo
  // conhecido. Trata como erro (tentar de novo) em vez de inventar explicação.
  return "erro";
}

/** CPF utilizável: 11 dígitos. Máscara e espaço não contam. */
export function temCpf(cpf: string | null | undefined): boolean {
  return String(cpf ?? "").replace(/\D/g, "").length === 11;
}

/**
 * O estado permite desenhar o QR?
 *
 * ⚠️ Existe pra a tela nunca passar `value={token}` com token vazio: o
 * `react-native-qrcode-svg` renderiza um quadrado preto sem sentido em vez de
 * falhar, e um QR ilegível no leitor da recepção é pior que a ausência dele.
 */
export function podeDesenharQr(estado: EstadoQr): boolean {
  return estado === "ok";
}
