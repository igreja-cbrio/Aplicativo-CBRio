// Stub de `expo-router` para os testes de régua (ver vitest.config.ts).
// Só o que o código puro toca: `router.navigate`. As chamadas ficam
// registradas em `navegacoes` pra o teste conferir PARA ONDE a seta levaria.
export const navegacoes: string[] = [];
export const metodos: string[] = [];

export const router = {
  navigate: (destino: unknown) => {
    navegacoes.push(String(destino));
    metodos.push("navigate");
  },
  push: (destino: unknown) => {
    navegacoes.push(String(destino));
  },
  // ⚠️ `replace` é MARCADO: a barra de baixo troca de irmã com replace (pra não
  // empilhar) e entra com navigate — se as duas registrassem igual, o teste não
  // teria como provar a diferença, que é justamente a régua.
  replace: (destino: unknown) => {
    navegacoes.push(`(replace) ${String(destino)}`);
  },
  back: () => {
    navegacoes.push("(back)");
  },
  // A seta (`subirUmNivel`) volta com `dismissTo` desde 27/11/2026: o destino
  // entra em `navegacoes` igual (é o PAI que os testes conferem) e o método fica
  // em `metodos`, para provar que não é `navigate` (que empilha cópia nova).
  dismissTo: (destino: unknown) => {
    navegacoes.push(String(destino));
    metodos.push("dismissTo");
  },
  canGoBack: () => false,
  dismissAll: () => {},
};

export type Href = string;
export function usePathname() {
  return "/";
}
export function useRouter() {
  return router;
}
export function useLocalSearchParams() {
  return {};
}
export function useFocusEffect() {}
export const Stack = null;
export const Redirect = null;
