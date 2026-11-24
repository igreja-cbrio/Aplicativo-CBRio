// RESULTADO DA BUSCA POR SELFIE QUE FICA AO SAIR E VOLTAR (24/11/2026).
//
// Pedido do Matheus: quem fez a selfie e recebeu o resultado não pode ter de
// tirar outra selfie e esperar de novo só porque saiu da tela. Desenho decidido
// com o conselho:
//
// ⚠️⚠️ SÓ MEMÓRIA DO APP. Nada de AsyncStorage, SecureStore, arquivo, servidor,
// log ou telemetria (o teste reprova). Gravar em disco é, ao pé da letra, a LEI
// "nunca gravar 'fotos em que fulano aparece'" e exigiria texto novo no aceite.
// A memória morre quando o app fecha (ou o sistema o mata): isso é esperado.
//
// ⚠️⚠️ SÓ O RESULTADO: ids das fotos e contagens (`ResultadoBusca`), copiados
// campo a campo. Nunca a selfie, distância, descritor ou URL com token.
//
// Regras:
// - chave = conta (uid do Supabase) + álbum; a leitura confere o uid de novo;
// - vale até 24 h e só na régua (limiares) de hoje;
// - busca nova só SUBSTITUI quando entrega algo verificado (fechar antes, ou ser
//   recusada no aceite, mantém o resultado anterior);
// - apaga ao sair da conta / trocar de conta (`apagarTodosResultados`, chamado
//   pelo AuthContext), no botão "Apagar resultado", e quando o álbum deixa de
//   estar liberado ou a busca é desligada (`oQueFazerComGuardado`).
import { LIMIAR_FORTE, LIMIAR_PROVAVEL, VIZINHANCA_SEQUENCIA, type FimDaBusca, type ResultadoBusca } from "./buscaFacial";

export const VALIDADE_RESULTADO_MS = 24 * 60 * 60 * 1000;
/** Resultado de outra régua (limiares recalibrados) não volta a aparecer. */
export const REGUA_RESULTADO = `${LIMIAR_FORTE}/${LIMIAR_PROVAVEL}/${VIZINHANCA_SEQUENCIA}`;
export const MAX_RESULTADOS_GUARDADOS = 5;

export type ResultadoGuardado = {
  uid: string;
  albumId: string;
  /** Quando a busca foi entregue (ms). */
  em: number;
  regua: string;
  /** Ids do álbum na hora da busca (não é dado biométrico): mostra o que mudou depois. */
  idsDaBusca: readonly string[];
  resultado: ResultadoBusca;
};

const guardados = new Map<string, ResultadoGuardado>();
const chave = (uid: string, albumId: string) => `${uid}:${albumId}`;

const soIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const FINS: ReadonlySet<string> = new Set(["fim", "pessoa", "erro"]);

/** Cópia campo a campo do que pode ficar guardado. Nada além disto entra. */
function copiar(r: ResultadoBusca): ResultadoBusca {
  const fim: FimDaBusca = FINS.has(r.fimDaBusca) ? r.fimDaBusca : "fim";
  return Object.freeze({
    suas: Object.freeze(soIds(r.suas)) as string[],
    talvez: Object.freeze(soIds(r.talvez)) as string[],
    pelaSequencia: Object.freeze(soIds(r.pelaSequencia)) as string[],
    total: numero(r.total),
    verificadas: numero(r.verificadas),
    naoVerificadas: numero(r.naoVerificadas),
    interrompida: r.interrompida === true,
    fimDaBusca: fim,
  });
}

/**
 * Guarda o resultado entregue. Busca sem nenhuma foto verificada não substitui
 * o que já estava guardado (devolve false).
 */
export function guardarResultado(
  uid: string | null | undefined,
  albumId: string | null | undefined,
  r: ResultadoBusca,
  idsDaBusca: readonly string[],
  agora: number = Date.now(),
): boolean {
  if (!uid || !albumId || !r || numero(r.verificadas) <= 0) return false;
  guardados.delete(chave(uid, albumId));
  guardados.set(
    chave(uid, albumId),
    Object.freeze({ uid, albumId, em: agora, regua: REGUA_RESULTADO, idsDaBusca: Object.freeze(soIds(idsDaBusca)), resultado: copiar(r) }),
  );
  // Teto: some o mais antigo (o Map guarda a ordem de inserção).
  while (guardados.size > MAX_RESULTADOS_GUARDADOS) {
    const primeiro = guardados.keys().next().value;
    if (primeiro === undefined) break;
    guardados.delete(primeiro);
  }
  return true;
}

