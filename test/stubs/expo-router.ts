// Stub de `expo-router` para os testes de régua (ver vitest.config.ts).
// Só o que o código puro toca: `router.navigate`. As chamadas ficam
// registradas em `navegacoes` pra o teste conferir PARA ONDE a seta levaria.
export const navegacoes: string[] = [];

export const router = {
  navigate: (destino: unknown) => {
    navegacoes.push(String(destino));
  },
  push: (destino: unknown) => {
    navegacoes.push(String(destino));
  },
  replace: (destino: unknown) => {
    navegacoes.push(String(destino));
  },
  back: () => {
    navegacoes.push("(back)");
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
