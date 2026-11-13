import { it, expect } from "vitest";
import { temaKids, chaveTemaKids } from "@/lib/kidsTema";
import { diasDoMesKids, moverMesKids } from "@/lib/kidsCalendario";
it("preferência inválida volta ao amarelo e contas não compartilham chave", () => {
  expect(temaKids(null).id).toBe("amarelo");
  expect(temaKids("rosa").id).toBe("rosa");
  expect(temaKids("invalid").id).toBe("amarelo");
  expect(chaveTemaKids("a")).not.toBe(chaveTemaKids("b"));
});
it("calendário respeita ano bissexto e virada de ano sem UTC", () => {
  expect(diasDoMesKids("2028-02").filter(Boolean)).toHaveLength(29);
  expect(diasDoMesKids("2027-02").filter(Boolean)).toHaveLength(28);
  expect(diasDoMesKids("2026-11")[0]).toBe("2026-11-01");
  expect(moverMesKids("2026-12", 1)).toBe("2027-01");
  expect(moverMesKids("2027-01", -1)).toBe("2026-12");
});
