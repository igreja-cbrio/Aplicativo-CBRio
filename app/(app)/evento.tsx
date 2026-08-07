// ============================================================================
// EVENTO · detalhe + inscrição DENTRO do app (Marcos · 05/08/2026)
//
// Pedido dele: "ao clicar em inscrições, aparecem todos os eventos da igreja...
// na aba de eventos inscritos, ao clicar deve aparecer MINHA INSCRIÇÃO naquele
// evento, e eu quero que os outros eventos tenham inscrições PELO APP também,
// sem link externo como é o caso do celebra".
//
// UMA tela para os dois estados (é a mesma pergunta do ponto de vista da pessoa:
// "e esse evento?"): já inscrita → a inscrição dela; não inscrita → o formulário.
//
// ⚠️⚠️ O FORMULÁRIO NÃO REPETE A RÉGUA DO SERVIDOR. O `POST /app/eventos/:id/
// inscrever` chama a MESMA função da porta pública (`inscreverEspinha`), então
// contrato de campos, benefício por CPF, vaga atômica, consentimento e cobrança
// são idênticos ao site. Aqui só pré-preenchemos (ficha do cadastro), pedimos os
// campos EXTRA e exibimos o erro que o servidor devolver — validação de verdade
// é lá. Reimplementar seria o "segundo caminho de escrita de pessoa" que o
// Contrato de porta existe pra impedir.
//
// ⚠️ PAGAMENTO continua na página hospedada (`/pagamento/<token>`): é onde vivem
// Pix/boleto/cartão e o escopo PCI (dado de cartão nunca entra no app). O app
// abre o link que a própria resposta devolve.
// ⚠️ Evento com campo `imagem` cai no FORM PÚBLICO (o app não sobe arquivo pro
// pipeline daquele formulário) — melhor mandar pro caminho que funciona do que
// mostrar um campo que não envia.
// ============================================================================
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { SeusDados } from "@/components/inscricoes/SeusDados";
import { faltaNaFicha, podeInscrever } from "@/lib/ficha";
import { extrasFaltando, montarPayloadInscricao } from "@/lib/inscricaoPayload";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { trackEvento } from "@/lib/telemetria";
import { abrirInscricaoEvento } from "@/lib/eventos";
import {
  buscarEventosAbertos,
  inscreverEmEvento,
  minhasInscricoesEventos,
  urlPagamentoDaResposta,
  type CampoEvento,
  type EventoAberto,
  type MinhaInscricaoEvento,
  type TextosInscricao,
} from "@/lib/api";
import { font, radius, spacing, type Palette } from "@/constants/theme";

