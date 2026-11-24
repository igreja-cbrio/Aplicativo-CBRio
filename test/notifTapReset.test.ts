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
  it("push sem destino não segura o reset (não navegou)", () => {
    expect(ler("lib/notifTap.ts")).toMatch(/ultimoToqueEm = 0;\s*trackEvento\("notif_tap_sem_destino"/);
  });
  it("criar conta segura o portão de atualização (mesma bandeira do completar-cadastro); o login NÃO", () => {
    for (const p of ["app/(auth)/cadastro.tsx", "app/(app)/completar-cadastro.tsx"]) {
      expect(ler(p), p).toMatch(/useEffect\(\(\) => \{\s*abrirFichaCadastro\(\);\s*return \(\) => \{ fecharFichaCadastro\(\); \};\s*\}, \[\]\);/);
    }
    // No login a 1ª abertura precisa aplicar o OTA (conserto de 29/08: "instalei e veio a versão antiga").
    expect(ler("app/(auth)/login.tsx")).not.toContain("abrirFichaCadastro");
  });
  it("o portão também espera o cadastro gravando (a tela desmonta antes do carimbo da ficha)", () => {
    expect(ler("components/app/PortaoAtualizacao.tsx")).toMatch(/const fichaAberta = fichaNaTela \|\| cadastroGravando;/);
  });
});
