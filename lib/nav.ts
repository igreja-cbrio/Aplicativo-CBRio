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
