// Um campo do censo, nativo. Espelha `PerguntaCampo.tsx` da web em comportamento
// (não em código: lá é DOM, aqui é React Native).
//
// ⚠️ O que NÃO pode divergir da web é o VALOR gravado, porque o servidor compara
// texto: escolha única guarda a string da opção, múltipla guarda array de
// strings, número guarda number, data guarda 'AAAA-MM-DD'. Mudar o formato aqui
// quebra o gráfico daquela pergunta sem erro nenhum na tela.
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { alternarOpcao, ehNeutra, NAO_SE_APLICA, type Pergunta } from "@/lib/censoForm";
import { buscarCatalogo, type ItemCatalogo } from "@/lib/censoApi";

type Props = {
  pergunta: Pergunta;
  valor: unknown;
  onChange: (v: unknown) => void;
  faltando?: boolean;
};

/** Máscaras dos formatos de texto curto. Mesmas da web. */
function mascarar(formato: string | undefined, v: string): string {
  if (formato === "telefone") {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (formato === "cpf") {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (formato === "cep") {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
  }
  if (formato === "instagram") return v.replace(/\s/g, "");
  return v;
}

function tecladoDe(formato?: string) {
  if (formato === "telefone" || formato === "cpf" || formato === "cep") return "number-pad" as const;
  if (formato === "email") return "email-address" as const;
  return "default" as const;
}

export default function CampoCenso({ pergunta: p, valor, onChange, faltando }: Props) {
  const colors = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(colors, !!faltando), [colors, faltando]);

  // ── busca em catálogo (igrejas do RJ, grupos ativos) ──
  // ⚠️ A lista NÃO vem na pergunta: são 1.911 igrejas. Busca no servidor, com
  // teto de 2 caracteres (o backend recusa abaixo disso).
  if (p.tipo === "busca") {
    return <CampoBusca pergunta={p} valor={valor} onChange={onChange} faltando={faltando} />;
  }

  // ── opções (escolha única / múltipla / sim-não) ──
  if (p.tipo === "sim_nao" || p.tipo === "opcao_unica" || p.tipo === "multipla") {
    const opcoes = p.tipo === "sim_nao" ? ["Sim", "Não"] : (p.opcoes || []);
    const multi = p.tipo === "multipla";
    const marcadas = multi
      ? (Array.isArray(valor) ? valor.map(String) : [])
      : [String(valor ?? "")];
    const extras = p.permite_nao_se_aplica ? [NAO_SE_APLICA] : [];

    return (
      <View style={s.opcoes}>
        {[...opcoes, ...extras].map((o) => {
          const on = marcadas.includes(o);
          const neutra = ehNeutra(p, o);
          return (
            <Pressable
              key={o}
              onPress={() => onChange(multi ? alternarOpcao(p, valor, o) : (on ? null : o))}
              accessibilityRole={multi ? "checkbox" : "radio"}
              accessibilityState={{ checked: on }}
              style={[s.opcao, on && s.opcaoOn]}
            >
              <Ionicons
                name={multi
                  ? (on ? "checkbox" : "square-outline")
                  : (on ? "radio-button-on" : "radio-button-off")}
                size={20}
                color={on ? colors.primary : colors.textMuted}
              />
              <Text style={[s.opcaoTexto, neutra && s.opcaoNeutra]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // ── escalas e NPS: botões numerados ──
  if (p.tipo === "escala_5" || p.tipo === "estrelas_5" || p.tipo === "nps") {
    const nps = p.tipo === "nps";
    const nums = nps
      ? Array.from({ length: 11 }, (_, i) => i)
      : [1, 2, 3, 4, 5];
    const atual = valor === null || valor === undefined ? null : Number(valor);
    return (
      <View>
        <View style={s.escala}>
          {nums.map((n) => {
            const on = atual === n;
            return (
              <Pressable
                key={n}
                onPress={() => onChange(on ? null : n)}
                accessibilityRole="button"
                accessibilityLabel={String(n)}
                style={[s.nota, nps && s.notaNps, on && s.notaOn]}
              >
                <Text style={[s.notaTexto, on && s.notaTextoOn]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
        {(p.rotulos?.min || p.rotulos?.max) && (
          <View style={s.rotulos}>
            <Text style={s.rotulo}>{p.rotulos?.min || ""}</Text>
            <Text style={s.rotulo}>{p.rotulos?.max || ""}</Text>
          </View>
        )}
        {p.permite_nao_se_aplica && (
          <Pressable
            onPress={() => onChange(valor === NAO_SE_APLICA ? null : NAO_SE_APLICA)}
            style={[s.opcao, valor === NAO_SE_APLICA && s.opcaoOn, { marginTop: spacing.sm }]}
          >
            <Ionicons
              name={valor === NAO_SE_APLICA ? "radio-button-on" : "radio-button-off"}
              size={20} color={valor === NAO_SE_APLICA ? colors.primary : colors.textMuted}
            />
            <Text style={[s.opcaoTexto, s.opcaoNeutra]}>{NAO_SE_APLICA}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── número ──
  if (p.tipo === "numero") {
    return (
      <TextInput
        style={s.input}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        value={valor === null || valor === undefined ? "" : String(valor)}
        onChangeText={(t) => {
          const so = t.replace(/\D/g, "");
          onChange(so === "" ? null : Number(so));
        }}
      />
    );
  }

  // ── data · AAAA-MM-DD no valor, DD/MM/AAAA na tela ──
  // ⚠️ O servidor espera ISO. Guardar o texto brasileiro aqui gravaria data que
  // nenhum gráfico consegue ordenar.
  if (p.tipo === "data") {
    const iso = typeof valor === "string" ? valor : "";
    const br = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
      : "";
    return (
      <TextInput
        style={s.input}
        keyboardType="number-pad"
        placeholder={t("DD/MM/AAAA")}
        placeholderTextColor={colors.textMuted}
        value={br}
        maxLength={10}
        onChangeText={(t) => {
          const d = t.replace(/\D/g, "").slice(0, 8);
          const fmt = d.length <= 2 ? d
            : d.length <= 4 ? `${d.slice(0, 2)}/${d.slice(2)}`
            : `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
          if (d.length === 8) {
            onChange(`${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`);
          } else {
            // Incompleta não vira valor: metade de uma data é dado inválido.
            onChange(fmt === "" ? null : "");
          }
        }}
      />
    );
  }

  // ── texto longo ──
  if (p.tipo === "texto_longo") {
    return (
      <TextInput
        style={[s.input, s.inputLongo]}
        multiline
        textAlignVertical="top"
        placeholder=""
        value={typeof valor === "string" ? valor : ""}
        onChangeText={onChange}
      />
    );
  }

  // ── texto curto, com máscara por formato ──
  return (
    <TextInput
      style={s.input}
      keyboardType={tecladoDe(p.formato)}
      autoCapitalize={p.formato === "email" || p.formato === "instagram" ? "none" : "sentences"}
      autoComplete={p.formato === "email" ? "email" : p.formato === "cep" ? "postal-code" : "off"}
      placeholder={p.formato === "cep" ? "00000-000"
        : p.formato === "telefone" ? "(21) 99999-9999"
        : p.formato === "instagram" ? "@seuperfil" : ""}
      placeholderTextColor={colors.textMuted}
      value={typeof valor === "string" ? valor : ""}
      onChangeText={(t) => onChange(mascarar(p.formato, t))}
    />
  );
}

/**
 * Busca com sugestões. O valor gravado é o TEXTO escolhido (mesma coisa que a
 * web grava) — nunca um id, senão o gráfico não sabe rotular.
 *
 * ⚠️ `permite_outro !== false` deixa a pessoa usar o que digitou: lista
 * incompleta sem escape faz ela responder qualquer coisa só para poder avançar.
 */
function CampoBusca({ pergunta: p, valor, onChange, faltando }: Props) {
  const colors = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(colors, !!faltando), [colors, faltando]);
  const [termo, setTermo] = useState("");
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const escolhido = typeof valor === "string" ? valor : "";

  // Debounce: digitar "batista" dispararia 7 buscas sem isto.
  useEffect(() => {
    if (!p.catalogo || termo.trim().length < 2) { setItens([]); return; }
    let vivo = true;
    setBuscando(true);
    const id = setTimeout(() => {
      buscarCatalogo(p.catalogo!, termo)
        .then((r) => { if (vivo) setItens(r); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 350);
    return () => { vivo = false; clearTimeout(id); };
  }, [termo, p.catalogo]);

  if (escolhido) {
    return (
      <Pressable onPress={() => { onChange(null); setTermo(""); }} style={[s.opcao, s.opcaoOn]}>
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        <Text style={s.opcaoTexto}>{escolhido}</Text>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        style={s.input}
        placeholder={p.catalogo === "grupos_ativos"
          ? t("Busque pelo nome do grupo ou do líder")
          : t("Comece a digitar o nome")}
        placeholderTextColor={colors.textMuted}
        value={termo}
        onChangeText={setTermo}
        autoCorrect={false}
      />
      {buscando && <Text style={s.rotulo}>{t("Procurando…")}</Text>}
      {itens.map((i) => (
        <Pressable key={i.valor} onPress={() => onChange(i.valor)} style={s.opcao}>
          <View style={{ flex: 1 }}>
            <Text style={s.opcaoTexto}>{i.rotulo}</Text>
            {!!i.detalhe && <Text style={s.rotulo}>{i.detalhe}</Text>}
          </View>
        </Pressable>
      ))}
      {!buscando && termo.trim().length >= 2 && p.permite_outro !== false && (
        <Pressable onPress={() => onChange(termo.trim())} style={s.opcao}>
          <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />
          <Text style={s.opcaoTexto}>{t("Usar")} “{termo.trim()}”</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(c: Palette, erro: boolean) {
  return StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: erro ? c.danger : c.border,
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: font.size.md,
      minHeight: 48,
    },
    inputLongo: { minHeight: 110, paddingTop: 12 },
    opcoes: { gap: spacing.sm },
    opcao: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      borderWidth: 1, borderColor: erro ? c.danger : c.border,
      backgroundColor: c.surface, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: 13, minHeight: 48,
    },
    opcaoOn: { borderColor: c.primary, backgroundColor: c.surfaceAlt },
    opcaoTexto: { color: c.text, fontSize: font.size.md, flex: 1 },
    opcaoNeutra: { color: c.textMuted },
    escala: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    nota: {
      width: 52, height: 48, borderRadius: radius.md,
      borderWidth: 1, borderColor: erro ? c.danger : c.border,
      backgroundColor: c.surface, alignItems: "center", justifyContent: "center",
    },
    // NPS tem 11 botões: menor, para caber sem apertar o alvo de toque.
    notaNps: { width: 44 },
    notaOn: { borderColor: c.primary, backgroundColor: c.surfaceAlt },
    notaTexto: { color: c.text, fontSize: font.size.md, fontWeight: "600" },
    notaTextoOn: { color: c.primary },
    rotulos: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
    rotulo: { color: c.textMuted, fontSize: font.size.sm },
  });
}
