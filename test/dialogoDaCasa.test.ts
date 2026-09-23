// ============================================================================
// DIÁLOGO DA CASA · FUNDO DA FOLHA · ROLAR ATÉ O CAMPO (23/09/2026)
//
// Três relatos do Marcos no mesmo dia, todos na tela de gerenciar grupo e na
// porta de cadastro, todos vistos no Android dele:
//
//   1. "quando eu tentava apertar o botão de aprovar, ele abria uma janela
//      quadrada e feia, que não tinha tanto a cara do app; o de recusar ficava
//      bonito" → confirmação NATIVA (`Alert.alert` com botões) a nível de tela.
//      A régua: toda confirmação nativa que sobra está LISTADA com o porquê
//      (`CONFIRMACOES_NATIVAS_QUE_FICAM`) — folha aberta por baixo (o diálogo
//      irmão nasce ATRÁS no iPhone), 3 opções (o diálogo tem 2 botões) ou SOS.
//   2. "o botão ficou muito abaixo, eu poderia ter clicado em fechar sem
//      querer" → `fundoDaFolha`: piso na altura da barra de 3 botões + respiro,
//      régua ÚNICA pra toda folha do app.
//   3. "no form de entrada, quando a pessoa está dizendo quem é, quando o
//      teclado sobe fica difícil de ver" → `FormularioRolavel`: ganhar foco rola
//      até o campo. As três portas (login, cadastro, completar cadastro) usam.
//
// ⚠️ MUTATION GUARDS em scripts/mutantes.mjs: tirar o piso da folha, tirar o
// gancho de foco do <Input>, e voltar o Aprovar pra Alert.alert.
// ============================================================================
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";
import { fundoDaFolha, BARRA_NAV_ANDROID, RESPIRO_DA_FOLHA } from "@/lib/folha";
import { alvoDaRolagem, FOLGA_ACIMA_DO_CAMPO, ATRASO_TECLADO_MS } from "@/lib/rolarAteCampo";
import { ARQUIVOS_ALERTA_NATIVO, CONFIRMACOES_NATIVAS_QUE_FICAM } from "@/lib/dialogosNativos";

const RAIZ = process.cwd();
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");
const relativo = (abs: string) => abs.slice(RAIZ.length + 1).replace(/\\/g, "/");

function arquivosTsx(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivosTsx(p, acc);
    else if (/\.tsx$/.test(nome)) acc.push(p);
  }
  return acc;
}

