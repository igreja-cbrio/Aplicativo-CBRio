import { temConviteSupervisor } from '@/lib/supervisorConvitePendente';
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useRef } from "react";
import { Stack, router, useGlobalSearchParams, usePathname } from "expo-router";
import { AppState, BackHandler, Platform } from "react-native";
import { KidsThemeProvider } from "@/contexts/KidsThemeContext";
import { MembroProvider } from "@/contexts/MembroContext";
import { CadastroGate } from "@/components/auth/CadastroGate";
import { MenuProvider } from "@/contexts/MenuContext";
import { ehRaiz, registrarRotaAtual, subirUmNivel } from "@/lib/hierarquia";
import { toqueDeNotificacaoRecente } from "@/lib/notifTap";

export const unstable_settings = { anchor: "(principal)" };

/**
 * Quanto tempo fora faz o app "começar de novo" na Home ao voltar.
 *
 * ⚠️ Por que isto existe (Marcos, 04/08/2026: "toda vez que eu abro ele vai
 * pra tela de notificações, abre sempre na home"): **não era bug de código.**
 * COLD START já cai na Home sempre — o expo-router força a rota raiz quando o
 * app não é aberto por deep link (`getInitialURL` → `getRootURL()`), e o
 * `index` é o primeiro filho do Stack. O que acontecia é o **sistema
 * RETOMANDO** o app na última tela (comportamento normal do Android/iOS
 * quando o processo continua vivo) — foi por isso que, no travamento de manhã,
 * "só apagando os dados" resolvia: apagar força o encerramento e a próxima
 * abertura vira cold start.
 * Descartado com dado, não por suposição: a tabela `app_push_tokens` **não tem
 * NENHUM token Android** e as contas dele não têm nenhuma linha em
 * `app_notificacoes` — nenhuma notificação chegou naquele aparelho, então o
 * caminho do tap não podia ter mandado ele pra lá.
 *
 * 3 minutos: trocar de app rapidinho (copiar um código, abrir o WhatsApp,
 * preencher um formulário no navegador) preserva a tela; voltar depois disso é
 * "abrir o app de novo" e começa na Home. É um número só, fácil de ajustar.
 */
const MS_PARA_RECOMECAR = 3 * 60 * 1000;

export default function AppLayout() {
  const pathname = usePathname();
  const focused = useIsFocused();
  const focusRef = useRef(focused);
  focusRef.current = focused;
  const paramsGlobais = useGlobalSearchParams();

  // Rota atual num ref: o listener de AppState é montado UMA vez e leria um
  // pathname congelado se dependesse do closure.
  const rotaRef = useRef(pathname);
  rotaRef.current = pathname;

  // A seta de voltar é `cd ..` (lib/hierarquia.ts). As ~29 telas com seta
  // própria chamam `subirUmNivel()` sem argumento, então quem sabe onde a
  // pessoa está é este layout — o único lugar que já observa o pathname.
  registrarRotaAtual(pathname, paramsGlobais);

  // ⚠️ BOTÃO FÍSICO DO ANDROID = MESMA ÁRVORE DA SETA (pedido do Marcos ·
  // 05/08/2026: "faça o botao fisico ser igual ao da seta"). Sem isto o hardware
  // back andava no HISTÓRICO enquanto a seta subia um nível — dois
  // comportamentos pra um gesto que a pessoa entende como "voltar".
  // ⚠️ Na HOME o handler NÃO intercepta (devolve false): ali o certo é o sistema
  // minimizar/sair o app. Engolir o back na raiz é como se faz um app que não
  // fecha — e o Android reclama disso na revisão da Play Store.
  // ⚠️ Também não intercepta em `/completar-cadastro`: sair de lá por gesto
  // deixaria a pessoa numa área que o CadastroGate manda de volta na hora
  // (loop visível). Quem sai de lá é o próprio fluxo, ao concluir.
  // ⚠️ `Modal` do react-native (usado em 6 telas com `onRequestClose`) trata o
  // back no próprio diálogo nativo e NÃO chega aqui — modal aberto fecha o
  // modal, como antes.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const rota = rotaRef.current;
      if (ehRaiz(rota) || rota === "/inscricao-formulario" || rota.startsWith("/completar-cadastro")) return false;
      subirUmNivel(rota);
      return true; // consumido: não deixa o histórico agir também
    });
    return () => sub.remove();
  }, []);

  // Voltar depois de um tempo fora = começar na Home (ver MS_PARA_RECOMECAR).
  useEffect(() => {
    let saiuEm: number | null = null;
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado !== "active") {
        // `inactive` (iOS) também conta: central de controle, ligação, aba de
        // notificações do sistema. Se durar pouco, o teto de tempo não deixa
        // resetar — então marcar aqui é seguro.
        if (saiuEm == null) saiuEm = Date.now();
        return;
      }
      if (saiuEm == null) return;
      const fora = Date.now() - saiuEm;
      saiuEm = null;
      // Toque numa push acabou de levar a pessoa ao aviso: não desfaz (lib/notifTap.ts).
      if (fora < MS_PARA_RECOMECAR || !focusRef.current || toqueDeNotificacaoRecente()) return;

      const rota = rotaRef.current;
      // Já está na Home, ou está no meio do cadastro (resetar apagaria o que a
      // pessoa digitou) → não mexe.
      if (temConviteSupervisor() || rota === "/voluntariado" || rota === "/evento" || rota === "/inscricao-formulario" || rota === "/" || rota.startsWith("/completar-cadastro") || rota === "/recuperar-senha" || rota === "/redefinir-senha") return;
      try {
        router.dismissAll();
      } catch {
        /* sem nada empilhado pra dispensar */
      }
      router.replace("/");
    });
    return () => sub.remove();
  }, []);

  return (
    <MembroProvider>
      <KidsThemeProvider><MenuProvider>
        <CadastroGate>
          {/* O chat cobre a casca inteira. O dock continua montado na tela abaixo,
              e o UIKit o revela junto com ela durante o gesto, inclusive cancelado. */}
          <Stack screenOptions={{ headerShown: false, animation: "ios_from_right", animationDuration: 180 }}>
            <Stack.Screen name="(principal)" options={{ animation: "none" }} />
            <Stack.Screen name="fale-conosco-chat" />
          </Stack>
        </CadastroGate>
      </MenuProvider></KidsThemeProvider>
    </MembroProvider>
  );
}
