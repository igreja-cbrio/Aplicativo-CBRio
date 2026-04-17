import { useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '@/constants/Colors';
import { Button } from '@/components/ui/Button';
import { inscricoes as inscricoesApi } from '@/lib/api';

interface Inscricao {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  titulo: string;
  descricao: string;
  cor: string;
  aberto: boolean;
  info?: string;
}

const TIPOS: Inscricao[] = [
  {
    id: 'grupos',
    icon: 'people',
    titulo: 'Grupos de Conexão',
    descricao: 'Encontre pessoas e cresça em comunidade.',
    cor: C.primary,
    aberto: true,
    info: 'Os grupos se reúnem semanalmente em casas e espaços da cidade. Escolha pelo dia ou bairro.',
  },
  {
    id: 'eventos',
    icon: 'calendar',
    titulo: 'Eventos & Conferências',
    descricao: 'Participe dos próximos eventos da CBRio.',
    cor: C.purple,
    aberto: true,
    info: 'Inscrições abertas para os eventos desta temporada.',
  },
  {
    id: 'batismo',
    icon: 'water',
    titulo: 'Batismo',
    descricao: 'Dê esse passo de fé com a nossa comunidade.',
    cor: C.info,
    aberto: true,
    info: 'O batismo é um marco importante da sua jornada cristã. Próxima cerimônia em breve.',
  },
  {
    id: 'retiro',
    icon: 'leaf',
    titulo: 'Retiro',
    descricao: 'Dias de encontro profundo com Deus.',
    cor: '#10B981',
    aberto: true,
    info: 'Retiros anuais de renovação espiritual.',
  },
  {
    id: 'cursos',
    icon: 'school',
    titulo: 'Cursos & Formação',
    descricao: 'Discipulado, liderança e formação cristã.',
    cor: C.warn,
    aberto: true,
    info: 'Curso Ágape, Bases, Voluntariado e mais.',
  },
  {
    id: 'next',
    icon: 'rocket',
    titulo: 'NEXT',
    descricao: 'Programa de discipulado para jovens.',
    cor: C.purple,
    aberto: true,
    info: 'NEXT é o programa de formação de jovens líderes da CBRio.',
  },
  {
    id: 'voluntariado',
    icon: 'hand-right',
    titulo: 'Quero ser Voluntário',
    descricao: 'Sirva na CBRio com seus dons e talentos.',
    cor: '#EC4899',
    aberto: true,
    info: 'Complete o cadastro de voluntário para começar a servir. Após aprovação, você terá acesso ao módulo de Voluntariado.',
  },
];

export default function Inscricoes() {
  const router = useRouter();
  const [selected, setSelected] = useState<Inscricao | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleInscrever = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await inscricoesApi.inscrever(selected.id, {});
      Alert.alert('Inscrição recebida!', 'Nossa equipe vai entrar em contato em breve.');
      setSelected(null);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Inscrições</Text>
          <Text style={s.sub}>Participe da vida da CBRio</Text>
        </View>

        <View style={s.body}>
          {TIPOS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.card, !t.aberto && s.cardFechado]}
              onPress={() => t.aberto && setSelected(t)}
              activeOpacity={t.aberto ? 0.8 : 1}
            >
              <View style={[s.iconBox, { backgroundColor: t.cor + '18' }]}>
                <Ionicons name={t.icon} size={26} color={t.cor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitulo}>{t.titulo}</Text>
                <Text style={s.cardDesc}>{t.descricao}</Text>
              </View>
              {t.aberto
                ? <View style={[s.badge, { backgroundColor: t.cor + '18' }]}>
                    <Text style={[s.badgeText, { color: t.cor }]}>Aberto</Text>
                  </View>
                : <View style={[s.badge, { backgroundColor: C.border }]}>
                    <Text style={[s.badgeText, { color: C.text2 }]}>Em breve</Text>
                  </View>
              }
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <SafeAreaView style={s.modal}>
            <View style={s.modalHeader}>
              <View style={[s.modalIcon, { backgroundColor: selected.cor + '18' }]}>
                <Ionicons name={selected.icon} size={32} color={selected.cor} />
              </View>
              <Text style={s.modalTitulo}>{selected.titulo}</Text>
              {selected.info && <Text style={s.modalInfo}>{selected.info}</Text>}
            </View>
            <View style={s.modalActions}>
              <Button label="Quero me inscrever" onPress={handleInscrever} loading={loading} fullWidth />
              <Button label="Cancelar" variant="ghost" onPress={() => setSelected(null)} fullWidth />
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  scroll:      { flexGrow: 1, paddingBottom: 32 },
  header:      { backgroundColor: C.info, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  title:       { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub:         { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  body:        { padding: 16, gap: 10 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardFechado: { opacity: 0.5 },
  iconBox:     { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitulo:  { fontSize: 15, fontWeight: '700', color: C.text },
  cardDesc:    { fontSize: 12, color: C.text2, marginTop: 3, lineHeight: 17 },
  badge:       { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  modal:       { flex: 1, backgroundColor: C.bg },
  modalHeader: { padding: 28, gap: 10, alignItems: 'center', paddingTop: 40 },
  modalIcon:   { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  modalTitulo: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center' },
  modalInfo:   { fontSize: 14, color: C.text2, lineHeight: 21, textAlign: 'center' },
  modalActions:{ padding: 24, gap: 10 },
});
