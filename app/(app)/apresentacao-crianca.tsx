// ============================================================================
// APRESENTAÇÃO DE CRIANÇA · a porta nativa (11/08/2026)
//
// Pedido do Marcos: *"Apresentação de Bebês está fora do app, quero que tudo seja
// dentro do app. Quando a pessoa marcar que quer apresentar bebê, já que já temos
// os dados dela dentro do app, tem que perguntar se o filho é dela; se sim,
// indicar o vínculo, completar os dados se a criança não existir como família já.
// Se for outra pessoa, ela tem que preencher os dados completos dos responsáveis
// e criança, tudo dentro do app e não em link externo."*
//
// ⚠️⚠️ O que existia era um LINK MORTO: `cbrio.org/apresentacao-criancas` não tem
// rota no ERP e devolvia 200 só pelo catch-all do SPA. `apresentacao_bebes` tinha
// 0 linhas — ninguém nunca conseguiu se inscrever.
// ============================================================================
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { apiGet, apiPost } from "@/lib/api";
import { maskCPF, maskDateBR } from "@/lib/validators";
import { acaoAoFechar } from "@/lib/descartarRascunho";
import {
  avisoDoVinculo,
  faltaNoPedido,
  nascimentoParaISO,
  podeEnviarPedido,
  outroEmBranco,
  VAZIO_OUTRO,
  type CriancaForm,
  type OutroResponsavelForm,
  type QuemApresenta,
  type ResponsavelForm,
} from "@/lib/apresentacaoCrianca";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Resp = {
  proxima_data: string;
  familia: { nome: string | null; membros: string[] } | null;
  pedidos: { id: string; bebe_nome: string; data_apresentacao: string; status: string | null }[];
  pode_indicar_vinculo: boolean;
};

const VAZIA: CriancaForm = { nome: "", nascimento: "", sexo: null };
const VAZIO_RESP: ResponsavelForm = { nome: "", telefone: "", email: "" };

function dataBonita(iso: string): string {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [a, m, d] = s.split("-");
  return `${d}/${m}/${a}`;
}

