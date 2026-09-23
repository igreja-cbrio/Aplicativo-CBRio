// ============================================================================
// FOLHA ÓRFÃ — estado que ABRE uma folha e nenhuma folha lê (23/09/2026)
//
// O incidente: em `grupo-membros.tsx` o botão "Recusar" do card de pendentes
// fazia `setRecusaAlvo(p)`, mas o `<Modal visible={!!recusaAlvo}>` tinha sido
// apagado no refactor f246407 (05/08). O estado era gravado, o handler
// `confirmarRecusa` continuava no arquivo lendo `recusaAlvo`… e NADA na tela
// lia o estado. Sete semanas assim, sem tipo nem lint reclamar — TypeScript não
// enxerga "estado nunca renderizado". Sintoma pro líder: "não consigo apertar".
//
// A régua: todo estado `*Alvo` / `*Aberto` / `*Aberta` cujo setter é chamado
// com algo que NÃO é `null`/`false` (ou seja, alguém ABRE) precisa ser lido em
// pelo menos uma linha fora da declaração e fora de `const p = X;` do handler.
// `visible={!!X}`, `visivel={X}`, `prop={X}`, `{X && …}`, `!X ? … :` e
// `if (X)` são todos leituras válidas — a régua não impõe a FORMA da folha, só
// que exista uma.
//
// ⚠️ MUTATION GUARD: o mutante em scripts/mutantes.mjs é a AUSÊNCIA do bloco
// (byte a byte o que estava em produção), não um operador trocado.
// ============================================================================
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";

const RAIZ = process.cwd();

function arquivosTsx(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivosTsx(p, acc);
    else if (/\.tsx$/.test(nome)) acc.push(p);
  }
  return acc;
}

/** Estados de folha que alguém abre e ninguém lê. Exportado pela régua pura. */
export function folhasOrfas(fonte: string): string[] {
  const src = semComentarios(fonte);
  const orfas: string[] = [];
  const decl = /const \[([A-Za-z]+(?:Alvo|Aberto|Aberta)), (set[A-Za-z]+)\]\s*=\s*useState/g;
  for (const m of src.matchAll(decl)) {
    const estado = m[1];
    const setter = m[2];
    // Alguém ABRE? (setter com argumento que não é null/false)
    let abre = false;
    let i = -1;
    while ((i = src.indexOf(setter + "(", i + 1)) >= 0) {
      const arg = src.slice(i + setter.length + 1, i + setter.length + 8);
      if (!/^(null|false)\s*\)/.test(arg)) { abre = true; break; }
    }
    if (!abre) continue;
    // Alguém LÊ, fora da declaração e do `const p = estado;` do handler?
    const palavra = new RegExp(`(^|[^A-Za-z0-9_$])${estado}($|[^A-Za-z0-9_$])`);
    const soCopia = new RegExp(`^\\s*const \\w+ = ${estado};?\\s*$`);
    const leituras = src.split("\n").filter(
      (l) => palavra.test(l) && !/useState/.test(l) && !soCopia.test(l),
    );
    if (leituras.length === 0) orfas.push(estado);
  }
  return orfas;
}

describe("folha órfã: estado que abre uma folha precisa ser lido por alguma folha", () => {
  it("a régua pega o que estava em produção (setter chamado, estado nunca lido)", () => {
    const orfao = `
      const [recusaAlvo, setRecusaAlvo] = useState<GrupoPedido | null>(null);
      async function confirmarRecusa() {
        const p = recusaAlvo;
        if (!p) return;
      }
      <Pressable onPress={() => { setRecusaAlvo(p); setMotivo(""); }} />
    `;
    expect(folhasOrfas(orfao)).toEqual(["recusaAlvo"]);
  });

  it("a régua aceita qualquer forma de leitura (visible, visivel, prop, condicional, if)", () => {
    const base = `
      const [recusaAlvo, setRecusaAlvo] = useState<X | null>(null);
      <Pressable onPress={() => setRecusaAlvo(p)} />
    `;
    for (const leitura of [
      "<Modal visible={!!recusaAlvo} />",
      "<Folha visivel={recusaAlvo} />",
      "<ModalAgenda ocorrencia={recusaAlvo} />",
      "{recusaAlvo && <Text>x</Text>}",
      "{!recusaAlvo ? <A /> : <B />}",
      "if (recusaAlvo) return null;",
    ]) {
      expect(folhasOrfas(base + leitura), leitura).toEqual([]);
    }
  });

  it("estado que só é FECHADO (setter com null/false) não conta como folha", () => {
    const soFecha = `
      const [acaoAlvo, setAcaoAlvo] = useState<X | null>(null);
      <Pressable onPress={() => setAcaoAlvo(null)} />
    `;
    expect(folhasOrfas(soFecha)).toEqual([]);
  });

  it("comentário citando o estado NÃO vale como leitura", () => {
    const comentado = `
      const [recusaAlvo, setRecusaAlvo] = useState<X | null>(null);
      // aqui devia ter um <Modal visible={!!recusaAlvo}>
      <Pressable onPress={() => setRecusaAlvo(p)} />
    `;
    expect(folhasOrfas(comentado)).toEqual(["recusaAlvo"]);
  });

  it("nenhuma tela ou componente do app tem folha órfã", () => {
    const arquivos = [...arquivosTsx(join(RAIZ, "app")), ...arquivosTsx(join(RAIZ, "components"))];
    expect(arquivos.length).toBeGreaterThan(20);
    const problemas: string[] = [];
    for (const arq of arquivos) {
      const orfas = folhasOrfas(readFileSync(arq, "utf8"));
      for (const estado of orfas) problemas.push(`${arq.slice(RAIZ.length + 1)} → ${estado}`);
    }
    expect(problemas, "estado de folha gravado por um botão e lido por ninguém").toEqual([]);
  });
});
