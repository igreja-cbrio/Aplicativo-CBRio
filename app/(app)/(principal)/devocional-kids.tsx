import { ScrollView } from '@/components/navigation/DockContent';
import { Text } from '@/components/ui/Typography';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/lib/i18n';
import { subirUmNivel } from '@/lib/hierarquia';
import { carregarDevocionaisKids, abrirDevocionalKids, salvarDevocionalKids, compartilharDevocionalKids, type DevocionalKids } from '@/lib/kidsDevocionais';

export default function DevocionalKidsScreen() {
  const c = useColors(), t = useT(), s = useMemo(() => css(c), [c]);
  const { user } = useAuth();
  const { semana } = useLocalSearchParams<{ semana?: string }>();
  const [itens, setItens] = useState<DevocionalKids[]>([]), [proxima, setProxima] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [erro, setErro] = useState(''), [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState('');
  const generation = useRef(0), trava = useRef(false);
  const carregar = useCallback(async (antes?: string) => {
    const g = ++generation.current; setLoading(true); setErro('');
    try {
      const r = await carregarDevocionaisKids(antes);
      if (!antes && semana && !r.itens.some(i => i.semana === semana)) {
        const alvo = await carregarDevocionaisKids(undefined, semana);
        r.itens = [...alvo.itens, ...r.itens];
      }
      if (generation.current !== g) return;
      setItens(v => antes ? [...v, ...r.itens.filter(i => !v.some(x => x.id === i.id))] : r.itens); setProxima(r.proxima);
    } catch { if (generation.current === g) setErro(t('Não foi possível carregar os devocionais Kids.')); }
    finally { if (generation.current === g) setLoading(false); }
  }, [t, semana]);
  useFocusEffect(useCallback(() => {
    setItens([]); setProxima(null); setAviso(''); carregar();
    return () => { generation.current++; setItens([]); };
  }, [carregar, user?.id]));
  async function agir(i: DevocionalKids, acao: 'abrir' | 'baixar' | 'compartilhar') {
    if (trava.current) return; trava.current = true; setBusy(true); setAviso('');
    try {
      if (acao === 'abrir') await abrirDevocionalKids(i);
      else if (acao === 'compartilhar') await compartilharDevocionalKids(i);
      else if (await salvarDevocionalKids(i) === 'salvo') setAviso(t('PDF salvo na pasta que você escolheu.'));
    } catch { setAviso(t('Não foi possível abrir o PDF. Tente novamente.')); }
    finally { trava.current = false; setBusy(false); }
  }
  return <SafeAreaView style={s.safe} edges={['left', 'right']}>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading && itens.length > 0} onRefresh={() => carregar()} />}>
      <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel={t('Voltar')} style={s.back} onPress={() => subirUmNivel('/devocional-kids')}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.title}>{t('Devocionais Kids')}</Text></View>
      <View style={s.intro}><Ionicons name="book-outline" size={30} color={c.primary} /><Text style={s.introTitle}>{t('Uma semana, uma conversa em família.')}</Text><Text style={s.muted}>{t('Leia, converse e viva o desafio da semana com as crianças.')}</Text></View>
      {semana && <Text style={s.muted}>{t('Semana de')} {semana.split('-').reverse().join('/')}</Text>}
      {erro ? <View><Text style={s.muted}>{erro}</Text><Pressable style={s.button} accessibilityRole="button" onPress={() => carregar()}><Text style={s.buttonText}>{t('Tentar novamente')}</Text></Pressable></View> : null}
      {aviso ? <Text accessibilityLiveRegion="polite" style={s.muted}>{aviso}</Text> : null}
      {!loading && !erro && !itens.length ? <Text style={s.muted}>{t('Os devocionais Kids aparecerão aqui quando forem publicados.')}</Text> : null}
      {itens.map(i => <View key={i.id} style={[s.card, i.semana === semana && { borderColor: c.primary }]}>
        <Text style={s.week}>{t('Semana de')} {i.semana.split('-').reverse().join('/')}</Text><Text style={s.cardTitle}>{i.titulo}</Text><Text style={s.muted}>{t("Série")}: {i.serie}</Text>
        {i.descricao ? <Text style={s.muted}>{i.descricao}</Text> : null}
        <Pressable style={s.primary} disabled={busy} accessibilityRole="button" onPress={() => agir(i, 'abrir')}><Ionicons name="document-text-outline" size={20} color="#fff" /><Text style={s.primaryText}>{t('Ler devocional')}</Text></Pressable>
        <View style={s.actions}>{(['baixar', 'compartilhar'] as const).map(acao => <Pressable key={acao} disabled={busy} style={s.button} accessibilityRole="button" onPress={() => agir(i, acao)}><Text style={s.buttonText}>{acao === 'baixar' ? t('Baixar PDF') : t('Compartilhar')}</Text></Pressable>)}</View>
      </View>)}
      {loading || busy ? <ActivityIndicator color={c.primary} /> : null}
      {proxima ? <Pressable style={s.button} disabled={loading} accessibilityRole="button" onPress={() => carregar(proxima)}><Text style={s.buttonText}>{t('Semanas anteriores')}</Text></Pressable> : null}
    </ScrollView>
  </SafeAreaView>;
}
const css = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, content: { padding: 20, paddingBottom: 90, gap: 16 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8 }, back: { minWidth: 44, minHeight: 44, justifyContent: 'center' }, title: { flex: 1, color: c.text, fontSize: 25, fontWeight: '800' },
  intro: { paddingVertical: 14, gap: 10 }, introTitle: { color: c.text, fontSize: 21, fontWeight: '700' }, muted: { color: c.textMuted, fontSize: 15, lineHeight: 23 }, card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 20, gap: 12 }, week: { color: c.primary, fontSize: 13, fontWeight: '700' }, cardTitle: { color: c.text, fontSize: 22, fontWeight: '800' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 }, buttonText: { color: c.primary, fontWeight: '700', fontSize: 15 }, primary: { minHeight: 52, backgroundColor: c.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
