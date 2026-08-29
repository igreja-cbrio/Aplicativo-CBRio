import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import Constants from "expo-constants";
import { useAuth } from "@/contexts/AuthContext";
import { useMembro } from "@/lib/useMembro";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Option = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
};

export default function MenuScreen() {
  const { user, signOut } = useAuth();
  const { membro } = useMembro();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const nome =
    membro?.nome || (user?.user_metadata?.nome as string) || t("Membro CBRio");

  // ⚠️ Não há mais consulta de papel de grupo aqui: "Meu grupo" vale pra todo
  // mundo e a fila de quem lidera é um cartão dentro de /meu-grupo. Antes o
  // menu chamava getGrupoPapel() só pra decidir se mostrava um item.

  /**
   * ⚠️ O menu é o que NÃO está na barra de baixo (Grupos · Servir · Cuidados ·
   * Devocional) nem na faixa de cima (sino → Notificações/Avisos · foto →
   * Perfil). Repetir aqui o que está sempre a um toque só faz a lista crescer
   * — foi o pedido do Marcos ("o app precisa ser sempre simples", 04/08/2026).
   *
   * Saíram nesta limpeza, cada um por um motivo dele:
   *  · "Início"        → não existe botão de início em lugar nenhum; a Home é
   *                      a seta da faixa.
   *  · "No culto"      → só aparece na HOME enquanto o culto está ao vivo
   *                      (fora disso a tela não tem propósito).
   *  · "Avisos"        → o mural virou porta dentro do sino (Notificações).
   *  · "Notificações"  → o sino está em toda tela.
   *  · "Cartões"       → virou "Cartão de Membro", dentro do Perfil.
   *  · "Grupos"/"Meu grupo"/"Meus grupos" → 3 entradas viraram 1 tela (a de
   *                      Grupos na barra, que lista os meus e oferece entrar
   *                      em outro).
   *  · "Fale conosco"/"Sobre a CBRio" → dentro de Configurações.
   */
  /**
   * ⚠️ O menu é o que NÃO está na barra de baixo (Grupos · Servir · Cuidados ·
   * Devocional) nem na faixa de cima (sino → Notificações/Avisos · foto →
   * Perfil). Repetir aqui o que está sempre a um toque só faz a lista crescer
   * — pedido do Marcos ("o app precisa ser sempre simples", 04/08/2026).
   *
   * Arrumação de 05/08/2026, também dele:
   *  · **Batismo** desceu de "Você" pra "Participar" (é uma inscrição, não um
   *    dado seu).
   *  · **Check-in Kids** saiu daqui e virou um cartão DENTRO de "Minha família"
   *    — quem faz check-in de criança é o responsável, na tela onde ele cuida
   *    da própria família.
   *  · **Generosidade** entrou e SAIU no mesmo dia: a tela mostrava a chave
   *    PIX, e exibir chave de doação é o que a App Store proíbe (3.2.2(iv)).
   *    "Você" fica com 3 itens até termos uma forma aprovada.
   *  · **"Inscrições do meu grupo"** virou **"Meu grupo"** e aponta pra MESMA
   *    tela da barra (`/meu-grupo`) — era isso que fazia "grupos" no menu e
   *    "Grupos" na barra abrirem coisas diferentes. A fila de quem lidera já é
   *    um cartão lá dentro, então não precisa de item próprio.
   *
   * Saíram antes (04/08): Início (a Home é a seta), No culto (card de ao vivo
   * na Home), Avisos e Notificações (o sino), Cartões (virou "Cartão de Membro"
   * no Perfil), Fale conosco e Sobre (dentro de Configurações).
   */
  const secoes: { titulo: string; itens: Option[] }[] = [
    {
      titulo: "Você",
      itens: [
        { label: "Meu perfil", icon: "person-outline", onPress: () => router.navigate("/perfil") },
        { label: "Minha família", icon: "people-outline", onPress: () => router.navigate("/familia") },
        { label: "Sua jornada", icon: "trail-sign-outline", onPress: () => router.navigate("/jornada") },
        { label: "Censo", icon: "clipboard-outline", onPress: () => router.navigate("/censo") },
        // ⚠️ "Generosidade" abre a tela do VALOR (texto), NUNCA chave PIX/QR/
        // link de pagamento — guideline 3.2.2(iv) da App Store. Ver o cabeçalho
        // de components/generosidade/GenerosidadeTexto.tsx antes de mexer.
        { label: "Generosidade", icon: "gift-outline", onPress: () => router.navigate("/generosidade") },
      ],
    },
    {
      titulo: "Participar",
      itens: [
        { label: "Inscrições", icon: "create-outline", onPress: () => router.navigate("/inscricoes") },
        { label: "Meu grupo", icon: "people-circle-outline", onPress: () => router.navigate("/meu-grupo") },
        { label: "Batismo", icon: "water-outline", onPress: () => router.navigate("/batismo") },
        { label: "NEXT", icon: "sparkles-outline", onPress: () => router.navigate("/next") },
      ],
    },
    {
      titulo: "Conteúdo",
      itens: [
        { label: "Pregações", icon: "play-circle-outline", onPress: () => router.navigate("/videos") },
      ],
    },
    {
      titulo: "Ajustes",
      itens: [
        { label: "Configurações", icon: "settings-outline", onPress: () => router.navigate("/configuracoes") },
        // ⚠️ Suporte do PRODUTO, não fila pastoral: "Falar com a CBRio" continua
        // sendo o caminho de oração/conversa com pastor (pedido do Matheus,
        // 29/08). Misturar os dois encheria a fila do cuidado de bug report.
        { label: "Ajuda com o app", icon: "help-buoy-outline", onPress: () => router.navigate("/ajuda-app") },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            {membro?.avatarUrl ? (
              <Image source={{ uri: membro.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <CbrioHeart size={32} color={colors.brandPale} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{nome}</Text>
            {!!user?.email && <Text style={styles.meta}>{user.email}</Text>}
          </View>
        </View>

        {secoes.map((sec) => (
          <View key={sec.titulo} style={styles.secao}>
            <Text style={styles.secaoTitulo}>{t(sec.titulo)}</Text>
            <GlassCard style={styles.list}>
              {sec.itens.map((opt, i) => (
                <Pressable
                  key={opt.label}
                  onPress={opt.onPress}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && styles.rowBorder,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <Ionicons name={opt.icon} size={22} color={colors.brandMid} />
                  <Text style={styles.rowLabel}>{t(opt.label)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </GlassCard>
          </View>
        ))}

        <Button title={t("Sair")} variant="ghost" onPress={() => signOut()} />

        <View style={styles.versao}>
          <Text style={styles.versaoTxt}>
            CBRio · {t("versão")} {Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },
    secao: { gap: spacing.sm },
    secaoTitulo: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImg: { width: 64, height: 64, borderRadius: radius.full },
    name: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    meta: { color: colors.textMuted, fontSize: font.size.sm },
    list: {
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowLabel: { flex: 1, color: colors.text, fontSize: font.size.md },
    versao: {
      alignItems: "center",
      paddingTop: spacing.sm,
    },
    versaoTxt: { color: colors.textMuted, fontSize: 12 },
  });
