/** Divide um texto em trechos de texto puro e links http(s). Puro, sem RN. */
export type TrechoLink = { tipo: "texto"; texto: string } | { tipo: "link"; texto: string; url: string };

const URL_RE = /https?:\/\/[^\s<>]+/gi;
// pontuação que costuma colar no fim da URL numa frase
const FIM_RE = /[.,;:!?'"”’»\]}…]+$/;

export function linkify(corpo: string): TrechoLink[] {
  const out: TrechoLink[] = [];
  const push = (t: TrechoLink) => {
    const ult = out[out.length - 1];
    if (t.tipo === "texto" && ult?.tipo === "texto") ult.texto += t.texto;
    else if (t.texto) out.push(t);
  };
  let pos = 0;
  for (const m of corpo.matchAll(URL_RE)) {
    const ini = m.index ?? 0;
    let url = m[0];
    // tira pontuação final; ")" só se não tiver "(" correspondente dentro da URL
    for (;;) {
      const antes = url;
      url = url.replace(FIM_RE, "");
      if (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) url = url.slice(0, -1);
      if (url === antes) break;
    }
    if (!/^https?:\/\/[^\s/.]/i.test(url)) continue; // "http://" solto
    push({ tipo: "texto", texto: corpo.slice(pos, ini) });
    push({ tipo: "link", texto: url, url });
    pos = ini + url.length;
  }
  push({ tipo: "texto", texto: corpo.slice(pos) });
  return out;
}
