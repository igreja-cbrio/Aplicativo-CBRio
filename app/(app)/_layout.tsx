import { useEffect, useRef } from "react";
import { Stack, router, usePathname } from "expo-router";
import { AppState, BackHandler, Platform, View } from "react-native";
import { MembroProvider } from "@/contexts/MembroContext";
import { CadastroGate } from "@/components/auth/CadastroGate";
import { TopBar } from "@/components/ui/TopBar";
import { BottomBar } from "@/components/ui/BottomBar";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { ehRaiz, registrarRotaAtual, subirUmNivel } from "@/lib/hierarquia";

/**
 * ============================================================================
 * CASCA DA NAVEGAÇÃO (Marcos · 04/08/2026) — desenho aprovado por ele:
 *
 *   faixa superior:  [ ← ]        Título/logo        [ 🔔 ] [ foto ]
 *   barra de baixo:  Grupos · Servir · Cuidados · Devocional · Menu
 *
 * A HOME fica FORA da barra e **não existe botão "Início" em lugar nenhum** —
 * chega-se nela pela SETA. Foi decisão dele, ciente do trade-off (eu havia
 * sugerido Início na barra; ele preferiu os 4 valores + Menu, "senão fica
 * bagunçado").
 *
 * ⚠️ POR QUE A TAB BAR NATIVA SAIU (era `(tabs)/_layout.tsx` ·
 * expo-router/unstable-native-tabs): no UITabBarController, tudo que aparece
 * TEM que ser uma aba — não existe "tela fora da barra com a barra visível", e
 * a Home precisa exatamente disso. Custo assumido: perdemos o Liquid Glass
 * nativo do iOS 26 e o encolher-ao-rolar. Ganho: sai por OTA (é JS) e é o
 * desenho que ele quer ver.
 * ⚠️ Isto NÃO é o "dock custom" aposentado em 12/06 — lá o problema eram
 * GESTOS próprios (pan/long-press/GlassView aninhada). Aqui são 5 Pressable.
 *
 * As telas de barra recebem a faixa AQUI (uma só, global). As telas de
 * profundidade (perfil, cartões, kids, next…) seguem com o cabeçalho próprio
 * até a limpeza — montar as duas coisas juntas daria dois cabeçalhos.
 * ============================================================================
 */

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

/** Rota → título do centro da faixa. Home (`/`) mostra o logo. */
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
  const t = useT();
  const pathname = usePathname();

  const telaDeBarra = Object.prototype.hasOwnProperty.call(TELAS_BARRA, pathname);
  // Onboarding é a única tela sem casca: quem está completando o cadastro não
  // deve ter atalho pra sair pelo rodapé.
  const semBarra = pathname.startsWith("/completar-cadastro");

  // Rota atual num ref: o listener de AppState é montado UMA vez e leria um
  // pathname congelado se dependesse do closure.
  const rotaRef = useRef(pathname);
  rotaRef.current = pathname;

  // A seta de voltar é `cd ..` (lib/hierarquia.ts). As ~29 telas com seta
  // própria chamam `subirUmNivel()` sem argumento, então quem sabe onde a
  // pessoa está é este layout — o único lugar que já observa o pathname.
  registrarRotaAtual(pathname);

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
      if (ehRaiz(rota) || rota.startsWith("/completar-cadastro")) return false;
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
      if (fora < MS_PARA_RECOMECAR) return;

      const rota = rotaRef.current;
      // Já está na Home, ou está no meio do cadastro (resetar apagaria o que a
      // pessoa digitou) → não mexe.
      if (rota === "/" || rota.startsWith("/completar-cadastro")) return;
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
      {/* Portão de cadastro: quem entrou sem cadastro de gente (nome real +
          telefone + nascimento) é levado a /completar-cadastro. Não bloqueia
          render — só navega quando o servidor confirma que falta algo. */}
      <CadastroGate>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {telaDeBarra && (
            <TopBar
              titulo={TELAS_BARRA[pathname] ? t(TELAS_BARRA[pathname]) : undefined}
              mostrarLogo={pathname === "/"}
              mostrarVoltar={pathname !== "/"}
            />
          )}

          {/* A barra é IRMÃ do Stack (não sobreposta): a tela nunca fica por
              baixo dela, então nenhum `paddingBottom` de tela precisa saber
              que a barra existe. */}
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "ios_from_right",
                animationDuration: 260,
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
              <Stack.Screen name="menu" options={{ animation: "none" }} />
            </Stack>
          </View>

          {!semBarra && <BottomBar />}
        </View>
      </CadastroGate>
    </MembroProvider>
  );
}
