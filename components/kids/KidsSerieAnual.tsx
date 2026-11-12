import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/contexts/ThemeContext';
import { apiGet, apiPost } from '@/lib/api';

type Estado = { crianca_id: string; nome: string; serie: string | null; ano: number; iniciado: boolean; pendente: boolean; confirmado_em: string | null; opcoes: string[] };
export function KidsSerieAnual({ criancaId, nome }: { criancaId: string; nome: string }) {
  const colors = useColors();
  const styles = useMemo(() => StyleSheet.create({
    box: { padding: 16, gap: 12, marginVertical: 8 },
    title: { color: colors.text, fontSize: 16, fontWeight: '700' },
    text: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
    small: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
    option: { minHeight: 46, borderWidth: 1, borderColor: colors.textMuted, borderRadius: 8, padding: 12, justifyContent: 'center' },
    optionText: { color: colors.text, fontSize: 14 },
    secondary: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 24, padding: 12, alignItems: 'center', justifyContent: 'center' },
    error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  }), [colors]);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [editando, setEditando] = useState(false);
  const editandoRef = useRef(false); editandoRef.current = editando;
  const [serie, setSerie] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [adiado, setAdiado] = useState(false);
  const carregar = useCallback(async () => {
    try { const e = await apiGet<Estado>(`/app/kids/filho/${encodeURIComponent(criancaId)}/serie-escolar`); setEstado(e); setErro(''); }
    catch { setErro('Não foi possível verificar a série. O pré-check-in pode continuar.'); }
  }, [criancaId]);
  useFocusEffect(useCallback(() => {
    void carregar();
    const sub = AppState.addEventListener('change', s => { if (s === 'active' && !editandoRef.current) void carregar(); });
    return () => sub.remove();
  }, [carregar]));
  async function confirmar() {
    if (!estado || !serie) { setErro('Selecione a série escolar.'); return; }
    setSalvando(true); setErro('');
    try {
      const e = await apiPost<Estado>(`/app/kids/filho/${encodeURIComponent(criancaId)}/serie-escolar`, { serie, ano: estado.ano, confirmado_em: estado.confirmado_em, serie_anterior: estado.serie });
      setEstado(e); setEditando(false); setAdiado(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar. Sua escolha foi mantida. Tente novamente.');
      if ((e as { status?: number })?.status === 409) { await carregar(); setSerie(''); setErro('Os dados ou o ano mudaram. Confira a série e confirme novamente.'); }
    } finally { setSalvando(false); }
  }
  if (!estado) return erro ? <GlassCard style={styles.box}><Text style={styles.error} accessibilityRole="alert">{erro}</Text><Button title="Tentar novamente" onPress={carregar}/></GlassCard> : null;
  if (!estado.iniciado) return null;
  return <GlassCard style={styles.box}>
    <Text style={styles.title}>{estado.pendente ? `Confirme a série escolar de ${nome} em ${estado.ano}` : `Série de ${nome} confirmada para ${estado.ano}`}</Text>
    <Text style={styles.text}>{estado.serie ? `${estado.pendente ? 'Última série informada' : 'Série'}: ${estado.serie}` : 'Série ainda não informada'}</Text>
    {!editando && !!erro && <Text style={styles.error} accessibilityRole="alert">{erro}</Text>}
    {editando ? <View style={{ gap: 10 }}>
      <Text style={styles.text}>Qual série a criança cursará neste ano? Pode ser a mesma do ano anterior.</Text>
      {estado.opcoes.map(opcao => <Pressable key={opcao} disabled={salvando} accessibilityRole="radio" accessibilityState={{ checked: serie === opcao, disabled: salvando }} onPress={() => { setSerie(opcao); setErro(''); }} style={[styles.option, serie === opcao && { borderColor: colors.brandMid, borderWidth: 2 }]}><Text style={styles.optionText}>{serie === opcao ? '✓ ' : ''}{opcao}</Text></Pressable>)}
      {!!erro && <Text style={styles.error} accessibilityRole="alert">{erro}</Text>}
      <Button title={salvando ? 'Salvando…' : 'Confirmar série'} disabled={salvando || !serie} onPress={confirmar}/>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: salvando }} disabled={salvando} style={styles.secondary} onPress={() => { setEditando(false); setAdiado(true); setErro(''); }}><Text style={styles.optionText}>Informar depois</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: salvando }} disabled={salvando} style={styles.secondary} onPress={async () => { await carregar(); setSerie(''); }}><Text style={styles.optionText}>Atualizar dados da tela</Text></Pressable>
    </View> : <Button title={estado.pendente ? 'Confirmar série' : 'Revisar série'} onPress={() => { setEditando(true); setSerie(estado.pendente ? '' : estado.serie || ''); setErro(''); }}/>} 
    {estado.pendente && <Text style={styles.small}>{adiado ? 'Pode informar depois. ' : ''}O pré-check-in continua disponível. Confirmou aqui, vale também no totem.</Text>}
  </GlassCard>;
}
