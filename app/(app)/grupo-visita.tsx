import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CalendarioBR } from "@/components/ui/CalendarioBR";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { acaoAoFechar } from "@/lib/descartarRascunho";
import {
  getGrupoRoster, getEncontrosGrupo, registrarEncontroGrupo, getEncontroDetalhe,
  listarVisitasGrupo, registrarVisitaGrupo,
  type GrupoRoster, type GrupoEncontro, type VisitaSupervisao,
  type GrupoEncontroDetalhe,
} from "@/lib/api";
import { montarRegistroVisita } from "@/lib/visitaSupervisao";
import { subirUmNivel } from "@/lib/hierarquia";
import { ehSupervisao } from "@/lib/papelGrupo";
import { hojeBRT } from "@/lib/dataBRT";
import { trackEvento } from "@/lib/telemetria";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

/**
 * ⚠️⚠️ TELA DO SUPERVISOR (07/08/2026 · pedido do Marcos).
 *
 * *"podemos deixar uma tela apenas para Registrar Frequência e comentários
 * sobre aquele grupo… o supervisor não precisa ver estudos, pedidos de
 * aprovação. No máximo Pessoas, Frequência e comentários."*
 *
 * É ROTA PRÓPRIA, não aba condicional em `grupo-membros.tsx` (1.070 linhas, 5
 * modais, escrita diferente): a chamada aqui grava DUAS coisas — a frequência,
 * que é do GRUPO e vai pro líder, e a VISITA, que é do supervisor.
 *
 * ⚠️ Quem decide que esta é a tela certa é o SERVIDOR (`meu_papel`), e a tela
 * RE-CONFERE ao carregar: deep link de quem lidera cai na tela completa.
 *
 * ⚠️⚠️ NÃO PROMETER PRIVACIDADE NO COMENTÁRIO. A premissa "comentários apenas
 * para o supervisor" NÃO se sustenta no schema: `grupo_supervisao_visitas` tem
 * policy de SELECT `USING(true)` pra qualquer autenticado e a observação já é
 * exibida no histórico da aba Visitas do /grupos. A tela diz a verdade — vai
 * pro registro de supervisão, que a coordenação lê.
 */

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// ⚠️ O roster devolve o ENUM cru do banco (`co_lider`, `lider_treinamento`,
// `visitante`). Sem mapa, o supervisor lia "co_lider · 12 presenças".
const FUNCAO: Record<string, string> = {
  lider: "Líder",
  co_lider: "Co-líder",
  lider_treinamento: "Em treinamento",
  frequentador: "Frequentador",
  visitante: "Visitante",
  supervisor: "Supervisor",
  coordenador: "Coordenador",
};
const rotuloFuncao = (f: string) => FUNCAO[f] || f;

