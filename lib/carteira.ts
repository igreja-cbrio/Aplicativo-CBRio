// Qual carteira digital o aparelho tem, e o que dizer quando o servidor recusa
// o passe. Régua PURA (a lei da casa: nada de decisão dentro do .tsx).
//
// ⚠️⚠️ POR QUE ISTO EXISTE (14/08/2026): a tela do cartão mostrava o botão
// **"Add to Apple Wallet" no ANDROID**, sem checar plataforma, e o toque caía no
// caminho do `.pkpass` — formato da Apple, que o Google Wallet não abre. O
// Android via o nome de outra plataforma e recebia um arquivo que nada no
// aparelho sabe ler. O backend já tinha a porta certa
// (`POST /public/membresia/wallet/google`), e ninguém a chamava.
export type Carteira = "apple" | "google";

/** `null` = plataforma sem carteira conhecida — a tela não promete botão. */
export function carteiraDe(os: string): Carteira | null {
  if (os === "ios") return "apple";
  if (os === "android") return "google";
  return null;
}

export type FalhaCarteira = "nao_configurado" | "sem_cadastro" | "dado_invalido" | "outro";

/**
 * Traduz o status do servidor no que a PESSOA precisa fazer.
 *
 * ⚠️ 503 é "a igreja ainda não ligou isso", não "seu cadastro tem problema":
 * mandar alguém conferir o próprio CPF por causa de uma credencial que falta no
 * servidor é fazê-la procurar erro onde não há.
 */
export function motivoFalhaCarteira(status: number): FalhaCarteira {
  if (status === 503) return "nao_configurado";
  if (status === 404) return "sem_cadastro";
  if (status === 400) return "dado_invalido";
  return "outro";
}
