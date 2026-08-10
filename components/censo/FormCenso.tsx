// Formulário do censo dentro do app — um bloco por tela.
//
// Mesma decisão de UI da web, e pelo mesmo motivo: 31 perguntas numa rolagem
// única é o caminho curto para a pessoa desistir. Bloco por tela dá o fim à
// vista, valida 6 campos por vez em vez de 31 no final, e a condicional encurta
// o formulário de verdade (bloco cujo conteúdo todo ficou invisível não existe).
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import CampoCenso from "@/components/censo/CampoCenso";
import {
  blocosVisiveis, faltando, limparInvisiveis, progresso,
  type Pergunta, type Respostas,
} from "@/lib/censoForm";

type Props = {
  perguntas: Pergunta[];
  consentimentoTexto?: string | null;
  valoresIniciais?: Respostas;
  enviando: boolean;
  erroEnvio?: string | null;
  onEnviar: (respostas: Respostas, consentimento: boolean) => void;
};

export default function FormCenso({
  perguntas, consentimentoTexto, valoresIniciais, enviando, erroEnvio, onEnviar,
}: Props) {
  const colors = useColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [respostas, setRespostas] = useState<Respostas>(valoresIniciais || {});
  const [passo, setPasso] = useState(0);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [consentimento, setConsentimento] = useState(false);
  const rolagem = useRef<ScrollView | null>(null);

  const blocos = useMemo(() => blocosVisiveis(perguntas, respostas), [perguntas, respostas]);
  const prog = useMemo(() => progresso(perguntas, respostas), [perguntas, respostas]);

  // O bloco pode desaparecer quando uma condicional muda (respondeu "não tenho
  // filhos" e o bloco de filhos sai). Sem este clamp o passo aponta para o vazio.
  const idx = Math.min(passo, Math.max(0, blocos.length - 1));
  const bloco = blocos[idx];
  const ultimo = idx >= blocos.length - 1;

  const faltandoNoBloco = useMemo(
    () => (bloco ? faltando(bloco.perguntas, respostas) : []),
    [bloco, respostas],
  );
  const faltandoIds = new Set(faltandoNoBloco.map((p) => p.id));

  function setResposta(id: string, valor: unknown) {
    setRespostas((atuais) => {
      const proximas = { ...atuais };
      if (valor === null || valor === undefined || valor === ""
        || (Array.isArray(valor) && valor.length === 0)) delete proximas[id];
      else proximas[id] = valor;
      return proximas;
    });
  }

  function aoTopo() {
    rolagem.current?.scrollTo({ y: 0, animated: true });
  }

  function avancar() {
    if (faltandoNoBloco.length) { setMostrarErros(true); return; }
    setMostrarErros(false);
    setPasso(idx + 1);
    aoTopo();
  }

  function voltar() {
    setMostrarErros(false);
    setPasso(Math.max(0, idx - 1));
    aoTopo();
  }

  function enviar() {
    // ⚠️ Revalida o questionário INTEIRO, não só o bloco: a pessoa pode ter
    // voltado e mudado uma condicional que reabriu pergunta obrigatória lá atrás.
    const tudo = faltando(perguntas, respostas);
    if (tudo.length) {
      const ondeEsta = blocos.findIndex((b) => b.perguntas.some((p) => p.id === tudo[0].id));
      setPasso(ondeEsta >= 0 ? ondeEsta : 0);
      setMostrarErros(true);
      aoTopo();
      return;
    }
    if (!consentimento) { setMostrarErros(true); return; }
    // Limpa resposta de pergunta que ficou invisível — o servidor descartaria,
    // mas mandar dado que a pessoa não confirmou é mentir no payload.
    onEnviar(limparInvisiveis(perguntas, respostas), true);
  }

  if (!bloco) {
    return (
      <View style={s.centro}>
        <Text style={s.texto}>{t("Este censo não tem perguntas ainda.")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={rolagem}
      style={{ flex: 1 }}
      contentContainerStyle={s.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      {/* progresso */}
      <View style={s.progressoLinha}>
        <Text style={s.progressoTexto}>
          {t("Parte")} {idx + 1} {t("de")} {blocos.length}
        </Text>
        <Text style={s.progressoTexto}>
          {prog.feitas} {t("de")} {prog.total} {t("respondidas")}
        </Text>
      </View>
      <View style={s.barra}>
        <View style={[s.barraCheia, { width: `${prog.pct}%` }]} />
      </View>

      {!!bloco.titulo && <Text style={s.blocoTitulo}>{bloco.titulo}</Text>}

      {bloco.perguntas.map((p) => (
        <View key={p.id} style={s.campo}>
          <Text style={s.label}>
            {p.texto}
            {p.obrigatoria && <Text style={s.obrigatoria}> *</Text>}
          </Text>
          {!!p.descricao && <Text style={s.descricao}>{p.descricao}</Text>}
          <CampoCenso
            pergunta={p}
            valor={respostas[p.id]}
            onChange={(v) => setResposta(p.id, v)}
            faltando={mostrarErros && faltandoIds.has(p.id)}
          />
        </View>
      ))}

      {mostrarErros && faltandoNoBloco.length > 0 && (
        <View style={s.aviso}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={s.avisoTexto}>
            {faltandoNoBloco.length === 1
              ? t("Falta responder 1 pergunta obrigatória nesta parte.")
              : `${t("Faltam responder")} ${faltandoNoBloco.length} ${t("perguntas obrigatórias nesta parte.")}`}
          </Text>
        </View>
      )}

      {/* consentimento · só no último bloco, como na web */}
      {ultimo && !!consentimentoTexto && (
        <Pressable
          onPress={() => setConsentimento(!consentimento)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentimento }}
          style={[s.consentimento, mostrarErros && !consentimento && s.consentimentoErro]}
        >
          {/* ⚠️ Linha montada aqui, e não com o <Checkbox> compartilhado: o
              rótulo dele não tem `flex: 1`, então texto de várias linhas — que é
              o caso do consentimento — sairia cortado na lateral em vez de
              quebrar. Mexer no componente compartilhado no meio desta entrega
              mudaria todas as telas que o usam. */}
          <Ionicons
            name={consentimento ? "checkbox" : "square-outline"}
            size={22}
            color={consentimento ? colors.primary : colors.textMuted}
          />
          <Text style={s.consentimentoTexto}>{consentimentoTexto}</Text>
        </Pressable>
      )}

      {!!erroEnvio && (
        <View style={s.aviso}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={s.avisoTexto}>{erroEnvio}</Text>
        </View>
      )}

      <View style={s.acoes}>
        {idx > 0 && (
          <Pressable onPress={voltar} style={s.voltar} accessibilityRole="button">
            <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
            <Text style={s.voltarTexto}>{t("Voltar")}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          {ultimo ? (
            <Button
              title={enviando ? t("Enviando…") : t("Enviar respostas")}
              onPress={enviar}
              disabled={enviando}
            />
          ) : (
            <Button title={t("Continuar")} onPress={avancar} />
          )}
        </View>
      </View>

      {enviando && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />}
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    conteudo: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
    centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    texto: { color: c.textMuted, fontSize: font.size.md, textAlign: "center" },
    progressoLinha: { flexDirection: "row", justifyContent: "space-between" },
    progressoTexto: { color: c.textMuted, fontSize: font.size.sm },
    barra: { height: 6, borderRadius: radius.full, backgroundColor: c.surfaceAlt, overflow: "hidden" },
    barraCheia: { height: 6, borderRadius: radius.full, backgroundColor: c.primary },
    blocoTitulo: { color: c.text, fontSize: font.size.lg, fontWeight: "700", marginTop: spacing.sm },
    campo: { gap: spacing.xs },
    label: { color: c.text, fontSize: font.size.md, lineHeight: 21 },
    obrigatoria: { color: c.textMuted },
    descricao: { color: c.textMuted, fontSize: font.size.sm, lineHeight: 19, marginBottom: 2 },
    aviso: {
      flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
      backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.md,
    },
    avisoTexto: { color: c.danger, fontSize: font.size.sm, flex: 1, lineHeight: 19 },
    consentimento: {
      flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
      borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
      padding: spacing.md, backgroundColor: c.surface,
    },
    consentimentoTexto: { color: c.textMuted, fontSize: font.size.sm, lineHeight: 19, flex: 1 },
    consentimentoErro: { borderColor: c.danger },
    acoes: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
    voltar: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: spacing.sm },
    voltarTexto: { color: c.textMuted, fontSize: font.size.md },
  });
}