function fmtIso(iso: string) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
function isoParaBR(iso: string) {
  return fmtIso(iso);
}
function brParaISO(br: string) {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export default function GrupoVisitaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const grupoId = String(id || "");

  const [aba, setAba] = useState<"pessoas" | "encontros">("encontros");
  const [roster, setRoster] = useState<GrupoRoster | null>(null);
  const [encontros, setEncontros] = useState<GrupoEncontro[] | null>(null);
  const [visitas, setVisitas] = useState<VisitaSupervisao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário de registro
  const [aberto, setAberto] = useState(false);
  const [dataBR, setDataBR] = useState(isoParaBR(hojeBRT()));
  const [calendario, setCalendario] = useState(false);
  // Detalhe do encontro aberto (pedido do Marcos: "um quadradinho clicável… aí
  // vejo os comentários e a presença em um lugar só").
  const [detalhe, setDetalhe] = useState<GrupoEncontroDetalhe | null>(null);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [ausentes, setAusentes] = useState<Set<string>>(new Set());
  const [tema, setTema] = useState("");
  // ⚠️ LIGADO por padrão: o caso comum é o supervisor estar no encontro. Foi
  // essa a decisão do Marcos ao aprovar o interruptor.
  const [presente, setPresente] = useState(true);
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!grupoId) return;
    try {
      const [r, e, v] = await Promise.all([
        getGrupoRoster(grupoId),
        // ⚠️ `null` = NÃO CARREGOU · `[]` = não existe. Colapsar os dois em `[]`
        // fazia o herói afirmar "Ainda não registrada" numa falha de rede — e o
        // supervisor iria visitar de novo achando que nunca tinha registrado.
        getEncontrosGrupo(grupoId).catch(() => null),
        listarVisitasGrupo(grupoId).catch(() => null),
      ]);
      // ⚠️ RE-CONFERE o papel com o SERVIDOR. Quem lidera não fica preso na
      // versão enxuta por causa de um link antigo ou de um push.
      if (r.meu_papel && !ehSupervisao(r.meu_papel)) {
        router.replace({ pathname: "/grupo-membros", params: { id: grupoId, nome: r.grupo.nome } } as any);
        return;
      }
      setRoster(r);
      setEncontros(e ? e.encontros || [] : null);
      setVisitas(v ? v.visitas || [] : null);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não conseguimos carregar o grupo."));
    }
  }, [grupoId, t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const membrosAtivos = roster?.membros || [];
  const presentes = useMemo(
    () => membrosAtivos.filter((m) => m.membro_id && !ausentes.has(m.membro_id)),
    [membrosAtivos, ausentes],
  );

  // Visita MINHA daquele dia — é o que junta os dois registros num lugar só.
  const visitaDoDia = useCallback(
    (dataISO: string) => (visitas || []).find((v) => v.data_visita === dataISO) || null,
    [visitas],
  );

  async function abrirEncontro(e: GrupoEncontro) {
    setDetalhe(null);
    setDetalheErro(null);
    setCarregandoDetalhe(true);
    try {
      const r = await getEncontroDetalhe(grupoId, e.id);
      setDetalhe(r.encontro);
    } catch (err) {
      // Sem detalhe, mostramos o que a LISTA já tinha — melhor que modal vazio.
      setDetalhe({ ...e, presentes: [] });
      setDetalheErro(t("Não conseguimos carregar quem esteve presente."));
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  /**
   * ⚠️ Só pergunta quando há trabalho a perder (`lib/descartarRascunho.ts`).
   *
   * Aqui o sinal é o INVERSO da chamada do líder: o formulário abre com
   * `ausentes` VAZIO (todo mundo presente por padrão), então "mexeu" é ter
   * marcado alguém como ausente — enquanto na tela do líder é ter DESMARCADO.
   * Mesma régua, sinais opostos; por isso quem decide é o chamador, e a função
   * pura só recebe `mudouAlgo`.
   *
   * ⚠️ `presente` (o interruptor "estive no encontro") NÃO entra: ele nasce
   * `true` e desligá-lo é uma escolha de 1 toque, refeita em 1 toque.
   */
  function fecharRegistro() {
    const acao = acaoAoFechar({
      campos: [tema, comentario],
      mudouAlgo: ausentes.size > 0,
      salvando,
    });
    if (acao === "aguardar") return;
    if (acao === "fechar") { setAberto(false); return; }
    Alert.alert(
      t("Descartar o registro?"),
      t("O que você preencheu ainda não foi salvo."),
      [
        { text: t("Continuar preenchendo"), style: "cancel" },
        { text: t("Descartar"), style: "destructive", onPress: () => setAberto(false) },
      ],
    );
  }

  function abrirForm() {
    setDataBR(isoParaBR(hojeBRT()));
    setAusentes(new Set());
    setTema("");
    setPresente(true);
    setComentario("");
    setErroForm(null);
    setAberto(true);
  }

  function alternar(membroId: string) {
    setAusentes((s) => {
      const n = new Set(s);
      if (n.has(membroId)) n.delete(membroId);
      else n.add(membroId);
      return n;
    });
  }

  async function salvar() {
    setErroForm(null);
    const dataISO = brParaISO(dataBR);
    const plano = montarRegistroVisita({
      data: dataISO || "",
      presente,
      comentario,
      hoje: hojeBRT(),
    });
    if ("erro" in plano) {
      setErroForm(
        plano.erro === "data_futura"
          ? t("Não dá pra registrar um encontro que ainda não aconteceu.")
          : t("Escolha a data do encontro."),
      );
      return;
    }

    setSalvando(true);
    let avisoFrequencia: string | null = null;
    try {
      // 1) FREQUÊNCIA — é do grupo e vai pro líder, aconteça o que acontecer
      //    com a visita. Por isso vem primeiro.
      try {
        await registrarEncontroGrupo(grupoId, {
          data: dataISO!,
          tema: tema.trim() || undefined,
          presentes: presentes.map((m) => m.membro_id!).filter(Boolean),
        });
      } catch (e) {
        const st = (e as { status?: number })?.status;
        // 409 = o líder já registrou este dia. Não é erro: a frequência do
        // grupo é UMA só. A visita do supervisor segue valendo.
        if (st === 409) {
          // ⚠️ NEUTRO: o 409 vem da UNIQUE (grupo, data) e NÃO diz quem registrou —
          // pode ter sido o líder, o próprio supervisor mais cedo, ou um
          // encontro apagado que ainda ocupa a data. Afirmar "o líder" seria a
          // tela inventando autoria.
          avisoFrequencia = t("Já existe frequência registrada para este dia — mantivemos a que está lá.");
        } else {
          throw e;
        }
      }

      // 2) VISITA — só quando ele esteve presente. É isso que dá efeito real ao
      //    interruptor (ver lib/visitaSupervisao.ts).
      if (plano.gravar) {
        // ⚠️ São DOIS POSTs. Se a frequência gravou e a visita falha, dizer
        // "não conseguimos salvar" faria a pessoa tentar tudo de novo — e a
        // frequência voltaria 409. Aqui a mensagem diz o que JÁ foi gravado.
        // (O servidor é idempotente por grupo+pessoa+dia, então repetir a
        // visita não duplica.)
        try {
          await registrarVisitaGrupo(grupoId, plano.corpo);
        } catch (e) {
          setAberto(false);
          await carregar();
          setErro(t("A frequência foi registrada, mas não conseguimos registrar sua visita. Toque em Registrar de novo."));
          return;
        }
      }

      trackEvento("grupo_visita_registrada", { entity_id: grupoId, label: plano.gravar ? "presente" : "ausente" });
      setAberto(false);
      await carregar();
      if (avisoFrequencia) setErro(avisoFrequencia);
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : t("Não conseguimos salvar."));
    } finally {
      setSalvando(false);
    }
  }

  const g = roster?.grupo;
  const ultimaVisita = visitas && visitas.length > 0 ? visitas[0] : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ⚠️ Esta NÃO é tela de barra (não está em `TELAS_BARRA` do layout), então
          a TopBar global não monta aqui: a seta e o inset de topo são desta
          tela, como nas 5 irmãs de grupo. Sem `edges:["top"]` o título
          renderiza POR BAIXO do notch. */}
      <View style={styles.cabecalho}>
        <View style={styles.tituloLinha}>
          <Pressable
            onPress={() => subirUmNivel()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("Voltar")}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.titulo} numberOfLines={1}>{g?.nome || nome || t("Grupo")}</Text>
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {t("Você supervisiona este grupo")}
          {g?.dia_semana != null && DIAS[g.dia_semana] ? ` · ${t(DIAS[g.dia_semana])}` : ""}
          {g?.local ? ` · ${g.local}` : ""}
        </Text>
      </View>

      {/* HERÓI: a última visita é o que o supervisor precisa saber ao abrir. */}
      <View style={styles.heroi}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroiLabel}>{t("Sua última visita")}</Text>
          <Text style={styles.heroiValor}>
            {visitas === null
              ? t("Não carregou")
              : ultimaVisita ? fmtIso(ultimaVisita.data_visita) : t("Ainda não registrada")}
          </Text>
        </View>
        <Button title={t("Registrar")} onPress={abrirForm} />
      </View>

      <View style={styles.abas}>
        {(["encontros", "pessoas"] as const).map((k) => {
          const sel = aba === k;
          return (
            <Pressable
              key={k}
              onPress={() => setAba(k)}
              style={[styles.aba, sel && styles.abaSel]}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
            >
              <Text style={[styles.abaTxt, sel && styles.abaTxtSel]}>
                {k === "encontros" ? t("Encontros") : t("Pessoas")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.conteudo}>
        {erro ? (
          <View style={styles.avisoBox}>
            <Text style={styles.avisoTxt}>{erro}</Text>
            <Pressable onPress={carregar} hitSlop={6}>
              <Text style={styles.link}>{t("Tentar de novo")}</Text>
            </Pressable>
          </View>
        ) : null}

        {roster === null && !erro ? (
          <ActivityIndicator color={colors.brandMid} style={{ marginTop: spacing.xl }} />
        ) : roster === null ? null : aba === "encontros" ? (
          <>
            {encontros === null ? (
              <Text style={styles.vazio}>{t("Não conseguimos carregar os encontros.")}</Text>
            ) : encontros.length === 0 && (visitas || []).length === 0 ? (
              <Text style={styles.vazio}>{t("Nenhum encontro registrado ainda.")}</Text>
            ) : (
              <>
                {encontros.map((e) => {
                  const v = visitaDoDia(e.data);
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => abrirEncontro(e)}
                      style={({ pressed }) => [styles.linha, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("Abrir encontro de")} ${fmtIso(e.data)}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.linhaTitulo}>{fmtIso(e.data)}</Text>
                        <Text style={styles.linhaSub}>
                          {e.presentes} {e.presentes === 1 ? t("presente") : t("presentes")}
                          {e.tema ? ` · ${e.tema}` : ""}
                        </Text>
                        {/* Selo do que ESTE supervisor fez naquele dia — é o que
                            substitui a seção "Suas visitas" que existia à parte. */}
                        {v ? (
                          <View style={styles.selo}>
                            <Ionicons name="shield-checkmark" size={12} color={colors.brandMid} />
                            <Text style={styles.seloTxt}>{t("Você visitou")}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  );
                })}

                {/* ⚠️ Visita SEM encontro na mesma data não pode sumir: ela existe
                    quando o encontro daquele dia foi apagado depois (a UNIQUE de
                    data não é parcial, então ele some da lista e a visita fica).
                    Perder o comentário em silêncio seria o pior desfecho. */}
                {(visitas || [])
                  .filter((v) => !(encontros || []).some((e) => e.data === v.data_visita))
                  .map((v) => (
                    <View key={v.id} style={styles.linha}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.linhaTitulo}>{fmtIso(v.data_visita)}</Text>
                        <Text style={styles.linhaSub}>
                          {t("Visita registrada (sem frequência neste dia)")}
                        </Text>
                        {v.observacao ? <Text style={styles.linhaSub}>{v.observacao}</Text> : null}
                      </View>
                    </View>
                  ))}
              </>
            )}
          </>
        ) : (
          <>
            {/* ⚠️ SÓ LEITURA. Mudar função, tirar do grupo e transferir são atos
                de quem lidera (ou da coordenação) — o supervisor acompanha. */}
            {membrosAtivos.length === 0 ? (
              <Text style={styles.vazio}>{t("Este grupo ainda não tem ninguém no roster.")}</Text>
            ) : (
              membrosAtivos.map((m) => (
                <View key={m.id} style={styles.linha}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linhaTitulo}>{m.nome}</Text>
                    <Text style={styles.linhaSub}>
                      {m.funcao && m.funcao !== "frequentador" ? `${t(rotuloFuncao(m.funcao))} · ` : ""}
                      {m.presencas || 0} {(m.presencas || 0) === 1 ? t("presença") : t("presenças")}
                    </Text>
                  </View>
                  {m.telefone ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        const tel = String(m.telefone).replace(/\D/g, "");
                        Linking.openURL(`https://wa.me/${tel.startsWith("55") ? tel : `55${tel}`}`);
                      }}
                      accessibilityLabel={`${t("Falar com")} ${m.nome}`}
                    >
                      <Ionicons name="logo-whatsapp" size={20} color={colors.brandMid} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ── Registro: chamada + comentário + o interruptor ─────────────────── */}
      {/* ⚠️⚠️ AS TRÊS SAÍDAS PASSAM PELA MESMA DECISÃO (10/08 · item 15): o X,
          o botão VOLTAR do Android (`onRequestClose`) e o "Cancelar". Consertar
          só uma delas deixaria o mesmo estrago vivo pelas outras duas — e a que
          o Marcos encontrou foi justamente a menos óbvia (o voltar). */}
      <Modal visible={aberto} transparent animationType="fade" onRequestClose={fecharRegistro} statusBarTranslucent>
        <TecladoSeguro style={styles.modalFundo}>
          {/* ⚠️⚠️ O calendário fica DENTRO desta janela (13/08/2026): como
              <Modal> irmão ele nascia ATRÁS deste no iPhone e o toque em
              "Data do encontro" não abria nada — o mesmo defeito medido no
              modal de bloquear datas do voluntariado. */}
          {calendario ? (
            <CalendarioBR
              embutido
              visivel
              titulo={t("Data do encontro")}
              valor={dataBR}
              hojeISO={hojeBRT()}
              onFechar={() => setCalendario(false)}
              onEscolher={(d) => { setDataBR(d); setErroForm(null); setCalendario(false); }}
            />
          ) : (
          <View style={styles.modalCartao}>
            <View style={styles.modalTopo}>
              <Text style={styles.titulo}>{t("Registrar encontro")}</Text>
              <Pressable onPress={fecharRegistro} hitSlop={10} accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
              <View style={{ gap: spacing.xs }}>
                <Text style={styles.campoLabel}>{t("Data do encontro")}</Text>
                <Pressable
                  onPress={() => setCalendario(true)}
                  style={({ pressed }) => [styles.campoData, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.campoValor}>{dataBR}</Text>
                  <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* ⚠️ Roster VAZIO tem que ser dito. No teste de 07/08 o grupo
                  "teste 2" não tinha ninguém e o bloco aparecia como
                  "Quem esteve presente — 0/0" com uma lista em branco, que se
                  lê como tela quebrada. A visita é registrada do mesmo jeito —
                  ela é do supervisor, não depende de haver roster. */}
              <Text style={styles.campoLabel}>
                {t("Quem esteve presente")}
                {membrosAtivos.length > 0 ? ` — ${presentes.length}/${membrosAtivos.length}` : ""}
              </Text>
              {membrosAtivos.length === 0 ? (
                <Text style={styles.dica}>
                  {t("Este grupo ainda não tem ninguém cadastrado no roster, então não há chamada a fazer. Sua visita é registrada normalmente.")}
                </Text>
              ) : (
                <Text style={styles.dica}>{t("Todos começam marcados. Desmarque quem faltou.")}</Text>
              )}
              {membrosAtivos.map((m) => {
                const marcado = !!m.membro_id && !ausentes.has(m.membro_id);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => m.membro_id && alternar(m.membro_id)}
                    style={styles.chamadaLinha}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marcado }}
                  >
                    <Ionicons
                      name={marcado ? "checkbox" : "square-outline"}
                      size={22}
                      color={marcado ? colors.primary : colors.textMuted}
                    />
                    <Text style={styles.chamadaNome}>{m.nome}</Text>
                  </Pressable>
                );
              })}

              <Input
                label={t("Tema do encontro (opcional)")}
                value={tema}
                onChangeText={setTema}
                placeholder={t("Sobre o que falaram")}
              />

              <View style={styles.switchLinha}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitulo}>{t("Estive presente no encontro")}</Text>
                  <Text style={styles.dica}>
                    {presente
                      ? t("Vamos registrar uma visita de supervisão nesta data.")
                      : t("A frequência vai para o líder normalmente, mas nenhuma visita será contada.")}
                  </Text>
                </View>
                <Switch
                  value={presente}
                  onValueChange={setPresente}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>

              {presente ? (
                <>
                  <Input
                    label={t("Comentário da visita (opcional)")}
                    value={comentario}
                    onChangeText={setComentario}
                    placeholder={t("Como o grupo está indo")}
                    multiline
                  />
                  {/* ⚠️ Verdade sobre quem lê: a policy de SELECT é aberta e o
                      /grupos já mostra a observação. Não prometer sigilo. */}
                  <Text style={styles.dica}>
                    {t("Fica no registro de supervisão do grupo — a coordenação lê.")}
                  </Text>
                </>
              ) : null}

              {!!erroForm && <Text style={styles.erro}>{erroForm}</Text>}
            </ScrollView>

            <View style={styles.botoes}>
              <Button title={t("Cancelar")} variant="ghost" onPress={fecharRegistro} />
              <Button title={t("Salvar")} onPress={salvar} loading={salvando} />
            </View>
          </View>
          )}
        </TecladoSeguro>
      </Modal>

      {/* ── Encontro ABERTO: presença + os DOIS comentários num lugar só ────
          Pedido do Marcos (07/08): "não separaria os encontros de Suas visitas;
          faz um quadradinho clicável do encontro, aí quando eu clico vejo os
          comentários e a presença em um lugar só". */}
      <Modal
        visible={!!detalhe || carregandoDetalhe}
        transparent
        animationType="fade"
        onRequestClose={() => { setDetalhe(null); setDetalheErro(null); }}
        statusBarTranslucent
      >
        <Pressable style={styles.modalFundo} onPress={() => { setDetalhe(null); setDetalheErro(null); }}>
          <Pressable style={styles.modalCartao} onPress={() => {}}>
            {carregandoDetalhe && !detalhe ? (
              <ActivityIndicator color={colors.brandMid} style={{ paddingVertical: spacing.xl }} />
            ) : detalhe ? (
              <>
                <View style={styles.modalTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.titulo}>{fmtIso(detalhe.data)}</Text>
                    {detalhe.tema ? <Text style={styles.sub}>{detalhe.tema}</Text> : null}
                  </View>
                  <Pressable
                    onPress={() => { setDetalhe(null); setDetalheErro(null); }}
                    hitSlop={10}
                    accessibilityLabel={t("Fechar")}
                  >
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustKeyboardInsets
                  contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}>
                  <View style={{ gap: spacing.xs }}>
                    <Text style={styles.secaoTitulo}>
                      {t("Presença")} — {detalhe.presentes.length}
                    </Text>
                    {detalheErro ? (
                      <Text style={styles.dica}>{detalheErro}</Text>
                    ) : detalhe.presentes.length === 0 ? (
                      <Text style={styles.dica}>
                        {t("Ninguém foi marcado como presente neste encontro.")}
                      </Text>
                    ) : (
                      detalhe.presentes.map((pp) => (
                        <View key={pp.membro_id || pp.nome} style={styles.presencaLinha}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          <Text style={styles.presencaNome}>{pp.nome}</Text>
                        </View>
                      ))
                    )}
                    {/* ⚠️ Não listamos AUSENTES: o banco não guarda quem faltou
                        (só quem esteve), e deduzir do roster de hoje afirmaria
                        ausência de quem talvez nem estivesse no grupo na época. */}
                  </View>

                  {detalhe.observacoes ? (
                    <View style={{ gap: spacing.xs }}>
                      <Text style={styles.secaoTitulo}>{t("Comentário do encontro")}</Text>
                      <Text style={styles.comentario}>{detalhe.observacoes}</Text>
                    </View>
                  ) : null}

                  {(() => {
                    const v = visitaDoDia(detalhe.data);
                    if (!v) return null;
                    return (
                      <View style={{ gap: spacing.xs }}>
                        <Text style={styles.secaoTitulo}>{t("Sua visita")}</Text>
                        {v.observacao ? (
                          <Text style={styles.comentario}>{v.observacao}</Text>
                        ) : (
                          <Text style={styles.dica}>{t("Visita registrada, sem comentário.")}</Text>
                        )}
                      </View>
                    );
                  })()}

                  {detalhe.registrado_por_nome ? (
                    <Text style={styles.linhaAutor}>
                      {t("Registrado por")}: {detalhe.registrado_por_nome}
                    </Text>
                  ) : null}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    cabecalho: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    tituloLinha: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    titulo: { flex: 1, color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    sub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
    heroi: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      margin: spacing.lg,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    heroiLabel: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    heroiValor: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", marginTop: 2 },
    abas: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
    aba: { paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: "transparent" },
    abaSel: { borderBottomColor: colors.primary },
    abaTxt: { color: colors.textMuted, fontSize: font.size.md, fontWeight: "700" },
    abaTxtSel: { color: colors.text },
    conteudo: { padding: spacing.lg, paddingBottom: 40, gap: spacing.xs },
    secaoTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    vazio: { color: colors.textMuted, fontSize: font.size.sm, paddingVertical: spacing.lg, textAlign: "center" },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    linhaTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    linhaSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
    linhaAutor: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontStyle: "italic" },
    avisoBox: {
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    avisoTxt: { color: colors.text, fontSize: font.size.sm },
    link: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
    modalFundo: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    modalCartao: {
      width: "100%",
      maxWidth: 460,
      maxHeight: "88%",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.md,
    },
    modalTopo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    campoLabel: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    campoData: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: 52,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    campoValor: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    dica: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
    chamadaLinha: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8 },
    chamadaNome: { color: colors.text, fontSize: font.size.md, flex: 1 },
    switchLinha: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.glassBorder,
      marginTop: spacing.xs,
    },
    switchTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    botoes: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    erro: { color: colors.danger, fontSize: font.size.sm },
    selo: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    seloTxt: { color: colors.brandMid, fontSize: 12, fontWeight: "700" },
    presencaLinha: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 3 },
    presencaNome: { color: colors.text, fontSize: font.size.md },
    comentario: { color: colors.text, fontSize: font.size.md, lineHeight: 22 },
  });
