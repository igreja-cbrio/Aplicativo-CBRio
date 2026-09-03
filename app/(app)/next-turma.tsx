// ⚠️⚠️ TELA APOSENTADA (03/09/2026) — o conteúdo dela vive na gestão.
//
// Era a gestão de UMA turma (presença por encontro + walk-in + direcionamento).
// O trilho de turmas de `components/next/NextGestao.tsx` faz o mesmo sem trocar
// de tela, e é lá que o Marcos pediu pra cair direto quem tem permissão.
//
// ⚠️ O redirect FICA: esta rota existia antes de hoje, então pode estar em
// link/push já entregue e na pilha de quem está com bundle intermediário (o OTA
// aplica na 2ª abertura). Precedente: `inscricao-next.tsx`.
//
// ⚠️ Redireciona pra `/next`, NÃO pra uma rota de gestão própria: quem não
// gerencia também pode chegar aqui por link antigo, e `/next` é a única tela que
// sabe decidir — pelo que o SERVIDOR responde — se mostra gestão ou membro.
import { Redirect } from "expo-router";

export default function NextTurmaRedirect() {
  return <Redirect href="/next" />;
}
