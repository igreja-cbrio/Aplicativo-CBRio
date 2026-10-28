import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const detalhe = readFileSync(new URL("../app/(app)/evento.tsx", import.meta.url), "utf8");
const lista = readFileSync(new URL("../app/(app)/inscricoes.tsx", import.meta.url), "utf8");

describe("capas de eventos sem recorte", () => {
  it("mostra a arte inteira no detalhe e na miniatura", () => {
    expect(detalhe).toContain('resizeMode="contain"');
    expect(lista).toContain('style={styles.eventoCapa} resizeMode="contain"');
    expect(detalhe).not.toContain('resizeMode="cover"');
  });

  it("usa a proporção carregada, vinculada à imagem, sem altura fixa", () => {
    expect(detalhe).toContain("proporcao: width / height");
    expect(detalhe).toContain("capaMedida?.uri === capa ? capaMedida.proporcao : 2");
    expect(detalhe).toContain("Number.isFinite(width)");
    expect(detalhe).toContain("Number.isFinite(height)");
    expect(detalhe).toContain("width > 0 && height > 0");
    expect(detalhe).toContain("return () => { atual = false; }");
    expect(detalhe).not.toMatch(/capa:\s*\{[^}]*height:/);
  });
});
