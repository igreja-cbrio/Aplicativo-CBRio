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
