/**
 * Quebra de linha no rótulo de atalho da Home.
 *
 * ⚠️⚠️ POR QUE NÃO É NBSP (erro meu, 26/08/2026 · corrigido em 27/08).
 * O pedido do Matheus foi *"deixe a palavra crianças embaixo, pq tá meio
 * estranho assim em 1 linha só"*. Eu resolvi com ESPAÇO INQUEBRÁVEL entre
 * "Apresentação" e "de", e ele voltou dizendo que **não mudou nada** — estava
 * certo, e o conserto era incapaz de funcionar por duas razões:
 *
 *  1. **NBSP não FORÇA quebra, só IMPEDE.** Se o texto já couber como está, ele
 *     não produz efeito nenhum.
 *  2. Pior: ele COLA "Apresentação de" num pedaço só. A célula do atalho tem
 *     33,3% da largura do conteúdo (~119 pt num iPhone de 390), e esse pedaço
 *     grudado fica no limite — quando não cabe, o motor quebra onde quiser ou
 *     estoura, ou seja o resultado fica pior que o natural.
 *
 * ⇒ A quebra é EXPLÍCITA e vem **depois da primeira palavra**. Some a dúvida de
 * medida: a linha 1 é sempre a palavra mais longa sozinha ("Apresentação") e a
 * linha 2 é o resto ("de crianças"), as duas com folga na célula — inclusive em
 * aparelho estreito. Quebrar ANTES da última palavra ("Apresentação de" /
 * "crianças") deixaria a linha 1 justo no limite, que é a armadilha de novo.
 *
 * ⚠️ E a quebra mora AQUI, no render, não na chave de i18n: `\n` dentro da chave
 * obrigaria o tradutor a reproduzir a quebra, e layout não é tradução. Funciona
 * em qualquer idioma porque a régua é posicional — en "Children's dedication" →
 * "Children's" / "dedication"; es "Presentación de niños" → "Presentación" /
 * "de niños".
 */
export function quebrarAposPrimeiraPalavra(texto: string): string {
  const t = String(texto ?? "");
  // ⚠️ Normaliza o NBSP que ficou na base: a chave antiga do dicionário tem
  // ` ` depois de "Apresentação", e sem trocar por espaço comum ele não
  // conta como separador aqui — o rótulo voltaria a ser UMA palavra gigante e a
  // função devolveria o texto intacto, reproduzindo o bug que ela conserta.
  const limpo = t.replace(/\u00a0/g, " ");
  const i = limpo.indexOf(" ");
  // Uma palavra só (ou nada): não há o que quebrar, e inventar quebra dentro da
  // palavra é pior que o texto apertado.
  if (i <= 0 || i === limpo.length - 1) return limpo;
  return `${limpo.slice(0, i)}\n${limpo.slice(i + 1)}`;
}
