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
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { abaixoDoPiso } from "@/lib/versaoApp";
import { versaoMinimaApp, type VersaoMinima } from "@/lib/api";
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
  // ⚠️⚠️ CONSERTO (07/08): antes isto era um `momentoDeCobrar` que virava `true`
  // e **NUNCA voltava a false** — ou seja, a proteção que o comentário acima
  // promete NÃO EXISTIA: um download que terminasse no meio do uso mostrava o
  // portão na hora, inclusive por cima do `/completar-cadastro`, apagando o que
  // a pessoa tinha digitado.
  //
  // A régua certa não é "quando cobrar" e sim "de ONDE veio este update":
  // se ele foi baixado NESTA sessão de tela acesa, espera o próximo ciclo; se
  // já estava no aparelho quando o app abriu (ou quando voltou do background),
  // cobra. Isso mantém o "se não atualizar não usa" — não se atravessa um ciclo
  // de background com bundle velho — sem interromper quem está no meio de algo.
  const baixouNestaSessao = useRef(false);
  const [, forcar] = useState(0);

  const buscar = useCallback(async () => {
    if (!Updates.isEnabled || buscando.current) return;
    buscando.current = true;
    try {
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) {
        await Updates.fetchUpdateAsync(); // vira isUpdatePending
        baixouNestaSessao.current = true;
        forcar((n) => n + 1);
      }
    } catch {
      // Sem rede / servidor fora: silêncio de propósito. O app segue usável com
      // o bundle atual — o portão só existe quando o novo JÁ está no aparelho.
    } finally {
      buscando.current = false;
    }
  }, []);

  useEffect(() => {
    buscar();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        // Voltou do background: o que foi baixado antes disso passa a valer.
        baixouNestaSessao.current = false;
        forcar((n) => n + 1);
        buscar();
      }
    });
    return () => sub.remove();
  }, [buscar]);

  return baixouNestaSessao;
}

/**
 * ⚠️⚠️ O PISO DA LOJA (Onda 3 · 07/08/2026) — é o caso que o portão de OTA NÃO
 * cobre e nunca vai cobrir.
 *
 * `runtimeVersion.policy = "appVersion"`: no dia em que a `version` subir, todo
 * binário antigo para de receber OTA (manifesto devolve **204**). O app não
 * quebra — CONGELA no último bundle — e `isUpdatePending` nunca mais fica true,
 * então o portão de cima fica cego. A partir daí só a LOJA alcança o aparelho.
 *
 * ⚠️ Compara `Updates.runtimeVersion`, que vem do plist compilado no BUILD.
 * `expoConfig.version` é a versão do BUNDLE e é "1.0.0" em 100% dos eventos.
 * ⚠️ FAIL-OPEN em tudo: sem rede, endpoint fora, config ilegível ou versão
 * ilegível ⇒ NÃO bloqueia. E o servidor precisa dizer `bloqueia: true` de
 * propósito — dúvida nunca tranca ninguém.
 * ⚠️ Consulta só na abertura e na volta do background (não a cada render).
 */
function usaPisoDeVersao() {
  const [cfg, setCfg] = useState<VersaoMinima | null>(null);

  const conferir = useCallback(async () => {
    try {
      setCfg(await versaoMinimaApp());
    } catch {
      setCfg(null); // fail-open
    }
  }, []);

  useEffect(() => {
    conferir();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") conferir();
    });
    return () => sub.remove();
  }, [conferir]);

  const minima = Platform.OS === "ios" ? cfg?.minima_ios : cfg?.minima_android;
  // A versão do BINÁRIO. Em dev (`Updates` desligado) vem vazia ⇒ não bloqueia.
  const versao = Updates.isEnabled ? Updates.runtimeVersion : null;
  return {
    bloquear: !!cfg?.bloqueia && abaixoDoPiso(versao, minima),
    mensagem: cfg?.mensagem || null,
    url: (Platform.OS === "ios" ? cfg?.url_loja_ios : cfg?.url_loja_android) || null,
    minima: minima || null,
  };
}

/** Tela de "atualize pela loja" — sem botão de escape, como o portão de OTA. */
function TelaLoja({
  piso, colors, styles, t,
}: {
  piso: { mensagem: string | null; url: string | null; minima: string | null };
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  t: (s: string) => string;
}) {
  return (
    <View style={styles.tela}>
      <View style={styles.miolo}>
        <CbrioHeart size={54} />
        <View style={styles.textos}>
          <Text style={styles.titulo}>{t("Atualize o app")}</Text>
          <Text style={styles.corpo}>
            {piso.mensagem ||
              t("Esta versão do app ficou para trás e não recebe mais atualizações automáticas. Baixe a versão nova na loja para continuar.")}
          </Text>
        </View>
        {piso.url ? (
          <Pressable
            style={styles.botao}
            onPress={() => Linking.openURL(piso.url as string)}
            accessibilityRole="button"
          >
            <Text style={styles.botaoTxt}>{t("Abrir a loja")}</Text>
          </Pressable>
        ) : null}
        {/* ⚠️ Sem "depois": binário abaixo do piso não recebe OTA nenhum, então
            não existe caminho de volta dentro do app. */}
        <Text style={styles.rodape}>
          {t("A atualização é obrigatória para manter o app funcionando com o sistema da igreja.")}
        </Text>
      </View>
    </View>
  );
}

export function PortaoAtualizacao({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const t = useT();
  const { isUpdatePending } = Updates.useUpdates();
  const [aplicando, setAplicando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const baixouNestaSessao = useBuscaAtualizacao();
  const piso = usaPisoDeVersao();

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
  // ⚠️ ORDEM IMPORTA: o piso da LOJA vem primeiro. Quem está abaixo dele não
  // recebe OTA nenhum (o manifesto devolve 204 pra runtime que não existe mais),
  // então oferecer "atualizar agora" seria mandar a pessoa pra um beco sem saída.
  if (piso.bloquear) return <TelaLoja piso={piso} colors={colors} styles={styles} t={t} />;

  // ⚠️ `Updates.isEnabled` é false em dev/Expo Go — ali o portão não existe.
  if (!Updates.isEnabled || !isUpdatePending || baixouNestaSessao.current) return <>{children}</>;

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
