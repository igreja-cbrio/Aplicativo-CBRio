// Ícone de compartilhar de uma linha/cartão de inscrição.
//
// ⚠️ Alvo de toque PRÓPRIO dentro de um cartão que já é tocável: sem `hitSlop`
// um ícone de 18px vira toque errado, e o toque errado aqui abre a tela do
// evento em vez de compartilhar — a pessoa não entende o que aconteceu.
//
// ⚠️ NÃO renderiza nada quando não há mensagem (link ausente). Botão que abre a
// folha de compartilhar e manda texto sem endereço é pior que botão ausente,
// porque o estrago acontece no aparelho de quem RECEBEU.
import { Pressable, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { trackEvento } from "@/lib/telemetria";
import { radius } from "@/constants/theme";

type Props = {
  /** Mensagem pronta (régua `lib/compartilharInscricao`). `null` = não renderiza. */
  mensagem: string | null;
  /** Nome do que está sendo compartilhado — vai no rótulo de acessibilidade. */
  oQue: string;
  /** Some na telemetria pra medir adoção: 'evento' | 'porta'. */
  tipo: "evento" | "porta";
  /** Chave/slug do item, só pra telemetria (nunca dado de pessoa).
   *  ⚠️ NÃO chamar de `ref`: é prop reservada do React e o valor nem chega. */
  refId?: string | null;
};

export default function BotaoCompartilhar({ mensagem, oQue, tipo, refId }: Props) {
  const colors = useColors();
  const t = useT();
  if (!mensagem) return null;

  async function compartilhar() {
    try {
      trackEvento("inscricao_compartilhar", { label: tipo, entity_id: refId || undefined });
      await Share.share({ message: mensagem! });
    } catch {
      // a pessoa cancelou o compartilhamento
    }
  }

  return (
    <Pressable
      onPress={compartilhar}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`${t("Compartilhar")} ${oQue}`}
      style={({ pressed }) => [
        styles.alvo,
        { backgroundColor: colors.glass },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View>
        <Ionicons name="share-social-outline" size={17} color={colors.brandMid} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  alvo: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
