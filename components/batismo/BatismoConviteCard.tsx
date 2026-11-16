import { useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, Share, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import type { MeuBatismo } from '@/lib/batismo';
import { conviteBatismo } from '@/lib/batismoConvite';
import { gerarConviteBatismo } from '@/lib/batismoConviteImagem';

export function BatismoConviteCard({ batismo, agora }: { batismo: MeuBatismo; agora: number }) {
  const t = useT();
  const colors = useColors();
  const lock = useRef(false);
  const [busy, setBusy] = useState<'whatsapp' | 'imagem' | 'share' | null>(null);
  const [imagem, setImagem] = useState<string | null>(null);
  if (!conviteBatismo(batismo, agora)) return null;
  async function executar(tipo: NonNullable<typeof busy>, acao: { (): Promise<void> }) {
    if (lock.current) return;
    lock.current = true;
    setBusy(tipo);
    try { await acao(); }
    catch { Alert.alert(t("Não foi possível compartilhar"), t("Tente novamente em instantes.")); }
    finally { lock.current = false; setBusy(null); }
  }
  async function whatsapp() {
    const convite = conviteBatismo(batismo, Date.now());
    if (!convite) return;
    await executar('whatsapp', async () => {
      try { await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(convite.texto)}`); }
      catch { await Share.share({ message: convite.texto }); }
    });
  }
  async function criarImagem() {
    const convite = conviteBatismo(batismo, Date.now());
    if (!convite) return;
    await executar('imagem', async () => { setImagem(await gerarConviteBatismo(convite)); });
  }
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 24, padding: 20, gap: 14, marginBottom: 16 }}>
      <Ionicons name="heart-outline" size={26} color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{t("Esse momento fica melhor juntos")}</Text>
      <Text style={{ color: colors.textMuted, lineHeight: 23 }}>{t("Convide amigos e familiares para celebrar seu batismo.")}</Text>
      <Button title={t("Convidar pelo WhatsApp")} onPress={whatsapp} disabled={!!busy} loading={busy === 'whatsapp'} />
      <Button title={t("Criar convite para Stories")} variant="ghost" onPress={criarImagem} disabled={!!busy} loading={busy === 'imagem'} />
      <Modal visible={!!imagem} animationType="slide" onRequestClose={() => { if (!lock.current) setImagem(null); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>{t("Seu convite")}</Text>
            <Text style={{ color: colors.textMuted }}>{t("Compartilhe a arte no Instagram. Se Stories não aparecer entre as opções, salve a imagem e escolha-a ao criar um Story.")}</Text>
            {imagem && <Image accessibilityLabel={t("Prévia do convite de batismo")} source={{ uri: imagem }} style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 20 }} resizeMode="contain" />}
            <Button title={t("Compartilhar imagem")} disabled={!!busy} loading={busy === 'share'} onPress={() => executar('share', async () => {
              if (!imagem || !await Sharing.isAvailableAsync()) throw new Error('Compartilhamento indisponível');
              await Sharing.shareAsync(imagem, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t("Seu convite") });
            })} />
            <Button title={t("Fechar")} variant="ghost" disabled={!!busy} onPress={() => setImagem(null)} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
