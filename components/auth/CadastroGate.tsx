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
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { statusIdentidade } from "@/lib/api";

// ⚠️⚠️ CONSERTO DO BECO SEM SAÍDA (06/08/2026 · o Marcos ficou trancado fora)
// O portão perguntava ao servidor UMA vez, na montagem, e guardava `incompleto`.
// Quem terminava o cadastro (por qualquer caminho) era mandado pra Home, o efeito
// de rota via `incompleto` ainda true e **devolvia pra tela de cadastro** — laço
// infinito. Ninguém tinha concluído até hoje (`app_onboarding` = 0 observações),
// então o defeito só apareceu quando ele tentou.
// A tela chama `revalidarCadastro()` ao concluir; o portão repergunta ao servidor
// e só então libera. Ponteiro em nível de módulo (mesmo padrão do
// `registrarRotaAtual` de lib/hierarquia) pra não ter que enfiar um context novo
// entre o layout e a tela.
let revalidarRef: (() => Promise<void>) | null = null;
export async function revalidarCadastro(): Promise<void> {
  await revalidarRef?.();
}

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
    if (!user?.id) { setChecado(false); setIncompleto(false); redirecionou.current = false; liberado.current = false; }
  }, [user?.id]);

  // Repergunta ao servidor — chamado pela tela de cadastro ao concluir.
  const liberado = useRef(false);
  const revalidar = useCallback(async () => {
    try {
      const s = await statusIdentidade();
      if (s.completo) liberado.current = true; // trava o redirect ANTES do setState
      setIncompleto(!s.completo);
      setChecado(true);
    } catch {
      // Sem resposta: mantém o estado atual (não é hora de decidir no escuro).
    }
  }, []);
  useEffect(() => {
    revalidarRef = revalidar;
    return () => { if (revalidarRef === revalidar) revalidarRef = null; };
  }, [revalidar]);

  // Enquanto a ficha não fecha, toda rota volta pra tela de cadastro.
  // ⚠️ `liberado` é um REF, não estado: `router.replace` roda logo depois do
  // `setIncompleto(false)` e o commit do React pode não ter acontecido ainda —
  // o ref é lido na hora e fecha essa janela de corrida.
  useEffect(() => {
    if (liberado.current || !incompleto) return;
    if (pathname.startsWith("/completar-cadastro")) return;
    router.replace("/completar-cadastro");
  }, [incompleto, pathname, router]);

  // Não esconde a UI enquanto a checagem roda (é 1 GET) — o bloqueio é por
  // navegação, o que mantém o Stack montado (a tela de cadastro é uma rota
  // dele). Some a barra de baixo e a faixa nessa rota, e o gesto de voltar
  // está desabilitado, então não há saída lateral.
  return <>{children}</>;
}
