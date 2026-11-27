// ============================================================================
// MEMÓRIA POR ABA (27/11/2026 · pedido do Marcos)
//
// "A pessoa está escalando alguém, esqueceu o nome, vai em Grupos, vê
// rapidamente, e ao clicar em Servir de novo ainda está naquela tela."
//
// ⚠️⚠️ O que se descobriu ao medir: no expo-router 6 (React Navigation 7),
// `router.navigate` para uma tela que NÃO é a do topo EMPILHA UMA CÓPIA NOVA.
// Ele só reaproveita quando a tela já é a do topo. O comentário antigo de
// `lib/nav.ts` ("navigate volta pra instância viva") valia no Router de antes
// do SDK 52; o app já nasceu no 6. Na prática, cada toque na barra criava uma
// tela nova (por isso o Servir "recomeçava") e as antigas ficavam congeladas na
// memória, sem limite.
//
// Como fica: a pilha é tratada em GALHOS. O galho de uma aba é a raiz dela mais
// as telas abertas dentro dela (pela árvore de `lib/hierarquia.ts`). Tocar numa
// aba SOBE o galho dela para o topo com as MESMAS instâncias (mesma `key`): a
// tela volta exatamente como estava (rolagem, o que foi digitado, o que estava
// carregado). Nenhuma tela é recriada.
//
// ⚠️ Régua PURA (roda no CI). Quem aplica é `components/navigation/TrocaDeAba`.
// ============================================================================
import { QUICK_LINKS } from "./appNavigation";
import { rotaPai } from "./hierarquia";

/** Uma rota da pilha como o React Navigation guarda (só o que a régua lê). */
export type RotaPilha = { key?: string; name: string; params?: object };

export type TrocaDeAba = { tipo: "nada" } | { tipo: "pilha"; rotas: RotaPilha[] };

const BARRA = new Set<string>(QUICK_LINKS.map((item) => item.href));

/** Nome da rota no Stack → caminho (`index` é a Home). */
export function caminhoDaRota(nome: string): string {
  return nome === "index" ? "/" : `/${nome}`;
}

/**
 * A aba a que a rota pertence, subindo a árvore até achar uma raiz da barra.
 * `null` = fora das abas (Home, Menu, perfil, avisos…).
 */
export function abaDaRota(caminho: string, params: object = {}): string | null {
  let atual = (caminho || "/").split("?")[0];
  const vistos = new Set<string>();
  while (atual !== "/" && !vistos.has(atual)) {
    if (BARRA.has(atual)) return atual;
    vistos.add(atual);
    atual = rotaPai(atual, params as Record<string, unknown>);
  }
  return null;
}

function abaDe(rota: RotaPilha): string | null {
  return abaDaRota(caminhoDaRota(rota.name), rota.params ?? {});
}

/**
 * O que fazer com a pilha ao tocar na aba `destino` (`/voluntariado`…).
 * - aba já no topo e na raiz dela → nada;
 * - aba já no topo, mas numa tela de dentro → volta ao início da aba;
 * - outra aba → o galho dela sobe ao topo, inteiro e vivo (ou a raiz entra, se
 *   ela ainda não foi aberta). Os outros galhos ficam embaixo, na mesma ordem.
 */
export function trocarDeAba(rotas: readonly RotaPilha[], destino: string): TrocaDeAba {
  const raiz = destino.split("?")[0];
  const nomeRaiz = raiz.replace(/^\//, "");
  const topo = rotas[rotas.length - 1];
  const doGalho = rotas.filter((r) => abaDe(r) === raiz);
  const outras = rotas.filter((r) => abaDe(r) !== raiz);

  if (topo && abaDe(topo) === raiz) {
    if (topo.name === nomeRaiz) return { tipo: "nada" };
    // Início da aba: reaproveita a raiz viva (a mais recente), se houver.
    const raizViva = [...doGalho].reverse().find((r) => r.name === nomeRaiz);
    return { tipo: "pilha", rotas: [...outras, raizViva ?? { name: nomeRaiz }] };
  }
  return { tipo: "pilha", rotas: [...outras, ...(doGalho.length ? doGalho : [{ name: nomeRaiz }])] };
}
