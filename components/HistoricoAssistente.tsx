import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Typography';
import { useColors } from '@/contexts/ThemeContext';
import { useLang, useT } from '@/lib/i18n';
import { apiGet } from '@/lib/api';

export type ConversaAssistente = { id: string; titulo: string; status: string; created_at: string };
type Pagina = { conversas: ConversaAssistente[]; proximo: string | null };
export function HistoricoAssistente({ aberto, fechar, selecionar, nova, identidade }: {
  aberto: boolean; fechar: () => void; selecionar: (c: ConversaAssistente) => void;
  nova: () => void; identidade: string | null;
}) {
  const c = useColors(), t = useT(), { lang } = useLang();
  const [itens, setItens] = useState<ConversaAssistente[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false), [erro, setErro] = useState(false);
  const geracao = useRef(0), ocupado = useRef(false);
  const carregar = useCallback(async (cursor?: string) => {
    if (ocupado.current || !identidade) return;
    const g = geracao.current; ocupado.current = true; setCarregando(true); setErro(false);
    try {
      const r = await apiGet<Pagina>('/app/assistente/conversas' + (cursor ? '?antes=' + encodeURIComponent(cursor) : ''));
      if (g !== geracao.current) return;
      setItens(prev => cursor ? [...prev, ...r.conversas.filter(x => !prev.some(y => y.id === x.id))] : r.conversas);
      setProximo(r.proximo);
    } catch { if (g === geracao.current) setErro(true); }
    finally { if (g === geracao.current) { ocupado.current = false; setCarregando(false); } }
  }, [identidade]);
  useEffect(() => {
    geracao.current++; ocupado.current = false; setItens([]); setProximo(null); setErro(false);
    if (aberto) void carregar();
    return () => { geracao.current++; ocupado.current = false; };
  }, [aberto, identidade, carregar]);
  return <Modal visible={aberto} animationType="slide" presentationStyle="pageSheet" onRequestClose={fechar}>
    <SafeAreaView style={[s.safe, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>{t("Histórico de conversas")}</Text>
        <Pressable onPress={fechar} style={s.icon} accessibilityRole="button" accessibilityLabel={t("Fechar")}><Ionicons name="close" size={26} color={c.text} /></Pressable>
      </View>
      <Pressable onPress={nova} accessibilityRole="button" style={[s.new, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name="create-outline" size={24} color={c.brandMid} /><Text style={{ color: c.text, fontWeight: '700' }}>{t("Nova conversa")}</Text>
      </Pressable>
      <FlatList data={itens} keyExtractor={x => x.id} contentContainerStyle={s.list}
        ListEmptyComponent={!carregando && !erro ? <Text style={{ color: c.textMuted }}>{t("Suas conversas aparecerão aqui.")}</Text> : null}
        renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => selecionar(item)} style={[s.row, { borderColor: c.border }]}>
          <Text numberOfLines={2} style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{item.titulo || t("Conversa com imagem")}</Text>
          <Text style={{ color: c.textMuted, marginTop: 6 }}>{t("Iniciada em")} {new Date(item.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </Pressable>}
        ListFooterComponent={<View style={s.footer}>
          {carregando ? <ActivityIndicator color={c.brandMid} accessibilityLabel={t("Carregando")} /> : null}
          {erro ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{t("Não foi possível carregar o histórico.")}</Text> : null}
          {!carregando && (proximo || erro) ? <Pressable style={s.new} accessibilityRole="button" onPress={() => carregar(proximo || undefined)}><Text style={{ color: c.brandMid }}>{erro ? t("Tentar novamente") : t("Carregar mais")}</Text></Pressable> : null}
        </View>}
      />
    </SafeAreaView>
  </Modal>;
}
const s = StyleSheet.create({
  safe: { flex: 1 }, header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: '700' }, icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  new: { marginHorizontal: 20, padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { padding: 20, flexGrow: 1 }, row: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth }, footer: { paddingVertical: 20, gap: 12 },
});
