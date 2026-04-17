import { useEffect, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { membro as membroApi } from '@/lib/api';
import { C } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function Perfil() {
  const router  = useRouter();
  const [perfil, setPerfil] = useState<any>(null);
  const [user, setUser]     = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        membroApi.perfil(data.user.id).then(setPerfil).catch(() => {});
      }
    });
  }, []);

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const nome  = perfil?.nome || user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Membro';
  const email = user?.email || '';
  const iniciais = nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{iniciais}</Text>
          </View>
          <Text style={s.nome}>{nome}</Text>
          <Text style={s.email}>{email}</Text>
          {perfil?.celula && (
            <View style={s.celulaBadge}>
              <Ionicons name="people" size={13} color={C.primary} />
              <Text style={s.celulaText}>{perfil.celula}</Text>
            </View>
          )}
        </View>

        <View style={s.body}>

          {/* Info cards */}
          {perfil && (
            <Card style={s.infoCard}>
              <Text style={s.cardTitle}>Informações</Text>
              {perfil.telefone && (
                <InfoRow icon="call-outline" label="Telefone" value={perfil.telefone} />
              )}
              {perfil.data_nascimento && (
                <InfoRow icon="calendar-outline" label="Nascimento" value={perfil.data_nascimento} />
              )}
              {perfil.endereco && (
                <InfoRow icon="location-outline" label="Endereço" value={perfil.endereco} />
              )}
              {perfil.situacao && (
                <InfoRow icon="checkmark-circle-outline" label="Situação" value={perfil.situacao} />
              )}
            </Card>
          )}

          {/* Quick stats */}
          <View style={s.statsRow}>
            <StatCard label="Check-ins" value={perfil?.total_checkins ?? '—'} icon="qr-code" />
            <StatCard label="Grupos" value={perfil?.total_grupos ?? '—'} icon="people" />
            <StatCard label="Desde" value={perfil?.membro_desde ? new Date(perfil.membro_desde).getFullYear().toString() : '—'} icon="star" />
          </View>

          {/* Menu items */}
          <Card>
            <MenuItem icon="person-outline"         label="Sou Visitante"         onPress={() => router.push('/visitante')} />
            <MenuItem icon="notifications-outline"  label="Notificações"          onPress={() => {}} />
            <MenuItem icon="shield-checkmark-outline" label="Privacidade"         onPress={() => {}} last />
          </Card>

          <Card style={{ marginTop: 0 }}>
            <MenuItem icon="help-circle-outline"    label="Ajuda & Suporte"       onPress={() => {}} />
            <MenuItem icon="information-circle-outline" label="Sobre o App"       onPress={() => {}} last />
          </Card>

          <Button label="Sair da conta" variant="outline" onPress={handleLogout} fullWidth />

          <Text style={s.version}>CBRio App v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={16} color={C.text2} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon} size={20} color={C.primary} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, last }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.menuItem, !last && s.menuItemBorder]}
    >
      <Ionicons name={icon} size={20} color={C.text2} />
      <Text style={s.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={C.border} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flexGrow: 1, paddingBottom: 40 },
  header:       { backgroundColor: C.primary, paddingTop: 32, paddingBottom: 36, alignItems: 'center', gap: 6 },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText:   { fontSize: 28, fontWeight: '800', color: '#fff' },
  nome:         { fontSize: 20, fontWeight: '800', color: '#fff' },
  email:        { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  celulaBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  celulaText:   { fontSize: 12, fontWeight: '600', color: '#fff' },
  body:         { padding: 20, gap: 12 },
  cardTitle:    { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard:     {},
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel:    { fontSize: 13, color: C.text2, flex: 1 },
  infoValue:    { fontSize: 13, fontWeight: '600', color: C.text },
  statsRow:     { flexDirection: 'row', gap: 10 },
  statCard:     { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.border },
  statValue:    { fontSize: 20, fontWeight: '800', color: C.text },
  statLabel:    { fontSize: 11, color: C.text2, fontWeight: '600', textAlign: 'center' },
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuItemBorder:{ borderBottomWidth: 1, borderBottomColor: C.border },
  menuLabel:    { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  version:      { textAlign: 'center', fontSize: 12, color: C.text2, marginTop: 8 },
});