export default function ApresentacaoCriancaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [dados, setDados] = useState<Resp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [quem, setQuem] = useState<QuemApresenta | null>(null);
  const [crianca, setCrianca] = useState<CriancaForm>(VAZIA);
  const [resp, setResp] = useState<ResponsavelForm>(VAZIO_RESP);
  const [outro, setOutro] = useState<OutroResponsavelForm>(VAZIO_OUTRO);
  const [abriuOutro, setAbriuOutro] = useState(false);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{
    data: string;
    familia: string | null;
    propria: boolean;
    extra: { entrou: boolean; em_outra_familia: boolean; falhou: boolean } | null;
  } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiGet<Resp>("/app/apresentacao-crianca");
      setDados(r);
      setErroCarga(null);
    } catch (e) {
      // ⚠️ Falha de rede NÃO pode virar "não há apresentação" — é a mentira que a
      // Onda 2 tirou do `meu-grupo` e do `evento`.
      setErroCarga(e instanceof Error ? e.message : t("Não foi possível carregar agora."));
    } finally {
      setCarregando(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const falta = quem ? faltaNoPedido(quem, crianca, resp, outro) : [];
  const podeEnviar = !!quem && podeEnviarPedido(quem, crianca, resp, outro);
  const aviso = quem ? avisoDoVinculo(quem, dados?.familia?.nome ?? null) : null;

  function voltar() {
    const campos = [crianca.nome, crianca.nascimento, resp.nome, resp.telefone, outro.nome, outro.cpf, obs];
    const acao = acaoAoFechar({ campos, salvando: enviando });
    if (acao === "aguardar") return;
    if (acao === "fechar") { quem ? setQuem(null) : subirUmNivel(); return; }
    Alert.alert(
      t("Descartar o que você preencheu?"),
      t("Os dados da criança não foram enviados."),
      [
        { text: t("Continuar preenchendo"), style: "cancel" },
        {
          text: t("Descartar"),
          style: "destructive",
          onPress: () => {
            setCrianca(VAZIA); setResp(VAZIO_RESP); setOutro(VAZIO_OUTRO);
            setAbriuOutro(false); setObs(""); setErro(null); setQuem(null);
          },
        },
      ],
    );
  }

  async function enviar() {
    if (!quem || !podeEnviar) return;
    setErro(null);
    setEnviando(true);
    try {
      const r = await apiPost<{
        data_apresentacao: string;
        familia: string | null;
        ja_inscrito?: boolean;
        responsavel_extra?: { entrou: boolean; em_outra_familia: boolean; falhou: boolean } | null;
      }>(
        "/app/apresentacao-crianca",
        {
          propria: quem === "propria",
          crianca: {
            nome: crianca.nome.trim(),
            data_nascimento: nascimentoParaISO(crianca.nascimento),
            sexo: crianca.sexo,
          },
          ...(quem === "outra"
            ? { responsavel: { nome: resp.nome.trim(), telefone: resp.telefone, email: resp.email || null } }
            : {}),
          // ⚠️ Só vai quando a pessoa preencheu de verdade — bloco em branco não
          // pode virar `{nome:"",cpf:""}` no servidor (ele recusaria o pedido
          // inteiro por causa de um campo que ninguém quis usar).
          ...(quem === "propria" && !outroEmBranco(outro)
            ? {
                responsavel_extra: {
                  nome: outro.nome.trim(),
                  cpf: outro.cpf,
                  telefone: outro.telefone || null,
                  sexo: outro.sexo,
                },
              }
            : {}),
          observacoes: obs.trim() || null,
        },
      );
      setPronto({
        data: r.data_apresentacao, familia: r.familia ?? null, propria: quem === "propria",
        extra: r.responsavel_extra ?? null,
      });
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível registrar agora."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TecladoSeguro style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable onPress={voltar} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("Apresentação de crianças")}</Text>
            <View style={{ width: 24 }} />
          </View>

          {carregando ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : pronto ? (
            <View style={styles.ok}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              <Text style={styles.okTitulo}>{t("Apresentação registrada")}</Text>
              <Text style={styles.okTxt}>
                {t("A cerimônia é no culto de domingo, dia")} {dataBonita(pronto.data)}.
              </Text>
              {pronto.propria && (
                <Text style={styles.okTxt}>
                  {pronto.familia
                    ? `${t("A criança entrou na sua família")} (${pronto.familia}) — ${t("veja em Minha família")}.`
                    : t("A criança já aparece em Minha família.")}
                </Text>
              )}
              {/* ⚠⚠ A tela DIZ o que aconteceu com o outro responsável. Fingir que
                  entrou quando ele ficou na família dele (ou quando falhou) faria
                  a pessoa esperar uma "família alinhada" que não vai aparecer. */}
              {!!pronto.extra && (
                <Text style={[styles.okTxt, !pronto.extra.entrou && styles.okAviso]}>
                  {pronto.extra.entrou
                    ? t("O outro responsável também entrou na família — quando ele baixar o app, já vai ver vocês lá.")
                    : pronto.extra.em_outra_familia
                      ? t("O outro responsável já está em outra família no sistema. Registramos o parentesco com a criança e a equipe vai alinhar.")
                      : t("Não conseguimos incluir o outro responsável agora — a equipe vai completar.")}
                </Text>
              )}
              <Text style={styles.okTxt}>{t("A equipe entra em contato pra combinar os detalhes.")}</Text>
            </View>
          ) : erroCarga ? (
            <Pressable style={styles.erroCard} onPress={carregar} accessibilityRole="button">
              <Text style={styles.erroTxt}>{erroCarga}</Text>
              <Text style={styles.erroLink}>{t("Toque pra tentar de novo")}</Text>
            </Pressable>
          ) : !quem ? (
            <>
              <View style={styles.dataCard}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <Text style={styles.dataTxt}>
                  {t("Próxima cerimônia")}: <Text style={styles.dataForte}>{dataBonita(dados?.proxima_data ?? "")}</Text>
                  {"\n"}
                  <Text style={styles.dataSub}>{t("Sempre no 2º domingo do mês")}</Text>
                </Text>
              </View>

              {!!dados?.pedidos?.length && (
                <View style={styles.jaCard}>
                  <Text style={styles.jaTitulo}>{t("Você já pediu")}</Text>
                  {dados.pedidos.map((p) => (
                    <Text key={p.id} style={styles.jaTxt}>
                      {p.bebe_nome} · {dataBonita(p.data_apresentacao)}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={styles.intro}>{t("Quem você quer apresentar?")}</Text>

              {dados?.pode_indicar_vinculo ? (
                <Pressable style={styles.opcao} onPress={() => setQuem("propria")} accessibilityRole="button">
                  <View style={styles.opcaoIcone}>
                    <Ionicons name="happy" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opcaoTitulo}>{t("É meu filho ou minha filha")}</Text>
                    <Text style={styles.opcaoAjuda}>
                      {t("Já temos seus dados — você só preenche os da criança.")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ) : (
                // ⚠️ Sem cadastro fechado não há a quem ligar a criança. A tela DIZ
                // isso em vez de esconder a opção sem explicar.
                <View style={styles.avisoCard}>
                  <Ionicons name="information-circle" size={18} color={colors.primary} />
                  <Text style={styles.avisoTxt}>
                    {t("Pra indicar o vínculo com seu filho, complete seu cadastro primeiro.")}
                  </Text>
                </View>
              )}

              <Pressable style={styles.opcao} onPress={() => setQuem("outra")} accessibilityRole="button">
                <View style={styles.opcaoIcone}>
                  <Ionicons name="people" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcaoTitulo}>{t("É filho de outra pessoa")}</Text>
                  <Text style={styles.opcaoAjuda}>
                    {t("Você preenche os dados dos responsáveis e da criança.")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </>
          ) : (
            <>
              {!!aviso && (
                <View style={styles.avisoCard}>
                  <Ionicons name="people-circle" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.avisoTxt}>{t(aviso)}</Text>
                    {!!dados?.familia?.membros?.length && (
                      <Text style={styles.avisoSub}>
                        {t("Com")}: {dados.familia.membros.join(", ")}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <Text style={styles.secao}>{t("Dados da criança")}</Text>
              <Input
                label={t("Nome completo da criança")}
                value={crianca.nome}
                onChangeText={(v) => setCrianca((c) => ({ ...c, nome: v }))}
                autoCapitalize="words"
              />
              <Input
                label={t("Data de nascimento")}
                value={crianca.nascimento}
                onChangeText={(v) => setCrianca((c) => ({ ...c, nascimento: maskDateBR(v) }))}
                keyboardType="number-pad"
                placeholder="DD/MM/AAAA"
              />
              <View style={styles.sexoRow}>
                {(["F", "M"] as const).map((sx) => (
                  <Pressable
                    key={sx}
                    onPress={() => setCrianca((c) => ({ ...c, sexo: c.sexo === sx ? null : sx }))}
                    style={[styles.sexoBtn, crianca.sexo === sx && styles.sexoBtnOn]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.sexoTxt, crianca.sexo === sx && styles.sexoTxtOn]}>
                      {sx === "F" ? t("Menina") : t("Menino")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* ⚠️ NÃO EXISTE CAMPO DE CPF AQUI, e é regra: "sem CPF,
                  identificamos pelo pai" (Marcos · 11/08). O servidor recusa o
                  envio se o campo chegar. */}

              {quem === "outra" && (
                <>
                  <Text style={styles.secao}>{t("Dados do responsável")}</Text>
                  <Input
                    label={t("Nome completo do responsável")}
                    value={resp.nome}
                    onChangeText={(v) => setResp((r) => ({ ...r, nome: v }))}
                    autoCapitalize="words"
                  />
                  <Input
                    label={t("Telefone do responsável")}
                    value={resp.telefone}
                    onChangeText={(v) => setResp((r) => ({ ...r, telefone: v }))}
                    keyboardType="phone-pad"
                  />
                  <Input
                    label={t("E-mail (opcional)")}
                    value={resp.email}
                    onChangeText={(v) => setResp((r) => ({ ...r, email: v }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <View style={styles.avisoCard}>
                    <Ionicons name="information-circle" size={18} color={colors.primary} />
                    <Text style={styles.avisoTxt}>
                      {t("A equipe confere os dados e fala com os responsáveis antes da cerimônia.")}
                    </Text>
                  </View>
                </>
              )}

              {quem === "propria" && (
                <>
                  {!abriuOutro ? (
                    <Pressable
                      style={styles.addResp}
                      onPress={() => setAbriuOutro(true)}
                      accessibilityRole="button"
                    >
                      <Ionicons name="person-add" size={18} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addRespTxt}>{t("Adicionar o outro responsável")}</Text>
                        <Text style={styles.addRespSub}>
                          {t("A família fica montada no sistema e ele já vê vocês ao baixar o app.")}
                        </Text>
                      </View>
                    </Pressable>
                  ) : (
                    <>
                      <View style={styles.secaoRow}>
                        <Text style={styles.secao}>{t("Outro responsável")}</Text>
                        <Pressable
                          onPress={() => { setOutro(VAZIO_OUTRO); setAbriuOutro(false); }}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t("Remover o outro responsável")}
                        >
                          <Text style={styles.remover}>{t("Remover")}</Text>
                        </Pressable>
                      </View>
                      <Input
                        label={t("Nome completo")}
                        value={outro.nome}
                        onChangeText={(v) => setOutro((o) => ({ ...o, nome: v }))}
                        autoCapitalize="words"
                      />
                      {/* ⚠⚠ O CPF AQUI É OBRIGATÓRIO, e é o oposto da criança de
                          propósito: é ADULTO. É o CPF que faz o cadastro dele ser
                          REENCONTRADO quando baixar o app, em vez de nascer um
                          segundo — "tem que ter CPF" (Marcos · 11/08). */}
                      <Input
                        label={t("CPF")}
                        value={outro.cpf}
                        onChangeText={(v) => setOutro((o) => ({ ...o, cpf: maskCPF(v) }))}
                        keyboardType="number-pad"
                        placeholder="000.000.000-00"
                      />
                      <Input
                        label={t("Telefone (opcional)")}
                        value={outro.telefone}
                        onChangeText={(v) => setOutro((o) => ({ ...o, telefone: v }))}
                        keyboardType="phone-pad"
                      />
                      <View style={styles.sexoRow}>
                        {(["F", "M"] as const).map((sx) => (
                          <Pressable
                            key={sx}
                            onPress={() => setOutro((o) => ({ ...o, sexo: o.sexo === sx ? null : sx }))}
                            style={[styles.sexoBtn, outro.sexo === sx && styles.sexoBtnOn]}
                            accessibilityRole="button"
                          >
                            <Text style={[styles.sexoTxt, outro.sexo === sx && styles.sexoTxtOn]}>
                              {sx === "F" ? t("Mãe") : t("Pai")}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}

              <Input
                label={t("Algo que a equipe precisa saber? (opcional)")}
                value={obs}
                onChangeText={setObs}
                multiline
              />

              {!!falta.length && (
                <Text style={styles.faltaTxt}>
                  {t("Falta preencher")}: {falta.map((f) => t(f)).join(" · ")}
                </Text>
              )}
              {!!erro && <Text style={styles.erroInline}>{erro}</Text>}

              <Button
                title={t("Registrar apresentação")}
                onPress={enviar}
                loading={enviando}
                disabled={!podeEnviar}
              />
            </>
          )}
        </ScrollView>
      </TecladoSeguro>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    intro: { color: c.textMuted, fontSize: font.size.md, marginTop: spacing.sm },
    secao: { color: c.text, fontSize: font.size.md, fontWeight: "700", marginTop: spacing.sm },
    dataCard: {
      flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
      backgroundColor: c.primary + "14", borderRadius: radius.lg, padding: spacing.md,
    },
    dataTxt: { color: c.text, fontSize: font.size.sm, flex: 1, lineHeight: 20 },
    dataForte: { fontWeight: "800" },
    dataSub: { color: c.textMuted, fontSize: font.size.sm },
    jaCard: {
      backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, borderColor: c.glassBorder, gap: 4,
    },
    jaTitulo: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    jaTxt: { color: c.textMuted, fontSize: font.size.sm },
    opcao: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, borderColor: c.glassBorder,
    },
    opcaoIcone: {
      width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
      backgroundColor: c.primary + "18",
    },
    opcaoTitulo: { color: c.text, fontSize: font.size.md, fontWeight: "700" },
    opcaoAjuda: { color: c.textMuted, fontSize: font.size.sm, marginTop: 2 },
    avisoCard: {
      flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
      backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, borderColor: c.glassBorder,
    },
    avisoTxt: { color: c.text, fontSize: font.size.sm, flex: 1, lineHeight: 19 },
    avisoSub: { color: c.textMuted, fontSize: font.size.sm, marginTop: 2 },
    sexoRow: { flexDirection: "row", gap: spacing.sm },
    sexoBtn: {
      flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: "center",
      borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface,
    },
    sexoBtnOn: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    sexoTxt: { color: c.textMuted, fontSize: font.size.md, fontWeight: "600" },
    sexoTxtOn: { color: c.text, fontWeight: "800" },
    addResp: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      backgroundColor: c.primary + "0F", borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, borderColor: c.primary + "33", borderStyle: "dashed",
    },
    addRespTxt: { color: c.text, fontSize: font.size.md, fontWeight: "700" },
    addRespSub: { color: c.textMuted, fontSize: font.size.sm, marginTop: 2 },
    secaoRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    remover: { color: c.danger, fontSize: font.size.sm, fontWeight: "700" },
    okAviso: { color: c.text },
    faltaTxt: { color: c.textMuted, fontSize: font.size.sm },
    erroInline: { color: "#ef4444", fontSize: font.size.sm },
    erroCard: {
      backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, borderColor: c.glassBorder, gap: 4,
    },
    erroTxt: { color: c.text, fontSize: font.size.sm },
    erroLink: { color: c.primary, fontSize: font.size.sm, fontWeight: "700" },
    ok: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
    okTitulo: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    okTxt: { color: c.textMuted, fontSize: font.size.sm, textAlign: "center", lineHeight: 19 },
  });
