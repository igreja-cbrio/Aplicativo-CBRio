import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';
import { temAudioNativo, carregarAudio } from '@/lib/audioNativo';
import { useFocusEffect } from 'expo-router';
import { File } from 'expo-file-system';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text } from '@/components/ui/Typography';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import type { ArquivoImagem } from '@/lib/escolherImagem';

let gravacaoEmUso = false;
const disponivel = temAudioNativo;
const emEnvio = new Map<string, number>(), apagarDepois = new Set<string>();
export function reterAudio(uri: string) { emEnvio.set(uri, (emEnvio.get(uri) || 0) + 1); return () => { const n = (emEnvio.get(uri) || 1) - 1; if (n) emEnvio.set(uri, n); else { emEnvio.delete(uri); if (apagarDepois.delete(uri)) apagarAudio(uri); } }; }
export function apagarAudio(uri: string) { if (emEnvio.has(uri)) { apagarDepois.add(uri); return; } try { const f = new File(uri); if (f.exists) f.delete(); } catch { /* Arquivo temporário já removido. */ } }
function IconeMicrofone({ parar = false }: { parar?: boolean }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    {parar ? <Rect x={6} y={6} width={12} height={12} rx={2} fill="#fff" /> : <>
      <Rect x={9} y={2.5} width={6} height={12} rx={3} stroke="#fff" strokeWidth={1.7} />
      <Path d="M5.5 10.5v1.5a6.5 6.5 0 0 0 13 0v-1.5M12 18.5v3M8.5 21.5h7" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </>}
  </Svg>;
}
type Props = { disabled: boolean; iniciar: () => void; ativo: (v: boolean) => void; pronto: (a: ArquivoImagem) => void; erro: (s: string) => void };
export function GravadorMensagem(p: Props) {
  const c = useColors(), t = useT();
  if (disponivel) return <GravadorNativo {...p} />;
  return <Pressable disabled={p.disabled} accessibilityRole="button" accessibilityLabel={t('Gravar áudio')}
    onPress={() => p.erro(t('Atualize o app na loja para gravar mensagens de áudio.'))}
    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.brandMid, alignItems: 'center', justifyContent: 'center' }}>
    <IconeMicrofone />
  </Pressable>;
}
function GravadorNativo(p: Props) {
  // O entrypoint exige módulo nativo. Só carregar após a guarda acima:
  // os binários antigos continuam recebendo OTA no runtime 1.0.0.
  const A = carregarAudio();
  const recorder = A.useAudioRecorder({ ...A.RecordingPresets.HIGH_QUALITY, sampleRate: 24000, numberOfChannels: 1, bitRate: 64000 }, evento => {
    if (evento.hasError) { if (alive.current) props.current.erro(t('A gravação foi interrompida. Grave novamente.')); void terminar(false, evento.isFinished); }
    else if (evento.isFinished) void terminar(true, true);
  });
  const status = A.useAudioRecorderState(recorder, 200);
  const c = useColors(), t = useT(), props = useRef(p); props.current = p;
  const alive = useRef(true), sessao = useRef<{ cancelada: boolean; preparada: boolean; parando: boolean; inicio: number; uri: string | null } | null>(null);
  const [fase, setFase] = useState<'parado' | 'preparando' | 'gravando' | 'parando'>('parado');
  async function terminar(enviar: boolean, encerrada = false) {
    const s = sessao.current;
    if (!s) return;
    if (!enviar) s.cancelada = true;
    if (s.parando) return;
    if (!s.preparada) return; // Quem aguarda permissão/preparo fará a limpeza.
    s.parando = true;
    if (alive.current) setFase('parando');
    let uri: string | null = s.uri, entregue = false;
    try {
      if (!encerrada) await recorder.stop(); uri = recorder.uri;
      await A.setAudioModeAsync({ allowsRecording: false });
      if (!alive.current || s.cancelada || props.current.disabled) return;
      if (!uri || Date.now() - s.inicio < 600) throw new Error(t('Grave por pelo menos um segundo.'));
      if (new File(uri).size > 1024 * 1024) throw new Error(t('Áudio muito grande. Grave uma mensagem mais curta.'));
      props.current.ativo(false); // A prévia desmonta o gravador; limpar estado ANTES do callback.
      props.current.pronto({ uri, name: `audio-${Date.now()}.m4a`, type: 'audio/mp4' }); entregue = true;
    } catch (e) { if (alive.current && !s.cancelada) props.current.erro(e instanceof Error ? e.message : t('Não foi possível gravar o áudio.')); }
    finally {
      await A.setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!entregue && uri) apagarAudio(uri);
      if (sessao.current === s) sessao.current = null;
      gravacaoEmUso = false;
      if (alive.current) { setFase('parado'); props.current.ativo(false); }
    }
  }
  async function iniciar() {
    if (sessao.current || props.current.disabled) return;
    if (gravacaoEmUso) { props.current.erro(t('Aguarde a gravação anterior terminar.')); return; }
    gravacaoEmUso = true;
    const s = { cancelada: false, preparada: false, parando: false, inicio: 0, uri: null as string | null }; sessao.current = s;
    setFase('preparando'); props.current.iniciar(); props.current.ativo(true);
    try {
      const perm = await A.requestRecordingPermissionsAsync();
      if (s.cancelada || !alive.current) return;
      if (!perm.granted) throw new Error(t('Permita o acesso ao microfone nos ajustes do celular.'));
      await A.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      if (s.cancelada || !alive.current) return;
      await recorder.prepareToRecordAsync(); s.preparada = true; s.uri = recorder.uri;
      if (s.cancelada || !alive.current) { await terminar(false); return; }
      s.inicio = Date.now(); recorder.record({ forDuration: 120 }); setFase('gravando');
    } catch (e) {
      if (alive.current && !s.cancelada) props.current.erro(e instanceof Error ? e.message : t('Não foi possível gravar o áudio.'));
      s.cancelada = true;
    } finally {
      if (!s.preparada) {
        await A.setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        gravacaoEmUso = false;
        if (sessao.current === s) sessao.current = null;
        if (alive.current) { setFase('parado'); props.current.ativo(false); }
      } else if (s.cancelada) await terminar(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener('change', state => { if (state === 'background') void terminar(false); });
    return () => { alive.current = false; if (sessao.current) sessao.current.cancelada = true; void terminar(false); sub.remove(); };
  }, []);
  useEffect(() => { if (fase === 'gravando' && status.durationMillis >= 119500) void terminar(true); }, [fase, status.durationMillis]);
  const ocupado = fase === 'preparando' || fase === 'parando';
  return <View>
    {fase !== 'parado' ? <View style={{ position: 'absolute', bottom: 58, right: 0, width: 270, padding: 12, borderRadius: 16, backgroundColor: c.surface }}>
      <Text accessibilityLiveRegion="polite" style={{ color: c.text }}>{fase === 'gravando' ? `${t('Gravando áudio')} · ${Math.floor(status.durationMillis / 1000)} s` : t('Preparando áudio…')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void terminar(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.text }}>{t('Cancelar gravação')}</Text></Pressable>
    </View> : null}
    <Pressable disabled={p.disabled || ocupado} accessibilityRole="button" accessibilityLabel={fase === 'gravando' ? t('Parar gravação') : t('Gravar áudio')}
      onPress={() => void (fase === 'gravando' ? terminar(true) : iniciar())}
      style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.brandMid, alignItems: 'center', justifyContent: 'center' }}>
      {ocupado ? <ActivityIndicator color="#fff" /> : <IconeMicrofone parar={fase === 'gravando'} />}
    </Pressable>
  </View>;
}

