// ============================================================================
// PORTÃO DE ATUALIZAÇÃO · obrigatório, sem opção de recusar (Marcos · 05/08/2026)
//
// Pedido dele, com a razão: "coloca essa questão de aviso, mas não de opção de
// recusar, não queremos pessoas usando código antigo, isso quebra o sistema, se
// não atualizar não usa".
//
// O gatilho foi o Pedro Paiva: ele baixou o app pra opinar, abriu UMA vez e
// avaliou o bundle de ontem — porque o ciclo do OTA é de 2 aberturas (a 1ª
// baixa, a 2ª aplica) e **nada na tela avisava**. Além do teste enviesado, código
// antigo conversando com o backend novo é a classe de bug mais difícil de
// diagnosticar: o servidor está certo, a pessoa jura que não está.
//
// ⚠️⚠️ A LINHA DE SEGURANÇA: só bloqueia com `isUpdatePending`, ou seja quando o
// bundle JÁ ESTÁ NO APARELHO e aplicar é instantâneo (não depende de rede).
// Bloquear em `isUpdateAvailable` (existe no servidor, ainda não baixou) deixaria
// quem está com internet ruim TRANCADO FORA do app — inclusive offline, onde o
// app funciona hoje. É a diferença entre "obrigatório" e "inutilizável".
//
// ⚠️ Sem botão de "depois", por decisão dele. O único botão aplica; se aplicar
// falhar, o botão vira "tentar de novo" (mesma ação, não é escape).
// ⚠️ No-op em desenvolvimento (`expo-updates` desligado) — senão a tela apareceria
// em dev e no Expo Go, onde `reloadAsync` nem existe.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { CbrioHeart } from "@/components/brand/CbrioHeart";

/**
 * Busca por atualização na abertura e a cada volta do background — o padrão do
 * expo-updates só checa no load, então uma sessão que fica aberta o dia todo
 * nunca veria o update do dia. Baixar aqui é o que faz o portão aparecer.
 *
 * Devolve `momentoDeCobrar`: fica true no cold start e a cada volta do
 * background. ⚠️ POR QUE ISSO EXISTE: o download termina em background e
 * `isUpdatePending` viraria true NO MEIO do uso — inclusive no meio do
 * `/completar-cadastro`, que agora também é obrigatório. A pessoa perderia o que
 * digitou e recomeçaria. Cobrar na volta do background (ou na abertura) mantém
 * "se não atualizar não usa" — não se atravessa um ciclo de background com
 * bundle velho — sem apagar o que a pessoa estava escrevendo. Não é escape: não
 * há botão de "depois", e a janela é de minutos.
 */
function useBuscaAtualizacao() {
  const buscando = useRef(false);
  const [momentoDeCobrar, setMomentoDeCobrar] = useState(false);

  const buscar = useCallback(async () => {
    if (!Updates.isEnabled || buscando.current) return;
    buscando.current = true;
    try {
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) await Updates.fetchUpdateAsync(); // vira isUpdatePending
    } catch {
      // Sem rede / servidor fora: silêncio de propósito. O app segue usável com
      // o bundle atual — o portão só existe quando o novo JÁ está no aparelho.
    } finally {
      buscando.current = false;
    }
  }, []);

  useEffect(() => {
    // Cold start: se já havia update baixado de uma sessão anterior, cobra agora.
    setMomentoDeCobrar(true);
    buscar();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        setMomentoDeCobrar(true);
        buscar();
      }
    });
    return () => sub.remove();
  }, [buscar]);

  return momentoDeCobrar;
}

export function PortaoAtualizacao({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const t = useT();
  const { isUpdatePending } = Updates.useUpdates();
  const [aplicando, setAplicando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const momentoDeCobrar = useBuscaAtualizacao();

  async function aplicar() {
    setAplicando(true);
    setFalhou(false);
    try {
      await Updates.reloadAsync(); // não volta: o app reinicia no bundle novo
    } catch {
      setFalhou(true);
      setAplicando(false);
    }
  }

  // ⚠️ `Updates.isEnabled` é false em dev/Expo Go — ali o portão não existe.
  if (!Updates.isEnabled || !isUpdatePending || !momentoDeCobrar) return <>{children}</>;

  return (
    <View style={styles.tela}>
      <View style={styles.miolo}>
        <CbrioHeart size={54} />
        <View style={styles.textos}>
          <Text style={styles.titulo}>{t("Atualização pronta")}</Text>
          <Text style={styles.corpo}>
            {t("Uma versão nova do app já está no seu aparelho. Para continuar, aplique a atualização — o app reinicia em um segundo.")}
          </Text>
          {falhou && (
            <Text style={styles.erro}>
              {t("Não conseguimos aplicar agora. Toque de novo.")}
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.botao, aplicando && styles.botaoOcupado]}
          onPress={aplicar}
          disabled={aplicando}
          accessibilityRole="button"
        >
          {aplicando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoTxt}>{falhou ? t("Tentar de novo") : t("Atualizar agora")}</Text>
          )}
        </Pressable>
        {/* Sem "depois": decisão do Marcos — código antigo conversando com o
            backend novo é o que quebra o sistema. */}
        <Text style={styles.rodape}>{t("A atualização é obrigatória para manter o app funcionando com o sistema da igreja.")}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    miolo: { alignItems: "center", gap: spacing.lg, maxWidth: 340, width: "100%" },
    textos: { alignItems: "center", gap: spacing.sm },
    titulo: { color: c.text, fontSize: 25, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
    corpo: { color: c.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    erro: { color: c.danger, fontSize: font.size.sm, textAlign: "center", marginTop: 2 },
    botao: {
      backgroundColor: c.primary, minHeight: 52, borderRadius: 16, alignSelf: "stretch",
      alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg,
    },
    botaoOcupado: { opacity: 0.75 },
    botaoTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
    rodape: { color: c.textMuted, fontSize: 12.5, textAlign: "center", opacity: 0.8 },
  });
}