/** O resultado desta conta neste álbum, se ainda vale. Vencido ou de outra conta é apagado. */
export function lerResultado(uid: string | null | undefined, albumId: string | null | undefined, agora: number = Date.now()): ResultadoGuardado | null {
  if (!uid || !albumId) return null;
  const k = chave(uid, albumId);
  const g = guardados.get(k);
  if (!g) return null;
  const vencido = agora - g.em > VALIDADE_RESULTADO_MS || agora < g.em - 60_000;
  if (g.uid !== uid || g.albumId !== albumId || vencido || g.regua !== REGUA_RESULTADO) {
    guardados.delete(k);
    return null;
  }
  return g;
}

export function apagarResultado(uid: string | null | undefined, albumId: string | null | undefined): void {
  if (uid && albumId) guardados.delete(chave(uid, albumId));
}

/** Sair da conta / trocar de conta. */
export function apagarTodosResultados(): void {
  guardados.clear();
}

/**
 * A cada lista de álbuns que chega: apaga TODOS os guardados desta conta cuja
 * busca deixou de valer (interruptor ligado, menor, conta sem cadastro) ou cujo
 * álbum saiu da lista / deixou de estar liberado. Não depende do álbum aberto.
 */
export function podarResultados(
  uid: string | null | undefined,
  resp: { albuns: readonly { id: string; situacao: string }[]; busca_facial: string | null } | null,
): void {
  if (!uid || !resp) return;
  const liberados = new Set(resp.albuns.filter((a) => a.situacao === "liberado").map((a) => a.id));
  for (const [k, g] of [...guardados]) {
    if (g.uid !== uid) continue;
    if (resp.busca_facial !== "liberada" || !liberados.has(g.albumId)) guardados.delete(k);
  }
}

export type DecisaoGuardado = "restaurar" | "apagar" | "nada";

/**
 * Com a lista de álbuns da conta em mãos: o resultado guardado volta, é apagado
 * (álbum sumiu, não está liberado, conta em conflito, busca desligada ou menor)
 * ou não há nada a fazer.
 */
export function oQueFazerComGuardado(
  guardado: ResultadoGuardado | null,
  resp: { albuns: readonly { id: string; situacao: string }[]; busca_facial: string | null } | null,
  albumId: string | null,
): DecisaoGuardado {
  if (!guardado || !resp || !albumId) return "nada";
  if (guardado.albumId !== albumId) return "nada";
  const album = resp.albuns.find((a) => a.id === albumId);
  if (!album || album.situacao !== "liberado") return "apagar";
  if (resp.busca_facial !== "liberada") return "apagar";
  return "restaurar";
}

/** O que mudou no álbum depois da busca: fotos do resultado que saíram e fotos novas não verificadas. */
export function mudancasDoAlbum(guardado: ResultadoGuardado, idsAtuais: readonly string[]): { sairam: number; novas: number } {
  const atuais = new Set(idsAtuais);
  const doResultado = new Set([...guardado.resultado.suas, ...guardado.resultado.talvez]);
  let sairam = 0;
  for (const id of doResultado) if (!atuais.has(id)) sairam += 1;
  let novas = 0;
  if (guardado.idsDaBusca.length > 0) {
    const daBusca = new Set(guardado.idsDaBusca);
    for (const id of atuais) if (!daBusca.has(id)) novas += 1;
  }
  return { sairam, novas };
}

const FUSO_BRT_MS = -3 * 60 * 60 * 1000;
const dois = (n: number) => String(n).padStart(2, "0");
/** "24/11 às 14:32" no horário de Brasília (a igreja opera em BRT). */
export function quandoFoiABusca(em: number): { dia: string; hora: string } {
  const d = new Date(em + FUSO_BRT_MS);
  return { dia: `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}`, hora: `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}` };
}
