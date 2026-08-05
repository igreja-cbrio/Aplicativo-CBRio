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
// Régua do "incompleto" (Marcos · 05/08/2026): nome de gente + telefone +
// nascimento + **CPF** + **sexo** = a FICHA PADRÃO. CPF e sexo passaram a ser
// exigidos porque `POST /app/inscricoes` recusa inscrição sem CPF — 50 das 75
// contas entravam "completas" e eram barradas ao pedir grupo/batismo/next.
//
// ⚠️ BLOQUEIA de verdade (era só um redirect): enquanto o servidor disser que
// falta algo, qualquer rota que não seja /completar-cadastro é devolvida pra lá.
// Reafirmar a cada troca de rota é necessário porque o tap numa PUSH navega
// direto pra tela do assunto (notifTap) e escapava do redirect único.
//
// ⚠️ Conservador onde importa: só age quando o servidor RESPONDE que falta algo.
// Falha de rede/endpoint (deploy em 2 etapas, app offline) NÃO bloqueia o app —
// preso na tela de cadastro sem internet seria pior que dado incompleto.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { statusIdentidade } from "@/lib/api";

export function CadastroGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checado, setChecado] = useState(false);
  const [incompleto, setIncompleto] = useState(false);
  const redirecionou = useRef(false);

  useEffect(() => {
    if (loading || !user?.id || checado) return;
    let vivo = true;
    statusIdentidade()
      .then((s) => {
        if (!vivo) return;
        setChecado(true);
        setIncompleto(!s.completo);
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
    if (!user?.id) { setChecado(false); setIncompleto(false); redirecionou.current = false; }
  }, [user?.id]);

  // Enquanto a ficha não fecha, toda rota volta pra tela de cadastro.
  useEffect(() => {
    if (!incompleto) return;
    if (pathname.startsWith("/completar-cadastro")) return;
    router.replace("/completar-cadastro");
  }, [incompleto, pathname, router]);

  // Não esconde a UI enquanto a checagem roda (é 1 GET) — o bloqueio é por
  // navegação, o que mantém o Stack montado (a tela de cadastro é uma rota
  // dele). Some a barra de baixo e a faixa nessa rota, e o gesto de voltar
  // está desabilitado, então não há saída lateral.
  return <>{children}</>;
}
