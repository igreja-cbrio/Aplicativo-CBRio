// ============================================================================
// FORMULÁRIO ROLÁVEL · a ScrollView que leva o campo focado pra vista
//
// Relato do Marcos (23/09/2026): *"no form de entrada, quando a pessoa está
// dizendo quem é, quando o teclado sobe fica difícil de ver"*.
//
// O que existia: `TecladoSeguro` (teclado não cobre) + `ScrollView` com
// `automaticallyAdjustKeyboardInsets` (iOS só). Nenhum dos dois ROLA até o
// campo: quem garante isso no iOS é o UIKit quando o campo está dentro de uma
// UIScrollView nativa — que o RN não usa pra `TextInput` — e no Android é o
// `requestChildRectangleOnScreen`, que só dispara quando o foco MUDA, não quando
// a janela encolhe com o campo já focado. Resultado: campo focado espremido
// entre o herói e o teclado, ou parcialmente coberto.
//
// Como funciona: o `Input` (e o `PhoneInput`) avisam por contexto quando ganham
// foco; este componente mede a posição do campo em relação ao CONTEÚDO da
// ScrollView (`measureLayout` contra um View próprio, sem depender da API
// interna da ScrollView) e rola pra deixá-lo no topo com o rótulo visível.
//
// ⚠️ Zero dependência nova (View + ScrollView do próprio RN) ⇒ sai por OTA.
// ⚠️ Qualquer falha de medição é silenciosa: o pior caso é o comportamento de
//   antes (não rolar), nunca um crash na porta obrigatória do app.
// ⚠️ `contentContainerStyle` vai pro View INTERNO (é ele que segura padding e
//   `gap`); a ScrollView só recebe `flexGrow: 1` pra layouts centralizados
//   (login/cadastro) continuarem centralizados.
// ============================================================================
import React, { createContext, useCallback, useContext, useRef } from "react";
import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { ATRASO_TECLADO_MS, alvoDaRolagem } from "@/lib/rolarAteCampo";

type RolarAte = (alvo: View | null) => void;

const RolagemContext = createContext<RolarAte | null>(null);

/**
 * Lido pelos campos: devolve a função que rola até o View passado, ou `null`
 * fora de um `FormularioRolavel` (aí o campo não faz nada — comportamento
 * antigo).
 */
export function useRolarAteCampo(): RolarAte | null {
  return useContext(RolagemContext);
}

export function FormularioRolavel({
  children,
  contentContainerStyle,
  ...rest
}: ScrollViewProps & { contentContainerStyle?: StyleProp<ViewStyle> }) {
  const rolagem = useRef<ScrollView>(null);
  const conteudo = useRef<View>(null);

  const rolarAte = useCallback<RolarAte>((alvo) => {
    const base = conteudo.current;
    if (!alvo || !base) return;
    // Espera o teclado começar a subir (ver ATRASO_TECLADO_MS).
    setTimeout(() => {
      try {
        alvo.measureLayout(
          base,
          (_x, y) => { rolagem.current?.scrollTo({ y: alvoDaRolagem(y), animated: true }); },
          () => { /* medição falhou: fica como estava */ },
        );
      } catch { /* idem */ }
    }, ATRASO_TECLADO_MS);
  }, []);

  return (
    <RolagemContext.Provider value={rolarAte}>
      <ScrollView ref={rolagem} {...rest} contentContainerStyle={{ flexGrow: 1 }}>
        {/* `collapsable={false}`: no Android um View "sem função" some da
            árvore nativa e o measureLayout perde a referência. */}
        <View ref={conteudo} collapsable={false} style={[{ flexGrow: 1 }, contentContainerStyle]}>
          {children}
        </View>
      </ScrollView>
    </RolagemContext.Provider>
  );
}

export default FormularioRolavel;
