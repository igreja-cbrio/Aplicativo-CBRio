// ⚠️ PESSOAS DO SERVIR · só pra ADMIN (24/09/2026 · pedido do Marcos)
//
// "para as pessoas que forem admin, uma opção na aba de servir de buscar as
// pessoas que tem no app, clicar no perfil, vincular ele em um time, selecionar
// quais cultos ele vai servir naquele time para aparecer na seleção".
//
// É a parte "gerencia pessoas e estruturas" do papel admin, que antes só a web
// fazia. Mesmas tabelas e leis do servidor (`/app/voluntariado/admin/*`):
//   · "em quais cultos serve" é por (PESSOA, TIME) — marcar todos = qualquer culto;
//   · tirar do time é reversível (is_active=false), por isso confirma e não avisa duas vezes;
//   · a preferência de domingo é da pessoa, não do time.
// A porta (card na aba Servir) aparece com `gere_pessoas` (admin OU líder de time/área
// sem recorte · 24/09). O LÍDER vê e mexe só nos times que lidera; a trava é o servidor (403).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useT } from "@/lib/i18n";
import { fundoDaFolha } from "@/lib/folha";
import { useDialogo } from "@/components/ui/Dialogo";
import {
  buscarPessoasServir, getPessoaServir, vincularAoTime, atualizarVinculo, tirarDoTime, salvarRodizioDe,
  type AdminPessoa, type AdminPessoaDetalhe, type AdminVinculo,
} from "@/lib/api";

