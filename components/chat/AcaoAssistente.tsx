import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Typography';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import { podeConfirmarAcao, type PropostaAssistente } from '@/lib/assistenteAcao';

export function ConfirmacaoAssistente({ acao, bloqueado, confirmar }: {
  acao: PropostaAssistente; bloqueado: boolean;
  confirmar: (confirmar: boolean, campos: Record<string, string>) => void;
}) {
  const c = useColors(); const t = useT();
  const [aceitou, setAceitou] = useState(false);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    setAceitou(false); setCampos({}); setAgora(Date.now());
    const h = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(h);
  }, [acao.id]);
  const s = useMemo(() => StyleSheet.create({
    card: { padding: 16, gap: 12, borderWidth: 1, borderColor: c.border, borderRadius: 18, backgroundColor: c.surface },
    titulo: { color: c.text, fontSize: 18, fontWeight: '700' },
    texto: { color: c.text, fontSize: 15, lineHeight: 21 },
    termos: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    opcao: { minHeight: 44, minWidth: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    selecionada: { borderColor: c.brandMid, backgroundColor: c.surfaceAlt },
    aceite: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
    aceitarTexto: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
    confirmar: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 14, backgroundColor: c.brandMid },
    confirmarTexto: { color: c.background, fontWeight: '600', fontSize: 15 },
    cancelar: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  }), [c]);
  const expirou = Date.parse(acao.expira_em) <= agora;
  const liberado = !bloqueado && podeConfirmarAcao(acao, aceitou, campos, agora);
  return <View style={s.card}>
    <Text style={s.titulo}>{acao.titulo}</Text>
    <Text style={s.texto}>{acao.resumo}</Text>
    {(acao.campos || []).map(campo => <View key={campo.chave} style={{ gap: 8 }}>
      <Text style={s.texto}>{campo.rotulo}</Text>
      <View style={s.opcoes}>{campo.opcoes.map(opcao => <Pressable key={opcao} accessibilityRole="radio"
        accessibilityState={{ checked: campos[campo.chave] === opcao, disabled: bloqueado || expirou }} disabled={bloqueado || expirou}
        onPress={() => setCampos(v => ({ ...v, [campo.chave]: opcao }))}
        style={[s.opcao, campos[campo.chave] === opcao && s.selecionada]}><Text style={s.texto}>{opcao}</Text></Pressable>)}</View>
    </View>)}
    <Text style={s.termos}>{acao.termos}</Text>
    {expirou ? <Text style={s.texto}>{t('Esta proposta expirou. Peça uma nova inscrição no chat.')}</Text> : <Pressable
      accessibilityRole="checkbox" accessibilityState={{ checked: aceitou, disabled: bloqueado }} disabled={bloqueado}
      onPress={() => setAceitou(v => !v)} style={s.aceite}>
      <Text style={s.texto}>{aceitou ? '☑' : '☐'}</Text>
      <Text style={s.aceitarTexto}>{t('Revisei os dados e aceito os termos acima.')}</Text>
    </Pressable>}
    <Pressable disabled={!liberado} accessibilityRole="button" accessibilityState={{ disabled: !liberado }}
      onPress={() => confirmar(true, campos)} style={[s.confirmar, !liberado && { opacity: 0.5 }]}>
      {bloqueado ? <ActivityIndicator color={c.background} /> : <Text style={s.confirmarTexto}>{t('Confirmar inscrição')}</Text>}
    </Pressable>
    <Pressable disabled={bloqueado} accessibilityRole="button" onPress={() => confirmar(false, {})} style={s.cancelar}>
      <Text style={s.texto}>{t('Cancelar')}</Text>
    </Pressable>
  </View>;
}
