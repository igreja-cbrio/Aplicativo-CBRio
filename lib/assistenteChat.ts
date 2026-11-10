// Chat "Fale conosco" (assistente automático): régua PURA do polling.
//
// ⚠️ Polling, NÃO websocket: há o risco conhecido de 401 em massa por bundle
// velho no realtime. A tela chama o GET `…/mensagens?desde=` em intervalo
// adaptativo enquanto focada; aqui mora só a conta (mescla, cursor, intervalo),
// para ser testável sem React.

export type AutorChat = "membro" | "assistente" | "equipe";

export type MensagemChat = {
  id: string;
  autor: AutorChat;
  corpo: string;
  created_at: string;
};

/** Frase enviada pelo botão "Falar com uma pessoa" (o backend escala). */
export const PEDIDO_DE_PESSOA = "Quero falar com uma pessoa.";

const LOCAL = "local-";

export function ehLocal(m: MensagemChat): boolean {
  return m.id.startsWith(LOCAL);
}

/** Mensagem otimista (ainda não confirmada pelo servidor). `agoraIso` vem do chamador. */
export function mensagemLocal(
  seq: number,
  autor: AutorChat,
  corpo: string,
  agoraIso: string,
): MensagemChat {
  return { id: `${LOCAL}${autor}-${seq}`, autor, corpo, created_at: agoraIso };
}

const ms = (iso: string): number => {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
};

/** Maior `created_at` entre as mensagens do servidor (locais ficam de fora). */
export function maiorCriadoEm(msgs: MensagemChat[]): string | null {
  let melhor: string | null = null;
  for (const m of msgs) {
    if (ehLocal(m)) continue;
    if (melhor === null || ms(m.created_at) > ms(melhor)) melhor = m.created_at;
  }
  return melhor;
}

/**
 * Junta o que veio do polling ao que a tela já tem.
 *  - dedupe por `id` (o cursor do backend pode reenviar a linha mais nova);
 *  - uma mensagem otimista do membro some quando chega a versão do servidor
 *    com o mesmo corpo;
 *  - ordena por `created_at` (estável; locais ficam no fim em caso de empate);
 *  - `desde` = maior `created_at` do servidor (nunca recua).
 * `houveNovidade` = chegou id que a tela ainda não tinha.
 */
export function mesclarMensagens(
  atuais: MensagemChat[],
  recebidas: MensagemChat[],
  desdeAnterior: string | null = null,
): { mensagens: MensagemChat[]; desde: string | null; houveNovidade: boolean } {
  const ids = new Set(atuais.map((m) => m.id));
  const novas = recebidas.filter((m) => !ids.has(m.id));
  // dedupe dentro do próprio lote
  const vistos = new Set<string>();
  const unicas = novas.filter((m) => (vistos.has(m.id) ? false : (vistos.add(m.id), true)));

  let base = atuais;
  for (const n of unicas) {
    if (n.autor !== "membro") continue;
    const i = base.findIndex((m) => ehLocal(m) && m.autor === "membro" && m.corpo === n.corpo);
    if (i >= 0) base = base.filter((_, j) => j !== i);
  }

  const todas = [...base, ...unicas]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => ms(a.m.created_at) - ms(b.m.created_at) || a.i - b.i)
    .map((x) => x.m);

  const topo = maiorCriadoEm(todas);
  const desde =
    topo !== null && (desdeAnterior === null || ms(topo) > ms(desdeAnterior)) ? topo : desdeAnterior;
  return { mensagens: todas, desde, houveNovidade: unicas.length > 0 };
}

/** O assistente está "digitando" enquanto a última mensagem real é do membro. */
export function aguardandoResposta(msgs: MensagemChat[], enviando: boolean): boolean {
  if (enviando) return true;
  const ultima = msgs[msgs.length - 1];
  return !!ultima && ultima.autor === "membro";
}

/**
 * Intervalo do próximo poll (ms). Rápido logo após enviar/novidade; vai
 * espaçando quando nada chega; teto de 20 s (a equipe pode responder horas depois).
 */
export function proximoIntervalo(semNovidadeSeguidas: number, aguardando: boolean): number {
  if (aguardando) return semNovidadeSeguidas < 10 ? 2500 : 6000;
  const escada = [4000, 6000, 10000, 15000, 20000];
  return escada[Math.min(Math.max(semNovidadeSeguidas, 0), escada.length - 1)];
}
