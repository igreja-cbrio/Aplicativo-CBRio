// Toque numa push com o app em segundo plano há mais de 3 min (24/11/2026):
// o "voltar depois de um tempo fora = Home" desfazia a navegação do toque.
// Telemetria de 23 e 24/11: a resposta do push chega ANTES do `active`.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";

const ler = (p: string) => semComentarios(readFileSync(join(__dirname, "..", p), "utf8"));

describe("toque em push × volta para a Home", () => {
  it("o toque marca o instante logo depois de tratar a resposta", () => {
    expect(ler("lib/notifTap.ts")).toMatch(/marcarProcessada\(resp\);\s*ultimoToqueEm = Date\.now\(\);/);
  });
  it("o reset da Home não mexe logo depois de um toque", () => {
    expect(ler("app/(app)/_layout.tsx")).toContain("if (fora < MS_PARA_RECOMECAR || !focusRef.current || toqueDeNotificacaoRecente()) return;");
  });
  it("criar conta e login seguram o portão de atualização (mesma bandeira do completar-cadastro)", () => {
    for (const p of ["app/(auth)/cadastro.tsx", "app/(auth)/login.tsx", "app/(app)/completar-cadastro.tsx"]) {
      expect(ler(p), p).toMatch(/useEffect\(\(\) => \{\s*abrirFichaCadastro\(\);\s*return \(\) => \{ fecharFichaCadastro\(\); \};\s*\}, \[\]\);/);
    }
  });
});
