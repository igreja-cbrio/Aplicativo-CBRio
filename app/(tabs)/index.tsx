import { useEffect, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { cultos } from '@/lib/api';
import { C } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';

const PROXIMOS_CULTOS = [
  { dia: 'Domingo', horarios: ['08:30', '10:00', '19:00'], local: 'Sede CBRio' },
  { dia: 'Quarta',  horarios: ['20:00'],                   local: 'Sede CBRio' },
  { dia: 'Sábado',  horarios: ['17:00 Bridge', '20:00 AMI'], local: 'Sede CBRio' },
];

function diasSemana() {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return dias[new Date().getDay()];
}

export default function Home() {
  const router  = useRouter();
  const [nome, setNome] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      setNome(meta?.nome || data.user?.email?.split('@')[0] || '');
    });
  }, []);

  const hojeIdx  = new Date().getDay(); // 0=dom,3=qua,6=sáb
  const proxDia  = PROXIMOS_CULTOS.find(c =>
    ['Domingo','Quarta','Sábado'][0] === diasSemana()
  ) || PROXIMOS_CULTOS[0];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#00B39D', '#00c9af']} style={s.header}>
          <View>
            <Text style={s.headerGreet}>
              {nome ? `Olá, ${nome.split(' ')[0]}` : 'Bem-vindo'}
            </Text>
            <Text style={s.headerSub}>CBRio — Igreja de Cristo no Rio</Text>
          </View>
          <TouchableOpacity style={s.notifBtn}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={s.body}>

          {/* Próximo culto */}
          <Text style={s.sectionTitle}>Próximos cultos</Text>
          {PROXIMOS_CULTOS.map(c => (
            <Card key={c.dia} style={s.cultoCard}>
              <View style={s.cultoRow}>
                <View style={[s.cultoDia, { backgroundColor: C.primaryDim }]}>
                  <Text style={[s.cultoDiaText, { color: C.primary }]}>{c.dia.slice(0, 3)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cultoTitle}>{c.dia}</Text>
                  <Text style={s.cultoHorarios}>{c.horarios.join(' · ')}</Text>
                  <View style={s.cultoLocalRow}>
                    <Ionicons name="location-outline" size={12} color={C.text2} />
                    <Text style={s.cultoLocal}> {c.local}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={s.checkinBtn}
                  onPress={() => router.push('/checkin')}
                >
                  <Text style={s.checkinBtnText}>Check-in</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}

          {/* Ações rápidas */}
          <Text style={s.sectionTitle}>Ações rápidas</Text>
          <View style={s.acoes}>
            <ActionCard
              icon="person-add"
              label="Sou Visitante"
              color={C.info}
              onPress={() => router.push('/visitante')}
            />
            <ActionCard
              icon="people"
              label="Grupos"
              color={C.purple}
              onPress={() => router.push('/grupos')}
            />
            <ActionCard
              icon="qr-code"
              label="Check-in"
              color={C.primary}
              onPress={() => router.push('/checkin')}
            />
          </View>

          {/* Sobre */}
          <Card style={{ marginBottom: 8 }}>
            <Text style={s.sobreTitle}>Nossa missão</Text>
            <Text style={s.sobreText}>
              Fazer discípulos que façam discípulos, transformando vidas pelo poder do Evangelho
              no Rio de Janeiro e ao redor do mundo.
            </Text>
          </Card>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ icon, label, color, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.actionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flexGrow: 1, paddingBottom: 32 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 24 },
  headerGreet:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  notifBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  body:         { padding: 20, gap: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  cultoCard:    { marginBottom: 8 },
  cultoRow:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cultoDia:     { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cultoDiaText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  cultoTitle:   { fontSize: 15, fontWeight: '700', color: C.text },
  cultoHorarios:{ fontSize: 13, color: C.text2, marginTop: 1 },
  cultoLocalRow:{ flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cultoLocal:   { fontSize: 11, color: C.text2 },
  checkinBtn:   { backgroundColor: C.primaryDim, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  checkinBtnText:{ fontSize: 12, fontWeight: '700', color: C.primary },
  acoes:        { flexDirection: 'row', gap: 12 },
  actionCard:   { flex: 1, backgroundColor: C.card, borderRadius: 20, padding: 16, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  actionIcon:   { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionLabel:  { fontSize: 12, fontWeight: '600', color: C.text, textAlign: 'center' },
  sobreTitle:   { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 8 },
  sobreText:    { fontSize: 13, color: C.text2, lineHeight: 20 },
});
