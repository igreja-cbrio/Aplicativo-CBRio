// ============================================================================
// A CATRACA DO BINÁRIO DA LOJA · régua pura (03/09/2026)
//
// O que estes testes cobram é a DECISÃO (avisar × bloquear × deixar passar) e a
// detecção de mudança NATIVA. Não tocam git nem rede — a coleta impura
// (`avaliarLojas`/`relatar`) fica fora de propósito, pela lei do vitest.config:
// teste aqui é determinístico.
//
// ⚠️ A regra que mais importa: FAIL-OPEN. Dado ilegível NÃO pode bloquear
// publicação — travar um hotfix por causa de um ledger que não deu pra ler é
// pior que publicar com o embutido velho.
// ============================================================================
import { describe, expect, it } from "vitest";
import { avaliarDrift, diffNativo, LIMITES } from "../scripts/driftLoja";

describe("avaliarDrift · cadência de 2 semanas", () => {
  it("binário fresco passa", () => {
    const v = avaliarDrift({ diasAtras: 3, commitsAtras: 8, mudouNativo: false });
    expect(v.nivel).toBe("ok");
  });

  it("14 dias já avisa (a cadência combinada)", () => {
    expect(avaliarDrift({ diasAtras: 14, commitsAtras: 1, mudouNativo: false }).nivel).toBe("aviso");
    expect(avaliarDrift({ diasAtras: 13, commitsAtras: 1, mudouNativo: false }).nivel).toBe("ok");
  });

  it("30 commits avisa mesmo com poucos dias — distância é volume de mudança, não só tempo", () => {
    expect(avaliarDrift({ diasAtras: 2, commitsAtras: 30, mudouNativo: false }).nivel).toBe("aviso");
  });

  it("teto de 30 dias bloqueia", () => {
    expect(avaliarDrift({ diasAtras: 30, commitsAtras: 1, mudouNativo: false }).nivel).toBe("bloqueio");
    expect(avaliarDrift({ diasAtras: 29, commitsAtras: 1, mudouNativo: false }).nivel).toBe("aviso");
  });

  it("teto de 60 commits bloqueia", () => {
    expect(avaliarDrift({ diasAtras: 1, commitsAtras: 60, mudouNativo: false }).nivel).toBe("bloqueio");
  });

  it("o incidente de 03/09 (iOS 33: 73 dias, 192 commits) seria BLOQUEIO", () => {
    const v = avaliarDrift({ diasAtras: 73, commitsAtras: 192, mudouNativo: false });
    expect(v.nivel).toBe("bloqueio");
  });
});

describe("avaliarDrift · mudança nativa", () => {
  it("bloqueia SOZINHA, sem olhar distância — OTA não entrega nativo", () => {
    const v = avaliarDrift({ diasAtras: 0, commitsAtras: 0, mudouNativo: true });
    expect(v.nivel).toBe("bloqueio");
    expect(v.motivos.join(" ")).toContain("NATIVA");
  });

  it("bloqueia mesmo sem distância medida", () => {
    expect(avaliarDrift({ diasAtras: null, commitsAtras: null, mudouNativo: true }).nivel).toBe("bloqueio");
  });
});

describe("avaliarDrift · FAIL-OPEN (a lei)", () => {
  it("sem nada medido é 'desconhecido', nunca bloqueio", () => {
    const v = avaliarDrift({ diasAtras: null, commitsAtras: null, mudouNativo: null });
    expect(v.nivel).toBe("desconhecido");
  });

  it("mudouNativo null NÃO bloqueia — 'não consegui medir' ≠ 'medi e está errado'", () => {
    const v = avaliarDrift({ diasAtras: 1, commitsAtras: 1, mudouNativo: null });
    expect(v.nivel).toBe("ok");
    expect(v.motivos.join(" ")).toContain("fail-open");
  });

  it("dado lixo (NaN/string/undefined) não vira bloqueio", () => {
    expect(avaliarDrift({}).nivel).toBe("desconhecido");
    expect(avaliarDrift({ diasAtras: NaN, commitsAtras: NaN }).nivel).toBe("desconhecido");
    // @ts-expect-error entrada deliberadamente errada
    expect(avaliarDrift({ diasAtras: "40", commitsAtras: "999" }).nivel).toBe("desconhecido");
  });

  it("uma métrica só já serve pra decidir", () => {
    expect(avaliarDrift({ diasAtras: null, commitsAtras: 61, mudouNativo: false }).nivel).toBe("bloqueio");
    expect(avaliarDrift({ diasAtras: 40, commitsAtras: null, mudouNativo: false }).nivel).toBe("bloqueio");
  });
});

describe("diffNativo · conservador de propósito", () => {
  const base = {
    pkgAntes: { dependencies: { expo: "^54.0.0", "expo-updates": "~29.0.18" } },
    pkgAgora: { dependencies: { expo: "^54.0.0", "expo-updates": "~29.0.18" } },
    appAntes: { expo: { plugins: ["expo-router"], android: { permissions: ["A"] } } },
    appAgora: { expo: { plugins: ["expo-router"], android: { permissions: ["A"] } } },
  };

  it("nada mudou ⇒ lista vazia", () => {
    expect(diffNativo(base)).toEqual([]);
  });

  it("dependência nova acusa", () => {
    const itens = diffNativo({
      ...base,
      pkgAgora: { dependencies: { ...base.pkgAgora.dependencies, "expo-camera": "~15.0.0" } },
    });
    expect(itens.join(" ")).toContain("expo-camera");
  });

  it("bump de versão acusa — não sabemos, só pelo nome, se o pacote tem nativo", () => {
    const itens = diffNativo({
      ...base,
      pkgAgora: { dependencies: { ...base.pkgAgora.dependencies, "expo-updates": "~29.1.0" } },
    });
    expect(itens.join(" ")).toContain("expo-updates");
  });

  it("dependência removida acusa", () => {
    const itens = diffNativo({ ...base, pkgAgora: { dependencies: { expo: "^54.0.0" } } });
    expect(itens.join(" ")).toContain("REMOVIDA");
  });

  it("plugin novo no app.json acusa", () => {
    const itens = diffNativo({
      ...base,
      appAgora: { expo: { plugins: ["expo-router", "expo-camera"], android: { permissions: ["A"] } } },
    });
    expect(itens.join(" ")).toContain("plugins");
  });

  it("permissão nova do Android acusa", () => {
    const itens = diffNativo({
      ...base,
      appAgora: { expo: { plugins: ["expo-router"], android: { permissions: ["A", "B"] } } },
    });
    expect(itens.join(" ")).toContain("android.permissions");
  });

  it("mudança que o OTA CARREGA não acusa (nome, splash)", () => {
    const itens = diffNativo({
      ...base,
      appAntes: { expo: { ...base.appAntes.expo, name: "CBRio", splash: { image: "a.png" } } },
      appAgora: { expo: { ...base.appAgora.expo, name: "CBRio Novo", splash: { image: "b.png" } } },
    });
    expect(itens).toEqual([]);
  });

  it("entrada vazia não explode nem acusa", () => {
    expect(diffNativo({})).toEqual([]);
  });
});

describe("LIMITES", () => {
  it("aviso vem antes do bloqueio nos dois eixos", () => {
    expect(LIMITES.avisoDias).toBeLessThan(LIMITES.bloqueioDias);
    expect(LIMITES.avisoCommits).toBeLessThan(LIMITES.bloqueioCommits);
  });
});
