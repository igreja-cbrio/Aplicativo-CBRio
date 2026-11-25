import { Redirect } from "expo-router";

// Tela ÓRFÃ aposentada (2026-07-06): nenhuma navegação interna apontava pra cá,
// e o formulário antigo criava a inscrição via /app/inscricoes tipo="next", que
// caía só em app_inscricoes (invisível pro módulo NEXT). O fluxo correto é a
// tela /next, que usa POST /app/next/inscrever → next_inscricoes direto.
// Mantida só como redirect pra cobrir deep links antigos (cbrio://inscricao-next).
export default function InscricaoNextRedirect() {
  return <Redirect href="/next" />;
}
