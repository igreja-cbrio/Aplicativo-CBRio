// ============================================================================
// TIRAR COMENTÁRIO DE CÓDIGO · uma régua só (11/08/2026)
//
// ⚠️⚠️ POR QUE ISTO NÃO É UM REGEX. A primeira versão era
// `src.replace(/(^|[^:])\/\/[^\n]*/g, ...)` — e ela **apagava o resto de
// qualquer linha em que uma STRING contivesse `//`**. Caso vivo neste repo:
// `app/(app)/completar-cadastro.tsx:218` (`!retorno.startsWith("//")`).
// Testado: numa linha com `startsWith("//")` seguida de `t("REAL")`, o `t()`
// **sumia da varredura**. Ou seja: o modo de falha era **remover dívida de i18n
// da contagem em silêncio** — o oposto do que o portão existe pra fazer.
//
// ⚠️ E existiam DUAS implementações divergentes (uma no script do i18n, outra no
// teste das réguas), **nenhuma testada**, num repo cuja lei é "régua pura vive
// num lugar só". Esta é a única; `test/reguas.test.ts` importa daqui.
//
// A varredura é um autômato de 1 caractere: só sai de "código" quando entra numa
// string, e comentário dentro de string não é comentário.
// ============================================================================

/**
 * Devolve o mesmo texto com todo comentário trocado por espaço.
 *
 * ⚠️ PRESERVA COMPRIMENTO E QUEBRAS DE LINHA: número de linha e coluna de
 * qualquer relatório continuam batendo com o arquivo real. Trocar por "" faria
 * o relatório apontar linha errada, que é como se perde confiança em ferramenta.
 *
 * @param {string} src
 * @returns {string}
 */
export function semComentarios(src) {
  const n = src.length;
  const out = new Array(n);
  let i = 0;
  // 'codigo' | 'linha' | 'bloco' | 'aspas' | 'apostrofo' | 'crase'
  let estado = 'codigo';

  const branco = (c) => (c === '\n' ? '\n' : ' ');

  while (i < n) {
    const c = src[i];
    const prox = src[i + 1];

    if (estado === 'codigo') {
      if (c === '/' && prox === '/') { estado = 'linha'; out[i] = ' '; i += 1; continue; }
      if (c === '/' && prox === '*') { estado = 'bloco'; out[i] = ' '; i += 1; continue; }
      if (c === '"') estado = 'aspas';
      else if (c === "'") estado = 'apostrofo';
      else if (c === '`') estado = 'crase';
      out[i] = c; i += 1; continue;
    }

    if (estado === 'linha') {
      if (c === '\n') { estado = 'codigo'; out[i] = '\n'; i += 1; continue; }
      out[i] = ' '; i += 1; continue;
    }

    if (estado === 'bloco') {
      if (c === '*' && prox === '/') { estado = 'codigo'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      out[i] = branco(c); i += 1; continue;
    }

    // Dentro de string: copia tudo, respeitando escape.
    // ⚠️ `\\` consome o próximo caractere — sem isso, `"tem \" aqui"` fecharia
    // a string no lugar errado e o resto do arquivo viraria "comentário".
    if (c === '\\') { out[i] = c; out[i + 1] = src[i + 1]; i += 2; continue; }
    if ((estado === 'aspas' && c === '"')
      || (estado === 'apostrofo' && c === "'")
      || (estado === 'crase' && c === '`')) estado = 'codigo';
    // ⚠️ String de aspas simples/duplas não atravessa linha: se a linha acabar
    // sem fechar, é código quebrado ou apóstrofo dentro de texto (`d'água`) —
    // voltar pra 'codigo' impede que UM apóstrofo desalinhe o arquivo inteiro.
    if (c === '\n' && estado !== 'crase') estado = 'codigo';
    out[i] = c; i += 1;
  }

  return out.join('');
}
