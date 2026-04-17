import { useEffect, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cultos } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { C } from '@/constants/Colors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function Checkin() {
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [selected, setSelected]         = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [done, setDone]                 = useState(false);

  useEffect(() => {
    cultos.serviceTypes().then(setServiceTypes).catch(() => {});
  }, []);

  const hoje = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  const handleCheckin = async () => {
    if (!selected) { Alert.alert('Selecione o culto'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await cultos.checkin({
        service_type_id: selected,
        data: format(new Date(), 'yyyy-MM-dd'),
        membro_id: user?.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (e: any) {
      Alert.alert('Erro ao fazer check-in', e.message);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={s.doneCircle}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <Text style={s.doneTitle}>Check-in feito!</Text>
        <Text style={s.doneSub}>
          Que bom que você está aqui hoje.{'\n'}Que Deus abençoe seu dia!
        </Text>
        <Button label="Novo check-in" variant="outline" onPress={() => { setDone(false); setSelected(null); }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.title}>Check-in</Text>
          <Text style={s.sub}>{hoje}</Text>
        </View>

        <Text style={s.instrucao}>Selecione o culto que você está participando:</Text>

        <View style={s.lista}>
          {serviceTypes.length === 0
            ? [
                { id: 'd1', name: 'Domingo 08:30', color: C.primary },
                { id: 'd2', name: 'Domingo 10:00', color: '#10b981' },
                { id: 'd3', name: 'Domingo 19:00', color: C.purple },
                { id: 'q1', name: 'Quarta com Deus', color: C.info },
                { id: 'a1', name: 'AMI', color: C.warn },
              ].map(st => (
                <ServiceCard key={st.id} st={st} selected={selected === st.id} onPress={() => setSelected(st.id)} />
              ))
            : serviceTypes.map(st => (
                <ServiceCard key={st.id} st={st} selected={selected === st.id} onPress={() => setSelected(st.id)} />
              ))
          }
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Button
            label="Confirmar check-in"
            onPress={handleCheckin}
            loading={loading}
            disabled={!selected}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceCard({ st, selected, onPress }: { st: any; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.serviceCard, selected && { borderColor: st.color || C.primary, borderWidth: 2, backgroundColor: (st.color || C.primary) + '08' }]}
    >
      <View style={[s.serviceColor, { backgroundColor: st.color || C.primary }]} />
      <Text style={[s.serviceName, selected && { color: st.color || C.primary, fontWeight: '700' }]}>
        {st.name}
      </Text>
      {selected && <Ionicons name="checkmark-circle" size={22} color={st.color || C.primary} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flexGrow: 1, paddingBottom: 32 },
  header:       { backgroundColor: C.primary, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  title:        { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub:          { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, textTransform: 'capitalize' },
  instrucao:    { fontSize: 14, color: C.text2, paddingHorizontal: 20, paddingVertical: 20 },
  lista:        { gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  serviceCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  serviceColor: { width: 10, height: 10, borderRadius: 5 },
  serviceName:  { flex: 1, fontSize: 15, fontWeight: '500', color: C.text },
  doneCircle:   { width: 96, height: 96, borderRadius: 48, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  doneTitle:    { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 8 },
  doneSub:      { fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
