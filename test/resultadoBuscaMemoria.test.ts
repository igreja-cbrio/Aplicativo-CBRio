// Resultado da busca por selfie que fica ao sair e voltar (24/11/2026).
// Ver lib/resultadoBuscaMemoria.ts: só memória, só ids e contagens, conta + álbum,
// até 24 h, apagado ao sair/trocar de conta, no "Apagar resultado" e quando o
// álbum ou a busca deixam de valer.
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";
import type { ResultadoBusca } from "../lib/buscaFacial";
import {
  MAX_RESULTADOS_GUARDADOS,
  VALIDADE_RESULTADO_MS,
  apagarResultado,
  apagarTodosResultados,
  guardarResultado,
  lerResultado,
  mudancasDoAlbum,
  oQueFazerComGuardado,
  podarResultados,
  quandoFoiABusca,
} from "../lib/resultadoBuscaMemoria";

const AGORA = Date.UTC(2026, 10, 24, 18, 32, 0); // 24/11 15:32 BRT
const res = (over: Partial<ResultadoBusca> = {}): ResultadoBusca => ({
  suas: ["a", "b"],
  talvez: ["c"],
  pelaSequencia: ["c"],
  total: 10,
  verificadas: 10,
  naoVerificadas: 0,
  interrompida: false,
  fimDaBusca: "fim",
  ...over,
});
const IDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

beforeEach(() => apagarTodosResultados());

describe("guardar e ler", () => {
  it("volta o resultado da mesma conta no mesmo álbum", () => {
    expect(guardarResultado("u1", "alb", res(), IDS, AGORA)).toBe(true);
    const g = lerResultado("u1", "alb", AGORA + 60_000);
    expect(g?.resultado.suas).toEqual(["a", "b"]);
    expect(g?.em).toBe(AGORA);
  });

  it("outra conta (mesmo celular) ou outro álbum não veem nada", () => {
    guardarResultado("u1", "alb", res(), IDS, AGORA);
    expect(lerResultado("u2", "alb", AGORA)).toBeNull();
    expect(lerResultado("u1", "outro", AGORA)).toBeNull();
    expect(lerResultado(null, "alb", AGORA)).toBeNull();
  });

  it("vence em 24 h e o vencido é apagado", () => {
    guardarResultado("u1", "alb", res(), IDS, AGORA);
    expect(lerResultado("u1", "alb", AGORA + VALIDADE_RESULTADO_MS)).not.toBeNull();
    expect(lerResultado("u1", "alb", AGORA + VALIDADE_RESULTADO_MS + 1)).toBeNull();
    expect(lerResultado("u1", "alb", AGORA)).toBeNull();
  });

  it("busca sem nenhuma foto verificada não substitui o resultado anterior", () => {
    guardarResultado("u1", "alb", res(), IDS, AGORA);
    expect(guardarResultado("u1", "alb", res({ suas: [], talvez: [], verificadas: 0, naoVerificadas: 10 }), IDS, AGORA + 1000)).toBe(false);
    expect(lerResultado("u1", "alb", AGORA + 2000)?.resultado.suas).toEqual(["a", "b"]);
  });

  it("busca nova entregue SUBSTITUI (nunca soma duas selfies)", () => {
    guardarResultado("u1", "alb", res(), IDS, AGORA);
    guardarResultado("u1", "alb", res({ suas: ["j"], talvez: [] }), IDS, AGORA + 1000);
    const g = lerResultado("u1", "alb", AGORA + 2000);
    expect(g?.resultado.suas).toEqual(["j"]);
    expect(g?.resultado.talvez).toEqual([]);
  });

  it("guarda SÓ os campos do resultado (nada de distância, selfie ou URL)", () => {
    const sujo = { ...res(), distancias: { a: 0.1 }, selfie: "data:image/jpeg;base64,AAAA", url: "https://x" } as unknown as ResultadoBusca;
    guardarResultado("u1", "alb", sujo, IDS, AGORA);
    const g = lerResultado("u1", "alb", AGORA)!;
    expect(Object.keys(g.resultado).sort()).toEqual(
      ["fimDaBusca", "interrompida", "naoVerificadas", "pelaSequencia", "suas", "talvez", "total", "verificadas"].sort(),
    );
    expect(Object.keys(g).sort()).toEqual(["albumId", "em", "idsDaBusca", "regua", "resultado", "uid"].sort());
    expect(JSON.stringify(g)).not.toMatch(/data:|0\.1|https?:/);
  });

  it("guarda no máximo alguns álbuns (o mais antigo sai)", () => {
    for (let i = 0; i <= MAX_RESULTADOS_GUARDADOS; i += 1) guardarResultado("u1", `alb${i}`, res(), IDS, AGORA + i);
    expect(lerResultado("u1", "alb0", AGORA + 100)).toBeNull();
    expect(lerResultado("u1", `alb${MAX_RESULTADOS_GUARDADOS}`, AGORA + 100)).not.toBeNull();
  });

  it("apagar um e apagar tudo (sair da conta)", () => {
    guardarResultado("u1", "alb", res(), IDS, AGORA);
    guardarResultado("u1", "alb2", res(), IDS, AGORA);
    apagarResultado("u1", "alb");
    expect(lerResultado("u1", "alb", AGORA)).toBeNull();
    expect(lerResultado("u1", "alb2", AGORA)).not.toBeNull();
    apagarTodosResultados();
    expect(lerResultado("u1", "alb2", AGORA)).toBeNull();
  });
});

