import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import {
  getMinhaFamilia,
  criarConviteFamilia,
  aceitarConviteFamilia,
  removerDaFamilia,
  type MinhaFamilia,
  type FamiliarMembro,
  type ParentescoConvite,
} from "@/lib/api";
import { trackEvento } from "@/lib/telemetria";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const PARENTESCO_LABEL: Record<string, string> = {
  filho: "Filho(a)", pai_mae: "Pai/Mãe", conjuge: "Cônjuge", irmao: "Irmão(ã)",
  avo: "Avô/Avó", neto: "Neto(a)", tio: "Tio(a)", sobrinho: "Sobrinho(a)",
  primo: "Primo(a)", responsavel: "Responsável", dependente: "Dependente", outro: "Familiar",
};

const OPCOES_CONVITE: { key: ParentescoConvite; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "filho", label: "Meu filho(a)", icon: "happy-outline" },
  { key: "conjuge", label: "Meu cônjuge", icon: "heart-outline" },
  { key: "pai_mae", label: "Meu pai / mãe", icon: "person-outline" },
  { key: "irmao", label: "Meu irmão(ã)", icon: "people-outline" },
  { key: "outro", label: "Outro familiar", icon: "add-circle-outline" },
];

function iniciais(nome: string): string {
  return nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function FamiliaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const params = useLocalSearchParams<{ codigo?: string }>();

  const [familia, setFamilia] = useState<MinhaFamilia | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [gerando, setGerando] = useState<ParentescoConvite | null>(null);
  const [codigo, setCodigo] = useState((params.codigo || "").toUpperCase());
  const [aceitando, setAceitando] = useState(false);
  const [aceite, setAceite] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await getMinhaFamilia();
      setFamilia(r);
    } catch {
      setFamilia({ familia: null, familiares: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function convidar(parentesco: ParentescoConvite) {
    setGerando(parentesco);
    try {
      const conv = await criarConviteFamilia(parentesco);
      trackEvento("familia_convite_gerado", { label: parentesco });
      setEscolhendo(false);
      await Share.share({ message: conv.mensagem });
    } catch (e: any) {
      setAceite(e?.message || t("Não foi possível gerar o convite."));
    } finally {
      setGerando(null);
    }
  }

  async function aceitar() {
    const cod = codigo.trim().toUpperCase();
    if (cod.length < 4) { setAceite(t("Digite o código do convite.")); return; }
    setAceitando(true);
    setAceite(null);
    try {
      const r = await aceitarConviteFamilia(cod);
      trackEvento("familia_convite_aceito", {});
      setFamilia({ familia: r.familia, familiares: r.familiares });
      setCodigo("");
      setAceite(t("Pronto! Você agora faz parte da família."));
    } catch (e: any) {
      setAceite(e?.message || t("Não foi possível aceitar o convite."));
    } finally {
      setAceitando(false);
    }
  }

  async function remover(f: FamiliarMembro) {
    try {
      const r = await removerDaFamilia(f.id);
      setFamilia({ familia: r.familia, familiares: r.familiares });
    } catch {
      /* silencioso — recarrega ao focar */
    }
  }

  const familiares = familia?.familiares || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Minha família")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {familia === null ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : (
          <>
            {/* Lista de familiares */}
            {familiares.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitulo}>
                  {familia.familia?.nome || t("Família")}
                </Text>
                {familiares.map((f) => (
                  <View key={f.id} style={styles.familiar}>
                    <View style={styles.avatar}>
                      {f.foto_url ? (
                        <Image source={{ uri: f.foto_url }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarTxt}>{iniciais(f.nome)}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.familiarNome} numberOfLines={1}>{f.nome}</Text>
                      {f.parentesco ? (
                        <Text style={styles.familiarParentesco}>{t(PARENTESCO_LABEL[f.parentesco] || "Familiar")}</Text>
                      ) : null}
                    </View>
                    <Pressable onPress={() => remover(f)} hitSlop={8} style={styles.removerBtn} accessibilityRole="button" accessibilityLabel={t("Remover da família")}>
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.vazioBox}>
                <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                <Text style={styles.vazio}>{t("Você ainda não adicionou ninguém à sua família.")}</Text>
              </View>
            )}

            {/* Check-in das crianças — mora AQUI (pedido do Marcos, 05/08/2026:
                "em minha família você pode adicionar membros e fazer o check-in
                das crianças"). Saiu do menu como item solto: quem faz check-in
                de criança é o responsável, e é nesta tela que ele cuida da
                própria família. */}
            <Pressable
              onPress={() => router.navigate("/kids")}
              style={({ pressed }) => [styles.kidsCard, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={t("Check-in das crianças")}
            >
              <View style={styles.kidsIcone}>
                <Ionicons name="happy-outline" size={22} color={colors.brandMid} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitulo}>{t("Check-in das crianças")}</Text>
                <Text style={styles.cardSub}>
                  {t("Prepare a entrada dos seus filhos no Kids e mostre o código na recepção.")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            {/* Convidar */}
            <View style={styles.card}>
              <Text style={styles.cardTitulo}>{t("Convidar um familiar")}</Text>
              <Text style={styles.cardSub}>{t("Envie um convite e, ao aceitar, a pessoa entra na sua família.")}</Text>
              {!escolhendo ? (
                <Button title={t("Convidar familiar")} onPress={() => setEscolhendo(true)} />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {OPCOES_CONVITE.map((o) => (
                    <Pressable key={o.key} style={styles.opcao} onPress={() => convidar(o.key)} disabled={gerando != null} accessibilityRole="button">
                      <Ionicons name={o.icon} size={20} color={colors.brandMid} />
                      <Text style={styles.opcaoTxt}>{t(o.label)}</Text>
                      {gerando === o.key ? (
                        <ActivityIndicator color={colors.brandMid} />
                      ) : (
                        <Ionicons name="share-outline" size={18} color={colors.textMuted} />
                      )}
                    </Pressable>
                  ))}
                  <Button title={t("Cancelar")} variant="ghost" onPress={() => setEscolhendo(false)} />
                </View>
              )}
            </View>

            {/* Aceitar convite por código */}
            <View style={styles.card}>
              <Text style={styles.cardTitulo}>{t("Recebeu um convite?")}</Text>
              <Text style={styles.cardSub}>{t("Digite o código que você recebeu para entrar na família.")}</Text>
              <TextInput
                value={codigo}
                onChangeText={(v) => setCodigo(v.toUpperCase())}
                placeholder={t("Código do convite")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                style={styles.input}
              />
              <Button title={t("Entrar na família")} onPress={aceitar} loading={aceitando} />
              {aceite ? <Text style={styles.aviso}>{aceite}</Text> : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    back: { width: 24 },
    title: { fontSize: font.size.xl, fontWeight: "700", color: colors.text },
    center: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: spacing.md },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
    cardTitulo: { fontSize: font.size.md, fontWeight: "700", color: colors.text },
    kidsCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
    kidsIcone: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center" },
    cardSub: { fontSize: font.size.sm, color: colors.textMuted, marginBottom: 4 },
    familiar: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 6 },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarImg: { width: "100%", height: "100%" },
    avatarTxt: { color: colors.brandMid, fontWeight: "700", fontSize: font.size.sm },
    familiarNome: { fontSize: font.size.md, fontWeight: "600", color: colors.text },
    familiarParentesco: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
    removerBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    vazioBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
    vazio: { fontSize: font.size.sm, color: colors.textMuted, textAlign: "center" },
    opcao: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.md },
    opcaoTxt: { flex: 1, fontSize: font.size.md, color: colors.text, fontWeight: "500" },
    input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.text, fontSize: font.size.lg, letterSpacing: 2, textAlign: "center", fontWeight: "700" },
    aviso: { fontSize: font.size.sm, color: colors.textMuted, textAlign: "center", marginTop: 4 },
  });
}
