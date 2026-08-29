// ════════════════════════════════════════════════════════════════════════════
//  Card do Kids na Home — só no DIA em que tem culto com Kids
//
//  Pedido do Matheus (29/08/2026). ⚠️⚠️ O pré-check-in JÁ EXISTIA e ninguém
//  achava: **1 uso na história inteira** contra 888 check-ins no totem em 30
//  dias. Isto não é recurso novo — é o caminho até ele.
//
//  ⚠️ Este card NÃO é uma segunda implementação do pré-check-in: ele chama o
//  MESMO endpoint da tela `/kids` e manda a pessoa pra lá pra ver o QR. Duas
//  implementações divergiriam no primeiro ajuste, e o sintoma seria "gerei pela
//  Home e o código não é o mesmo da tela do Kids".
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet, apiPost } from "@/lib/api";
import { hojeBRT } from "@/lib/dataBRT";
import { temKidsHoje, rotuloFilhos, codigoValido, type CultoDoDia } from "@/lib/kidsHoje";
import { trackEvento } from "@/lib/telemetria";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Filho = { id: string; nome: string };
type PreCheckin = { id: string; codigo: string; crianca_ids: string[]; expira_em: string };
type MeusFilhos = { filhos: Filho[]; preCheckin: PreCheckin | null };

export function CardKidsCheckin({ cultos }: { cultos: CultoDoDia[] }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const [dados, setDados] = useState<MeusFilhos | null>(null);
  const [gerando, setGerando] = useState(false);

  // ⚠️ A condição vem do que a Home JÁ carregou — nenhuma consulta nova só pra
  // decidir se o card existe. E só busca os filhos quando HOJE tem Kids: quem
  // não tem culto hoje não paga uma chamada de rede por um card invisível.
  const hoje = temKidsHoje(cultos, hojeBRT());

  const carregar = useCallback(async () => {
    if (!hoje) return;
    try {
      setDados(await apiGet<MeusFilhos>("/app/kids/meus-filhos"));
    } catch {
      // ⚠️ Falha de rede esconde o card, nunca mostra card quebrado: a pessoa
      // ainda tem a tela /kids inteira pelo menu.
      setDados(null);
    }
  }, [hoje]);

  useEffect(() => { carregar(); }, [carregar]);
  // Voltar da tela do Kids tem que refletir o código recém-gerado.
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const filhos = dados?.filhos ?? [];
  if (!hoje || filhos.length === 0) return null;

  const pronto = codigoValido(dados?.preCheckin, Date.now());
  const nomes = rotuloFilhos(filhos.map((f) => f.nome));

  async function gerar() {
    if (gerando) return;
    setGerando(true);
    try {
      // ⚠️ Gera pra TODOS os filhos: a família chega junta, e é isso que torna
      // o card "mais rápido" (o pedido). Quem precisa escolher ajusta em /kids.
      await apiPost("/app/kids/pre-checkin", { crianca_ids: filhos.map((f) => f.id) });
      trackEvento("kids_precheckin_home", { entity_id: filhos[0]?.id });
      router.navigate("/kids");
    } catch {
      // O erro é resolvido na tela cheia, que mostra a mensagem do servidor.
      router.navigate("/kids");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Pressable
      onPress={() => router.navigate("/kids")}
      accessibilityRole="button"
      accessibilityLabel={t("Check-in do Kids")}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.icone}>
        <Ionicons name="happy-outline" size={22} color="#fff" />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.titulo}>{t("Check-in do Kids")}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {pronto ? `${nomes} · ${t("código")} ${dados?.preCheckin?.codigo}` : nomes}
        </Text>
      </View>

      <Pressable
        onPress={pronto ? () => router.navigate("/kids") : gerar}
        disabled={gerando}
        accessibilityRole="button"
        style={({ pressed }) => [styles.botao, pressed && { opacity: 0.8 }]}
      >
        {gerando
          ? <ActivityIndicator size="small" color={colors.primary} />
          // ⚠️ "Adiantar", nunca "Fazer check-in": o app NÃO faz check-in — ele
          // gera o código que a pessoa apresenta na chegada. A entrada e a
          // retirada seguem presenciais, por decisão de segurança do módulo.
          : <Text style={styles.botaoTexto}>{pronto ? t("Ver código") : t("Adiantar")}</Text>}
      </Pressable>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    icone: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center", justifyContent: "center",
    },
    titulo: { color: "#fff", fontSize: font.size.lg, fontWeight: "800" },
    sub: { color: "rgba(255,255,255,0.92)", fontSize: font.size.sm },
    botao: {
      backgroundColor: "#fff",
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: spacing.md,
      minWidth: 92,
      alignItems: "center",
    },
    botaoTexto: { color: colors.primary, fontSize: font.size.sm, fontWeight: "800" },
  });