describe("o que fazer com o guardado ao voltar", () => {
  const resp = (situacao = "liberado", busca: string | null = "liberada") => ({ albuns: [{ id: "alb", situacao }], busca_facial: busca });
  const g = () => {
    guardarResultado("u1", "alb", res(), IDS, AGORA);
    return lerResultado("u1", "alb", AGORA);
  };

  it("álbum liberado e busca liberada: restaura", () => {
    expect(oQueFazerComGuardado(g(), resp(), "alb")).toBe("restaurar");
  });

  it("álbum fora da lista, despublicado ou em conflito: apaga", () => {
    expect(oQueFazerComGuardado(g(), { albuns: [], busca_facial: "liberada" }, "alb")).toBe("apagar");
    expect(oQueFazerComGuardado(g(), resp("conflito"), "alb")).toBe("apagar");
    expect(oQueFazerComGuardado(g(), resp("aguardando"), "alb")).toBe("apagar");
  });

  it("busca desligada (interruptor), menor ou resposta antiga: apaga", () => {
    expect(oQueFazerComGuardado(g(), resp("liberado", "indisponivel"), "alb")).toBe("apagar");
    expect(oQueFazerComGuardado(g(), resp("liberado", "menor"), "alb")).toBe("apagar");
    expect(oQueFazerComGuardado(g(), resp("liberado", null), "alb")).toBe("apagar");
  });

  it("sem guardado ou sem a lista de álbuns ainda: nada", () => {
    expect(oQueFazerComGuardado(null, resp(), "alb")).toBe("nada");
    expect(oQueFazerComGuardado(g(), null, "alb")).toBe("nada");
  });
});

describe("poda a cada lista de álbuns (não depende do álbum aberto)", () => {
  const lista = (busca: string | null, albuns: { id: string; situacao: string }[]) => ({ albuns, busca_facial: busca });
  beforeEach(() => {
    guardarResultado("u1", "a1", res(), IDS, AGORA);
    guardarResultado("u1", "a2", res(), IDS, AGORA);
    guardarResultado("u2", "a1", res(), IDS, AGORA);
  });

  it("interruptor/menor: apaga todos os desta conta, e só desta conta", () => {
    podarResultados("u1", lista("indisponivel", [{ id: "a1", situacao: "liberado" }, { id: "a2", situacao: "liberado" }]));
    expect(lerResultado("u1", "a1", AGORA)).toBeNull();
    expect(lerResultado("u1", "a2", AGORA)).toBeNull();
    expect(lerResultado("u2", "a1", AGORA)).not.toBeNull();
  });

  it("álbum que saiu da lista ou deixou de estar liberado: apaga só ele", () => {
    podarResultados("u1", lista("liberada", [{ id: "a1", situacao: "conflito" }]));
    expect(lerResultado("u1", "a1", AGORA)).toBeNull();
    expect(lerResultado("u1", "a2", AGORA)).toBeNull();
    guardarResultado("u1", "a1", res(), IDS, AGORA);
    podarResultados("u1", lista("liberada", [{ id: "a1", situacao: "liberado" }]));
    expect(lerResultado("u1", "a1", AGORA)).not.toBeNull();
  });

  it("sem conta ou sem lista: não mexe", () => {
    podarResultados(null, lista("indisponivel", []));
    podarResultados("u1", null);
    expect(lerResultado("u1", "a1", AGORA)).not.toBeNull();
  });
});