/**
 * Pausa sem derrubar a tela. Quando a prévia desmonta (ao ENVIAR o áudio), o
 * `useAudioPlayer` do expo-audio libera o player ANTES das nossas limpezas,
 * porque foi declarado antes, e `pause()` num player liberado LANÇA
 * NativeSharedObjectNotFoundException. Erro em limpeza de efeito sobe até o
 * ErrorBoundary e a pessoa vê "Algo deu errado". Medido em 24/11/2026 na
 * telemetria (`render_crash` em PreviaNativa, iOS 1.0.5 build 53): o primeiro
 * binário do iPhone com o módulo de áudio. Todo `pause()` da prévia passa por aqui.
 */
function pausarSemQuebrar(player: { pause(): void }) {
  try { player.pause(); } catch { /* player já liberado pelo expo-audio */ }
}

export function PreviaAudio({ uri, busy }: { uri: string; busy: boolean }) {
  return disponivel ? <PreviaNativa key={uri} uri={uri} busy={busy} /> : null;
}
function PreviaNativa({ uri, busy }: { uri: string; busy: boolean }) {
  const A = carregarAudio();
  const player = A.useAudioPlayer(uri), status = A.useAudioPlayerStatus(player);
  const c = useColors(), t = useT();
  const [erro, setErro] = useState(false);
  const focada = useRef(true), vivo = useRef(true), revisao = useRef(0), ocupado = useRef(busy); ocupado.current = busy;
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; revisao.current++; }; }, []);
  useFocusEffect(useCallback(() => { focada.current = true; return () => { focada.current = false; revisao.current++; pausarSemQuebrar(player); }; }, [player]));
  useEffect(() => { if (busy) { revisao.current++; pausarSemQuebrar(player); } }, [busy, player]);
  useEffect(() => { const sub = AppState.addEventListener('change', s => { if (s !== 'active') { revisao.current++; pausarSemQuebrar(player); } }); return () => sub.remove(); }, [player]);
  return <Pressable disabled={busy || !status.isLoaded} accessibilityRole="button" onPress={async () => {
    const r = ++revisao.current;
    const vigente = () => vivo.current && focada.current && revisao.current === r && !ocupado.current;
    try {
    setErro(false);
    if (status.playing) { pausarSemQuebrar(player); return; }
    await A.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
    if (!vigente()) return;
    if (status.didJustFinish) await player.seekTo(0);
    if (vigente()) player.play();
    } catch { if (vigente()) setErro(true); }
  }} style={{ minHeight: 48, padding: 12 }}><Text style={{ color: c.text }}>{erro ? t('Não foi possível ouvir. Toque para tentar novamente.') : status.playing ? t('Pausar áudio') : t('Ouvir áudio')} · {Math.ceil(status.duration)} s</Text></Pressable>;
}
