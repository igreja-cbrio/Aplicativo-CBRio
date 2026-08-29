// ════════════════════════════════════════════════════════════════════════════
//  "Pode aplicar o bundle novo AGORA?" — a régua do portão de atualização
//
//  Relato do Matheus (29/08/2026): *"quem tá baixando o app pro Android, quando
//  a pessoa instala, algumas baixam e ele vem com uma versão antiga, como se não
//  tivesse subido o OTA pra ela. Aí a pessoa tem que fechar e abrir o app para
//  subir o OTA novo. Na instalação, já deve vir com a última versão."*
//
//  ⚠️⚠️ A TELA JÁ EXISTIA e funcionava. O que a impedia de aparecer na
//  instalação era uma guarda posta para OUTRA coisa:
//
//      setBaixouNestaSessao(true);          // antes do fetch, fecha uma corrida
//      await Updates.fetchUpdateAsync();
//      ...
//      prontoParaAplicar = isUpdatePending && !baixouNestaSessao && ...
//
//  `baixouNestaSessao` existe desde 07/08 para NÃO INTERROMPER quem está usando
//  o app quando um download termina no meio — inclusive no `/completar-cadastro`,
//  onde interromper apaga o que a pessoa digitou. A guarda está certa.
//
//  Só que na PRIMEIRA abertura depois de instalar não há nada a interromper: a
//  pessoa acabou de abrir e está vendo o bundle que veio dentro do APK. Ali a
//  guarda protegia o vazio e cobrava o preço — o ciclo de duas aberturas que ele
//  descreveu.
//
//  ⇒ `Updates.isEmbeddedLaunch` distingue os dois casos com precisão: `true`
//  significa que o app está rodando o bundle EMBUTIDO no binário, ou seja
//  nenhum OTA foi aplicado ainda. Não é um proxy nem uma heurística de tempo —
//  é o próprio fato. (Já era lido pela telemetria desde antes.)
//
//  ⚠️ O que NÃO muda: a ficha de cadastro aberta continua segurando o portão, e
//  as guardas de transição (`isChecking`/`isDownloading`/startup) continuam
//  valendo. Sem elas o `reloadAsync` reinicia no MESMO bundle e vira o loop do
//  "clico e fica piscando" (13/08).
// ════════════════════════════════════════════════════════════════════════════

export type EstadoPortao = {
  /** `Updates.isEnabled` — false em dev e no Expo Go. */
  habilitado: boolean;
  /** O bundle novo JÁ está no aparelho: aplicar é troca local (~1s). */
  updatePendente: boolean;
  /** Baixado NESTA sessão de tela acesa (pode estar interrompendo alguém). */
  baixouNestaSessao: boolean;
  /** ⚠️ Rodando o bundle que veio no binário — nenhum OTA aplicado ainda. */
  lancamentoEmbutido: boolean;
  /** `/completar-cadastro` em andamento: interromper apaga o formulário. */
  fichaAberta: boolean;
  checando: boolean;
  baixando: boolean;
  startupRodando: boolean;
};

/**
 * Devolve `{ aplicar, motivo }`. O motivo sobe para telemetria e para a
 * investigação do próximo relato — "não aplicou" sem dizer por quê foi
 * exatamente o que fez este defeito durar.
 */
export function decidirAplicacao(e: Partial<EstadoPortao> = {}): {
  aplicar: boolean;
  motivo: string;
} {
  if (!e.habilitado) return { aplicar: false, motivo: "updates_desligado" };
  if (!e.updatePendente) return { aplicar: false, motivo: "sem_update_pendente" };

  // ⚠️ Estas vêm ANTES da exceção do embutido: transição em voo faz o
  // `reloadAsync` reiniciar no MESMO bundle, e aí `isUpdatePending` acende de
  // novo — o loop de 13/08. Vale inclusive na instalação.
  if (e.checando) return { aplicar: false, motivo: "checando" };
  if (e.baixando) return { aplicar: false, motivo: "baixando" };
  if (e.startupRodando) return { aplicar: false, motivo: "startup_rodando" };

  // ⚠️ A ficha aberta segura o portão em QUALQUER caso, inclusive no primeiro
  // lançamento: dá pra instalar, abrir, começar a preencher o cadastro e o
  // download terminar no meio. Aplicar ali apagaria o formulário — o custo que
  // a guarda de 07/08 existe pra evitar.
  if (e.fichaAberta) return { aplicar: false, motivo: "ficha_aberta" };

  // ⚠️⚠️ A EXCEÇÃO: rodando o bundle embutido, aplicar agora. É a primeira
  // abertura depois de instalar — não há nada a interromper, e não aplicar é
  // justamente o "instalei e veio a versão antiga".
  if (e.lancamentoEmbutido) return { aplicar: true, motivo: "primeira_abertura" };

  if (e.baixouNestaSessao) return { aplicar: false, motivo: "baixou_nesta_sessao" };
  return { aplicar: true, motivo: "pronto" };
}

/**
 * Lê `Updates.isEmbeddedLaunch` com guarda.
 *
 * ⚠️ `typeof === "boolean"` e default **false**: em versão que não expõe o
 * campo, `undefined` não pode virar "é o primeiro lançamento" — isso ligaria a
 * exceção para TODA sessão e traria de volta a interrupção no meio do uso. Na
 * dúvida, o comportamento é o de antes. (A telemetria já lê com a mesma guarda.)
 */
export function leEmbutido(valor: unknown): boolean {
  return typeof valor === "boolean" ? valor : false;
}
