import { router, type Href } from "expo-router";

/**
 * Navegação padrão do app.
 *
 * ⚠️ Existia aqui um desvio (`dismissTo`) porque Home/Cuidados/Servir/Doar/Menu
 * eram ABAS NATIVAS (UITabBarController) e empilhar pra elas a partir de uma
 * tela de stack CRASHAVA o app. Com a barra própria (04/08/2026) tudo é tela de
 * stack, então `navigate` serve pra tudo — e ele reaproveita a tela quando ela
 * já está na pilha (não empilha duplicado, e a seta continua fazendo sentido).
 *
 * A função fica como ponto único de navegação: se um dia a regra mudar de novo,
 * muda aqui e não nas ~30 chamadas espalhadas.
 */
export function irPara(rota: Href) {
  router.navigate(rota);
}

// ============================================================================
//  O TOQUE NA BARRA DE BAIXO (11/08/2026 · "a navegação tá travada")
//
//  ⚠️⚠️ É `navigate`, e NUNCA `replace` — considerei trocar e a troca seria uma
//  REGRESSÃO. `navigate` reaproveita a tela quando ela já está na pilha: indo
//  Grupos → Servir → Grupos, o expo-router VOLTA pra instância viva de Grupos
//  (descartando Servir), então a rolagem e o que já tinha carregado continuam
//  lá. `replace` destruiria a tela a cada toque: toda volta pagaria montagem
//  nova + a busca do `useFocusEffect` + o spinner de carregando — exatamente a
//  sensação de peso que se quer eliminar.
//
//  ⚠️ A pilha NÃO cresce sem limite: as 5 telas são irmãs, então o pior caso é
//  [Home + as 5 abas] e revisitar qualquer uma delas ENCOLHE a pilha em vez de
//  aumentá-la. E a seta continua sendo `cd ..` (lib/hierarquia.ts), não o
//  histórico — voltar de qualquer aba é 1 toque até a Home.
//
//  O que dava o peso era outra coisa, e foi consertada onde de fato estava:
//  a animação de "entrei um nível" a cada troca de aba (agora `animation:
//  "none"` nas 5 telas, em (app)/_layout.tsx) e a ausência de qualquer resposta
//  ao dedo enquanto a próxima tela não desenhava (feedback + tátil na barra).
// ============================================================================

/** As 5 telas da barra de baixo, na ordem em que aparecem. */
export const ROTAS_BARRA = [
  "/meu-grupo",
  "/voluntariado",
  "/cuidados",
  "/devocional",
  "/menu",
] as const;

const BARRA = new Set<string>(ROTAS_BARRA);

/** Rota (com ou sem query) é uma das telas da barra? */
export function ehRotaDeBarra(rota: string): boolean {
  if (!rota) return false;
  return BARRA.has(rota.split("?")[0]);
}

/**
 * `nada` → já está nessa tela (toque no item aceso não navega)
 * `ir`   → `navigate`, que reaproveita a aba viva quando ela já está na pilha
 * `home` → volta pra tela principal (só do `/menu` · ver abaixo)
 */
export type AcaoBarra = "nada" | "ir" | "home";

/**
 * ⚠️⚠️ TOCAR EM "MENU" ESTANDO NO MENU VOLTA PRA HOME (20/08/2026).
 *
 * Pedido do Matheus: *"o botão de menu na parte de baixo... voltasse para a
 * tela principal caso eu clique nele, estando na tela de menu. pois estamos sem
 * botão para voltar pra home"*. E é verdade: a Home **não está na barra** (a
 * barra tem Grupos · Servir · Cuidados · Devocional · Menu), então de dentro do
 * menu não havia caminho de 1 toque de volta.
 *
 * ⚠️ Vale SÓ pro `/menu`, de propósito. O menu é uma GAVETA — fechá-la é voltar
 * pra onde se estava. As outras quatro são DESTINOS: tocar em "Grupos" estando
 * em Grupos jogar a pessoa pra Home seria perder a tela por um toque acidental,
 * que é o oposto do que se espera de uma barra de abas.
 */
const ROTA_HOME = "/";
const VOLTA_PRA_HOME = new Set<string>(["/menu"]);

export function acaoDaBarra(atual: string, destino: string): AcaoBarra {
  // Query string não muda a tela: /meu-grupo?aba=encontrar é /meu-grupo.
  const a = (atual || "/").split("?")[0];
  const d = (destino || "/").split("?")[0];
  if (a !== d) return "ir";
  return VOLTA_PRA_HOME.has(d) ? "home" : "nada";
}

/** Executa o toque num item da barra. */
export function irParaBarra(atual: string, destino: string) {
  const acao = acaoDaBarra(atual, destino);
  if (acao === "nada") return;
  // ⚠️ `navigate` também na volta pra Home: ela já está no fundo da pilha, e
  // `navigate` a REAPROVEITA em vez de empilhar uma segunda Home — que é o que
  // faria o botão de voltar do Android sair do app em vez de subir a árvore.
  router.navigate((acao === "home" ? ROTA_HOME : destino) as Href);
}
