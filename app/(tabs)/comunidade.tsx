import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Linking, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { grupos as gruposApi, voluntariado as voluntariadoApi } from '@/lib/api';
import { C } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function Comunidade() {
  const router  = useRouter();
  const [aba, setAba]           = useState<'grupos' | 'voluntariado'>('grupos');
  const [grupos, setGrupos]     = useState<any[]>([]);
  const [volInfo, setVolInfo]   = useState<any>(null);
  const [isVol, setIsVol]       = useState(false);
  const [loading, setLoading]   = useState(true);
  const [userId, setUserId]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      setUserId(id || null);
      Promise.all([
        gruposApi.meusGrupos().then(setGrupos).catch(() => setGrupos([])),
        id ? voluntariadoApi.status(id).then(r => { setIsVol(r.voluntario); setVolInfo(r); }).catch(() => {}) : Promise.resolve(),
      ]).finally(() => setLoading(false));
    });
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Comunidade</Text>
        <View style={s.abas}>
          <TouchableOpacity onPress={() => setAba('grupos')} style={[s.aba, aba === 'grupos' && s.abaActive]}>
            <Ionicons name="people" size={16} color={aba === 'grupos' ? C.primary : C.text2} />
            <Text style={[s.abaText, aba === 'grupos' && s.abaTextActive]}>Grupos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAba('voluntariado')} style={[s.aba, aba === 'voluntariado' && s.abaActive]}>
            <Ionicons name="hand-right" size={16} color={aba === 'voluntariado' ? '#EC4899' : C.text2} />
            <Text style={[s.abaText, aba === 'voluntariado' && { color: '#EC4899', fontWeight: '700' }]}>Voluntariado</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={C.primary} />
      ) : aba === 'grupos' ? (
        <AbaGrupos grupos={grupos} router={router} />
      ) : (
        <AbaVoluntariado isVol={isVol} volInfo={volInfo} router={router} />
      )}
    </SafeAreaView>
  );
}

function AbaGrupos({ grupos, router }: { grupos: any[]; router: any }) {
  if (grupos.length === 0) {
    return (
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.emptyState}>
          <View style={[s.emptyIcon, { backgroundColor: C.primaryDim }]}>
            <Ionicons name="people" size={32} color={C.primary} />
          </View>
          <Text style={s.emptyTitle}>Você ainda não está em um grupo</Text>
          <Text style={s.emptyText}>
            Os grupos de conexão são a melhor forma de viver em comunidade e crescer na fé.
          </Text>
          <Button label="Ver grupos disponíveis" onPress={() => router.push('/(tabs)/inscricoes')} fullWidth />
        </View>
        <ExploreGrupos />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.sectionTitle}>Meus grupos</Text>
      {grupos.map(g => (
        <Card key={g.id} style={s.grupoCard}>
          <View style={s.grupoRow}>
            <View style={[s.grupoIcon, { backgroundColor: (g.color || C.primary) + '18' }]}>
              <Ionicons name="people" size={22} color={g.color || C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.grupoNome}>{g.nome || g.name}</Text>
              {g.lider && <Text style={s.grupoLider}>Líder: {g.lider}</Text>}
              {g.horario && <Text style={s.grupoInfo}>{g.horario}</Text>}
            </View>
            {g.whatsapp && (
              <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${g.whatsapp.replace(/\D/g, '')}`)} style={s.waBtn}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </TouchableOpacity>
            )}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

function ExploreGrupos() {
  const OPCOES = [
    { nome: 'Grupos por bairro', icon: 'location' as const, cor: C.primary },
    { nome: 'Bridge – Jovens', icon: 'flash' as const, cor: C.purple },
    { nome: 'Grupo Família', icon: 'home' as const, cor: C.info },
    { nome: 'AMI – Adultos', icon: 'star' as const, cor: C.warn },
  ];

  return (
    <>
      <Text style={[s.sectionTitle, { marginTop: 8 }]}>Grupos disponíveis</Text>
      {OPCOES.map(g => (
        <TouchableOpacity key={g.nome} style={s.grupoCardExplore} activeOpacity={0.8}>
          <View style={[s.grupoIcon, { backgroundColor: g.cor + '18' }]}>
            <Ionicons name={g.icon} size={20} color={g.cor} />
          </View>
          <Text style={s.grupoNome}>{g.nome}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.text2} />
        </TouchableOpacity>
      ))}
    </>
  );
}

function AbaVoluntariado({ isVol, volInfo, router }: { isVol: boolean; volInfo: any; router: any }) {
  if (!isVol) {
    return (
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.emptyState}>
          <View style={[s.emptyIcon, { backgroundColor: '#EC489918' }]}>
            <Ionicons name="hand-right" size={32} color="#EC4899" />
          </View>
          <Text style={s.emptyTitle}>Você ainda não é voluntário</Text>
          <Text style={s.emptyText}>
            Sirva a CBRio com seus dons. Preencha o cadastro e aguarde a aprovação do líder da sua área.
          </Text>
          <Button label="Quero ser voluntário" onPress={() => router.push('/(tabs)/inscricoes')} fullWidth />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {volInfo?.area && (
        <Card style={s.volCard}>
          <Text style={s.volArea}>Área: {volInfo.area}</Text>
          {volInfo.funcao && <Text style={s.volFuncao}>{volInfo.funcao}</Text>}
        </Card>
      )}
      <Text style={s.sectionTitle}>Minhas escalas</Text>
      <Card>
        <Text style={s.volInfo}>
          Suas próximas escalas aparecerão aqui. Fique atento às notificações da sua área.
        </Text>
      </Card>
      <Text style={[s.sectionTitle, { marginTop: 8 }]}>Comunicados da área</Text>
      <Card>
        <Text style={s.volInfo}>Nenhum comunicado no momento.</Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  header:        { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border, paddingTop: 20 },
  title:         { fontSize: 22, fontWeight: '800', color: C.text, paddingHorizontal: 24, marginBottom: 12 },
  abas:          { flexDirection: 'row', paddingHorizontal: 16, gap: 4, paddingBottom: 0 },
  aba:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  abaActive:     { borderBottomColor: C.primary },
  abaText:       { fontSize: 14, fontWeight: '600', color: C.text2 },
  abaTextActive: { color: C.primary, fontWeight: '700' },
  scroll:        { padding: 16, paddingBottom: 32, gap: 10 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  emptyState:    { alignItems: 'center', padding: 24, gap: 12 },
  emptyIcon:     { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:    { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  emptyText:     { fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  grupoCard:     { marginBottom: 0 },
  grupoCardExplore: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  grupoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grupoIcon:     { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grupoNome:     { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  grupoLider:    { fontSize: 12, color: C.text2 },
  grupoInfo:     { fontSize: 12, color: C.text2 },
  waBtn:         { padding: 8 },
  volCard:       { borderLeftWidth: 4, borderLeftColor: '#EC4899' },
  volArea:       { fontSize: 14, fontWeight: '700', color: C.text },
  volFuncao:     { fontSize: 13, color: C.text2, marginTop: 2 },
  volInfo:       { fontSize: 14, color: C.text2 },
});