/** Cada chamada `Alert.alert(...)` do fonte, com o texto do 1º argumento e se tem botões. */
export function alertasDe(fonte: string): { titulo: string; comBotoes: boolean }[] {
  const src = semComentarios(fonte);
  const out: { titulo: string; comBotoes: boolean }[] = [];
  let i = -1;
  while ((i = src.indexOf("Alert.alert(", i + 1)) >= 0) {
    let depth = 0;
    let j = i + "Alert.alert".length;
    let primeiraVirgula = -1;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") { depth--; if (depth === 0) break; }
      else if (ch === "," && depth === 1 && primeiraVirgula < 0) primeiraVirgula = j;
    }
    const chamada = src.slice(i, j + 1);
    const inicioArg = i + "Alert.alert(".length;
    const titulo = src.slice(inicioArg, primeiraVirgula > 0 ? primeiraVirgula : j).trim();
    out.push({ titulo, comBotoes: /\[\s*\{/.test(chamada) });
  }
  return out;
}

describe("diálogo da casa: confirmação nativa só onde há um PORQUÊ listado", () => {
  const telas = [...arquivosTsx(join(RAIZ, "app")), ...arquivosTsx(join(RAIZ, "components"))];

  it("o extrator entende título simples, template e ternário, e separa aviso de confirmação", () => {
    const fonte = `
      Alert.alert(t("Erro"), "x");
      Alert.alert(t("Aceitar inscrição"), \`\${t("Aprovar")} \${p.nome}?\`, [
        { text: t("Cancelar"), style: "cancel" },
        { text: t("Aceitar"), onPress: () => {} },
      ]);
      Alert.alert(qual === "mae" ? t("Foto da mãe") : t("Foto do pai"), t("Como?"), [{ text: "a" }]);
      // Alert.alert(t("comentado"), "", [{ text: "não conta" }])
    `;
    const r = alertasDe(fonte);
    expect(r.map((a) => a.comBotoes)).toEqual([false, true, true]);
    expect(r[1].titulo).toBe('t("Aceitar inscrição")');
    expect(r[2].titulo).toContain("Foto da mãe");
  });

  it("toda Alert.alert COM BOTÕES do app está em CONFIRMACOES_NATIVAS_QUE_FICAM (ou em arquivo nativo por lei)", () => {
    const sobrando: string[] = [];
    for (const abs of telas) {
      const rel = relativo(abs);
      if (rel === "components/ui/Dialogo.tsx") continue; // é o próprio diálogo
      if (ARQUIVOS_ALERTA_NATIVO.includes(rel)) continue; // SOS, trocar/redefinir senha
      for (const a of alertasDe(readFileSync(abs, "utf8"))) {
        if (!a.comBotoes) continue;
        const permitido = CONFIRMACOES_NATIVAS_QUE_FICAM.some(
          (c) => c.arquivo === rel && c.titulos.some((tit) => a.titulo.includes(tit)),
        );
        if (!permitido) sobrando.push(`${rel} → ${a.titulo}`);
      }
    }
    expect(sobrando, "confirmação nativa sem porquê listado — migre pra useDialogo ou liste em lib/dialogosNativos.ts").toEqual([]);
  });

  it("cada confirmação listada ainda EXISTE (lista não vira fóssil) e tem porquê", () => {
    for (const c of CONFIRMACOES_NATIVAS_QUE_FICAM) {
      expect(c.porque.length, `${c.arquivo} sem justificativa`).toBeGreaterThan(60);
      const src = ler(c.arquivo);
      const titulos = alertasDe(src).filter((a) => a.comBotoes).map((a) => a.titulo);
      for (const tit of c.titulos) {
        expect(titulos.some((x) => x.includes(tit)), `${c.arquivo}: "${tit}" não é mais uma confirmação nativa — tire da lista`).toBe(true);
      }
    }
  });

  it("quem usa dlg.confirmar / dlg.avisar renderiza <dlg.Dialogo /> (irmão, senão a promise nunca resolve)", () => {
    const faltando: string[] = [];
    for (const abs of telas) {
      const src = semComentarios(readFileSync(abs, "utf8"));
      if (/dlg\.(confirmar|avisar)\(/.test(src) && !src.includes("<dlg.Dialogo />")) faltando.push(relativo(abs));
    }
    expect(faltando).toEqual([]);
  });

  it("os Aprovar das duas telas de pedidos são do diálogo da casa, não Alert.alert", () => {
    for (const tela of ["app/(app)/grupo-membros.tsx", "app/(app)/grupo-inscricoes.tsx"]) {
      const src = semComentarios(ler(tela));
      expect(src).toContain('titulo: t("Aceitar inscrição")');
      expect(alertasDe(src).some((a) => a.titulo.includes("Aceitar inscrição")), `${tela} voltou a confirmar com Alert.alert`).toBe(false);
    }
  });
});

describe("fundoDaFolha: piso na altura da barra de 3 botões + respiro", () => {
  const MINIMO = BARRA_NAV_ANDROID + RESPIRO_DA_FOLHA;

  it("⚠️ MUTATION GUARD: inset 0 (Modal do Android) NÃO encosta o botão na barra", () => {
    expect(fundoDaFolha(0)).toBe(MINIMO);
    expect(MINIMO).toBeGreaterThanOrEqual(80);
  });

  it("barra de gestos (24) e barra de 3 botões (48) dão o mesmo piso", () => {
    expect(fundoDaFolha(24)).toBe(MINIMO);
    expect(fundoDaFolha(48)).toBe(MINIMO);
  });

  it("inset maior que a barra é respeitado, e a função é monotônica", () => {
    expect(fundoDaFolha(60)).toBe(60 + RESPIRO_DA_FOLHA);
    let anterior = -1;
    for (const inset of [0, 8, 24, 34, 48, 56, 80]) {
      const v = fundoDaFolha(inset);
      expect(v).toBeGreaterThanOrEqual(anterior);
      anterior = v;
    }
  });

  it("inset inválido conta como 0", () => {
    expect(fundoDaFolha(undefined)).toBe(MINIMO);
    expect(fundoDaFolha(NaN)).toBe(MINIMO);
    expect(fundoDaFolha(-10)).toBe(MINIMO);
  });

  it("nenhuma folha do app soma o inset cru (todas passam por fundoDaFolha)", () => {
    const cruas: string[] = [];
    for (const abs of [...arquivosTsx(join(RAIZ, "app")), ...arquivosTsx(join(RAIZ, "components"))]) {
      const src = semComentarios(readFileSync(abs, "utf8"));
      // `styles.sheet` é a folha; paddingBottom dela com `insets.bottom` direto é a fórmula antiga.
      const re = /styles\.sheet,\s*\{\s*paddingBottom:\s*(?:spacing\.\w+\s*\+\s*)?insets\.bottom/g;
      if (re.test(src)) cruas.push(relativo(abs));
    }
    expect(cruas).toEqual([]);
  });
});

describe("rolar até o campo: FormularioRolavel nas portas e o gancho no Input", () => {
  it("alvoDaRolagem deixa o rótulo visível e nunca é negativo", () => {
    expect(alvoDaRolagem(300)).toBe(300 - FOLGA_ACIMA_DO_CAMPO);
    expect(alvoDaRolagem(10)).toBe(0);
    expect(alvoDaRolagem(0)).toBe(0);
    expect(alvoDaRolagem(NaN)).toBe(0);
    expect(alvoDaRolagem(120.6, 20)).toBe(101);
  });

  it("espera o teclado começar a subir antes de rolar", () => {
    expect(ATRASO_TECLADO_MS).toBeGreaterThanOrEqual(80);
    expect(ATRASO_TECLADO_MS).toBeLessThanOrEqual(300);
  });

  it("as três portas (login, cadastro, completar cadastro) usam FormularioRolavel, não ScrollView crua", () => {
    for (const tela of ["app/(auth)/login.tsx", "app/(auth)/cadastro.tsx", "app/(app)/completar-cadastro.tsx"]) {
      const src = semComentarios(ler(tela));
      expect(src, tela).toContain("<FormularioRolavel");
      expect(src, `${tela} ainda abre <ScrollView`).not.toMatch(/<ScrollView[\s>]/);
    }
  });

  it("⚠️ MUTATION GUARD: Input e PhoneInput avisam o formulário ao ganhar foco", () => {
    for (const comp of ["components/ui/Input.tsx", "components/ui/PhoneInput.tsx"]) {
      const src = semComentarios(ler(comp));
      expect(src, comp).toContain("useRolarAteCampo()");
      expect(src, `${comp} não chama rolar no onFocus`).toMatch(/onFocus=\{[^}]*rolar\?\.\(raiz\.current\)/);
      expect(src, `${comp} sem collapsable={false} na raiz (Android perde a referência)`).toContain("collapsable={false}");
    }
  });

  it("o FormularioRolavel mede contra um View próprio e nunca lança", () => {
    const src = semComentarios(ler("components/ui/FormularioRolavel.tsx"));
    expect(src).toContain("measureLayout(");
    expect(src).toContain("collapsable={false}");
    expect(src).toMatch(/try\s*\{/);
  });
});