describe("o que mudou no álbum depois da busca", () => {
  it("conta fotos do resultado que saíram e fotos novas sem verificar", () => {
    guardarResultado("u1", "alb", res(), IDS, AGORA);
    const g = lerResultado("u1", "alb", AGORA)!;
    expect(mudancasDoAlbum(g, IDS)).toEqual({ sairam: 0, novas: 0 });
    expect(mudancasDoAlbum(g, [...IDS.filter((x) => x !== "b"), "novo1", "novo2"])).toEqual({ sairam: 1, novas: 2 });
  });
});

describe("quando foi a busca (BRT)", () => {
  it("dia e hora de Brasília", () => {
    expect(quandoFoiABusca(AGORA)).toEqual({ dia: "24/11", hora: "15:32" });
    expect(quandoFoiABusca(Date.UTC(2026, 10, 25, 1, 5))).toEqual({ dia: "24/11", hora: "22:05" });
  });
});

describe("travas de texto", () => {
  const ler = (p: string) => semComentarios(readFileSync(join(__dirname, "..", p), "utf8"));

  it("o resultado nunca vai para disco, servidor ou log", () => {
    const mod = ler("lib/resultadoBuscaMemoria.ts");
    for (const proibido of ["AsyncStorage", "SecureStore", "expo-file-system", "FileSystem", "console.", "fetch(", "apiPost", "track"]) {
      expect(mod, proibido).not.toContain(proibido);
    }
  });

  it("sair da conta ou trocar de conta apaga tudo", () => {
    const auth = ler("contexts/AuthContext.tsx");
    expect(auth.match(/apagarTodosResultados\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(auth).toMatch(/if \(uid !== uidDaSessao\.current\) \{\s*apagarTodosResultados\(\);/);
  });

  it("a galeria não apaga ao sair da tela e só mostra o guardado depois de carregar o álbum inteiro", () => {
    const tela = ler("app/(app)/batismo-fotos.tsx");
    // A limpeza do foco (sair da tela) só fecha a busca em andamento: não apaga o resultado.
    expect(tela).toMatch(/return \(\) => \{\s*setBuscaAberta\(false\);\s*\};\s*\}, \[\]\),/);
    expect(tela).toMatch(/carregarTodasParaBusca\(\)\.then\(\s*\(fotos\) => \{[\s\S]{0,400}setResultadoBusca\(guardado\.resultado\)/);
    expect(tela).toContain('if (decisao === "apagar") {');
  });

  it("revisão de 24/11: lista inteira não é trocada por parcial, erro do restauro aparece, poda a cada lista", () => {
    const tela = ler("app/(app)/batismo-fotos.tsx");
    // Depois da carga completa, uma geração nova descarta carga parcial que começou durante ela.
    expect(tela).toMatch(/setSelecionadas\(\(s\) => new Set\(\[\.\.\.s\]\.filter\(\(x\) => r\.fotos\.some\(\(f\) => f\.id === x\)\)\)\);\s*geracao\.current \+= 1;\s*\}\s*return r\.fotos;/);
    // Restauro que falha não deixa a galeria presa no "carregando".
    expect(tela).toContain("if (!inicial.carregou || inicial.fotos.length === 0) setPag((p) => ({ ...p, carregou: true, carregando: false, erro }));");
    // Cada lista de álbuns poda o que deixou de valer.
    expect(tela).toContain("podarResultados(uidRef.current, resp);");
    // Voltar o foco confere se o resultado na tela ainda vale.
    expect(tela).toContain("if (resultadoRef.current && lerResultado(uidRef.current, albumRef.current)?.resultado !== resultadoRef.current) {");
    // A tela mostra a cópia guardada (a conferência acima é por identidade).
    expect(tela).toContain("setResultadoBusca(copia ? copia.resultado : r);");
    // Puxar para atualizar nunca encolhe a lista.
    expect(tela).toContain("await recarregarAlbum(pagRef.current.fotos.length);");
  });
});
