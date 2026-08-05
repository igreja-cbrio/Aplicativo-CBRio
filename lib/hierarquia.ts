// ============================================================================
// VOLTAR = `cd ..` (Marcos · 05/08/2026)
//
// Pedido dele, com a metáfora exata: "a ideia é como se fosse uma ótica de
// pastas, e que esse voltar fosse um comando cd .. no terminal".
//
// O problema: `router.back()` anda no HISTÓRICO. Quem toca Grupos → Servir →
// Cuidados → Devocional na barra precisa de 4 toques na seta pra chegar na Home,
// repassando por telas que já viu. Com hierarquia, UM toque leva ao PAI — e da
// tela de barra o pai é a Home.
//
// ⚠️ `navigate` (e não push/replace): quando o pai já está na pilha, o
// expo-router VOLTA pra ele e descarta o que estava em cima — que é justamente
// o `cd ..`. Se não estiver na pilha (app aberto direto numa tela por push ou
// deep link), ele entra normalmente e a pilha fica coerente.
//
// ⚠️ Rota que não estiver no mapa cai na Home. É proposital: preferimos um
// destino previsível a adivinhar. Tela nova = uma linha aqui.
// ⚠️ O botão FÍSICO do Android segue a MESMA árvore (05/08/2026 · "faça o botao
// fisico ser igual ao da seta"): o `BackHandler` é interceptado no
// `(app)/_layout.tsx`. Na Home ele NÃO é interceptado — ali o comportamento do
// sistema (minimizar/sair) é o certo, e engolir o back na raiz é a receita do
// app que não fecha.
// ============================================================================
import { router, type Href } from "expo-router";

/**
 * A árvore do app, do jeito que a pessoa entende (barra + menu), não do jeito
 * que os arquivos estão organizados.
 *
 *   /                      Home (raiz — não tem pai)
 *   ├── /meu-grupo         barra: Grupos
 *   │   ├── /grupos  /grupo-detalhe  /grupo-membros
 *   │   ├── /grupo-inscricoes  /grupo-editar
 *   ├── /voluntariado      barra: Servir
 *   │   └── /escala-supervisor
 *   ├── /cuidados          barra
 *   ├── /devocional        barra
 *   │   └── /anotacoes
 *   ├── /menu              barra
 *   │   ├── /perfil → /cartoes
 *   │   ├── /familia → /kids → /kids-filho, /kids-solicitar-vinculo
 *   │   ├── /jornada
 *   │   ├── /generosidade → /comprovante-doacoes
 *   │   ├── /inscricoes → /batismo → /inscricao-batismo
 *   │   │              └→ /evento (detalhe + inscrição no app)
 *   │   │              └→ /next → /next-turma
 *   │   ├── /videos
 *   │   └── /configuracoes → /trocar-senha, /fale-conosco, /sobre
 *   ├── /notificacoes      (o sino está na faixa em qualquer tela)
 *   │   └── /mural
 *   ├── /modo-culto        (card de ao vivo na Home)
 *   └── /culto-detalhe     (próximos cultos, na Home)
 */
const PAI: Record<string, string> = {
  // telas de barra → Home
  "/meu-grupo": "/",
  "/voluntariado": "/",
  "/cuidados": "/",
  "/devocional": "/",
  "/menu": "/",

  // grupos
  "/grupos": "/meu-grupo",
  "/grupo-detalhe": "/meu-grupo",
  "/grupo-membros": "/meu-grupo",
  "/grupo-inscricoes": "/meu-grupo",
  "/grupo-editar": "/meu-grupo",

  // servir
  "/escala-supervisor": "/voluntariado",

  // devocional
  "/anotacoes": "/devocional",

  // menu
  "/perfil": "/menu",
  "/cartoes": "/perfil",
  "/familia": "/menu",
  "/kids": "/familia",
  "/kids-filho": "/kids",
  "/kids-solicitar-vinculo": "/kids",
  "/jornada": "/menu",
  "/generosidade": "/menu",
  "/comprovante-doacoes": "/generosidade",
  "/inscricoes": "/menu",
  "/evento": "/inscricoes",
  "/batismo": "/inscricoes",
  "/inscricao-batismo": "/batismo",
  "/next": "/inscricoes",
  "/next-turma": "/next",
  "/videos": "/menu",
  "/configuracoes": "/menu",
  "/trocar-senha": "/configuracoes",
  "/fale-conosco": "/configuracoes",
  "/sobre": "/configuracoes",

  // avisos e culto
  "/notificacoes": "/",
  "/mural": "/notificacoes",
  "/modo-culto": "/",
  "/culto-detalhe": "/",
};

/** O pai da rota na árvore acima (Home quando não há mapa). */
export function rotaPai(rota: string): string {
  if (!rota || rota === "/") return "/";
  // Ignora query string: /grupo-detalhe?id=… continua sendo /grupo-detalhe.
  const limpa = rota.split("?")[0];
  return PAI[limpa] ?? "/";
}

/** É a raiz (não mostra seta)? */
export function ehRaiz(rota: string): boolean {
  return !rota || rota.split("?")[0] === "/";
}

// ⚠️ A rota atual fica AQUI, num módulo, e não como argumento de cada tela.
// Motivo prático: as ~25 telas com seta própria chamam `router.back()` do objeto
// global, sem `usePathname()` em escopo — passar a rota exigiria adicionar um
// hook em cada arquivo. O `(app)/_layout.tsx` já observa o pathname; ele
// registra aqui a cada troca de tela. É seguro por ser UI de thread única com
// uma rota ativa por vez.
let rotaAtual = "/";

/** Chamado pelo layout a cada navegação. Não usar em telas. */
export function registrarRotaAtual(rota: string) {
  rotaAtual = rota || "/";
}

/** Sobe um nível na árvore — o `cd ..` do app. */
export function subirUmNivel(rota?: string) {
  const pai = rotaPai(rota ?? rotaAtual);
  router.navigate(pai as Href);
}