function iniciais(nome: string): string {
  return (nome || "").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

const SEMANAS = [1, 2, 3, 4] as const;

export default function ServirPessoasScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dlg = useDialogo();

  // ── Busca ──
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<AdminPessoa[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscaErro, setBuscaErro] = useState(false);
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscaSeq = useRef(0);
  function onBusca(q: string) {
    setBusca(q); setBuscaErro(false);
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    if (q.trim().length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    const seq = ++buscaSeq.current;
    buscaTimer.current = setTimeout(async () => {
      try {
        const r = await buscarPessoasServir(q.trim());
        if (seq === buscaSeq.current) { setResultados(r); setBuscaErro(false); }
      } catch {
        if (seq === buscaSeq.current) { setResultados([]); setBuscaErro(true); }
      } finally {
        if (seq === buscaSeq.current) setBuscando(false);
      }
    }, 300);
  }

  // ── Ficha (modal) ──
  const [aberta, setAberta] = useState<AdminPessoa | null>(null);
  const [det, setDet] = useState<AdminPessoaDetalhe | null>(null);
  const [detErro, setDetErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);   // chave da ação em andamento
  const [timeNovo, setTimeNovo] = useState<string>("");          // time escolhido pra vincular
  const [funcaoNova, setFuncaoNova] = useState<string>("");

  const carregarDet = useCallback(async (id: string) => {
    setDet(null); setDetErro(null);
    try { setDet(await getPessoaServir(id)); }
    catch (e: any) { setDetErro(e?.message || t("Erro ao carregar a pessoa")); }
  }, [t]);

  function abrir(p: AdminPessoa) {
    setAberta(p); setTimeNovo(""); setFuncaoNova("");
    void carregarDet(p.id);
  }
  function fechar() { setAberta(null); setDet(null); }

  // Reflete na lista da busca o que mudou na ficha (times), sem nova busca.
  useEffect(() => {
    if (!det || !aberta) return;
    const nomes = [...new Set(det.vinculos.map(v => v.team_name).filter(Boolean))] as string[];
    setResultados(prev => prev.map(p => p.id === aberta.id ? { ...p, times: nomes.sort(), rodizio_semana: det.pessoa.rodizio_semana } : p));
  }, [det, aberta]);

  // Vínculos agrupados por time: o time é o card; as funções são linhas dentro.
  const porTime = useMemo(() => {
    const m = new Map<string, { team_id: string; nome: string; linhas: AdminVinculo[]; tipos: string[] | null }>();
    for (const v of det?.vinculos ?? []) {
      const g = m.get(v.team_id) ?? { team_id: v.team_id, nome: v.team_name || t("Sem nome"), linhas: [], tipos: v.service_type_ids };
      g.linhas.push(v);
      m.set(v.team_id, g);
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [det, t]);

  async function agir(chave: string, fn: () => void | Promise<void>, erroPadrao: string) {
    if (ocupado) return;
    setOcupado(chave);
    try { await fn(); if (aberta) await carregarDet(aberta.id); }
    catch (e: any) { void dlg.avisar(t("Erro"), e?.message || erroPadrao); }
    finally { setOcupado(null); }
  }

  function alternarCulto(grupo: { linhas: AdminVinculo[]; tipos: string[] | null }, tipoId: string) {
    const todos = (det?.tipos ?? []).map(x => x.id);
    const atual = grupo.tipos ?? todos;                       // null = serve em todos
    const novo = atual.includes(tipoId) ? atual.filter(x => x !== tipoId) : [...atual, tipoId];
    // ⚠️ Desmarcar o ÚLTIMO voltaria a NULL no servidor (= todos) — o oposto do
    // que a pessoa quis. A tela não deixa: avisa e mantém.
    if (novo.length === 0) { void dlg.avisar(t("Pelo menos um culto"), t("Pra tirar a pessoa do time, use o × ao lado da função.")); return; }
    void agir(`tipo:${grupo.linhas[0].id}:${tipoId}`, () => atualizarVinculo(grupo.linhas[0].id, { service_type_ids: novo }).then(() => {}), t("Erro ao salvar os cultos"));
  }

  async function tirar(v: AdminVinculo) {
    const ok = await dlg.confirmar({
      titulo: t("Tirar do time"),
      mensagem: `${t("Tirar")} ${aberta?.full_name ?? ""} ${t("de")} ${v.team_name ?? ""}${v.position_name ? ` (${v.position_name})` : ""}?`,
      acao: t("Tirar"),
      perigo: true,
    });
    if (!ok) return;
    void agir(`tirar:${v.id}`, () => tirarDoTime(v.id).then(() => {}), t("Erro ao tirar do time"));
  }

  function vincular() {
    if (!aberta || !timeNovo) return;
    void agir("vincular", async () => {
      await vincularAoTime({ volunteer_profile_id: aberta.id, team_id: timeNovo, position_id: funcaoNova || undefined });
      setTimeNovo(""); setFuncaoNova("");
    }, t("Erro ao vincular ao time"));
  }

  function mudarSemana(n: number | null) {
    if (!aberta || !det || det.pessoa.rodizio_semana === n || det.pode_rodizio === false) return;
    void agir(`semana:${n ?? "x"}`, () => salvarRodizioDe(aberta.id, n).then(() => {}), t("Erro ao salvar a preferência"));
  }

  const timeEscolhido = det?.times.find(x => x.id === timeNovo);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("Pessoas do Servir")}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.md }}>
        <Text style={styles.muted}>{t("Busque alguém pra ver os times dela nos times que você lidera, vincular e dizer em quais cultos ela serve.")}</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder={t("Buscar pessoa pelo nome…")} placeholderTextColor={colors.textMuted}
            value={busca} onChangeText={onBusca} autoFocus autoCorrect={false} />
          {buscando && <ActivityIndicator color={colors.primary} />}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        {busca.trim().length < 2 ? (
          <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>{t("Digite ao menos 2 letras do nome.")}</Text>
        ) : buscaErro ? (
          <Pressable style={{ padding: spacing.md, alignItems: "center" }} onPress={() => onBusca(busca)} accessibilityRole="button">
            <Text style={[styles.muted, { textAlign: "center" }]}>{t("Falha ao buscar. Toque pra tentar de novo.")}</Text>
          </Pressable>
        ) : (!buscando && resultados.length === 0) ? (
          <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>{t("Nenhuma pessoa encontrada.")}</Text>
        ) : resultados.map(p => (
          <Pressable key={p.id} style={styles.linha} onPress={() => abrir(p)} accessibilityRole="button" accessibilityLabel={`${t("Abrir")} ${p.full_name}`}>
            {p.avatar_url ? (
              <Image source={{ uri: p.avatar_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[styles.avatarTxt, { color: colors.primary }]}>{iniciais(p.full_name)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.pessoaNome} numberOfLines={1}>{p.full_name}</Text>
              <Text style={[styles.pequeno, { color: colors.textMuted }]} numberOfLines={1}>
                {p.times.length ? p.times.join(" · ") : t("Sem time")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>

      {/* Ficha da pessoa */}
      <Modal visible={!!aberta} animationType="slide" transparent statusBarTranslucent onRequestClose={fechar}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoDaFolha(insets.bottom), maxHeight: "92%" }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{aberta?.full_name}</Text>
              <Pressable onPress={fechar} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {!det && !detErro ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : detErro ? (
              <Pressable style={styles.center} onPress={() => aberta && carregarDet(aberta.id)} accessibilityRole="button">
                <Text style={[styles.muted, { textAlign: "center" }]}>{detErro}</Text>
                <Text style={[styles.pequeno, { color: colors.primary, marginTop: 8 }]}>{t("Tentar de novo")}</Text>
              </Pressable>
            ) : det && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {det.pessoa.telefone ? <Text style={[styles.pequeno, { color: colors.textMuted }]}>{det.pessoa.telefone}</Text> : null}

                {/* Domingo de preferência */}
                <Text style={styles.secao}>{t("Domingo de preferência")}</Text>
                {det.pode_rodizio === false && (
                  <Text style={[styles.muted, { marginBottom: 6 }]}>{t("Vincule a pessoa a um time seu pra poder ajustar o domingo dela.")}</Text>
                )}
                <View style={[styles.chips, det.pode_rodizio === false && { opacity: 0.45 }]} pointerEvents={det.pode_rodizio === false ? "none" : "auto"}>
                  <Pressable onPress={() => mudarSemana(null)} accessibilityRole="button" accessibilityState={{ selected: det.pessoa.rodizio_semana === null }}
                    style={[styles.chip, det.pessoa.rodizio_semana === null && styles.chipAtivo]}>
                    <Text style={[styles.chipTxt, det.pessoa.rodizio_semana === null && styles.chipTxtAtivo]}>{t("Nenhum")}</Text>
                  </Pressable>
                  {SEMANAS.map(n => {
                    const ativo = det.pessoa.rodizio_semana === n;
                    return (
                      <Pressable key={n} onPress={() => mudarSemana(n)} accessibilityRole="button" accessibilityState={{ selected: ativo }} accessibilityLabel={`${n}º ${t("domingo")}`}
                        style={[styles.chip, ativo && styles.chipAtivo]}>
                        <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>{n}º</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Times atuais */}
                <Text style={styles.secao}>{t("Times")}</Text>
                {porTime.length === 0 && (
                  <Text style={styles.muted}>{det.escopo === "lider" ? t("Ainda não está em nenhum time seu.") : t("Ainda não está em nenhum time.")}</Text>
                )}
                {/* Recorte do LÍDER: os outros times dela ficam escondidos, mas DITOS —
                    sumir em silêncio pareceria "ela não serve em mais nada". */}
                {(det.vinculos_fora ?? 0) > 0 && (
                  <Text style={[styles.pequeno, { color: colors.textMuted, marginBottom: 6 }]}>
                    {(det.vinculos_fora === 1 ? t("Serve também em 1 função de outro time, que você não lidera.") : t("Serve também em {n} funções de outros times, que você não lidera.")).replace("{n}", String(det.vinculos_fora))}
                  </Text>
                )}
                {porTime.map(g => (
                  <View key={g.team_id} style={styles.cardTime}>
                    <Text style={styles.cardTimeNome}>{g.nome}</Text>
                    {g.linhas.map(v => (
                      <View key={v.id} style={styles.funcaoLinha}>
                        <Text style={[styles.pequeno, { color: colors.text, flex: 1 }]}>{v.position_name || t("Sem função definida")}</Text>
                        {ocupado === `tirar:${v.id}` ? <ActivityIndicator color={colors.textMuted} /> : (
                          <Pressable onPress={() => tirar(v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${t("Tirar")} ${t("de")} ${g.nome}`}>
                            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                          </Pressable>
                        )}
                      </View>
                    ))}
                    <Text style={[styles.pequeno, { color: colors.textMuted, marginTop: 6 }]}>
                      {g.tipos === null ? t("Serve em todos os cultos") : t("Serve só nestes cultos:")}
                    </Text>
                    <View style={styles.chips}>
                      {det.tipos.map(tp => {
                        const marcado = g.tipos === null || g.tipos.includes(tp.id);
                        const salvando = ocupado === `tipo:${g.linhas[0].id}:${tp.id}`;
                        return (
                          <Pressable key={tp.id} onPress={() => alternarCulto(g, tp.id)} disabled={!!ocupado} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }}
                            style={[styles.chip, marcado && styles.chipAtivo]}>
                            {salvando ? <ActivityIndicator size="small" color={colors.primary} />
                              : <Text style={[styles.chipTxt, marcado && styles.chipTxtAtivo]}>{tp.name}</Text>}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {/* Vincular a um time */}
                <Text style={styles.secao}>{det.escopo === "lider" ? t("Vincular a um time seu") : t("Vincular a um time")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {det.times.map(tm => {
                    const ativo = timeNovo === tm.id;
                    return (
                      <Pressable key={tm.id} onPress={() => { setTimeNovo(ativo ? "" : tm.id); setFuncaoNova(""); }} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                        style={[styles.chip, ativo && styles.chipAtivo]}>
                        <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>{tm.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {timeEscolhido && (
                  <>
                    <Text style={[styles.pequeno, { color: colors.textMuted, marginTop: 6 }]}>{t("Função (opcional)")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {timeEscolhido.posicoes.map(p => {
                        const ativo = funcaoNova === p.id;
                        return (
                          <Pressable key={p.id} onPress={() => setFuncaoNova(ativo ? "" : p.id)} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                            style={[styles.chip, ativo && styles.chipAtivo]}>
                            <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>{p.name}</Text>
                          </Pressable>
                        );
                      })}
                      {timeEscolhido.posicoes.length === 0 && <Text style={styles.muted}>{t("Sem funções definidas nesta equipe.")}</Text>}
                    </ScrollView>
                    <Pressable style={[styles.botao, !!ocupado && { opacity: 0.6 }]} onPress={vincular} disabled={!!ocupado} accessibilityRole="button">
                      {ocupado === "vincular" ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Ionicons name="person-add" size={18} color="#fff" />
                          <Text style={styles.botaoTxt}>{t("Vincular a")} {timeEscolhido.name}</Text>
                        </>
                      )}
                    </Pressable>
                  </>
                )}
                <View style={{ height: spacing.lg }} />
              </ScrollView>
            )}
          </View>
        </TecladoSeguro>
      </Modal>
      <dlg.Dialogo />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    title: { color: c.text, fontSize: font.size.lg, fontWeight: "700" },
    center: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
    muted: { color: c.textMuted, fontSize: font.size.sm },
    pequeno: { fontSize: font.size.sm },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 12, marginTop: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, color: c.text, paddingVertical: 10, fontSize: font.size.md },
    linha: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    avatar: { height: 36, width: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    avatarTxt: { fontSize: font.size.sm - 1, fontWeight: "700" },
    pessoaNome: { color: c.text, fontSize: font.size.md, fontWeight: "600" },
    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm, gap: 12 },
    sheetTitle: { color: c.text, fontSize: font.size.lg, fontWeight: "800", flex: 1 },
    secao: { color: c.text, fontSize: font.size.sm, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, marginTop: spacing.md, marginBottom: 6 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    chipAtivo: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    chipTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "600" },
    chipTxtAtivo: { color: c.primary },
    cardTime: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: c.surface },
    cardTimeNome: { color: c.text, fontSize: font.size.md, fontWeight: "800", marginBottom: 4 },
    funcaoLinha: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
    botao: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.primary, borderRadius: radius.md, paddingVertical: 12 },
    botaoTxt: { color: "#fff", fontWeight: "800", fontSize: font.size.md },
  });
