// KIDS › Certificados de Apresentação de Crianças (17/11/2026).
// A equipe do Kids libera no ERP; aqui o responsável autorizado vê, baixa e
// compartilha o PDF. O toque na notificação `kids_certificado_apresentacao`
// chega com `?id=` e o certificado aparece primeiro, em destaque.
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useKidsTheme } from "@/contexts/KidsThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { ErrorState } from "@/components/ui/ErrorState";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  carregarCertificadosKids, compartilharCertificado, dataPorExtenso, ordenarComDestaque,
  salvarCertificado, verCertificado, type CertificadoKids,
} from "@/lib/kidsCertificados";

type Acao = "ver" | "baixar" | "compartilhar";

export default function KidsCertificadosScreen() {
  const colors = useColors();
  const { tema } = useKidsTheme();
  const styles = useMemo(() => makeStyles(colors, tema.fundo), [colors, tema.fundo]);
  const t = useT();
  const { id: destaque } = useLocalSearchParams<{ id?: string }>();
  const [lista, setLista] = useState<CertificadoKids[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<{ id: string; acao: Acao } | null>(null);
  const [aviso, setAviso] = useState<{ id: string; texto: string; erro: boolean } | null>(null);
  const trava = useRef(false);
  const ativa = useRef(true);
  useEffect(() => () => { ativa.current = false; }, []);

  const carregar = useCallback(async (puxou = false) => {
    if (puxou) setRefreshing(true);
    try {
      const r = await carregarCertificadosKids();
      if (!ativa.current) return;
      setLista(r.certificados || []);
      setErro(null);
    } catch (e: any) {
      if (!ativa.current) return;
      // ⚠️ Erro nunca vira "nenhum certificado": a tela diz que não carregou.
      setErro(e?.status === 403 ? "sem_cadastro" : "falha");
    } finally {
      if (ativa.current) { setCarregando(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function agir(c: CertificadoKids, acao: Acao) {
    if (trava.current) return;
    trava.current = true;
    setOcupado({ id: c.id, acao });
    setAviso(null);
    try {
      if (acao === "ver") await verCertificado(c);
      else if (acao === "compartilhar") await compartilharCertificado(c);
      else {
        const r = await salvarCertificado(c);
        if (ativa.current && r === "salvo") setAviso({ id: c.id, texto: t("PDF salvo na pasta que você escolheu."), erro: false });
      }
    } catch (e) {
      if (ativa.current)
        setAviso({ id: c.id, texto: e instanceof Error ? e.message : t("Não foi possível abrir o certificado. Tente novamente."), erro: true });
    } finally {
      trava.current = false;
      if (ativa.current) setOcupado(null);
    }
  }

  const ordenada = useMemo(() => ordenarComDestaque(lista || [], destaque), [lista, destaque]);
  const destaqueSumiu = Boolean(destaque && lista && !lista.some((c) => c.id === destaque));

  const botao = (c: CertificadoKids, acao: Acao, icone: keyof typeof Ionicons.glyphMap, rotulo: string, primario = false) => {
    const rodando = ocupado?.id === c.id && ocupado.acao === acao;
    return (
      <Pressable
        key={acao}
        onPress={() => agir(c, acao)}
        disabled={Boolean(ocupado)}
        style={({ pressed }) => [styles.botao, primario && styles.botaoPrimario, (pressed || (ocupado && !rodando)) && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={`${rotulo} · ${c.crianca_nome}`}
        accessibilityState={{ busy: rodando, disabled: Boolean(ocupado) }}
      >
        {rodando ? <ActivityIndicator size="small" color={primario ? "#253D44" : colors.text} /> : <Ionicons name={icone} size={18} color={primario ? "#253D44" : colors.text} />}
        <Text numberOfLines={1} style={[styles.botaoTexto, primario && { color: "#253D44" }]}>{rotulo}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={colors.brandMid} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel("/kids-certificados")} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Certificados")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {carregando ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : erro === "sem_cadastro" ? (
          <Text style={styles.vazio}>{t("Confirme seu cadastro no app para ver os certificados das suas crianças.")}</Text>
        ) : erro && !lista ? (
          <ErrorState onRetry={() => { setCarregando(true); carregar(); }} />
        ) : (
          <>
            {destaqueSumiu && (
              <Text style={styles.avisoErro} accessibilityLiveRegion="polite">
                {t("Este certificado não está mais disponível no app. Fale com a equipe do Kids.")}
              </Text>
            )}
            {ordenada.length === 0 ? (
              <View style={styles.vazioBox}>
                <Ionicons name="ribbon-outline" size={36} color={colors.textMuted} />
                <Text style={styles.vazio}>{t("Quando a equipe do Kids liberar o certificado da apresentação da sua criança, ele aparece aqui.")}</Text>
                <Text style={styles.vazioSub}>{t("O certificado aparece para o responsável autorizado no Kids. Se a sua criança não está em Minhas crianças, peça o vínculo por lá.")}</Text>
                <Pressable onPress={() => router.navigate("/kids")} style={styles.link} accessibilityRole="button">
                  <Text style={styles.linkTexto}>{t("Minhas crianças")}</Text>
                </Pressable>
              </View>
            ) : (
              ordenada.map((c) => (
                <View key={c.id} style={[styles.card, c.id === destaque && styles.cardDestaque]}>
                  <View style={styles.cardTopo}>
                    <View style={styles.selo}><Ionicons name="ribbon" size={22} color="#253D44" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitulo}>{c.crianca_nome}</Text>
                      <Text style={styles.cardSub}>{t("Apresentação de Crianças")} · {dataPorExtenso(c.data_apresentacao)}</Text>
                    </View>
                  </View>
                  <View style={styles.acoes}>{botao(c, "ver", "eye-outline", t("Ver"), true)}</View>
                  <View style={styles.acoes}>
                    {botao(c, "baixar", "download-outline", t("Baixar"))}
                    {botao(c, "compartilhar", "share-social-outline", t("Compartilhar"))}
                  </View>
                  {aviso?.id === c.id && (
                    <Text style={aviso.erro ? styles.avisoErro : styles.avisoOk} accessibilityLiveRegion="polite">{aviso.texto}</Text>
                  )}
                </View>
              ))
            )}
            {erro === "falha" && lista && (
              <Text style={styles.avisoErro}>{t("Não foi possível atualizar agora. Puxe para tentar de novo.")}</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette, destaque: string) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.sm },
    back: { width: 24 },
    title: { flex: 1, textAlign: "center", color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: spacing.xl },
    vazioBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    vazioSub: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", lineHeight: 20 },
    link: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
    linkTexto: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "800" },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
    cardDestaque: { borderColor: destaque, borderWidth: 2 },
    cardTopo: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    selo: { width: 44, height: 44, borderRadius: 22, backgroundColor: destaque, alignItems: "center", justifyContent: "center" },
    cardTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    cardSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
    acoes: { flexDirection: "row", gap: spacing.sm },
    botao: { flexGrow: 1, flexBasis: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: spacing.sm },
    botaoPrimario: { backgroundColor: destaque, borderColor: destaque },
    botaoTexto: { color: colors.text, fontSize: font.size.sm, fontWeight: "800" },
    avisoOk: { color: colors.textMuted, fontSize: font.size.sm },
    avisoErro: { color: colors.danger, fontSize: font.size.sm },
  });
