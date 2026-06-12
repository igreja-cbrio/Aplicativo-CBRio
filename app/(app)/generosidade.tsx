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
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import QRCode from "react-native-qrcode-svg";
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
import { applePayDisponivel, abrirApplePay, confirmarApplePay } from "@/lib/applePay";
import { ApplePayButton, applePayButtonNativo } from "@/modules/apple-pay";
import { criarCheckoutSession } from "@/lib/stripeCheckout";
import { getMetodoPagamentoPadrao } from "@/lib/preferenciaPagamento";
import { CheckoutWebView } from "@/components/generosidade/CheckoutWebView";
import { SucessoDoacao } from "@/components/generosidade/SucessoDoacao";
import { GlassCard } from "@/components/ui/GlassCard";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";
import { useT } from "@/lib/i18n";

type Metodo = "pix" | "card" | "apple_pay";
type Categoria = "dizimo" | "oferta" | "campanha";

const PRESETS = [20, 50, 100, 200, 500];

const CATEGORIAS: { value: Categoria; label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; desc: string }[] = [
  { value: "dizimo", label: "Dízimo", icon: "ribbon-outline", desc: "" },
  { value: "oferta", label: "Oferta", icon: "gift-outline", desc: "Doação livre" },
  { value: "campanha", label: "Campanha", icon: "megaphone-outline", desc: "Causa específica" },
];

function formatBRL(centavos: number): string {
  const v = (centavos / 100).toFixed(2).replace(".", ",");
  return `R$ ${v}`;
}

