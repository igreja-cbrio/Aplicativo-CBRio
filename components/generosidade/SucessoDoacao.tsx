import { useEffect, useMemo } from "react";
import { Modal, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { brand, font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

/**
 * Confirmação de doação — substitui o Alert de sistema (HIG reserva
 * alerts pra erros e decisões). Confete + checkmark + valor doado.
 */
export function SucessoDoacao({
  valorCentavos,
  visible,
  onClose,
}: {
  valorCentavos: number | null;
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (visible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [visible]);

  const valor =
    valorCentavos != null
      ? `R$ ${(valorCentavos / 100).toFixed(2).replace(".", ",")}`
      : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={styles.titulo}>Doação confirmada</Text>
          {!!valor && <Text style={styles.valor}>{valor}</Text>}
          <Text style={styles.msg}>
            Obrigado pela sua generosidade! Toda contribuição sustenta a obra da
            CBRio. 💙
          </Text>
          <Button title="Amém" onPress={onClose} />
        </View>
        <ConfettiCannon
          count={90}
          origin={{ x: width / 2, y: -10 }}
          fadeOut
          autoStart
          fallSpeed={2600}
          explosionSpeed={420}
          colors={[brand.primary, brand.primaryMid, brand.pale, brand.sand, "#FFFFFF"]}
        />
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      alignSelf: "stretch",
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.md,
    },
    checkCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    titulo: { color: colors.text, fontSize: font.size.xl, fontFamily: BRAND_FONT },
    valor: { color: colors.primary, fontSize: font.size.xxl, fontFamily: BRAND_FONT },
    msg: {
      color: colors.textMuted,
      fontSize: font.size.sm,
      lineHeight: 20,
      textAlign: "center",
    },
  });
