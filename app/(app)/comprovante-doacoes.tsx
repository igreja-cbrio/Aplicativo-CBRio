import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { useMembro } from "@/lib/useMembro";
import { minhasContribuicoes, type Contribuicao } from "@/lib/contribuicoes";
import { PIX_KEY_FORMATADA } from "@/constants/pix";

const TIPO_LABEL: Record<string, string> = {
  dizimo: "Dízimo",
  oferta: "Oferta",
  campanha: "Campanha",
};

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function htmlComprovante(
  ano: number,
  nome: string,
  cpf: string,
  itens: Contribuicao[],
  total: number
): string {
  const linhas = itens
    .map(
      (c) => `<tr>
        <td>${dataBr(c.data)}</td>
        <td>${TIPO_LABEL[c.tipo] ?? c.tipo}${c.campanha ? ` — ${c.campanha}` : ""}</td>
        <td style="text-align:right">${brl(Number(c.valor))}</td>
      </tr>`
    )
    .join("");
  const hoje = new Date().toLocaleDateString("pt-BR");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #15333d; padding: 32px; }
    h1 { font-size: 20px; color: #408097; margin-bottom: 2px; }
    h2 { font-size: 14px; font-weight: 600; margin: 24px 0 8px; }
    .sub { color: #5a7a85; font-size: 12px; margin: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th { text-align: left; color: #5a7a85; font-weight: 600; border-bottom: 1.5px solid #408097; padding: 6px 4px; }
    th:last-child { text-align: right; }
    td { border-bottom: 1px solid #e3ecee; padding: 6px 4px; }
    .total td { font-weight: 700; border-bottom: none; padding-top: 10px; }
    .decl { font-size: 11.5px; color: #41606b; line-height: 1.5; margin-top: 24px; }
    .rodape { font-size: 10.5px; color: #8aa3ab; margin-top: 32px; }
  </style></head><body>
    <h1>Comunidade Batista do Rio de Janeiro — CBRio</h1>
    <p class="sub">CNPJ ${PIX_KEY_FORMATADA} · Av. das Américas, 7907 — Barra da Tijuca, Rio de Janeiro/RJ</p>
    <h2>Comprovante anual de doações — ${ano}</h2>
    <p class="sub">Doador(a): <b>${nome || "—"}</b>${cpf ? ` · CPF ${cpf}` : ""}</p>
    <table>
      <thead><tr><th>Data</th><th>Tipo</th><th>Valor</th></tr></thead>
      <tbody>
        ${linhas}
        <tr class="total"><td></td><td>Total em ${ano}</td><td style="text-align:right">${brl(total)}</td></tr>
      </tbody>
    </table>
    <p class="decl">Declaramos, para os devidos fins, que recebemos do(a) doador(a) acima identificado(a)
    as contribuições listadas neste documento, feitas de forma voluntária e sem qualquer contraprestação
    de bens ou serviços, destinadas à manutenção das atividades religiosas, sociais e missionárias desta
    organização religiosa sem fins lucrativos.</p>
    <p class="rodape">Documento gerado pelo app CBRio em ${hoje}. Inclui as contribuições registradas
    nos sistemas da igreja (app, importações bancárias e lançamentos do financeiro).</p>
  </body></html>`;
}

export default function ComprovanteDoacoes() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { membro } = useMembro();

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [itens, setItens] = useState<Contribuicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    minhasContribuicoes(ano)
      .then((r) => ativo && setItens(r))
      .catch(() => ativo && setItens([]))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [ano]);

  const total = itens.reduce((s, c) => s + Number(c.valor), 0);

  async function gerarPdf() {
    setGerando(true);
    try {
      const html = htmlComprovante(ano, membro?.nome ?? "", membro?.cpf ?? "", itens, total);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: t("Comprovante de doações"),
          UTI: "com.adobe.pdf",
        });
      }
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Falha ao gerar o comprovante."));
    }
    setGerando(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Comprovante de doações")}</Text>
        </View>

        <Text style={styles.intro}>
          {t(
            "Resumo das suas contribuições concluídas no ano, pra usar na declaração do Imposto de Renda (ficha Doações Efetuadas)."
          )}
        </Text>

        <View style={styles.anosRow}>
          {[anoAtual - 1, anoAtual].map((a) => {
            const sel = ano === a;
            return (
              <Pressable key={a} onPress={() => setAno(a)} style={[styles.anoChip, sel && styles.anoChipSel]}>
                <Text style={[styles.anoChipTxt, sel && styles.anoChipTxtSel]}>{a}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : itens.length === 0 ? (
          <View style={styles.vazio}>
            <Ionicons name="receipt-outline" size={28} color={colors.textMuted} />
            <Text style={styles.vazioTxt}>
              {t("Nenhuma contribuição registrada em")} {ano}.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.lista}>
              {itens.map((c) => (
                <View key={c.id} style={styles.linha}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linhaTipo}>
                      {t(TIPO_LABEL[c.tipo] ?? c.tipo)}
                      {c.campanha ? ` — ${c.campanha}` : ""}
                    </Text>
                    <Text style={styles.linhaData}>{dataBr(c.data)}</Text>
                  </View>
                  <Text style={styles.linhaValor}>{brl(Number(c.valor))}</Text>
                </View>
              ))}
              <View style={[styles.linha, styles.linhaTotal]}>
                <Text style={styles.totalLabel}>{t("Total no ano")}</Text>
                <Text style={styles.totalValor}>{brl(total)}</Text>
              </View>
            </View>

            <Pressable onPress={gerarPdf} disabled={gerando} style={[styles.botao, gerando && { opacity: 0.6 }]}>
              {gerando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <Text style={styles.botaoTxt}>{t("Gerar comprovante (PDF)")}</Text>
                </>
              )}
            </Pressable>
          </>
        )}

        <Text style={styles.nota}>
          {t(
            "Doações a igrejas não são dedutíveis do IR, mas devem ser declaradas na ficha “Doações Efetuadas” (código 99). PIX feito direto no app do banco entra aqui quando o financeiro concilia o extrato."
          )}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 120 },
    header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    back: { padding: 2 },
    title: { fontSize: 24, fontWeight: "800", color: colors.text },
    intro: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 16 },
    anosRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    anoChip: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    anoChipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    anoChipTxt: { color: colors.text, fontWeight: "600", fontSize: 14 },
    anoChipTxtSel: { color: "#fff" },
    vazio: { alignItems: "center", gap: 8, paddingVertical: 40 },
    vazioTxt: { color: colors.textMuted, fontSize: 14 },
    lista: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 12,
    },
    linhaTipo: { color: colors.text, fontSize: 14, fontWeight: "600" },
    linhaData: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
    linhaValor: { color: colors.text, fontSize: 14, fontWeight: "700" },
    linhaTotal: { borderBottomWidth: 0 },
    totalLabel: { flex: 1, color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    totalValor: { color: colors.primary, fontSize: 16, fontWeight: "800" },
    botao: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 14,
    },
    botaoTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
    nota: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 16 },
  });
}
