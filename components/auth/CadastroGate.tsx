// ============================================================================
// Portão de CADASTRO · manda pra /completar-cadastro quem entrou sem cadastro
// de gente (Marcos · 04/08/2026).
//
// O gatilho de auth.users cria um `mem_membros` no signup SEM passar pelo
// matcher e sem exigir campo — resultado medido em produção: 13 de 21 cadastros
// com nome = prefixo do e-mail ("karlosaragao", "totem1") e 1 duplicata de
// pessoa real. Os líderes de grupo são os primeiros a usar o app, e é a
// oportunidade de fechar o cadastro de quem falta.
//
// Régua do "incompleto" (decidida com o Marcos): nome de gente + telefone +
// nascimento. **CPF é recomendado, não obrigatório** — ninguém fica de fora do
// app por não ter o documento em mãos.
//
// ⚠️ Conservador de propósito: só age quando o servidor RESPONDE que falta algo.
// Falha de rede/endpoint (deploy em 2 etapas, app offline) NÃO bloqueia o app —
// preso na tela de cadastro sem internet seria pior que dado incompleto.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { statusIdentidade } from "@/lib/api";

export function CadastroGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checado, setChecado] = useState(false);
  const redirecionou = useRef(false);

  useEffect(() => {
    if (loading || !user?.id || checado) return;
    let vivo = true;
    statusIdentidade()
      .then((s) => {
        if (!vivo) return;
        setChecado(true);
        // `completo` já ignora o CPF (só recomendado) — ver backend.
        if (!s.completo && !redirecionou.current) {
          redirecionou.current = true;
          router.replace("/completar-cadastro");
        }
      })
      .catch(() => {
        // Sem resposta = segue a vida (ver comentário do topo).
        if (vivo) setChecado(true);
      });
    return () => { vivo = false; };
  }, [loading, user?.id, checado, router]);

  // Trocou de conta → checa de novo na próxima montagem.
  useEffect(() => {
    if (!user?.id) { setChecado(false); redirecionou.current = false; }
  }, [user?.id]);

  // Nunca esconde a UI: o app abre normal enquanto a checagem roda (é 1 GET).
  // O redirect, quando acontece, é uma navegação — não um bloqueio de render.
  return <>{children}</>;
}
