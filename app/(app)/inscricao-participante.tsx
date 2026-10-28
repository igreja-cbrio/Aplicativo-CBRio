import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Typography";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { FormularioRolavel } from "@/components/ui/FormularioRolavel";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { CampoExtra } from "@/components/inscricoes/CampoExtra";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { buscarEventoParticipante, enviarInscricaoParticipante, suportaParticipanteNativo, type EventoPublico } from "@/lib/inscricaoParticipante";
import { mascaraDataBR, nascimentoBRParaISO, maskCPF } from "@/lib/validators";
import { extrasFaltando } from "@/lib/inscricaoPayload";
import { urlPagamentoDaResposta, type InscricaoEventoResp, type TextosInscricao } from "@/lib/api";
import { abrirFormularioInscricao, abrirInscricaoEvento } from "@/lib/eventos";

export default function InscricaoParticipante() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  // A chave remonta inclusive ao mudar de evento por deep link: nunca reaproveita dados/aceites.
  return <FormularioParticipante key={slug} slug={slug || ""} />;
}

function FormularioParticipante({ slug }: { slug: string }) {
  const c = useColors();
  const s = useMemo(() => styles(c), [c]);
  const t = useT();
  const [evento, setEvento] = useState<EventoPublico | null>(null);
  const [textos, setTextos] = useState<TextosInscricao | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [dados, setDados] = useState({ nome: "", cpf: "", telefone: "", email: "", nascimento: "", genero: "", endereco: "" });
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [termos, setTermos] = useState(false);
  const [optin, setOptin] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const ocupado = useRef(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<InscricaoEventoResp | null>(null);
  const mudar = (campo: keyof typeof dados, valor: string) => setDados(d => ({ ...d, [campo]: valor }));

  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErroCarga(false);
    buscarEventoParticipante(slug).then(([e, tx]) => {
      if (ativo) { setEvento(e); setTextos(tx); }
    }).catch(() => { if (ativo) setErroCarga(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [slug, tentativa]);

  const aberto = !!evento?.form_ativo && !evento.inscricoes_encerradas && !evento.aviso;
  const nativo = !!evento && suportaParticipanteNativo(evento);
  const minimo = evento?.contrato === "minimo";
  const pagar = resultado?.pagamento && resultado.beneficio !== "integral" ? urlPagamentoDaResposta(resultado) : null;

  async function enviar() {
    if (!evento || !aberto || !nativo || ocupado.current || resultado) return;
    setErro("");
    if (!termos) { setErro(t("É preciso aceitar os termos para se inscrever.")); return; }
    const nascimento = nascimentoBRParaISO(dados.nascimento);
    if (!minimo && !nascimento) { setErro(t("Informe uma data de nascimento válida.")); return; }
    const falta = extrasFaltando(evento.campos, extras);
    if (falta) { setErro(`${t("Preencha")}: ${falta}`); return; }
    ocupado.current = true; setEnviando(true);
    try {
      const r = await enviarInscricaoParticipante(slug, { nome: dados.nome, cpf: dados.cpf,
        telefone: dados.telefone, email: dados.email, dataNascimento: nascimento || "", genero: dados.genero },
      extras, termos, optin, evento.exigir_endereco ? dados.endereco : "");
      setResultado(r);
    } catch (e) { setErro(e instanceof Error ? e.message : t("Não foi possível inscrever agora.")); }
    finally { ocupado.current = false; setEnviando(false); }
  }

  function check(label: string, valor: boolean, mudarValor: (v: boolean) => void) {
    return <Pressable style={s.check} accessibilityRole="checkbox" accessibilityState={{ checked: valor }}
      onPress={() => mudarValor(!valor)} disabled={enviando}>
      <Ionicons name={valor ? "checkbox" : "square-outline"} size={24} color={c.primary} />
      <Text style={[s.text, { flex: 1 }]}>{label}</Text>
    </Pressable>;
  }

  return <SafeAreaView style={s.safe} edges={["left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Voltar")} style={s.back}
        onPress={() => router.canGoBack() ? router.back() : router.replace("/inscricoes")}>
        <Ionicons name="chevron-back" size={24} color={c.text} />
      </Pressable>
      <Text style={s.title}>{t("Inscrever outra pessoa")}</Text>
    </View>
    <TecladoSeguro style={{ flex: 1 }}>
      <FormularioRolavel contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {carregando ? <ActivityIndicator color={c.primary} /> : erroCarga || !evento ? <>
          <Text style={s.text}>{t("Não foi possível abrir o formulário. Tente carregar novamente.")}</Text>
          <Button title={t("Tentar novamente")} onPress={() => setTentativa(v => v + 1)} />
        </> : <>
          <GlassCard style={s.card}>
            <Text style={s.title}>{evento.nome}</Text>
            {evento.data ? <Text style={s.text}>{evento.data.split("-").reverse().join("/")}{evento.hora ? ` · ${evento.hora.slice(0, 5)}` : ""}</Text> : null}
            {evento.local ? <Text style={s.text}>{evento.local}</Text> : null}
            {evento.descricao ? <Text style={s.text}>{evento.descricao}</Text> : null}
            {evento.pagamento_ativo && evento.valor_centavos ? <Text style={s.text}>{`R$ ${(evento.valor_centavos / 100).toFixed(2).replace(".", ",")}`}</Text> : null}
          </GlassCard>
          {resultado ? <GlassCard style={s.card}>
            <Ionicons name={resultado.pagamento ? "time-outline" : "checkmark-circle-outline"} size={32} color={c.primary} />
            <Text style={s.title}>{resultado.pagamento ? t("Aguardando pagamento") : resultado.ja_inscrito ? t("Esta pessoa já está inscrita.") : evento.msg_sucesso_titulo || t("Inscrição confirmada!")}</Text>
            <Text style={s.text}>{resultado.pagamento ? t("Sua vaga está reservada. Conclua o pagamento para confirmar.") : evento.msg_sucesso_texto || t("Te esperamos lá.")}</Text>
            {resultado.numero_sorte ? <Text style={s.text}>{t("Seu número da sorte")}: {resultado.numero_sorte}</Text> : null}
            {resultado.comprovante_token ? <Button title={t("Abrir comprovante")} onPress={() => abrirFormularioInscricao(`https://www.cbrio.org/i/c/${encodeURIComponent(resultado.comprovante_token!)}`)} /> : null}
            {pagar ? <Button title={t("Pagar agora")} onPress={() => abrirInscricaoEvento(pagar)} /> : null}
          </GlassCard> : !aberto ? <Text style={s.text}>{evento.aviso || t("Inscrições encerradas")}</Text> : !nativo ? <GlassCard style={s.card}>
            <Text style={s.text}>{t("Este evento tem um formulário especial. Continue na página do evento, dentro do app, para preencher todos os campos e autorizações.")}</Text>
            <Button title={t("Abrir inscrição")} onPress={() => router.replace({ pathname: "/inscricao-formulario", params: { url: `https://www.cbrio.org/evento/${slug}`, para: "outra-pessoa" } })} />
          </GlassCard> : <>
            <Text style={s.text}>{t("Nome, CPF e nascimento devem ser de quem vai participar. Preencha seus dados somente nos campos de responsável, quando solicitados.")}</Text>
            <View style={s.fields} pointerEvents={enviando ? "none" : "auto"}>
              <Input label={t("Nome completo")} value={dados.nome} onChangeText={v => mudar("nome", v)} autoCapitalize="words" autoComplete="off" />
              <Input label={t("CPF")} value={dados.cpf} onChangeText={v => mudar("cpf", maskCPF(v))} keyboardType="number-pad" maxLength={14} autoComplete="off" />
              <Input label={t("Celular (com DDD)")} value={dados.telefone} onChangeText={v => mudar("telefone", v)} keyboardType="phone-pad" autoComplete="off" />
              {!minimo ? <>
                <Input label={t("E-mail")} value={dados.email} onChangeText={v => mudar("email", v)} keyboardType="email-address" autoComplete="off" autoCorrect={false} />
                <Input label={t("Data de nascimento")} placeholder="DD/MM/AAAA" value={dados.nascimento} onChangeText={v => mudar("nascimento", mascaraDataBR(v))} keyboardType="number-pad" maxLength={10} autoComplete="off" />
                <CampoExtra campo={{ key: "sexo", label: t("Sexo"), tipo: "select", opcoes: [t("Masculino"), t("Feminino")] }}
                  valor={dados.genero === "masculino" ? t("Masculino") : dados.genero === "feminino" ? t("Feminino") : ""}
                  onChange={v => mudar("genero", v === t("Masculino") ? "masculino" : v === t("Feminino") ? "feminino" : "")} />
              </> : null}
              {evento.exigir_endereco ? <Input label={t("Endereço completo")} value={dados.endereco} onChangeText={v => mudar("endereco", v)} autoComplete="off" /> : null}
              {(evento.campos || []).map(campo => <CampoExtra key={campo.key} campo={campo} valor={extras[campo.key] || ""} onChange={v => setExtras(d => ({ ...d, [campo.key]: v }))} />)}
            </View>
            {check(textos?.termos_lgpd || t("Concordo com o uso dos meus dados para esta inscrição."), termos, setTermos)}
            {check(textos?.aviso_optin || t("Quero receber avisos deste evento por WhatsApp."), optin, setOptin)}
            {erro ? <Text accessibilityRole="alert" style={s.error}>{erro}</Text> : null}
            <Button title={evento.pagamento_ativo ? t("Inscrever e pagar") : t("Confirmar inscrição")} onPress={enviar} loading={enviando} disabled={enviando} />
          </>}
        </>}
      </FormularioRolavel>
    </TecladoSeguro>
  </SafeAreaView>;
}

const styles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  back: { padding: spacing.sm },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 },
  card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg },
  fields: { gap: spacing.md },
  title: { color: c.text, fontSize: font.size.lg, fontWeight: "700", flexShrink: 1 },
  text: { color: c.textMuted, fontSize: font.size.md, lineHeight: 22 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.xs },
  error: { color: c.danger, fontSize: font.size.md },
});
