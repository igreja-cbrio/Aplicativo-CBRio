import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useColors } from "@/contexts/ThemeContext";
import {
  PIX_KEY,
  PIX_KEY_FORMATADA,
  PIX_KEY_TIPO,
  PIX_PAYLOAD,
  PIX_BENEFICIARIO,
  PIX_CIDADE,
} from "@/constants/pix";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

type Metodo = "pix" | "card" | "apple_pay";

export default function GenerosidadeScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [metodo, setMetodo] = useState<Metodo>("pix");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Generosidade</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.intro}>
          Sua generosidade alimenta a missão. Toda contribuição vai pra
          sustentar a obra da CBRio.
        </Text>

        <View style={styles.tabs}>
          <MetodoTab atual={metodo} value="pix" label="PIX" icon="qr-code" onPress={setMetodo} colors={colors} styles={styles} />
          <MetodoTab atual={metodo} value="card" label="Cartão" icon="card" onPress={setMetodo} colors={colors} styles={styles} />
          <MetodoTab atual={metodo} value="apple_pay" label="Apple Pay" icon="logo-apple" onPress={setMetodo} colors={colors} styles={styles} />
        </View>

        {metodo === "pix" && <ConteudoPix colors={colors} styles={styles} />}
        {metodo === "card" && <EmBreve titulo="Cartão de crédito em breve" txt="Estamos finalizando a integração com a Stripe. Por enquanto, contribua via PIX." colors={colors} styles={styles} />}
        {metodo === "apple_pay" && <EmBreve titulo="Apple Pay em breve" txt="Logo você poderá doar usando qualquer cartão do seu Apple Wallet com Face ID." colors={colors} styles={styles} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetodoTab({
  atual,
  value,
  label,
  icon,
  onPress,
  styles,
}: {
  atual: Metodo;
  value: Metodo;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: (m: Metodo) => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const sel = atual === value;
  return (
    <Pressable
      onPress={() => onPress(value)}
      style={[styles.tab, sel && styles.tabSel]}
    >
      <Ionicons name={icon} size={16} color={sel ? "#fff" : "#888"} />
      <Text style={[styles.tabTxt, sel && styles.tabTxtSel]}>{label}</Text>
    </Pressable>
  );
}

function ConteudoPix({
  colors,
  styles,
}: {
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [copiado, setCopiado] = useState<"chave" | "payload" | null>(null);

  async function copiar(texto: string, tipo: "chave" | "payload") {
    await Clipboard.setStringAsync(texto);
    setCopiado(tipo);
    setTimeout(() => setCopiado(null), 2000);
  }

  return (
    <View style={{ gap: spacing.md }}>
      {!!PIX_PAYLOAD && (
        <View style={[styles.box, { alignItems: "center" }]}>
          <Text style={styles.boxTitulo}>Aponte a câmera</Text>
          <View style={styles.qrBox}>
            <QRCode value={PIX_PAYLOAD} size={200} backgroundColor="#fff" color="#000" />
          </View>
          <Pressable onPress={() => copiar(PIX_PAYLOAD, "payload")} style={styles.btnGrande}>
            <Ionicons name={copiado === "payload" ? "checkmark" : "copy"} size={18} color="#fff" />
            <Text style={styles.btnGrandeTxt}>
              {copiado === "payload" ? "Copiado!" : "Copiar PIX (copia e cola)"}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.box}>
        <Text style={styles.boxTitulo}>Chave PIX</Text>
        <View style={styles.chaveRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chaveTipo}>{PIX_KEY_TIPO}</Text>
            <Text style={styles.chaveValor} selectable>{PIX_KEY_FORMATADA}</Text>
          </View>
          <Pressable onPress={() => copiar(PIX_KEY, "chave")} style={styles.copiarBtn}>
            <Ionicons name={copiado === "chave" ? "checkmark" : "copy-outline"} size={20} color={colors.primary} />
            <Text style={styles.copiarTxt}>{copiado === "chave" ? "Copiado" : "Copiar"}</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <Linha colors={colors} icon="person-outline" styles={styles}>
          Beneficiário: <Text style={{ fontWeight: "800" }}>{PIX_BENEFICIARIO}</Text>
        </Linha>
        <Linha colors={colors} icon="location-outline" styles={styles}>
          {PIX_CIDADE}
        </Linha>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitulo}>Como pagar</Text>
        <PassoNum num={1} colors={colors} styles={styles}>
          Abra o app do seu banco e escolha pagar via PIX.
        </PassoNum>
        <PassoNum num={2} colors={colors} styles={styles}>
          {PIX_PAYLOAD
            ? "Cole o código copia-e-cola (ou aponte a câmera pro QR Code)."
            : "Use o CNPJ acima como chave PIX e informe o valor."}
        </PassoNum>
        <PassoNum num={3} colors={colors} styles={styles}>
          Confirme os dados e finalize. Te agradecemos! 💙
        </PassoNum>
      </View>
    </View>
  );
}

function EmBreve({
  titulo,
  txt,
  colors,
  styles,
}: {
  titulo: string;
  txt: string;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.box}>
      <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md }}>
        <Ionicons name="time-outline" size={40} color={colors.brandMid} />
        <Text style={styles.boxTitulo}>{titulo}</Text>
        <Text style={styles.cardHint}>{txt}</Text>
      </View>
    </View>
  );
}

function Linha({
  icon,
  children,
  colors,
  styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  children: React.ReactNode;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.linhaRow}>
      <Ionicons name={icon} size={16} color={colors.brandMid} />
      <Text style={styles.linhaTxt}>{children}</Text>
    </View>
  );
}

function PassoNum({
  num,
  children,
  colors,
  styles,
}: {
  num: number;
  children: React.ReactNode;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.passoRow}>
      <View style={[styles.passoNum, { backgroundColor: colors.primary }]}>
        <Text style={styles.passoNumTxt}>{num}</Text>
      </View>
      <Text style={styles.linhaTxt}>{children}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontFamily: BRAND_FONT },
    intro: {
      color: colors.textMuted,
      fontSize: font.size.sm,
      lineHeight: 20,
      textAlign: "center",
      paddingHorizontal: spacing.sm,
    },
    tabs: {
      flexDirection: "row",
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.xs,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    tabSel: { backgroundColor: colors.primary },
    tabTxt: { color: colors.textMuted, fontWeight: "700", fontSize: font.size.sm },
    tabTxtSel: { color: "#fff" },
    box: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    boxTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800", textAlign: "center" },
    qrBox: {
      padding: spacing.md,
      backgroundColor: "#fff",
      borderRadius: radius.md,
      marginVertical: spacing.sm,
    },
    btnGrande: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.full,
      alignSelf: "stretch",
    },
    btnGrandeTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
    chaveRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    chaveTipo: { color: colors.textMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    chaveValor: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", marginTop: 2 },
    copiarBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
    },
    copiarTxt: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
    linhaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    linhaTxt: { flex: 1, color: colors.text, fontSize: font.size.sm, lineHeight: 20 },
    passoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
    passoNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    passoNumTxt: { color: "#fff", fontSize: 11, fontWeight: "900" },
    cardHint: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20, textAlign: "center" },
  });
