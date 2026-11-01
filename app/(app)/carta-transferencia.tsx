import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView } from '@/components/navigation/DockContent';
import { Text } from '@/components/ui/Typography';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useDialogo } from '@/components/ui/Dialogo';
import { TecladoSeguro } from '@/components/ui/TecladoSeguro';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import {
  carregarTransferencias,
  solicitarTransferencia,
  pedidoAberto,
  nomeIgrejaValido,
  STATUS_TRANSFERENCIA,
  type MeusPedidosTransferencia,
} from '@/lib/cartaTransferencia';

export default function CartaTransferencia() {
  const colors = useColors();
  const t = useT();
  const router = useRouter();
  const dlg = useDialogo();
  const [dados, setDados] = useState<MeusPedidosTransferencia | null>(null);
  const [igreja, setIgreja] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const ativa = useRef(false);
  const sequencia = useRef(0);
  const trava = useRef(false);
  const carregar = useCallback(async () => {
    const seq = ++sequencia.current;
    setCarregando(true);
    setErro('');
    try {
      const r = await carregarTransferencias();
      if (ativa.current && seq === sequencia.current) setDados(r);
    } catch (e) {
      if (ativa.current && seq === sequencia.current)
        setErro(
          e instanceof Error
            ? e.message
            : 'Não foi possível carregar seu pedido.',
        );
    } finally {
      if (ativa.current && seq === sequencia.current) setCarregando(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      ativa.current = true;
      setEnviando(trava.current);
      carregar();
      return () => {
        ativa.current = false;
        sequencia.current++;
      };
    }, [carregar]),
  );
  async function enviar() {
    if (
      trava.current ||
      !dados?.pode_solicitar ||
      pedidoAberto(dados.pedidos) ||
      !nomeIgrejaValido(igreja)
    )
      return;
    trava.current = true;
    setEnviando(true);
    setErro('');
    Keyboard.dismiss();
    try {
      const { pedido } = await solicitarTransferencia(igreja);
      if (ativa.current) {
        setDados((d) =>
          d
            ? {
                ...d,
                pedidos: [
                  pedido,
                  ...d.pedidos.filter((p) => p.id !== pedido.id),
                ],
              }
            : d,
        );
        setIgreja('');
      }
    } catch (e) {
      if (ativa.current)
        setErro(
          e instanceof Error
            ? e.message
            : 'Não foi possível enviar seu pedido. Tente novamente.',
        );
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }
  const aberto = dados && pedidoAberto(dados.pedidos);
  const card = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 12,
  };
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['left', 'right']}
    >
      <TecladoSeguro style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Voltar')}
              onPress={() => router.navigate('/cuidados')}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
            <Text
              style={{
                flex: 1,
                fontSize: 24,
                fontWeight: '700',
                color: colors.text,
              }}
            >
              {t('Carta de transferência')}
            </Text>
          </View>
          <Text
            style={{ fontSize: 16, lineHeight: 24, color: colors.textMuted }}
          >
            {t(
              'Vai para outra igreja? Envie seu pedido à equipe de Cuidados. Depois do atendimento, Integração cuidará da sua transferência.',
            )}
          </Text>
          {carregando && (
            <ActivityIndicator
              color={colors.primary}
              accessibilityLabel={t('Carregando...')}
            />
          )}
          {!!erro && (
            <View style={{ gap: 12 }}>
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {t(erro)}
              </Text>
              <Button
                title={t('Tentar novamente')}
                variant="ghost"
                onPress={carregar}
                disabled={carregando || enviando}
              />
            </View>
          )}
          {dados && (
            <>
              <View style={card}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: colors.text,
                  }}
                >
                  {t('Seus dados cadastrais')}
                </Text>
                <Text style={{ color: colors.text }}>{dados.pessoa.nome}</Text>
                <Text style={{ color: colors.textMuted }}>
                  {dados.pessoa.email || t('E-mail não cadastrado')}
                </Text>
                <Text style={{ color: colors.textMuted }}>
                  {dados.pessoa.telefone || t('Telefone não cadastrado')}
                </Text>
                <Button
                  title={t('Atualizar meu cadastro')}
                  variant="ghost"
                  onPress={() => router.navigate('/perfil')}
                  disabled={enviando}
                />
              </View>
              {!aberto && dados.pode_solicitar && (
                <View style={card}>
                  <Input
                    label={t('Igreja de destino')}
                    value={igreja}
                    onChangeText={setIgreja}
                    maxLength={160}
                    autoCapitalize="words"
                    editable={!enviando}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <Text style={{ color: colors.textMuted, lineHeight: 22 }}>
                    {t(
                      'Não é necessário informar o motivo da saída. Seu vínculo com a membresia continua ativo durante o atendimento.',
                    )}
                  </Text>
                  <Button
                    title={t('Solicitar transferência')}
                    loading={enviando}
                    disabled={carregando || !nomeIgrejaValido(igreja)}
                    onPress={async () => {
                      Keyboard.dismiss();
                      if (
                        await dlg.confirmar({
                          titulo: t('Enviar pedido de transferência?'),
                          mensagem: igreja.trim(),
                          acao: t('Enviar pedido'),
                          cancelar: t('Voltar'),
                        })
                      )
                        await enviar();
                    }}
                  />
                </View>
              )}
              {!aberto && !dados.pode_solicitar && (
                <Text style={{ color: colors.textMuted, lineHeight: 24 }}>
                  {t(
                    'Este pedido está disponível para membros ativos. Se precisar de ajuda com seu cadastro, fale com a equipe de Cuidados.',
                  )}
                </Text>
              )}
              {!!dados.pedidos.length && (
                <View style={{ gap: 14 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: colors.text,
                    }}
                  >
                    {t('Meus pedidos')}
                  </Text>
                  {dados.pedidos.map((p) => (
                    <View key={p.id} style={card}>
                      <Text
                        style={{ color: colors.primary, fontWeight: '700' }}
                      >
                        {t(STATUS_TRANSFERENCIA[p.status])}
                      </Text>
                      <Text style={{ color: colors.text }}>
                        {p.igreja_destino}
                      </Text>
                      <Text style={{ color: colors.textMuted }}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </Text>
                      {p.status === 'em_cuidados' && (
                        <Text style={{ color: colors.textMuted }}>
                          {t(
                            'Seu pedido foi recebido. A equipe de Cuidados entrará em contato com você.',
                          )}
                        </Text>
                      )}
                      {p.status === 'finalizada' && (
                        <Text style={{ color: colors.textMuted }}>
                          {t(
                            'Sua transferência foi concluída e seu vínculo de membresia com a CBRio foi encerrado.',
                          )}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </TecladoSeguro>
      <dlg.Dialogo />
    </SafeAreaView>
  );
}
