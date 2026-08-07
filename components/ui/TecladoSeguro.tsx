import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, View, type ViewStyle, type StyleProp } from "react-native";
import { folgaDoTeclado } from "@/lib/teclado";

/**
 * ⚠️⚠️ SUBSTITUI O `KeyboardAvoidingView` EM TODO O APP (07/08/2026).
 *
 * Pedido do Marcos, depois da varredura: *"faz de uma forma para ficar padrão"*
 * — em vez de um `keyboardVerticalOffset` calibrado por tela num aparelho.
 *
 * A diferença está em O QUE se mede. O `KeyboardAvoidingView` usa o `onLayout`,
 * que dá coordenadas **relativas ao pai**: em toda tela que não começa no topo
 * da janela (ou seja, todas as que ficam sob a faixa superior), ele
 * **sub-compensa** exatamente o deslocamento do topo — e é por isso que o campo
 * "quase" aparecia. O remendo oficial pra isso é justamente o offset por tela.
 *
 * Aqui a medida é ABSOLUTA (`measureInWindow`) e comparada com a posição real
 * do topo do teclado. Não existe constante de aparelho, de faixa nem de notch:
 * funciona igual em tela cheia, dentro de `<Modal>`, com fonte aumentada e em
 * aparelho que ninguém testou.
 *
 * ⚠️ NÃO oscila: o `paddingBottom` reduz a área INTERNA, não a altura do
 * container — então a borda de baixo medida continua a mesma e a conta
 * estabiliza na primeira passada.
 * ⚠️ Zero dependência nova (View + Keyboard do próprio RN) ⇒ sai por OTA.
 */
export function TecladoSeguro({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View>(null);
  const [folga, setFolga] = useState(0);
  // Guardados em ref porque são lidos dentro de callbacks assíncronos de medição
  // — em estado, causariam uma re-renderização por evento sem necessidade.
  const topoTeclado = useRef<number | null>(null);
  const alturaTeclado = useRef<number | undefined>(undefined);

  const recalcular = useCallback(() => {
    if (topoTeclado.current == null) {
      setFolga((f) => (f === 0 ? f : 0));
      return;
    }
    // `measureInWindow` pode devolver `undefined` se a view já saiu da árvore
    // (fechar o modal enquanto o teclado baixa) — daí os guards da régua pura.
    ref.current?.measureInWindow((_x, y, _w, h) => {
      const nova = folgaDoTeclado(y + h, topoTeclado.current, alturaTeclado.current);
      setFolga((f) => (Math.abs(f - nova) < 1 ? f : nova));
    });
  }, []);

  useEffect(() => {
    // ⚠️ iOS usa `Will` (acompanha a animação do teclado, sem solavanco);
    // Android só entrega `Did` de forma confiável.
    const abrir = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const fechar = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(abrir as "keyboardDidShow", (e) => {
      topoTeclado.current = e.endCoordinates.screenY;
      alturaTeclado.current = e.endCoordinates.height;
      recalcular();
    });
    const s2 = Keyboard.addListener(fechar as "keyboardDidHide", () => {
      topoTeclado.current = null;
      alturaTeclado.current = undefined;
      setFolga(0);
    });
    return () => { s1.remove(); s2.remove(); };
  }, [recalcular]);

  return (
    // `onLayout` cobre o caso do Android que AINDA redimensiona a janela: o
    // relayout dispara aqui e a conta refaz sozinha, dando 0.
    <View ref={ref} style={[style, { paddingBottom: folga }]} onLayout={recalcular}>
      {children}
    </View>
  );
}

export default TecladoSeguro;
