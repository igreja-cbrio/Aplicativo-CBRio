import { useEffect, useState } from 'react';
import {
  Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { anuncios as anunciosApi } from '@/lib/api';
import { C } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';

const PROXIMOS_CULTOS = [
  { dia: 'Domingo',  horarios: ['08:30', '10:00', '19:00'],       local: 'Sede CBRio', color: C.primary },
  { dia: 'Quarta',   horarios: ['20:00'],                          local: 'Sede CBRio', color: C.info },
  { dia: 'Sábado',   horarios: ['17:00 Bridge', '20:00 AMI'],     local: 'Sede CBRio', color: C.purple },
];

const ACOES = [
  { icon: 'qr-code'     as const, label: 'Check-in',    color: C.primary, route: '/checkin' },
  { icon: 'ticket'      as const, label: 'Inscrições',  color: C.info,    route: '/(tabs)/inscricoes' },
  { icon: 'book'        as const, label: 'Bíblia',      color: C.purple,  route: '/(tabs)/biblia' },
  { icon: 'play-circle' as const, label: 'Assistir',    color: '#EF4444', route: '/(tabs)/assistir' },
  { icon: 'person-add'  as const, label: 'Visitante',   color: C.warn,    route: '/visitante' },
  { icon: 'heart'       as const, label: 'Generosidade', color: '#EC4899', route: null },
] as const;

const GENEROSIDADE_URL = 'https://crmcbrio.vercel.app/generosidade';

export default function Home() {
  const router = useRouter();
  const [nome, setNome]           = useState('');
  const [anunciosList, setAnuncios] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      setNome(meta?.nome || data.user?.email?.split('@')[0] || '');
    });
    anunciosApi.list().then(setAnuncios).catch(() => {});
  }, []);

  const handleAcao = (route: string | null) => {
    if (!route) { Linking.openURL(GENEROSIDADE_URL); return; }
    router.push(route as any);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <LinearGradient colors={['#00B39D', '#009986']} style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerGreet}>
              {nome ? `Olá, ${nome.split(' ')[0]}` : 'Bem-vindo'}
            </Text>
            <Text style={s.headerSub}>CBRio — Igreja de Cristo no Rio</Text>
          </View>
          <ProfileAvatar nome={nome} size={40} />
        </LinearGradient>

        <View style={s.body}>

          {/* Anúncios */}
          {anunciosList.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Avisos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.anunciosScroll}>
                {anunciosList.map((a, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.anuncioCard, { backgroundColor: a.cor || C.primary }]}
                    onPress={() => a.link && Linking.openURL(a.link)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.anuncioTitulo}>{a.titulo}</Text>
                    {a.descricao && <Text style={s.anuncioDesc}>{a.descricao}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Próximos cultos */}
          <Text style={s.sectionTitle}>Próximos cultos</Text>
          {PROXIMOS_CULTOS.map(c => (
            <Card key={c.dia} style={s.cultoCard}>
              <View style={s.cultoRow}>
                <View style={[s.cultoDia, { backgroundColor: c.color + '18' }]}>
                  <Text style={[s.cultoDiaText, { color: c.color }]}>{c.dia.slice(0, 3)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cultoTitle}>{c.dia}</Text>
                  <Text style={s.cultoHorarios}>{c.horarios.join(' · ')}</Text>
                  <View style={s.cultoLocalRow}>
                    <Ionicons name="location-outline" size={12} color={C.text2} />
                    <Text style={s.cultoLocal}> {c.local}</Text>
                  </View>
                </View>
                <TouchableOpacity style={[s.checkinBtn, { backgroundColor: c.color + '18' }]} onPress={() => router.push('/checkin')}>
                  <Text style={[s.checkinBtnText, { color: c.color }]}>Check-in</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}

          {/* Ações rápidas */}
          <Text style={s.sectionTitle}>Ações rápidas</Text>
          <View style={s.acoes}>
            {ACOES.map(a => (
              <TouchableOpacity key={a.label} style={s.actionCard} onPress={() => handleAcao(a.route)} activeOpacity={0.8}>
                <View style={[s.actionIcon, { backgroundColor: a.color + '18' }]}>
                  <Ionicons name={a.icon} size={24} color={a.color} />
                </View>
                <Text style={s.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

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

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flexGrow: 1, paddingBottom: 32 },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 22, gap: 12 },
  headerGreet:   { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:     { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  body:          { padding: 20, gap: 16 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  anunciosScroll:{ marginHorizontal: -20, paddingHorizontal: 20 },
  anuncioCard:   { width: 220, borderRadius: 18, padding: 16, marginRight: 12 },
  anuncioTitulo: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 4 },
  anuncioDesc:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 17 },
  cultoCard:     { marginBottom: 8 },
  cultoRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cultoDia:      { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cultoDiaText:  { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  cultoTitle:    { fontSize: 15, fontWeight: '700', color: C.text },
  cultoHorarios: { fontSize: 13, color: C.text2, marginTop: 1 },
  cultoLocalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cultoLocal:    { fontSize: 11, color: C.text2 },
  checkinBtn:    { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  checkinBtnText:{ fontSize: 12, fontWeight: '700' },
  acoes:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard:    { width: '30%', flexGrow: 1, backgroundColor: C.card, borderRadius: 18, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.border },
  actionIcon:    { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel:   { fontSize: 11, fontWeight: '600', color: C.text, textAlign: 'center' },
  sobreTitle:    { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 8 },
  sobreText:     { fontSize: 13, color: C.text2, lineHeight: 20 },
});
