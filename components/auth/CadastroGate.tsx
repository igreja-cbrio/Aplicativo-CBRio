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
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { statusIdentidade } from "@/lib/api";
import { assinarCadastroNativo, lerCadastroNativo } from "@/lib/cadastroEmAndamento";

export function CadastroGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checado, setChecado] = useState(false);
  const [incompleto, setIncompleto] = useState(false);
  const redirecionou = useRef(false);

  // ⚠️⚠️ NÃO DECIDIR ENQUANTO O CADASTRO NATIVO ESTÁ SENDO CONCLUÍDO (07/08).
  // A sessão nasce no `signUp` e o portão montava perguntando o status NA MESMA
  // HORA — em paralelo com o `completarCadastroApp`, que é quem carimba. A
  // resposta voltava `completo: false` e rebatia a pessoa 4 s DEPOIS de a ficha
  // já estar confirmada no banco. Detalhes e a linha do tempo medida em
  // `lib/cadastroEmAndamento.ts`. Quando a bandeira baixa, o efeito reexecuta e
  // a checagem acontece normalmente — inclusive se o cadastro tiver falhado.
  const cadastrando = useSyncExternalStore(
    assinarCadastroNativo,
    lerCadastroNativo,
    lerCadastroNativo,
  );

  useEffect(() => {
    if (loading || !user?.id || checado || cadastrando) return;
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
  }, [loading, user?.id, checado, router, cadastrando]);

  // Trocou de conta → checa de novo na próxima montagem.
  useEffect(() => {
    if (!user?.id) { setChecado(false); setIncompleto(false); redirecionou.current = false; }
  }, [user?.id]);

  // Enquanto a ficha não fecha, toda rota volta pra tela de cadastro —
  // mas RECONFERINDO com o servidor antes de rebater.
  //
  // ⚠️⚠️ INCIDENTE 05/08/2026 (não regredir): `incompleto` é estado LOCAL e
  // nada o limpava. Quem terminava o cadastro (pelo CPF ou pelo formulário)
  // era mandado pra "/" pelo `concluir()`, este efeito disparava com
  // `incompleto` ainda `true` e devolvia a pessoa pra cá — para sempre, até
  // fechar e reabrir o app. O Matheus tentou 2×, a Joana Botafogo 3× em dois
  // minutos, os dois com o vínculo JÁ criado e a ficha completa no banco.
  //
  // Rebater sem perguntar era o erro: o estado que decide o bloqueio é do
  // SERVIDOR e muda por ação da pessoa na tela anterior. Agora cada tentativa
  // de sair re-consulta; só volta se o servidor CONFIRMAR que ainda falta.
  // Continua fail-closed (erro de rede mantém o bloqueio de quem já sabemos
  // estar incompleto) e o GET extra só acontece com a ficha aberta.
  useEffect(() => {
    if (!incompleto) return;
    if (pathname.startsWith("/completar-cadastro")) return;
    let vivo = true;
    statusIdentidade()
      .then((s) => {
        if (!vivo) return;
        if (s.completo) { setIncompleto(false); return; }  // acabou de completar
        router.replace("/completar-cadastro");
      })
      .catch(() => { if (vivo) router.replace("/completar-cadastro"); });
    return () => { vivo = false; };
  }, [incompleto, pathname, router]);

  // Não esconde a UI enquanto a checagem roda (é 1 GET) — o bloqueio é por
  // navegação, o que mantém o Stack montado (a tela de cadastro é uma rota
  // dele). Some a barra de baixo e a faixa nessa rota, e o gesto de voltar
  // está desabilitado, então não há saída lateral.
  return <>{children}</>;
}
