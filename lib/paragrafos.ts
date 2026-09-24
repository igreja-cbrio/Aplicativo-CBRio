/**
 * Quebra um texto de devocional em parágrafos curtos pra leitura no celular.
 * Pedido do Marcos (24/09/2026): "separasse mais os textos por parágrafo, para
 * a leitura ser menor".
 *
 * Régua: linha em branco no texto SEMPRE separa parágrafo (o autor decidiu).
 * Um parágrafo com mais de `maxFrases` frases é partido em grupos de
 * `maxFrases` frases — a reflexão do plano vem num bloco só de 6–7 frases.
 * ⚠️ Só corta em fim de frase seguido de MAIÚSCULA/aspa: "Atos 2.42" e
 * "Pr. Pedrão" têm ponto no meio e não podem virar duas frases.
 */
const FIM_DE_FRASE = /(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[A-ZÀ-ÖØ-Þ])/;
// "Pr. Pedrão", "Dr. Silva", "Ap. Paulo": ponto de abreviação seguido de nome
// próprio parece fim de frase. O pedaço que termina numa dessas é colado no seguinte.
const ABREVIACAO_FINAL = /\b(?:Pr|Pra|Sr|Sra|Dr|Dra|Ap|Ev|Rev|Prof|Profa|Pb|Mis|Bp)\.$/;

export function frases(texto: string): string[] {
  const pedacos = texto.split(FIM_DE_FRASE).map((f) => f.trim()).filter(Boolean);
  const saida: string[] = [];
  for (const p of pedacos) {
    const anterior = saida[saida.length - 1];
    if (anterior && ABREVIACAO_FINAL.test(anterior)) saida[saida.length - 1] = `${anterior} ${p}`;
    else saida.push(p);
  }
  return saida;
}

export function paragrafos(texto: string | null | undefined, maxFrases = 2): string[] {
  if (!texto) return [];
  const blocos = texto.split(/\n\s*\n|\n/).map((b) => b.trim()).filter(Boolean);
  const saida: string[] = [];
  for (const bloco of blocos) {
    const fs = frases(bloco);
    if (fs.length <= maxFrases + 1) { saida.push(bloco); continue; }
    for (let i = 0; i < fs.length; i += maxFrases) saida.push(fs.slice(i, i + maxFrases).join(" "));
  }
  return saida;
}