function fmtValor(centavos?: number | null) {
  if (!centavos || centavos <= 0) return null;
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Prazo de inscrição (timestamptz do servidor) em dia/mês/ano · hh:mm local. */
function fmtPrazo(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hh = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} · ${hh}`;
}

function fmtData(data?: string | null, hora?: string | null) {
  if (!data) return null;
  const [a, m, d] = data.split("-");
  if (!a || !m || !d) return data;
  const dia = `${d}/${m}/${a}`;
  return hora ? `${dia} · ${hora.slice(0, 5)}` : dia;
}

/** Rótulo do estado da inscrição em palavra de gente, não o enum cru. */
function rotuloStatus(insc: MinhaInscricaoEvento, t: (s: string) => string) {
  if (insc.status === "cancelada") return { txt: t("Cancelada"), cor: "danger" as const };
  if (insc.status === "confirmada") return { txt: t("Inscrição confirmada"), cor: "success" as const };
  if (insc.status === "recebida") {
    return insc.pagamento?.status === "pago"
      ? { txt: t("Pagamento recebido · confirmando"), cor: "warn" as const }
      : { txt: t("Aguardando pagamento"), cor: "warn" as const };
  }
  return { txt: insc.status, cor: "warn" as const };
}

export default function EventoScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { membro } = useMembro();

  const [evento, setEvento] = useState<EventoAberto | null>(null);
  const [textos, setTextos] = useState<TextosInscricao | null>(null);
  const [minha, setMinha] = useState<MinhaInscricaoEvento | null>(null);
  const [carregando, setCarregando] = useState(true);

  // form
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [termos, setTermos] = useState(false);
  const [optin, setOptin] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<{ titulo: string; texto: string; pagamentoUrl?: string | null } | null>(null);
  // ⚠️ "não conseguimos carregar" ≠ "evento não existe" (06/08/2026): na PORTA
  // do evento, que é onde o sinal é pior, a segunda mensagem esconde o QR de
  // quem está inscrito.
  const [falhouCarga, setFalhouCarga] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    try {
      // As duas listas em paralelo: o catálogo (dados do evento + campos) e as
      // minhas inscrições (que decide form × minha inscrição).
      // ⚠️ `allSettled` em vez de `catch(() => vazio)`: engolir a falha fazia
      // catálogo vazio e "evento não encontrado" — indistinguível de evento que
      // realmente não existe.
      const [rCat, rMine] = await Promise.allSettled([
        buscarEventosAbertos(),
        minhasInscricoesEventos(),
      ]);
      const cat = rCat.status === "fulfilled" ? rCat.value : { eventos: [] as EventoAberto[] };
      const mine = rMine.status === "fulfilled" ? rMine.value : { inscricoes: [] as MinhaInscricaoEvento[] };
      // Só é falha de verdade quando as DUAS não vieram: com a minha inscrição
      // em mãos a tela ainda mostra o QR, que é o que importa na entrada.
      setFalhouCarga(rCat.status === "rejected" && rMine.status === "rejected");
      setEvento((cat.eventos || []).find((e) => e.id === id) ?? null);
      if ("textos" in cat && cat.textos) setTextos(cat.textos);
      const viva = (mine.inscricoes || []).find(
        (i) => i.evento.id === id && i.status !== "cancelada"
      );
      setMinha(viva ?? (mine.inscricoes || []).find((i) => i.evento.id === id) ?? null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const temCampoImagem = (evento?.campos || []).some((c) => c.tipo === "imagem");

  async function enviar() {
    if (!evento || !membro) return;
    setErro(null);
    if (!termos) {
      setErro(t("É preciso aceitar os termos para se inscrever."));
      return;
    }
    // Obrigatórios EXTRA conferidos aqui só pra evitar ida-e-volta; o servidor
    // valida de novo (e é ele que manda). Régua em lib/inscricaoPayload.ts.
    const faltando = extrasFaltando(evento.campos, extras);
    if (faltando) {
      setErro(`${t("Preencha")}: ${faltando}`);
      return;
    }
    setEnviando(true);
    try {
      // ⚠️ O corpo vem de `montarPayloadInscricao` (lib/, testado no CI): é a
      // lista que o Contrato de Inscrição exige. Montar inline aqui foi como o
      // `sexo` quase ficou de fora — e faltar campo não quebra o TypeScript,
      // quebra a inscrição da pessoa com 400.
      const r = await inscreverEmEvento(evento.id, montarPayloadInscricao(membro, extras, optin));
      trackEvento("evento_inscricao", { entity_id: evento.id, reason: r.ja_inscrito ? "ja_inscrito" : "novo" });
      // `pagamento` é BOOLEAN na resposta do servidor; o link vem do
      // `public_token` (página hospedada). Isenção integral NÃO tem pagamento.
      const pagUrl = r.pagamento && r.beneficio !== "integral" ? urlPagamentoDaResposta(r) : null;
      setSucesso({
        titulo: evento.msg_sucesso_titulo || t("Inscrição confirmada!"),
        texto:
          r.beneficio === "integral"
            ? t("Sua inscrição foi liberada pela liderança — você não precisa pagar nada.")
            : pagUrl
              ? t("Sua vaga está reservada. Conclua o pagamento para confirmar.")
              : evento.msg_sucesso_texto || t("Te esperamos lá."),
        pagamentoUrl: pagUrl,
      });
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível inscrever agora."));
    } finally {
      setEnviando(false);
    }
  }

  const cabecalho = (
    <View style={styles.topRow}>
      <Pressable
        onPress={() => subirUmNivel()}
        hitSlop={8}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t("Voltar")}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {evento?.nome || t("Evento")}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );

  if (carregando) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        {cabecalho}
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  // ⚠️ FALHA DE CARGA vem ANTES do "não encontrado": sem isto, ficar offline na
  // porta do evento aparece como "esse evento não existe" pra quem está inscrito.
  if (falhouCarga && !evento && !minha) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        {cabecalho}
        <Text style={styles.muted}>
          {t("Não conseguimos carregar este evento. Verifique sua conexão.")}
        </Text>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Button title={t("Tentar de novo")} onPress={() => carregar()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!evento && !minha) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        {cabecalho}
        <Text style={styles.muted}>
          {t("Evento não encontrado ou com inscrições encerradas.")}
        </Text>
      </SafeAreaView>
    );
  }

  const ev = evento;
  const quando = fmtData(ev?.data ?? minha?.evento.data, ev?.hora ?? minha?.evento.hora);
  const local = ev?.local ?? minha?.evento.local;
  const capa = ev?.capa_url ?? minha?.evento.capa_url;
  const prazo = fmtPrazo(ev?.inscricoes_encerram_em);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {cabecalho}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {capa ? <Image source={{ uri: capa }} style={styles.capa} resizeMode="cover" /> : null}

        <GlassCard style={styles.card}>
          <Text style={styles.nome}>{ev?.nome || minha?.evento.nome}</Text>
          {quando ? (
            <View style={styles.linha}>
              <Ionicons name="calendar-outline" size={16} color={colors.brandMid} />
              <Text style={styles.linhaTxt}>{quando}</Text>
            </View>
          ) : null}
          {local ? (
            <View style={styles.linha}>
              <Ionicons name="location-outline" size={16} color={colors.brandMid} />
              <Text style={styles.linhaTxt}>{local}</Text>
            </View>
          ) : null}
          {ev?.pago && fmtValor(ev.valor_centavos) ? (
            <View style={styles.linha}>
              <Ionicons name="pricetag-outline" size={16} color={colors.brandMid} />
              <Text style={styles.linhaTxt}>
                {fmtValor(ev.valor_centavos)}
                {ev.parcelas_max && ev.parcelas_max > 1
                  ? ` · ${t("em até")} ${ev.parcelas_max}x ${t("no cartão")}`
                  : ""}
              </Text>
            </View>
          ) : ev && !ev.pago ? (
            <View style={styles.linha}>
              <Ionicons name="pricetag-outline" size={16} color={colors.brandMid} />
              <Text style={styles.linhaTxt}>{t("Gratuito")}</Text>
            </View>
          ) : null}
          {/* Prazo e vagas: o que faz a pessoa decidir AGORA. Só aparecem quando
              o servidor tem o dado — evento sem limite de vagas não mostra linha
              (dizer "0 vagas" ou "sem prazo" seria inventar informação). */}
          {prazo ? (
            <View style={styles.linha}>
              <Ionicons name="time-outline" size={16} color={colors.brandMid} />
              <Text style={styles.linhaTxt}>
                {t("Inscrições até")} {prazo}
              </Text>
            </View>
          ) : null}
          {ev?.vagas_restantes != null ? (
            <View style={styles.linha}>
              <Ionicons name="people-outline" size={16} color={colors.brandMid} />
              <Text style={styles.linhaTxt}>
                {ev.vagas_restantes <= 0
                  ? t("Vagas esgotadas")
                  : ev.vagas_restantes === 1
                    ? t("Última vaga!")
                    : `${t("Restam")} ${ev.vagas_restantes} ${t("vagas")}`}
              </Text>
            </View>
          ) : null}
          {ev?.tem_sorteio ? (
            <View style={styles.linha}>
              <Ionicons name="gift-outline" size={16} color={colors.brandMid} />
              <Text style={styles.linhaTxt}>{t("Tem sorteio de prêmios")}</Text>
            </View>
          ) : null}
          {ev?.descricao ? <Text style={styles.desc}>{ev.descricao}</Text> : null}
          {/* Evento sem nada além do nome (cadastro incompleto no sistema) —
              melhor dizer isso que deixar um card vazio parecendo tela quebrada. */}
          {ev && !quando && !local && !ev.descricao ? (
            <Text style={styles.descFraca}>
              {t("A igreja ainda não publicou os detalhes deste evento.")}
            </Text>
          ) : null}
        </GlassCard>

        {/* ───────── JÁ INSCRITA · a inscrição dela ───────── */}
        {minha && minha.status !== "cancelada" ? (
          <MinhaInscricao insc={minha} styles={styles} colors={colors} t={t} />
        ) : sucesso ? (
          <GlassCard style={styles.card}>
            <View style={styles.selo}>
              <Ionicons name="checkmark-circle" size={26} color={colors.success} />
            </View>
            <Text style={styles.sucessoTitulo}>{sucesso.titulo}</Text>
            <Text style={styles.desc}>{sucesso.texto}</Text>
            {sucesso.pagamentoUrl ? (
              <Button
                title={t("Pagar agora")}
                onPress={() => abrirInscricaoEvento(sucesso.pagamentoUrl as string)}
              />
            ) : null}
          </GlassCard>
        ) : temCampoImagem ? (
          /* Evento que pede FOTO: o app não sobe arquivo neste formulário —
             manda pro form público, que sabe. Honesto e sem campo morto. */
          <GlassCard style={styles.card}>
            <Text style={styles.desc}>
              {t("Este evento pede o envio de uma imagem. A inscrição segue no site, em uma janela aqui dentro.")}
            </Text>
            <Button title={t("Abrir inscrição")} onPress={() => abrirInscricaoEvento(ev!.url)} />
          </GlassCard>
        ) : !membro || !podeInscrever(membro) ? (
          /* Ficha incompleta: o contrato exige CPF/nascimento/sexo e a inscrição
             seria recusada pelo servidor — melhor levar pro cadastro.
             ⚠️ O botão vai pra tela de cadastro DO APP (era `abrirInscricaoEvento`,
             que abria o formulário no NAVEGADOR — a pessoa saía do app justamente
             no passo que existe pra ela não sair). `retorno` traz ela de volta
             pra este evento, então ela completa e se inscreve sem perder o lugar. */
          <GlassCard style={styles.card}>
            <Text style={styles.desc}>
              {t("Pra se inscrever, complete seu cadastro.")}{" "}
              {t("Falta")}: {faltaNaFicha(membro).join(" · ")}.
            </Text>
            <Button
              title={t("Completar meu cadastro")}
              onPress={() => {
                trackEvento("evento_completar_cadastro", { entity_id: ev?.id || minha?.evento.id });
                router.push(
                  `/completar-cadastro?retorno=${encodeURIComponent(`/evento?id=${id}`)}`,
                );
              }}
            />
          </GlassCard>
        ) : (
          /* ───────── NÃO INSCRITA · formulário ───────── */
          <>
            <SeusDados
              nome={membro.nome}
              telefone={membro.telefone}
              email={membro.email}
              extra={membro.cpf ? `CPF ${membro.cpf}` : null}
            />

            {(ev?.campos || []).map((c) => (
              <CampoExtra
                key={c.key}
                campo={c}
                valor={extras[c.key] ?? ""}
                onChange={(v) => setExtras((s) => ({ ...s, [c.key]: v }))}
                styles={styles}
                colors={colors}
                t={t}
              />
            ))}

            <Pressable style={styles.checkRow} onPress={() => setTermos((v) => !v)}>
              <Ionicons
                name={termos ? "checkbox" : "square-outline"}
                size={22}
                color={termos ? colors.primary : colors.textMuted}
              />
              <Text style={styles.checkTxt}>
                {textos?.termos_lgpd || t("Concordo com o uso dos meus dados para esta inscrição.")}
              </Text>
            </Pressable>

            <Pressable style={styles.checkRow} onPress={() => setOptin((v) => !v)}>
              <Ionicons
                name={optin ? "checkbox" : "square-outline"}
                size={22}
                color={optin ? colors.primary : colors.textMuted}
              />
              <Text style={styles.checkTxt}>
                {textos?.aviso_optin || t("Quero receber avisos deste evento por WhatsApp.")}
              </Text>
            </Pressable>

            {erro ? <Text style={styles.erro}>{erro}</Text> : null}

            <Button
              title={ev?.pago ? t("Inscrever e pagar") : t("Confirmar inscrição")}
              onPress={enviar}
              loading={enviando}
              disabled={enviando}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Bloco "minha inscrição": estado, número da sorte, QR e pagamento. */
function MinhaInscricao({
  insc,
  styles,
  colors,
  t,
}: {
  insc: MinhaInscricaoEvento;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
  t: (s: string) => string;
}) {
  const st = rotuloStatus(insc, t);
  const corBadge =
    st.cor === "success" ? colors.success : st.cor === "danger" ? colors.danger : "#F59E0B";
  const pendente = insc.status === "recebida" && insc.pagamento?.status !== "pago";
  return (
    <>
      <GlassCard style={styles.card}>
        <View style={[styles.badge, { backgroundColor: `${corBadge}22` }]}>
          <View style={[styles.badgeDot, { backgroundColor: corBadge }]} />
          <Text style={[styles.badgeTxt, { color: corBadge }]}>{st.txt}</Text>
        </View>

        {insc.bolsa_tipo ? (
          <Text style={styles.desc}>
            {insc.bolsa_tipo === "integral"
              ? t("Sua inscrição foi liberada pela liderança — você não precisa pagar nada.")
              : t("Você tem um valor especial autorizado pela liderança.")}
          </Text>
        ) : null}

        {insc.numero_sorte ? (
          <View style={styles.sorteBox}>
            <Text style={styles.sorteLabel}>{t("Seu número da sorte")}</Text>
            <Text style={styles.sorteNum}>{insc.numero_sorte}</Text>
          </View>
        ) : null}

        {pendente && insc.pagamento?.url ? (
          <Button title={t("Pagar agora")} onPress={() => abrirInscricaoEvento(insc.pagamento!.url as string)} />
        ) : null}
      </GlassCard>

      {/* Comprovante = o MESMO QR que a portaria lê no check-in. */}
      <GlassCard style={styles.card}>
        <Text style={styles.qrTitulo}>{t("Seu comprovante")}</Text>
        <Text style={styles.desc}>
          {t("Apresente este código na entrada. Ele também abre no navegador, se preferir.")}
        </Text>
        <View style={styles.qrBox}>
          <QRCode value={insc.comprovante_url} size={168} backgroundColor="#fff" />
        </View>
        <Button
          title={t("Abrir comprovante")}
          variant="ghost"
          onPress={() => abrirInscricaoEvento(insc.comprovante_url)}
        />
      </GlassCard>

      {Object.keys(insc.respostas || {}).length ? (
        <GlassCard style={styles.card}>
          <Text style={styles.qrTitulo}>{t("Suas respostas")}</Text>
          {Object.entries(insc.respostas).map(([k, v]) => (
            <View key={k} style={styles.respRow}>
              <Text style={styles.respKey}>{k}</Text>
              <Text style={styles.respVal}>{String(v)}</Text>
            </View>
          ))}
        </GlassCard>
      ) : null}
    </>
  );
}

/** Campo extra do form-builder. Tipos que o app não sabe renderizar caem em texto. */
function CampoExtra({
  campo,
  valor,
  onChange,
  styles,
  colors,
  t,
}: {
  campo: CampoEvento;
  valor: string;
  onChange: (v: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
  t: (s: string) => string;
}) {
  const label = `${campo.label}${campo.obrigatorio ? " *" : ""}`;
  const opcoes = campo.opcoes || [];

  if ((campo.tipo === "select" || campo.tipo === "escolha") && opcoes.length) {
    return (
      <View style={styles.campoBloco}>
        <Text style={styles.campoLabel}>{label}</Text>
        <View style={styles.pills}>
          {opcoes.map((o) => {
            const sel = valor === o;
            return (
              <Pressable
                key={o}
                onPress={() => onChange(sel ? "" : o)}
                style={[styles.pill, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.pillTxt, sel && { color: "#fff" }]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (campo.tipo === "multi" && opcoes.length) {
    // Múltipla escolha vai como lista separada por ", " — é o formato que o
    // servidor grava (string) e que o ERP exibe.
    const sel = new Set(valor ? valor.split(",").map((s) => s.trim()).filter(Boolean) : []);
    return (
      <View style={styles.campoBloco}>
        <Text style={styles.campoLabel}>{label}</Text>
        <View style={styles.pills}>
          {opcoes.map((o) => {
            const on = sel.has(o);
            return (
              <Pressable
                key={o}
                onPress={() => {
                  const n = new Set(sel);
                  if (on) n.delete(o);
                  else n.add(o);
                  onChange([...n].join(", "));
                }}
                style={[styles.pill, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.pillTxt, on && { color: "#fff" }]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <Input
      label={label}
      value={valor}
      onChangeText={onChange}
      placeholder={campo.tipo === "data" ? "DD/MM/AAAA" : undefined}
      multiline={campo.tipo === "textarea"}
      keyboardType={
        campo.tipo === "numero" ? "number-pad" : campo.tipo === "email" ? "email-address" : "default"
      }
      autoCapitalize={campo.tipo === "email" ? "none" : "sentences"}
    />
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    back: { width: 24 },
    title: { flex: 1, textAlign: "center", color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    muted: { color: c.textMuted, fontSize: font.size.md, padding: spacing.lg },
    capa: { width: "100%", height: 168, borderRadius: radius.lg },
    card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg },
    nome: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    linha: { flexDirection: "row", alignItems: "center", gap: 8 },
    linhaTxt: { color: c.textMuted, fontSize: font.size.md },
    desc: { color: c.textMuted, fontSize: font.size.md, lineHeight: 21 },
    descFraca: { color: c.textMuted, fontSize: font.size.sm, lineHeight: 19, fontStyle: "italic" },
    selo: { alignSelf: "center" },
    sucessoTitulo: { color: c.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
    },
    badgeDot: { width: 8, height: 8, borderRadius: 4 },
    badgeTxt: { fontSize: 13, fontWeight: "800" },
    sorteBox: { alignItems: "center", gap: 2, paddingVertical: spacing.sm },
    sorteLabel: { color: c.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
    sorteNum: { color: c.primary, fontSize: 40, fontWeight: "900" },
    qrTitulo: { color: c.text, fontSize: font.size.md, fontWeight: "800" },
    qrBox: { alignSelf: "center", padding: spacing.md, backgroundColor: "#fff", borderRadius: radius.lg },
    respRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
    respKey: { color: c.textMuted, fontSize: 13, flex: 1 },
    respVal: { color: c.text, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
    campoBloco: { gap: 6 },
    campoLabel: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    pillTxt: { color: c.text, fontSize: 13, fontWeight: "600" },
    checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    checkTxt: { color: c.textMuted, fontSize: 13, flex: 1, lineHeight: 19 },
    erro: { color: c.danger, fontSize: font.size.sm },
  });
