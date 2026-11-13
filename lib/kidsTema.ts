export const TEMAS_KIDS = [
  { id: "amarelo", nome: "Amarelo", fundo: "#F4D35E", tinta: "#765400" },
  { id: "azul", nome: "Azul", fundo: "#A8D8F0", tinta: "#155978" },
  { id: "verde", nome: "Verde", fundo: "#B8DFC3", tinta: "#285E3A" },
  { id: "lilas", nome: "Lilás", fundo: "#D5C2EC", tinta: "#624382" },
  { id: "rosa", nome: "Rosa", fundo: "#F3BDD4", tinta: "#843F5C" },
] as const;
export type TemaKids = typeof TEMAS_KIDS[number];
export function temaKids(id: unknown): TemaKids {
  return TEMAS_KIDS.find(t => t.id === id) || TEMAS_KIDS[0];
}
export const chaveTemaKids = (usuario: string) => `cbrio.kids.cor:${usuario}`;
