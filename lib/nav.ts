import { router, type Href } from "expo-router";

// Rotas que são ABAS nativas (UITabBarController), não telas de stack.
// Navegar pra elas EMPILHANDO a partir de uma tela de stack (jornada,
// inscrições, notificações…) crasha o app. O certo é dispensar o stack e
// selecionar a aba (dismissTo). De dentro de uma aba, canDismiss() é false e
// caímos no navigate normal (aba→aba funciona).
const TAB_ROTAS = new Set<string>(["/", "/cuidados", "/voluntariado", "/generosidade", "/menu"]);

export function irPara(rota: Href) {
  const s = typeof rota === "string" ? rota : "";
  if (TAB_ROTAS.has(s) && router.canDismiss()) router.dismissTo(rota);
  else router.navigate(rota);
}
