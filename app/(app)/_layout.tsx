import { Stack, usePathname } from "expo-router";
import { View } from "react-native";
import { MembroProvider } from "@/contexts/MembroContext";
import { CadastroGate } from "@/components/auth/CadastroGate";
import { TopBar } from "@/components/ui/TopBar";
import { BottomBar } from "@/components/ui/BottomBar";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";

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
                animationDuration: 280,
              }}
            />
          </View>

          {!semBarra && <BottomBar />}
        </View>
      </CadastroGate>
    </MembroProvider>
  );
}
