import { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { membro as membroApi } from '@/lib/api';
import { C } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const CAMPOS = [
  { key: 'nome',             label: 'Nome completo',    type: 'default'  },
  { key: 'telefone',         label: 'Telefone/WhatsApp', type: 'phone-pad' },
  { key: 'email',            label: 'E-mail',            type: 'email-address' },
  { key: 'data_nascimento',  label: 'Data de nascimento (DD/MM/AAAA)', type: 'default' },
  { key: 'endereco',         label: 'Endereço',          type: 'default' },
] as const;

type FormKey = typeof CAMPOS[number]['key'];

export default function Perfil() {
  const router  = useRouter();
  const [user, setUser]     = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [form, setForm]     = useState<Record<FormKey, string>>({
    nome: '', telefone: '', email: '', data_nascimento: '', endereco: '',
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        membroApi.perfil().then(p => {
          setPerfil(p);
          setForm({
            nome:            p?.nome            || data.user?.user_metadata?.nome || '',
            telefone:        p?.telefone        || '',
            email:           data.user?.email   || '',
            data_nascimento: p?.data_nascimento || '',
            endereco:        p?.endereco        || '',
          });
        }).catch(() => {
          setForm(f => ({ ...f, nome: data.user?.user_metadata?.nome || '', email: data.user?.email || '' }));
        }).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleSalvar = async () => {
    setSaving(true);
    try {
      await membroApi.atualizar(form);
      await supabase.auth.updateUser({ data: { nome: form.nome } });
      Alert.alert('Salvo!', 'Seu perfil foi atualizado.');
      setEditando(false);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
    setSaving(false);
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const iniciais = form.nome
    ? form.nome.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?';

  if (loading) return null;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Cabeçalho */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="chevron-down" size={24} color={C.text} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Meu perfil</Text>
            <TouchableOpacity onPress={() => setEditando(e => !e)} style={s.editBtn}>
              <Text style={s.editBtnText}>{editando ? 'Cancelar' : 'Editar'}</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{iniciais}</Text>
            </View>
            <Text style={s.nomeDisplay}>{form.nome || 'Sem nome'}</Text>
            <Text style={s.emailDisplay}>{form.email}</Text>
            {perfil?.situacao && (
              <View style={s.situacaoBadge}>
                <Text style={s.situacaoText}>{perfil.situacao}</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <StatCard icon="qr-code" label="Check-ins" value={perfil?.total_checkins ?? '—'} />
            <StatCard icon="people"  label="Grupos"    value={perfil?.total_grupos  ?? '—'} />
            <StatCard icon="star"    label="Membro desde" value={perfil?.membro_desde ? new Date(perfil.membro_desde).getFullYear().toString() : '—'} />
          </View>

          {/* Campos */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Informações pessoais</Text>
            {CAMPOS.map(campo => (
              <View key={campo.key} style={s.campo}>
                <Text style={s.campoLabel}>{campo.label}</Text>
                {editando ? (
                  <TextInput
                    style={s.input}
                    value={form[campo.key]}
                    onChangeText={v => setForm(f => ({ ...f, [campo.key]: v }))}
                    keyboardType={campo.type as any}
                    autoCapitalize={campo.key === 'email' ? 'none' : 'words'}
                    placeholderTextColor={C.text2}
                    placeholder={campo.label}
                  />
                ) : (
                  <Text style={[s.campoValor, !form[campo.key] && s.campoVazio]}>
                    {form[campo.key] || 'Não informado'}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {editando && (
            <View style={s.actions}>
              <Button label="Salvar alterações" onPress={handleSalvar} loading={saving} fullWidth />
            </View>
          )}

          {/* Conta */}
          <Card style={s.contaCard}>
            <TouchableOpacity style={s.menuItem} onPress={() => router.push('/(auth)/criar-senha')}>
              <Ionicons name="key-outline" size={20} color={C.text2} />
              <Text style={s.menuLabel}>Criar / alterar senha</Text>
              <Ionicons name="chevron-forward" size={16} color={C.border} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={C.danger} />
              <Text style={[s.menuLabel, { color: C.danger }]}>Sair da conta</Text>
            </TouchableOpacity>
          </Card>

          <Text style={s.version}>CBRio App v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon} size={18} color={C.primary} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flexGrow: 1, paddingBottom: 40 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: '#fff' },
  backBtn:       { padding: 4 },
  headerTitle:   { fontSize: 17, fontWeight: '700', color: C.text },
  editBtn:       { padding: 4 },
  editBtnText:   { fontSize: 14, fontWeight: '700', color: C.primary },
  avatarWrap:    { alignItems: 'center', paddingVertical: 28, gap: 6, backgroundColor: '#fff' },
  avatar:        { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText:    { fontSize: 32, fontWeight: '800', color: '#fff' },
  nomeDisplay:   { fontSize: 20, fontWeight: '800', color: C.text },
  emailDisplay:  { fontSize: 13, color: C.text2 },
  situacaoBadge: { backgroundColor: C.primaryDim, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  situacaoText:  { fontSize: 12, fontWeight: '600', color: C.primary },
  statsRow:      { flexDirection: 'row', gap: 10, padding: 16 },
  statCard:      { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border },
  statValue:     { fontSize: 18, fontWeight: '800', color: C.text },
  statLabel:     { fontSize: 10, color: C.text2, fontWeight: '600', textAlign: 'center' },
  section:       { padding: 16, gap: 2 },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  campo:         { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  campoLabel:    { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  campoValor:    { fontSize: 15, color: C.text },
  campoVazio:    { color: C.text2, fontStyle: 'italic' },
  input:         { fontSize: 15, color: C.text, padding: 0 },
  actions:       { paddingHorizontal: 16, marginBottom: 8 },
  contaCard:     { margin: 16 },
  menuItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  menuLabel:     { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  version:       { textAlign: 'center', fontSize: 12, color: C.text2, marginTop: 8 },
});
