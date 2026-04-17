import { useEffect, useState } from 'react';
import {
  Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { grupos as gruposApi } from '@/lib/api';
import { C } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Grupos() {
  const [lista, setLista]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    gruposApi.list()
      .then(setLista)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => setExpanded(e => e === id ? null : id);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={s.title}>Grupos</Text>
          <Text style={s.sub}>Encontre sua comunidade</Text>
        </View>

        <View style={s.body}>
          <Text style={s.sectionTitle}>Grupos de conexão</Text>
          <Text style={s.sectionSub}>
            Os grupos são o coração da nossa comunidade — um lugar para crescer na fé e construir amizades reais.
          </Text>

          {loading ? (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>Carregando grupos...</Text>
            </View>
          ) : lista.length === 0 ? (
            <FallbackGrupos />
          ) : (
            lista.map(g => (
              <GrupoCard
                key={g.id}
                grupo={g}
                expanded={expanded === g.id}
                onPress={() => toggle(g.id)}
              />
            ))
          )}

          <Card style={s.infoCard}>
            <View style={s.infoRow}>
              <Ionicons name="add-circle" size={22} color={C.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.infoTitle}>Quero participar de um grupo</Text>
                <Text style={s.infoText}>
                  Fale com nossa equipe de integração ou acesse o site para se inscrever.
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GrupoCard({ grupo, expanded, onPress }: { grupo: any; expanded: boolean; onPress: () => void }) {
  const handleWA = () => {
    if (grupo.whatsapp) Linking.openURL(`https://wa.me/${grupo.whatsapp.replace(/\D/g, '')}`);
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.grupoCard}>
      <View style={s.grupoRow}>
        <View style={[s.grupoIcon, { backgroundColor: (grupo.color || C.primary) + '18' }]}>
          <Ionicons name="people" size={22} color={grupo.color || C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.grupoName}>{grupo.nome || grupo.name}</Text>
          {grupo.bairro && <Text style={s.grupoBairro}>{grupo.bairro}</Text>}
        </View>
        {grupo.dia_semana != null && (
          <View style={s.diaBadge}>
            <Text style={s.diaText}>{DIAS[grupo.dia_semana] || ''}</Text>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={C.text2}
          style={{ marginLeft: 8 }}
        />
      </View>

      {expanded && (
        <View style={s.grupoDetail}>
          {grupo.horario && (
            <DetailRow icon="time-outline" text={grupo.horario} />
          )}
          {grupo.lider && (
            <DetailRow icon="person-outline" text={`Líder: ${grupo.lider}`} />
          )}
          {grupo.local && (
            <DetailRow icon="location-outline" text={grupo.local} />
          )}
          {grupo.descricao && (
            <Text style={s.grupoDesc}>{grupo.descricao}</Text>
          )}
          {grupo.whatsapp && (
            <TouchableOpacity onPress={handleWA} style={s.waBtn}>
              <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
              <Text style={s.waBtnText}>Entrar no grupo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function DetailRow({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={s.detailRow}>
      <Ionicons name={icon} size={14} color={C.text2} />
      <Text style={s.detailText}>{text}</Text>
    </View>
  );
}

function FallbackGrupos() {
  const grupos = [
    { id: '1', nome: 'Grupo Domingo Manhã', bairro: 'Botafogo', horario: 'Sábados às 19h', lider: 'Pastor Marcos', color: C.primary },
    { id: '2', nome: 'Bridge Jovens', bairro: 'Centro', horario: 'Sextas às 20h', lider: 'Lucas & Ana', color: C.purple },
    { id: '3', nome: 'Grupo Família', bairro: 'Barra da Tijuca', horario: 'Sábados às 18h', lider: 'Paulo & Maria', color: C.info },
    { id: '4', nome: 'AMI — Adultos Mais Igreja', bairro: 'Tijuca', horario: 'Sábados às 17h', lider: 'Pr. Roberto', color: C.warn },
  ];

  return (
    <>
      {grupos.map(g => (
        <View key={g.id} style={s.grupoCard}>
          <View style={s.grupoRow}>
            <View style={[s.grupoIcon, { backgroundColor: g.color + '18' }]}>
              <Ionicons name="people" size={22} color={g.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.grupoName}>{g.nome}</Text>
              <Text style={s.grupoBairro}>{g.bairro}</Text>
            </View>
          </View>
          <View style={s.grupoDetail}>
            <DetailRow icon="time-outline" text={g.horario} />
            <DetailRow icon="person-outline" text={`Líder: ${g.lider}`} />
          </View>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flexGrow: 1, paddingBottom: 32 },
  header:       { backgroundColor: C.purple, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  title:        { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub:          { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  body:         { padding: 20, gap: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  sectionSub:   { fontSize: 13, color: C.text2, lineHeight: 19, marginTop: 4, marginBottom: 4 },
  emptyState:   { alignItems: 'center', paddingVertical: 40 },
  emptyText:    { color: C.text2, fontSize: 14 },
  grupoCard:    { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.border, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  grupoRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grupoIcon:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grupoName:    { fontSize: 15, fontWeight: '700', color: C.text },
  grupoBairro:  { fontSize: 12, color: C.text2, marginTop: 2 },
  diaBadge:     { backgroundColor: C.primaryDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  diaText:      { fontSize: 11, fontWeight: '700', color: C.primary },
  grupoDetail:  { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 8 },
  detailRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText:   { fontSize: 13, color: C.text2 },
  grupoDesc:    { fontSize: 13, color: C.text2, lineHeight: 19, marginTop: 4 },
  waBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#E8FFF0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  waBtnText:    { fontSize: 13, fontWeight: '700', color: '#25D366' },
  infoCard:     { marginTop: 4 },
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start' },
  infoTitle:    { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
  infoText:     { fontSize: 12, color: C.text2, lineHeight: 18 },
});