export default function GenerosidadeScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [metodo, setMetodo] = useState<Metodo>("pix");

  // Abre no método preferido do usuário (Configurações → Forma de pagamento).
  useEffect(() => {
    getMetodoPagamentoPadrao().then((m) => {
      if (m === "apple_pay" && Platform.OS !== "ios") return;
      setMetodo(m);
    });
  }, []);
  const [categoria, setCategoria] = useState<Categoria>("dizimo");
  const [campanhaTxt, setCampanhaTxt] = useState("");
  const [valor, setValor] = useState<number>(50 * 100);
  const [customTxt, setCustomTxt] = useState("");

  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [sucessoValor, setSucessoValor] = useState<number | null>(null);

  function setCustom(t: string) {
    const limpo = t.replace(/[^\d,]/g, "").replace(",", ".");
    const num = parseFloat(limpo);
    setCustomTxt(t);
    if (!isNaN(num)) setValor(Math.round(num * 100));
  }

  function fecharCheckout(status: "success" | "cancel" | "interrupted" | "loading") {
    setCheckoutAberto(false);
    setCheckoutUrl(null);
    if (status === "success") {
      setSucessoValor(valor);
    } else if (status === "cancel") {
      Alert.alert(t("Pagamento cancelado"), t("Você pode tentar de novo quando quiser."));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {/* Aba raiz do dock: sem botão "voltar" (HIG — navegação por abas). */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("Generosidade")}</Text>
        </View>

        <Text style={styles.intro}>
          {t("Sua generosidade alimenta a missão. Toda contribuição vai pra sustentar a obra da CBRio.")}
        </Text>

        <GlassCard style={styles.tabs}>
          <MetodoTab atual={metodo} value="pix" label="PIX" icon="qr-code" onPress={setMetodo} colors={colors} styles={styles} />
          <MetodoTab atual={metodo} value="card" label={t("Cartão")} icon="card" onPress={setMetodo} colors={colors} styles={styles} />
          {Platform.OS === "ios" && (
            <MetodoTab atual={metodo} value="apple_pay" label="Apple Pay" icon="logo-apple" onPress={setMetodo} colors={colors} styles={styles} />
          )}
        </GlassCard>

        <View style={styles.box}>
          <Text style={styles.boxTitulo}>{t("Categoria")}</Text>
          <View style={styles.categoriasRow}>
            {CATEGORIAS.map((c) => {
              const sel = categoria === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCategoria(c.value);
                  }}
                  style={[styles.categoriaCard, sel && styles.categoriaCardSel]}
                >
                  <Ionicons
                    name={c.icon}
                    size={22}
                    color={sel ? "#fff" : colors.brandMid}
                  />
                  <Text style={[styles.categoriaLabel, sel && styles.categoriaLabelSel]}>{t(c.label)}</Text>
                  {!!c.desc && (
                    <Text style={[styles.categoriaDesc, sel && styles.categoriaDescSel]}>{t(c.desc)}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
          {categoria === "campanha" && (
            <TextInput
              value={campanhaTxt}
              onChangeText={setCampanhaTxt}
              placeholder={t("Nome da campanha")}
              placeholderTextColor={colors.textMuted}
              style={styles.customInput}
            />
          )}
        </View>

        {metodo !== "pix" && (
          <View style={styles.box}>
            <Text style={styles.boxTitulo}>{t("Valor")}</Text>
            <View style={styles.presets}>
              {PRESETS.map((v) => {
                const sel = valor === v * 100 && customTxt === "";
                return (
                  <Pressable
                    key={v}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setValor(v * 100);
                      setCustomTxt("");
                    }}
                    style={[styles.presetPill, sel && styles.presetPillSel]}
                  >
                    <Text style={[styles.presetTxt, sel && styles.presetTxtSel]}>R$ {v}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={customTxt}
              onChangeText={setCustom}
              placeholder={t("Outro valor")}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={styles.customInput}
            />
            <Text style={styles.valorFinal}>{formatBRL(valor)}</Text>
          </View>
        )}

        {metodo === "pix" && <ConteudoPix colors={colors} styles={styles} />}
        {metodo === "card" && (
          <ConteudoCartao
            valor={valor}
            categoria={categoria}
            campanha={categoria === "campanha" ? campanhaTxt.trim() || null : null}
            onAbrir={(url) => {
              setCheckoutUrl(url);
              setCheckoutAberto(true);
            }}
            colors={colors}
            styles={styles}
          />
        )}
        {metodo === "apple_pay" && (
          <ConteudoApplePay
            valor={valor}
            categoria={categoria}
            campanha={categoria === "campanha" ? campanhaTxt.trim() || null : null}
            onSucesso={() => setSucessoValor(valor)}
            colors={colors}
            styles={styles}
          />
        )}

        <Pressable
          onPress={() => router.push("/comprovante-doacoes")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 24,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Ionicons name="receipt-outline" size={20} color={colors.brandMid} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
              {t("Comprovante de doações")}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
              {t("Resumo anual pra declaração do IR")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </ScrollView>

      <CheckoutWebView url={checkoutUrl} visible={checkoutAberto} onResult={fecharCheckout} />
      <SucessoDoacao
        visible={sucessoValor != null}
        valorCentavos={sucessoValor}
        onClose={() => setSucessoValor(null)}
      />
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
      onPress={() => {
        Haptics.selectionAsync();
        onPress(value);
      }}
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
  const t = useT();
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
          <Text style={styles.boxTitulo}>{t("Aponte a câmera")}</Text>
          <View style={styles.qrBox}>
            <QRCode value={PIX_PAYLOAD} size={200} backgroundColor="#fff" color="#000" />
          </View>
          <Pressable onPress={() => copiar(PIX_PAYLOAD, "payload")} style={styles.btnGrande}>
            <Ionicons name={copiado === "payload" ? "checkmark" : "copy"} size={18} color="#fff" />
            <Text style={styles.btnGrandeTxt}>
              {copiado === "payload" ? t("Copiado!") : t("Copiar PIX (copia e cola)")}
            </Text>
          </Pressable>
        </View>
      )}
      <View style={styles.box}>
        <Text style={styles.boxTitulo}>{t("Chave PIX")}</Text>
        <View style={styles.chaveRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chaveTipo}>{PIX_KEY_TIPO}</Text>
            <Text style={styles.chaveValor} selectable>{PIX_KEY_FORMATADA}</Text>
          </View>
          <Pressable onPress={() => copiar(PIX_KEY, "chave")} style={styles.copiarBtn}>
            <Ionicons name={copiado === "chave" ? "checkmark" : "copy-outline"} size={20} color={colors.primary} />
            <Text style={styles.copiarTxt}>{copiado === "chave" ? t("Copiado") : t("Copiar")}</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <Linha colors={colors} icon="person-outline" styles={styles}>
          {t("Beneficiário:")} <Text style={{ fontWeight: "800" }}>{PIX_BENEFICIARIO}</Text>
        </Linha>
        <Linha colors={colors} icon="location-outline" styles={styles}>{PIX_CIDADE}</Linha>
      </View>
      <View style={styles.box}>
        <Text style={styles.boxTitulo}>{t("Como pagar")}</Text>
        <PassoNum num={1} colors={colors} styles={styles}>{t("Abra o app do seu banco e escolha pagar via PIX.")}</PassoNum>
        <PassoNum num={2} colors={colors} styles={styles}>
          {PIX_PAYLOAD ? t("Cole o código copia-e-cola (ou aponte a câmera pro QR Code).") : t("Use o CNPJ acima como chave PIX e informe o valor.")}
        </PassoNum>
        <PassoNum num={3} colors={colors} styles={styles}>{t("Confirme os dados e finalize. Te agradecemos!")} 💙</PassoNum>
      </View>
    </View>
  );
}

function ConteudoCartao({
  valor,
  categoria,
  campanha,
  onAbrir,
  colors,
  styles,
}: {
  valor: number;
  categoria: Categoria;
  campanha: string | null;
  onAbrir: (url: string) => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const [carregando, setCarregando] = useState(false);
  async function pagar() {
    setCarregando(true);
    try {
      const { url } = await criarCheckoutSession({ amountCents: valor, categoria, campanha });
      onAbrir(url);
    } catch (e) {
      Alert.alert(t("Não foi possível abrir o pagamento"), e instanceof Error ? e.message : t("Erro."));
    } finally {
      setCarregando(false);
    }
  }
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.box}>
        <Text style={styles.boxTitulo}>{t("Cartão de crédito")}</Text>
        <Text style={styles.cardHint}>
          {t("Você vai ser levado pra tela segura da Stripe pra informar os dados do cartão. O CBRio não guarda nada — toda a transação é processada direto na Stripe (PCI nível 1).")}
        </Text>
        <View style={styles.bandeiras}>
          <Ionicons name="card" size={28} color={colors.brandMid} />
          <Text style={styles.bandeirasTxt}>Visa · Mastercard · Elo · Amex</Text>
        </View>
      </View>
      <Button title={`${t("Pagar")} ${formatBRL(valor)}`} onPress={pagar} loading={carregando} />
    </View>
  );
}

function ConteudoApplePay({
  valor,
  categoria,
  campanha,
  onSucesso,
  colors,
  styles,
}: {
  valor: number;
  categoria: Categoria;
  campanha: string | null;
  onSucesso: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const [carregando, setCarregando] = useState(false);
  const [disponivel, setDisponivel] = useState<boolean | null>(null);

  useEffect(() => {
    applePayDisponivel().then(setDisponivel).catch(() => setDisponivel(false));
  }, []);

  async function pagar() {
    setCarregando(true);
    try {
      const label = categoria === "dizimo" ? `${t("Dízimo")} CBRio` : categoria === "campanha" ? `${campanha ?? t("Campanha")} CBRio` : `${t("Oferta")} CBRio`;
      const token = await abrirApplePay(valor, label);
      await confirmarApplePay(valor, token, { categoria, campanha });
      onSucesso();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("Erro desconhecido.");
      if (msg.toLowerCase().includes("cancel")) return;
      Alert.alert(t("Não foi possível processar"), msg);
    } finally {
      setCarregando(false);
    }
  }

  if (Platform.OS !== "ios") {
    return (
      <View style={styles.box}>
        <Text style={styles.cardHint}>{t("Apple Pay só está disponível em iOS.")}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.box}>
        <Text style={styles.boxTitulo}>Apple Pay</Text>
        <Text style={styles.cardHint}>
          {t("Pague com qualquer cartão que você já tem na Carteira do iPhone, com Face ID/Touch ID. Sem digitar nada.")}
        </Text>
        <Text style={styles.valorFinal}>{formatBRL(valor)}</Text>
      </View>
      {/* Botão OFICIAL do sistema (PKPaymentButton, tipo "donate") — exigido
          pelas HIG. Sempre visível: sem cartão, a sheet oferece adicionar um. */}
      {applePayButtonNativo ? (
        <ApplePayButton onPress={pagar} disabled={carregando} buttonType="donate" />
      ) : (
        <Pressable
          onPress={pagar}
          disabled={carregando}
          style={({ pressed }) => [
            styles.applePayBtn,
            pressed && { opacity: 0.85 },
            carregando && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="logo-apple" size={20} color="#fff" />
          <Text style={styles.applePayTxt}>
            {carregando ? t("Processando…") : `Pay ${formatBRL(valor)}`}
          </Text>
        </Pressable>
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
    header: { alignItems: "center", justifyContent: "center" },
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
      borderRadius: radius.md,
      padding: spacing.xs,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: spacing.sm,
      minHeight: 44, // alvo de toque mínimo (HIG)
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
    categoriasRow: { flexDirection: "row", gap: spacing.xs },
    categoriaCard: {
      flex: 1,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      gap: 4,
      minHeight: 92,
      justifyContent: "center",
    },
    categoriaCardSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoriaLabel: { color: colors.text, fontSize: font.size.sm, fontWeight: "800" },
    categoriaLabelSel: { color: "#fff" },
    categoriaDesc: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
    categoriaDescSel: { color: "rgba(255,255,255,0.85)" },
    presets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    presetPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44, // alvo de toque mínimo (HIG)
      justifyContent: "center",
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
      minHeight: 44, // alvo de toque mínimo (HIG)
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
    applePayBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "#000",
      paddingVertical: spacing.md,
      borderRadius: radius.full,
    },
    applePayTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
  });
