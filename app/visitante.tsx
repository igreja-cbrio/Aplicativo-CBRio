import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { visitante as visitanteApi } from '@/lib/api';
import { C } from '@/constants/Colors';
import { Button } from '@/components/ui/Button';

const COMO_CONHECEU = [
  'Redes sociais', 'Indicação de amigo', 'Família', 'Passei na frente', 'YouTube', 'Outro',
];

export default function CadastroVisitante() {
  const router  = useRouter();
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', como_conheceu: '',
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const maskTel = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) {
      Alert.alert('Preencha nome e telefone'); return;
    }
    setLoading(true);
    try {
      await visitanteApi.cadastrar({
        nome: form.nome.trim(),
        telefone: form.telefone,
        email: form.email.trim() || undefined,
        como_conheceu: form.como_conheceu || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🎉</Text>
        <Text style={s.doneTitle}>Bem-vindo à CBRio!</Text>
        <Text style={s.doneSub}>
          Ficamos felizes com sua visita.{'\n'}
          Em breve alguém da nossa equipe entrará em contato.
        </Text>
        <Button label="Voltar ao início" onPress={() => router.replace('/(tabs)')} fullWidth />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.topCard}>
            <Ionicons name="hand-right" size={32} color={C.primary} />
            <Text style={s.topTitle}>Olá, visitante!</Text>
            <Text style={s.topSub}>
              Deixe seus dados para nossa equipe de integração poder acompanhar você.
            </Text>
          </View>

          <View style={s.form}>
            <Field label="Nome completo *" value={form.nome} onChangeText={set('nome')} placeholder="Seu nome" />
            <Field
              label="Telefone / WhatsApp *"
              value={form.telefone}
              onChangeText={v => set('telefone')(maskTel(v))}
              placeholder="(21) 99999-9999"
              keyboardType="phone-pad"
            />
            <Field
              label="E-mail"
              value={form.email}
              onChangeText={set('email')}
              placeholder="seu@email.com"
              keyboardType="email-address"
            />

            <Text style={s.fieldLabel}>Como nos conheceu?</Text>
            <View style={s.chips}>
              {COMO_CONHECEU.map(opt => (
                <OpChip
                  key={opt}
                  label={opt}
                  selected={form.como_conheceu === opt}
                  onPress={() => set('como_conheceu')(form.como_conheceu === opt ? '' : opt)}
                />
              ))}
            </View>

            <Button label="Enviar cadastro" onPress={handleSubmit} loading={loading} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} autoCapitalize="words" {...props} placeholderTextColor={C.text2} />
    </View>
  );
}

function OpChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={[s.chip, selected && s.chipSelected]}
    >
      {label}
    </Text>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  scroll:    { flexGrow: 1, padding: 20, paddingBottom: 40 },
  topCard:   { backgroundColor: C.primaryDim, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8, marginBottom: 28 },
  topTitle:  { fontSize: 20, fontWeight: '800', color: C.text },
  topSub:    { fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 19 },
  form:      { gap: 0 },
  fieldLabel:{ fontSize: 12, fontWeight: '600', color: C.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:     { height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#fff', paddingHorizontal: 16, fontSize: 15, color: C.text, marginBottom: 16 },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#fff', fontSize: 13, color: C.text2, fontWeight: '500' },
  chipSelected:{ borderColor: C.primary, backgroundColor: C.primaryDim, color: C.primary },
  doneTitle: { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  doneSub:   { fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
