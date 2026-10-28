import { useIsFocused } from "@react-navigation/native";
import { DockInsetContext } from "@/components/navigation/DockContent";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { Stack, router, useGlobalSearchParams, usePathname } from "expo-router";
import { AppState, BackHandler, Platform, View } from "react-native";
import { MembroProvider } from "@/contexts/MembroContext";
import { CadastroGate } from "@/components/auth/CadastroGate";
import { TopBar } from "@/components/ui/TopBar";
import { BottomBar } from "@/components/ui/BottomBar";
import { useColors, useTheme } from "@/contexts/ThemeContext";
import { MenuProvider } from "@/contexts/MenuContext";
import { StatusBar } from "expo-status-bar";
import { ehRaiz, registrarRotaAtual, subirUmNivel } from "@/lib/hierarquia";

/** Navegação comum: marca no topo, menu lateral e atalhos da nova Home. */

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

/** Rota → título do centro da faixa. Home (`/`) usa seu cabeçalho editorial. */
const TELAS_BARRA: Record<string, string> = {
  "/": "",
  "/meu-grupo": "Meus grupos",
  "/voluntariado": "Servir",
  "/cuidados": "Cuidados",
  "/devocional": "Devocional",
  "/menu": "Menu",
};

export default function AppLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [dockHeight, setDockHeight] = useState(78 + Math.max(insets.bottom, 12));
  const { mode } = useTheme();
  const pathname = usePathname();
  const focused = useIsFocused();
  const focusRef = useRef(focused);
  focusRef.current = focused;
  const paramsGlobais = useGlobalSearchParams();

  const telaDeBarra = Object.prototype.hasOwnProperty.call(TELAS_BARRA, pathname);
  // Onboarding é a única tela sem casca: quem está completando o cadastro não
  // deve ter atalho pra sair pelo rodapé.
  const semBarra = pathname.startsWith("/completar-cadastro") || pathname === "/inscricao-formulario";

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
      if (fora < MS_PARA_RECOMECAR || !focusRef.current) return;

      const rota = rotaRef.current;
      // Já está na Home, ou está no meio do cadastro (resetar apagaria o que a
      // pessoa digitou) → não mexe.
      if (rota === "/evento" || rota === "/inscricao-formulario" || rota === "/" || rota.startsWith("/completar-cadastro") || rota === "/recuperar-senha" || rota === "/redefinir-senha") return;
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
      <MenuProvider>
      {/* Portão de cadastro: quem entrou sem cadastro de gente (nome real +
          telefone + nascimento) é levado a /completar-cadastro. Não bloqueia
          render — só navega quando o servidor confirma que falta algo. */}
      <CadastroGate>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {!semBarra && <StatusBar style={pathname === "/" || mode === "dark" ? "light" : "dark"} />}
          {!semBarra && pathname !== "/" && <TopBar mostrarVoltar={telaDeBarra || pathname === "/agenda"} />}

          {/* Conteúdo ocupa a tela inteira e passa por trás do dock. */}
          <View style={{ flex: 1 }}>
            <DockInsetContext.Provider value={semBarra || pathname === "/" ? 0 : dockHeight}>
            <Stack
              screenOptions={{
                headerShown: false,
                freezeOnBlur: true,
                animation: "ios_from_right",
                animationDuration: 180,
              }}
            >
              {/* ⚠️ TROCA DE ABA NÃO DESLIZA (11/08/2026 · "a navegação tá
                  travada"). `ios_from_right` significa "entrei um nível" — e
                  entre as 5 telas da barra ninguém entra em nada: elas são
                  IRMÃS. Deslizar 280 ms lateralmente a cada toque na barra é o
                  que dava peso; barra de abas em qualquer app troca na hora.
                  ⚠️ A Home entra na lista porque a seta VOLTA pra ela dessas
                  telas — se ela animasse, a ida seria instantânea e a volta não,
                  o que se lê como lentidão de novo.
                  ⚠️ As telas de PROFUNDIDADE (perfil, cartões, kids, evento…)
                  seguem com o `ios_from_right` do screenOptions: ali o
                  deslizamento é a informação de que se desceu um nível. */}
              <Stack.Screen name="index" options={{ animation: "none" }} />
              <Stack.Screen name="meu-grupo" options={{ animation: "none" }} />
              <Stack.Screen name="voluntariado" options={{ animation: "none" }} />
              <Stack.Screen name="cuidados" options={{ animation: "none" }} />
              <Stack.Screen name="devocional" options={{ animation: "none" }} />
              <Stack.Screen name="generosidade" options={{ animation: "none" }} />
              <Stack.Screen name="menu" options={{ animation: "none" }} />
            </Stack>
            </DockInsetContext.Provider>
          </View>

          {!semBarra && pathname !== "/" && <BottomBar onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)} />}
        </View>
      </CadastroGate>
      </MenuProvider>
    </MembroProvider>
  );
}
