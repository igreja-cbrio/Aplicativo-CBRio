// ============================================================================
// CI DAS RÉGUAS DO APP (05/08/2026)
//
// Por que existe: até hoje o portão de qualidade deste repo era `tsc --noEmit`
// + leitura de código. Numa varredura só (05/08) apareceram NOVE divergências
// entre a régua do app e a do ERP — status que não existia no banco
// (`"recusado"`), 7 status de voluntariado tratados como 3, dia em UTC, filtros
// de soft-delete ausentes. Nenhuma delas quebra o TypeScript: são acertos de
// SEMÂNTICA, e é exatamente isso que teste pega.
//
// ⚠️ ESCOPO PROPOSITAL: só código PURO (`lib/*` sem React/nativo). Não é teste
// de tela — pra isso é preciso rodar o app, e rodar o app é o passo humano.
// O que estes testes garantem é que a REGRA não muda sem alguém perceber.
//
// ⚠️ `expo-router` é stubado: `lib/hierarquia.ts` importa `router` só pra
// navegar, e o que a gente testa ali é o MAPA da árvore (função pura). Importar
// o módulo real puxaria o runtime nativo do Expo pra dentro do Node.
// ============================================================================
// ⚠️⚠️ O PORTÃO RODA NO FUSO DA IGREJA (11/08/2026 · o CI estava vermelho na
// main por causa disto). O runner do GitHub roda em **UTC**, e há régua cuja
// guarda só consegue existir em fuso negativo: `lib/homeCultos.ts` lê a data
// como `new Date("AAAA-MM-DDT12:00:00")` (meio-dia LOCAL) justamente porque
// `new Date("AAAA-MM-DD")` é meia-noite UTC e, em UTC-3, devolve o dia
// ANTERIOR — domingo vira sábado e a âncora da Home nunca acontece. Em UTC as
// duas formas dão o MESMO dia ⇒ o mutante que troca uma pela outra vira no-op,
// o teste não tem como pegá-lo, e o `test:mutantes` acusava "53/54 · há régua
// sem guarda de verdade". Reproduzido: nesta máquina 54/54, com `TZ=UTC` 53/54.
// Ou seja, era defeito do AMBIENTE do teste, não da régua.
// ⚠️ Não afrouxa as réguas de BRT (`lib/dataBRT.ts`): elas convertem o fuso
// explicitamente e seguem cobradas pelo mutante que troca a conversão por UTC.
process.env.TZ = "America/Sao_Paulo";

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "expo-router": path.resolve(__dirname, "test/stubs/expo-router.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Determinístico: sem rede, sem banco, sem relógio real onde importa
    // (a lição do `faixaEtaria.test.ts` do ERP, que dependia da HORA da
    // execução e passava/falhava conforme o horário do dia).
    restoreMocks: true,
  },
});
