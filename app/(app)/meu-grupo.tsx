import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet, contarPedidosGrupo } from "@/lib/api";
import { trackEvento } from "@/lib/telemetria";
import { abrirRota } from "@/lib/navegacao";
import { BuscadorGrupos } from "./grupos";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Material = { id: string; nome: string; comentario: string | null; url: string | null };
type Grupo = {
  id: string;
  nome: string;
  dia_semana: number | null;
  horario: string | null;
  local: string | null;
  endereco: string | null;
  bairro: string | null;
  complemento: string | null;
  lat: number | null;
  lng: number | null;
  foto_url: string | null;
  funcao: string | null;
  lider: { nome: string; telefone: string | null } | null;
  proximo_encontro: string | null;
  materiais: Material[];
};

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function quandoEncontro(g: Grupo): string {
  const partes: string[] = [];
  if (g.dia_semana != null && DIAS[g.dia_semana]) partes.push(DIAS[g.dia_semana]);
  if (g.horario) partes.push(g.horario.slice(0, 5));
  return partes.join(" · ") || "Horário a confirmar";
}

function proximoLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }) +
    " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function MeuGrupoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  /**
   * ⚠️ TELA ÚNICA de grupos (05/08/2026 · pedido do Marcos: "uma tela deve ter
   * todas as opções"). Antes, "Grupos" na barra e "grupos" no menu abriam telas
   * diferentes. Agora as duas caem aqui, e o BUSCADOR é a 2ª aba — não uma tela
   * concorrente. Quem lidera continua com a fila de inscrições como cartão.
   * O fluxo de inscrição não muda: tocar num grupo do buscador abre
   * `/grupo-detalhe`, que é quem tem o "Quero participar".
   */
  const [aba, setAba] = useState<"meus" | "encontrar">("meus");
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [pedidosPend, setPedidosPend] = useState(0);
  // ⚠️ Falha de rede NÃO pode virar "você não está em um grupo" (06/08/2026).
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiGet<{ grupos: Grupo[] }>("/app/meu-grupo");
      setErroCarga(null);
      const lista = r.grupos || [];
      setGrupos(lista);
      // Se lidera algum grupo, mostra quantas inscrições estão aguardando.
      if (lista.some((g) => g.funcao === "lider")) {
        contarPedidosGrupo().then(setPedidosPend).catch(() => setPedidosPend(0));
      } else {
        setPedidosPend(0);
      }
    } catch (e) {
      // ⚠️⚠️ Aqui era `setGrupos([])` — offline/401/500 viravam a MESMA tela de
      // "Você ainda não está em um grupo de conexão.", com um botão convidando
      // a pessoa a entrar num grupo que ela já tem. O líder com rede ruim lia
      // que não lidera nada. Erro agora é erro, com caminho de tentar de novo.
      setErroCarga(e instanceof Error ? e.message : "falha");
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // Papel de GESTÃO no grupo (vem de /app/meu-grupo: 'lider' quando o
  // mem_grupos.lider_id é o membro logado, mesmo sem linha no roster).
  const gerencia = (g: Grupo) => g.funcao === "lider" || g.funcao === "co_lider";

  function falarComLider(g: Grupo) {
    const tel = (g.lider?.telefone || "").replace(/\D/g, "");
    if (!tel) return;
    const num = tel.startsWith("55") ? tel : `55${tel}`;
    trackEvento("grupo_falar_lider", { entity_id: g.id });
    Linking.openURL(`https://wa.me/${num}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Sem cabeçalho local: a seta e o título vivem na faixa superior
          global (components/ui/TopBar.tsx) — esta é uma tela de barra. */}
      <View style={styles.abas}>
        {(["meus", "encontrar"] as const).map((k) => {
          const sel = aba === k;
          return (
            <Pressable
              key={k}
              onPress={() => setAba(k)}
              style={[styles.aba, sel && styles.abaSel]}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
            >
              <Ionicons
                name={k === "meus" ? "people-circle-outline" : "search-outline"}
                size={16}
                color={sel ? "#fff" : colors.textMuted}
              />
              <Text style={[styles.abaTxt, sel && styles.abaTxtSel]}>
                {k === "meus" ? t("Meus grupos") : t("Encontrar")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ⚠️ O buscador entra IRMÃO do ScrollView, nunca dentro: ele tem scroll
          próprio e um mapa: aninhar os dois trava o gesto e o mapa. Só monta ao
          abrir a aba (aí o mapa também só carrega quando é usado). */}
      {aba === "encontrar" ? (
        <BuscadorGrupos embutido />
      ) : (
      <ScrollView contentContainerStyle={styles.content}>
        {/* ⚠️ O botão "Inscrições do grupo" SAIU daqui (Marcos · 05/08/2026):
            "ao apertar gerenciar grupo, ali devem ter TODAS as opções para se
            fazer em um grupo". Duas portas pra aprovar pedido é o que fazia o
            líder achar que existiam dois lugares diferentes — a aprovação agora
            é a aba "Pedidos" dentro de Gerenciar grupo. A rota
            /grupo-inscricoes continua viva (link antigo e notificação de push
            apontam pra ela). */}
        {/* ⚠️ ERRO vem ANTES do vazio: sem isto, "não conseguimos carregar" e
            "você não está em grupo" são a mesma tela — e a segunda é mentira. */}
        {erroCarga ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
            <Text style={styles.vazio}>{t("Não conseguimos carregar seus grupos.")}</Text>
            <Text style={styles.vazioSub}>{t("Verifique sua conexão e tente de novo.")}</Text>
            <Button title={t("Tentar de novo")} onPress={() => carregar()} />
          </View>
        ) : grupos === null ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : grupos.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={32} color={colors.textMuted} />
            <Text style={styles.vazio}>{t("Você ainda não está em um grupo de conexão.")}</Text>
            <Text style={styles.vazioSub}>{t("Os grupos se reúnem durante a semana, nas casas e online.")}</Text>
            <Button title={t("Quero entrar em um grupo")} onPress={() => setAba("encontrar")} />
          </View>
        ) : (
          grupos.map((g) => (
            <View key={g.id} style={styles.card}>
              {g.foto_url ? <Image source={{ uri: g.foto_url }} style={styles.foto} resizeMode="cover" /> : null}
              <View style={styles.body}>
                <View style={styles.tituloRow}>
                  <Text style={styles.nome}>{g.nome}</Text>
                  {g.funcao && g.funcao !== "membro" && (
                    <View style={styles.papelBadge}><Text style={styles.papelTxt}>{g.funcao === "lider" ? t("Líder") : g.funcao === "co_lider" ? t("Co-líder") : g.funcao}</Text></View>
                  )}
                </View>

                <Linha icon="calendar-outline" texto={quandoEncontro(g)} colors={colors} styles={styles} />
                {g.local ? <Linha icon="location-outline" texto={g.local} colors={colors} styles={styles} /> : null}
                {proximoLabel(g.proximo_encontro) ? (
                  <View style={styles.proximo}>
                    <Text style={styles.proximoLabel}>{t("Próximo encontro")}</Text>
                    <Text style={styles.proximoData}>{proximoLabel(g.proximo_encontro)}</Text>
                  </View>
                ) : null}

                {/* ⚠️ Quem LIDERA o grupo não recebe "Falar com <ele mesmo>"
                    (o Marcos criou um grupo pra testar e viu "Falar com
                    Marcos" · 04/08). Pra líder/co-líder o CTA é gerenciar. */}
                {gerencia(g) ? (
                  <>
                    <Text style={styles.liderInfo}>
                      {g.funcao === "co_lider" ? t("Você é co-líder deste grupo.") : t("Você lidera este grupo.")}
                    </Text>
                    <Button
                      title={t("Gerenciar grupo")}
                      onPress={() => router.navigate({ pathname: "/grupo-membros", params: { id: g.id, nome: g.nome } } as any)}
                    />
                  </>
                ) : g.lider?.telefone ? (
                  <Button title={`${t("Falar com")} ${g.lider.nome.split(" ")[0]}`} onPress={() => falarComLider(g)} />
                ) : g.lider?.nome ? (
                  <Text style={styles.liderInfo}>{t("Líder")}: {g.lider.nome}</Text>
                ) : null}

                {((g.lat != null && g.lng != null) || g.local || g.endereco || g.bairro) ? (
                  <Button
                    title={t("Como chegar")}
                    variant="ghost"
                    onPress={() => abrirRota(
                      { lat: g.lat, lng: g.lng, endereco: [g.local, g.endereco, g.bairro].filter(Boolean).join(", ") },
                      { titulo: t("Como chegar"), cancelar: t("Cancelar") },
                    )}
                  />
                ) : null}

                {g.materiais.length > 0 && (
                  <View style={styles.materiais}>
                    <Text style={styles.materiaisTitulo}>{t("Materiais")}</Text>
                    {g.materiais.map((m) => (
                      <Pressable
                        key={m.id}
                        style={styles.material}
                        disabled={!m.url}
                        onPress={() => { if (m.url) { trackEvento("grupo_material_aberto", { entity_id: g.id }); Linking.openURL(m.url); } }}
                      >
                        <Ionicons name="document-text-outline" size={18} color={colors.brandMid} />
                        <Text style={styles.materialNome} numberOfLines={1}>{m.nome}</Text>
                        <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))
        )}

        {/* ⚠️ Esta tela é a ÚNICA porta de Grupos (pedido do Marcos, ponto 6:
            "3 páginas viram uma"): mostra os meus grupos, a fila de inscrições
            pra quem lidera e a entrada pra procurar outro grupo. As entradas
            "Grupos"/"Meu grupo"/"Meus grupos" saíram do menu. */}
        {grupos !== null && grupos.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.outroGrupo, pressed && { opacity: 0.7 }]}
            onPress={() => setAba("encontrar")}
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={20} color={colors.brandMid} />
            <Text style={styles.outroGrupoTxt}>{t("Entrar em outro grupo")}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Linha({ icon, texto, colors, styles }: { icon: React.ComponentProps<typeof Ionicons>["name"]; texto: string; colors: Palette; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.linha}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.linhaTxt}>{texto}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    abas: { flexDirection: "row", gap: spacing.xs, marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.full, padding: 4 },
    aba: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: radius.full },
    abaSel: { backgroundColor: colors.primary },
    abaTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "700" },
    abaTxtSel: { color: "#fff" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md },
    vazio: { color: colors.text, fontSize: font.size.md, textAlign: "center", fontWeight: "600" },
    vazioSub: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", marginTop: -spacing.xs },
    outroGrupo: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg },
    outroGrupoTxt: { flex: 1, color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, overflow: "hidden" },
    foto: { width: "100%", height: 150, backgroundColor: colors.glass },
    body: { padding: spacing.lg, gap: spacing.sm },
    tituloRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    nome: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    papelBadge: { backgroundColor: colors.glass, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    papelTxt: { color: colors.brandMid, fontSize: 11, fontWeight: "700" },
    linha: { flexDirection: "row", alignItems: "center", gap: 8 },
    linhaTxt: { color: colors.textMuted, fontSize: font.size.md },
    proximo: { backgroundColor: colors.glass, borderRadius: radius.md, padding: spacing.md, marginTop: 2 },
    proximoLabel: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    proximoData: { color: colors.text, fontSize: font.size.md, fontWeight: "600", marginTop: 2, textTransform: "capitalize" },
    liderInfo: { color: colors.textMuted, fontSize: font.size.sm },
    materiais: { gap: spacing.xs, marginTop: spacing.xs },
    materiaisTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    material: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.glassBorder },
    materialNome: { color: colors.text, fontSize: font.size.md, flex: 1 },
    pedidosCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.md },
    pedidosIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center" },
    pedidosTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    pedidosSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
    pedidosBadge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    pedidosBadgeTxt: { color: "#fff", fontSize: font.size.sm, fontWeight: "800" },
  });
