import React, { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useDialogo } from '@/components/ui/Dialogo';
import { useT } from '@/lib/i18n';
import { acaoPermissaoPush } from '@/lib/permissaoPush';
import { registerForPush } from '@/lib/push';

const apresentados = new Set<string>();
export function ConviteNotificacoes({ userId, onSettled }: { userId: string; onSettled?: () => void }) {
  const { confirmar, Dialogo } = useDialogo();
  const t = useT();
  useEffect(() => {
    if (Platform.OS === 'web') { onSettled?.(); return; }
    let cancelado = false;
    let ocupado = false;
    const chave = `cbrio:convite-notificacoes:v1:${userId}`;
    async function conferir() {
      if (ocupado || AppState.currentState !== 'active') return;
      ocupado = true;
      try {
        const p = await Notifications.getPermissionsAsync();
        if (cancelado) return;
        const acao = acaoPermissaoPush(p);
        if (acao === 'registrar') { await registerForPush(userId); return; }
        if (apresentados.has(chave) || await AsyncStorage.getItem(chave)) return;
        if (cancelado || AppState.currentState !== 'active') return;
        apresentados.add(chave);
        // Marca ao exibir: fechar ou escolher Agora não não repete a cada abertura.
        void AsyncStorage.setItem(chave, '1').catch(() => {});
        const aceitou = await confirmar({
          titulo: t('Receber avisos da CBRio?'),
          mensagem: acao === 'configuracoes'
            ? t('As notificações estão desativadas neste celular. Abra as Configurações para receber avisos e convites da igreja.')
            : t('Ative as notificações para receber avisos e convites da igreja. Você pode mudar essa escolha nas Configurações.'),
          acao: acao === 'configuracoes' ? t('Abrir Configurações') : t('Ativar notificações'),
          cancelar: t('Agora não'),
        });
        if (!aceitou || cancelado) return;
        if (acao === 'configuracoes') await Linking.openSettings();
        else await registerForPush(userId, { solicitarPermissao: true });
      } catch { /* não impede usar o aplicativo; Configurações continua disponível */ }
      finally { ocupado = false; if (!cancelado) onSettled?.(); }
    }
    void conferir();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void conferir(); });
    return () => { cancelado = true; sub.remove(); };
  }, [userId, confirmar, t, onSettled]);
  return <Dialogo />;
}
