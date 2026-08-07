// ============================================================================
// POR QUE O PUSH NÃO REGISTROU · classificação (07/08/2026 · fecho da Onda 2)
//
// O ACHADO QUE ISTO EXPÕE: `app_push_tokens` tem 30 linhas, **todas iOS**.
// **Zero Android**, desde sempre. E 7 das 8 contas que já abriram o app num
// Android nunca tiveram token nenhum.
//
// A causa está nos ARQUIVOS, não em suposição: o projeto **nunca teve**
// `android.googleServicesFile` no app.json nem `google-services.json` no repo
// (`git log --all` volta vazio nos dois). Sem isso o binário sai sem Firebase,
// `FirebaseMessaging.getInstance()` lança `IllegalStateException`, e
// `getExpoPushTokenAsync` falha na PRIMEIRA linha — antes do projectId, antes
// de falar com o servidor da Expo.
//
// ⚠️⚠️ O QUE ESCONDEU ISSO POR DOIS MESES: o `catch` de `registerForPush` só
// fazia `console.log`. Sem telemetria, a falha não existia em painel nenhum —
// o app fazia exatamente o que foi mandado e sumia com o erro. Esta régua
// existe pra transformar a mensagem opaca do módulo nativo num ENUM curto que
// o painel consegue CONTAR, e é por isso que ela é testada: se ela classificar
// errado, o conserto vai ser verificado contra o número errado.
//
// ⚠️ O conserto de verdade NÃO sai daqui e NÃO sai por OTA: exige projeto
// Firebase, `google-services.json` no app.json e BUILD Android novo.
// ============================================================================

export type MotivoPush =
  /** Binário sem Firebase — a causa medida hoje em 100% dos Android. */
  | "credencial_fcm"
  /** A pessoa recusou (ou o SO recusou) a notificação. */
  | "permissao"
  /** Simulador iOS não emite token. Não é defeito. */
  | "simulador"
  /** Sem internet no momento do registro. Some sozinho na próxima abertura. */
  | "rede"
  /** Faltou o projectId do EAS (app.json extra.eas.projectId). */
  | "sem_project_id"
  /** Nada acima bateu — a mensagem crua vai junto no evento pra leitura humana. */
  | "outro";

/**
 * Classifica a falha de registro de push a partir do erro.
 *
 * ⚠️ Ordem importa: `credencial_fcm` é conferida ANTES de `permissao` porque a
 * mensagem do Firebase pode conter a palavra "permission" vinda do
 * `e.message` interpolado pelo módulo nativo, e trocar os dois faria o achado
 * de hoje (credencial) se disfarçar de "gente recusou" — que é justamente a
 * conclusão errada mais fácil de tirar de "zero token no Android".
 */
export function motivoDaFalhaPush(erro: unknown): MotivoPush {
  const texto = mensagemDoErro(erro).toLowerCase();
  if (!texto) return "outro";

  // A mensagem literal do expo-notifications quando o binário não tem Firebase
  // (`PushTokenModule.kt` → "Make sure to complete the guide at
  // https://docs.expo.dev/push-notifications/fcm-credentials/ : …").
  if (texto.includes("fcm-credentials") || texto.includes("firebase")) return "credencial_fcm";
  if (texto.includes("default firebaseapp") || texto.includes("google-services")) return "credencial_fcm";

  if (texto.includes("simulator") || texto.includes("emulator")) return "simulador";
  if (texto.includes("must be a physical device") || texto.includes("physical device")) return "simulador";

  if (texto.includes("permission") || texto.includes("denied") || texto.includes("not authorized")) {
    return "permissao";
  }
  if (texto.includes("aps") && texto.includes("entitlement")) return "credencial_fcm";

  if (texto.includes("network") || texto.includes("timeout") || texto.includes("timed out")) return "rede";
  if (texto.includes("failed to fetch") || texto.includes("econnrefused")) return "rede";

  if (texto.includes("projectid") || texto.includes("project id")) return "sem_project_id";

  return "outro";
}

/**
 * Mensagem curta e segura pro campo `message` da telemetria.
 *
 * ⚠️ Teto de 300 caracteres: a mensagem do módulo nativo interpola o erro do
 * Firebase e fica longa. E ela NUNCA carrega dado de pessoa — é texto de
 * biblioteca —, mas o corte também é a garantia de que um erro inesperado não
 * despeje um payload inteiro no banco.
 */
export function mensagemDoErro(erro: unknown): string {
  if (erro == null) return "";
  if (typeof erro === "string") return erro.trim().slice(0, 300);
  const e = erro as { message?: unknown };
  const m = typeof e.message === "string" ? e.message : String(erro);
  return m.trim().slice(0, 300);
}
