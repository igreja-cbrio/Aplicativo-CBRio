import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCampus } from '@/contexts/CampusContext';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

export function CampusPicker() {
  const campus = useCampus();
  const colors = useColors();
  const t = useT();
  if (!campus.contexto || campus.contexto.estado === 'preparacao' || campus.contexto.campi.length < 2) return null;
  return <View style={styles.options}>
    <Text style={[styles.title, { color: colors.text }]}>{t('Campus')}</Text>
    <Text style={{ color: colors.textMuted }}>{t('Escolha a unidade cuja agenda você quer acompanhar. Seu cadastro permanece o mesmo.')}</Text>
    {campus.contexto.campi.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: item.id === campus.contexto?.campus_id }} disabled={campus.loading} onPress={() => void campus.selecionar(item.id)} style={[styles.option, { borderColor: item.id === campus.contexto?.campus_id ? colors.primary : colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.text }}>{item.nome}</Text>
    </Pressable>)}
  </View>;
}
export function CampusAccess({ children }: { children: React.ReactNode }) {
  const campus = useCampus(); const colors = useColors(); const t = useT(); const { signOut } = useAuth();
  if (campus.ready) return <View key={campus.scopeKey} style={styles.fill}>{children}</View>;
  return <View style={[styles.gate, { backgroundColor: colors.background }]}>
    {campus.loading ? <><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.text }}>{t('Carregando campus…')}</Text></> : <>
      <Text accessibilityRole="alert" style={{ color: colors.text }}>{campus.error || t('Escolha o campus para continuar.')}</Text>
      <CampusPicker />
      <Button title={t('Tentar novamente')} onPress={() => void campus.recarregar()} />
      <Button title={t('Sair')} variant="ghost" onPress={() => void signOut()} />
    </>}
  </View>;
}
const styles = StyleSheet.create({
  fill: { flex: 1 }, gate: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  options: { gap: 12, marginVertical: 12 }, title: { fontSize: 18, fontWeight: '600' },
  option: { padding: 16, borderWidth: 1, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
});
