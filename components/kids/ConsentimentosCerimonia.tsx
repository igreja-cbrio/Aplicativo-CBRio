import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { apiGet, type ErroApi } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Text } from '@/components/ui/Typography';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';

type Termos = { versao: string; imagem: string; genitores: string; aviso: string };
export function useConsentimentosCerimonia(atividade: 'batismo' | 'apresentacao', identidade: string) {
  const [termos, setTermos] = useState<Termos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [aceites, setAceites] = useState({ identidade, imagem: false, genitores: false });
  const atual = useRef(0);
  const reset = useCallback(() => setAceites({ identidade, imagem: false, genitores: false }), [identidade]);
  const carregar = useCallback(async () => {
    const geracao = ++atual.current;
    setCarregando(true); setErro(false); setTermos(null);
    setAceites(a => ({ ...a, imagem: false, genitores: false }));
    try {
      const r = await apiGet<Termos>(`/app/kids/inscricoes/termos?atividade=${atividade}`);
      if (geracao !== atual.current) return;
      if (![r.versao, r.imagem, r.genitores, r.aviso].every(v => typeof v === 'string' && v.trim())) throw new Error('termos');
      setTermos(r);
    } catch { if (geracao === atual.current) setErro(true); }
    finally { if (geracao === atual.current) setCarregando(false); }
  }, [atividade]);
  useEffect(() => { void carregar(); return () => { atual.current++; }; }, [carregar]);
  useEffect(reset, [reset]);
  const imagem = aceites.identidade === identidade && aceites.imagem;
  const genitores = aceites.identidade === identidade && aceites.genitores;
  const pronto = !!termos && !carregando && !erro && imagem && genitores;
  function mudar(campo: 'imagem' | 'genitores', valor: boolean) {
    setAceites(a => ({ ...(a.identidade === identidade ? a : { identidade, imagem: false, genitores: false }), [campo]: valor === true }));
  }
  function tratarErro(e: unknown) {
    const status = (e as ErroApi)?.status;
    if (status === 409 && (e as ErroApi)?.corpo?.codigo === 'termos_kids_desatualizados') { void carregar(); return true; }
    return false;
  }
  return { termos, carregando, erro, imagem, genitores, pronto, carregar, reset, mudar, tratarErro,
    payload: pronto ? { versao: termos!.versao, imagem: true, genitores: true } : null };
}
export function ConsentimentosCerimonia({ consentimentos: c, disabled = false }: {
  consentimentos: ReturnType<typeof useConsentimentosCerimonia>; disabled?: boolean;
}) {
  const t = useT();
  return <View style={{ gap: 16 }}>
    <Text>{t('Autorizações para a cerimônia')}</Text>
    {c.carregando ? <Text>{t('Carregando autorizações…')}</Text> : c.erro ? <>
      <Text accessibilityRole="alert">{t('Não foi possível carregar as autorizações. Tente novamente para continuar.')}</Text>
      <Button title={t('Tentar novamente')} disabled={disabled} onPress={c.carregar} />
    </> : c.termos ? <>
      <Text>{c.termos.aviso}</Text>
      <Checkbox label={c.termos.imagem} checked={c.imagem} disabled={disabled} onChange={v => c.mudar('imagem', v)} />
      <Checkbox label={c.termos.genitores} checked={c.genitores} disabled={disabled} onChange={v => c.mudar('genitores', v)} />
      {!c.pronto ? <Text>{t('Marque as duas autorizações para concluir a inscrição.')}</Text> : null}
    </> : null}
  </View>;
}
