import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import {
  StripeProvider,
  usePaymentSheet,
  PlatformPay,
  PlatformPayButton,
  isPlatformPaySupported,
  confirmPlatformPayPayment,
} from "@stripe/stripe-react-native";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import {
  PIX_KEY,
  PIX_KEY_FORMATADA,
  PIX_KEY_TIPO,
  PIX_PAYLOAD,
  PIX_BENEFICIARIO,
  PIX_CIDADE,
} from "@/constants/pix";
import {
  criarPaymentIntent,
  stripeConfigurado,
  STRIPE_PUBLISHABLE_KEY,
  APPLE_PAY_MERCHANT_ID,
} from "@/lib/stripe";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

type Metodo = "pix" | "card" | "apple_pay";

const PRESETS = [20, 50, 100, 200, 500];

function formatBRL(centavos: number): string {
  const v = (centavos / 100).toFixed(2).replace(".", ",");
  return `R$ ${v}`;
}

export default function GenerosidadeScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [valor, setValor] = useState<number>(50 * 100);
  const [customTxt, setCustomTxt] = useState("");

  function setCustom(t: string) {
    const limpo = t.replace(/[^\d,]/g, "").replace(",", ".");
    const num = parseFloat(limpo);
    setCustomTxt(t);
    if (!isNaN(num)) setValor(Math.round(num * 100));
  }

  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY ?? "pk_test_dummy"}
      merchantIdentifier={APPLE_PAY_MERCHANT_ID}
    >
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
            {Platform.OS === "ios" && (
              <MetodoTab atual={metodo} value="apple_pay" label="Apple Pay" icon="logo-apple" onPress={setMetodo} colors={colors} styles={styles} />
            )}
          </View>

          {(metodo !== "pix" || !PIX_PAYLOAD) && (
            <View style={styles.box}>
              <Text style={styles.boxTitulo}>Valor</Text>
              <View style={styles.presets}>
                {PRESETS.map((v) => {
                  const sel = valor === v * 100 && customTxt === "";
                  return (
                    <Pressable
                      key={v}
                      onPress={() => {
                        setValor(v * 100);
                        setCustomTxt("");
                      }}
                      style={[styles.presetPill, sel && styles.presetPillSel]}
                    >
                      <Text style={[styles.presetTxt, sel && styles.presetTxtSel]}>
                        R$ {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={customTxt}
                onChangeText={setCustom}
                placeholder="Outro valor"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={styles.customInput}
              />
              <Text style={styles.valorFinal}>{formatBRL(valor)}</Text>
            </View>
          )}

          {metodo === "pix" && <ConteudoPix colors={colors} styles={styles} />}
          {metodo === "card" && <ConteudoCartao valor={valor} colors={colors} styles={styles} />}
          {metodo === "apple_pay" && <ConteudoApplePay valor={valor} colors={colors} styles={styles} />}
        </ScrollView>
      </SafeAreaView>
    </StripeProvider>
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

function ConteudoCartao({
  valor,
  colors,
  styles,
}: {
  valor: number;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [carregando, setCarregando] = useState(false);

  async function pagar() {
    if (!stripeConfigurado()) {
      Alert.alert(
        "Configuração pendente",
        "Configure EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY no .env e implemente o endpoint /api/app/generosidade/payment-intent no backend."
      );
      return;
    }
    setCarregando(true);
    try {
      const intent = await criarPaymentIntent({ amountCents: valor, metodo: "card" });
      const { error: initErr } = await initPaymentSheet({
        merchantDisplayName: "CBRio",
        paymentIntentClientSecret: intent.client_secret,
        customerId: intent.customer,
        customerEphemeralKeySecret: intent.ephemeral_key,
        allowsDelayedPaymentMethods: false,
        applePay: { merchantCountryCode: "BR" },
      });
      if (initErr) throw new Error(initErr.message);
      const { error: payErr } = await presentPaymentSheet();
      if (payErr) {
        if (payErr.code !== "Canceled") {
          Alert.alert("Pagamento não concluído", payErr.message);
        }
        return;
      }
      Alert.alert("Pagamento confirmado 💙", "Obrigado pela sua generosidade!");
    } catch (e) {
      Alert.alert("Não foi possível processar", e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.box}>
        <Text style={styles.boxTitulo}>Cartão de crédito</Text>
        <Text style={styles.cardHint}>
          Você vai informar os dados do seu cartão na próxima tela. O
          processamento é via Stripe — nada fica salvo no app.
        </Text>
        <View style={styles.bandeiras}>
          <Ionicons name="card" size={28} color={colors.brandMid} />
          <Text style={styles.bandeirasTxt}>Visa · Mastercard · Elo · Amex</Text>
        </View>
      </View>

      <Button title={`Pagar ${formatBRL(valor)}`} onPress={pagar} loading={carregando} />
    </View>
  );
}

function ConteudoApplePay({
  valor,
  colors,
  styles,
}: {
  valor: number;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [carregando, setCarregando] = useState(false);
  const [suportado, setSuportado] = useState<boolean | null>(null);

  useEffect(() => {
    isPlatformPaySupported()
      .then(setSuportado)
      .catch(() => setSuportado(false));
  }, []);

  async function pagar() {
    if (!stripeConfigurado()) {
      Alert.alert(
        "Configuração pendente",
        "Configure EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY + Merchant ID no Apple Developer + endpoint /api/app/generosidade/payment-intent no backend."
      );
      return;
    }
    setCarregando(true);
    try {
      const intent = await criarPaymentIntent({ amountCents: valor, metodo: "apple_pay" });
      const { error } = await confirmPlatformPayPayment(intent.client_secret, {
        applePay: {
          cartItems: [
            {
              label: "Generosidade CBRio",
              amount: (valor / 100).toFixed(2),
              paymentType: PlatformPay.PaymentType.Immediate,
            },
          ],
          merchantCountryCode: "BR",
          currencyCode: "BRL",
        },
      });
      if (error) {
        if (error.code !== "Canceled") {
          Alert.alert("Pagamento não concluído", error.message);
        }
        return;
      }
      Alert.alert("Pagamento confirmado 💙", "Obrigado pela sua generosidade!");
    } catch (e) {
      Alert.alert("Não foi possível processar", e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setCarregando(false);
    }
  }

  if (Platform.OS !== "ios") {
    return (
      <View style={styles.box}>
        <Text style={styles.cardHint}>
          Apple Pay só está disponível em iOS.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.box}>
        <Text style={styles.boxTitulo}>Apple Pay</Text>
        <Text style={styles.cardHint}>
          Pague com qualquer cartão que você já tem na Carteira do iPhone, com
          Face ID/Touch ID. Sem digitar nada.
        </Text>
      </View>

      {suportado === false ? (
        <View style={styles.aviso}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.brandMid} />
          <Text style={styles.avisoTxt}>
            Você ainda não tem um cartão configurado. Adicione um no app
            Carteira pra liberar o Apple Pay.
          </Text>
        </View>
      ) : (
        <PlatformPayButton
          onPress={pagar}
          type={PlatformPay.ButtonType.Donate}
          appearance={PlatformPay.ButtonStyle.Automatic}
          style={styles.applePayBtn}
          disabled={carregando}
        />
      )}
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
    boxTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    presets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    presetPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surfaceAlt,
    },
    presetPillSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    presetTxt: { color: colors.textMuted, fontWeight: "700", fontSize: font.size.sm },
    presetTxtSel: { color: "#fff" },
    customInput: {
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: font.size.md,
      backgroundColor: colors.surfaceAlt,
    },
    valorFinal: {
      color: colors.text,
      fontSize: font.size.xl,
      fontFamily: BRAND_FONT,
      textAlign: "center",
      marginTop: spacing.xs,
    },
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
    cardHint: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    bandeiras: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    bandeirasTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    aviso: {
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      alignItems: "flex-start",
    },
    avisoTxt: { flex: 1, color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    applePayBtn: { height: 52, borderRadius: radius.full },
  });
