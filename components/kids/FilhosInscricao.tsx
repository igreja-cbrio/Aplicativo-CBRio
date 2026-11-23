import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';
import { listarFilhosInscricao, nascimentoBR, type FilhosInscricao } from '@/lib/kidsFilhosInscricao';
export function useFilhosInscricao() {
  const { user } = useAuth();
  const [dados, setDados] = useState<FilhosInscricao | null>(null);
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState(false);
  const versao = useRef(0);
  const carregar = useCallback(async () => {
    const v = ++versao.current; setDados(null); setCarregando(true); setErro(false);
    try { const r = await listarFilhosInscricao(); if (v === versao.current) setDados(r); }
    catch { if (v === versao.current) setErro(true); }
    finally { if (v === versao.current) setCarregando(false); }
  }, []);
  useFocusEffect(useCallback(() => { void carregar(); return () => { versao.current++; setDados(null); }; }, [carregar, user?.id]));
  return { dados, carregando, erro, carregar };
}
export function FilhosInscricao({ consulta, escolher, ocupado = false }: {
  consulta: ReturnType<typeof useFilhosInscricao>; escolher: (chave: string) => void; ocupado?: boolean;
}) {
  const c = useColors(), t = useT();
  return <View style={{ gap: 12 }}>
    <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{t('Selecione uma criança cadastrada')}</Text>
    {consulta.carregando || ocupado ? <ActivityIndicator color={c.primary} /> : null}
    {consulta.erro ? <View><Text style={{ color: c.textMuted }}>{t('Não foi possível consultar seus filhos.')}</Text><Button title={t('Tentar novamente')} onPress={consulta.carregar} /></View> : null}
    {!consulta.carregando && !consulta.erro && !consulta.dados?.filhos.length ? <Text style={{ color: c.textMuted }}>{t('Nenhum filho vinculado ao seu cadastro por enquanto.')}</Text> : null}
    {consulta.dados?.filhos.map(f => <Pressable key={f.chave} disabled={ocupado} onPress={() => escolher(f.chave)} accessibilityRole="button"
      style={{ padding: 18, minHeight: 60, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, gap: 4 }}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{f.nome}</Text>
      {f.data_nascimento ? <Text style={{ color: c.textMuted }}>{nascimentoBR(f.data_nascimento)}</Text> : null}
    </Pressable>)}
  </View>;
}
