import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { membro as membroApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { C } from '@/constants/Colors';
import { Button } from '@/components/ui/Button';

type Step = 'verificar' | 'senha' | 'feito';

export default function CriarSenha() {
  const router   = useRouter();
  const [step, setStep]       = useState<Step>('verificar');
  const [cpf, setCpf]         = useState('');
  const [nasc, setNasc]       = useState('');
  const [email, setEmail]     = useState('');
  const [senha, setSenha]     = useState('');
  const [senha2, setSenha2]   = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken]     = useState('');

  const maskCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const maskData = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
    return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
  };

  const handleVerificar = async () => {
    if (!cpf || !nasc || !email.trim()) {
      Alert.alert('Preencha todos os campos'); return;
    }
    setLoading(true);
    try {
      const res = await membroApi.vincular({ cpf: cpf.replace(/\D/g, ''), data_nascimento: nasc, email: email.trim() });
      setToken(res.token || '');
      setStep('senha');
    } catch (e: any) {
      Alert.alert('Não encontrado', 'Não encontramos um cadastro com esses dados. Verifique com nossa equipe.');
    }
    setLoading(false);
  };

  const handleCriarSenha = async () => {
    if (senha.length < 6) { Alert.alert('A senha precisa ter pelo menos 6 caracteres'); return; }
    if (senha !== senha2) { Alert.alert('As senhas não coincidem'); return; }
    setLoading(true);
    try {
      await supabase.auth.updateUser({ password: senha });
      setStep('feito');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
    setLoading(false);
  };

  if (step === 'feito') {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={s.doneIcon}>
          <Ionicons name="checkmark" size={40} color="#fff" />
        </View>
        <Text style={s.doneTitle}>Senha criada!</Text>
        <Text style={s.doneSub}>
          Agora você pode entrar no app com seu e-mail e senha a qualquer momento.
        </Text>
        <Button label="Ir para o início" onPress={() => router.replace('/(tabs)')} fullWidth />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.topCard}>
            <Ionicons name="key" size={28} color={C.primary} />
            <Text style={s.topTitle}>
              {step === 'verificar' ? 'Vincular conta' : 'Criar senha'}
            </Text>
            <Text style={s.topSub}>
              {step === 'verificar'
                ? 'Se você já tem cadastro na CBRio, informe seus dados para vincular sua conta ao app.'
                : 'Crie uma senha para acessar o app com seu e-mail e senha.'
              }
            </Text>
          </View>

          {step === 'verificar' && (
            <View style={s.form}>
              <Field label="CPF" value={cpf} onChangeText={v => setCpf(maskCpf(v))} keyboardType="numeric" placeholder="000.000.000-00" />
              <Field label="Data de nascimento" value={nasc} onChangeText={v => setNasc(maskData(v))} keyboardType="numeric" placeholder="DD/MM/AAAA" />
              <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="seu@email.com" />
              <Button label="Verificar cadastro" onPress={handleVerificar} loading={loading} fullWidth />
              <Button label="Não sou cadastrado" variant="ghost" onPress={() => router.back()} fullWidth />
            </View>
          )}

          {step === 'senha' && (
            <View style={s.form}>
              <Field label="Nova senha" value={senha} onChangeText={setSenha} secureTextEntry placeholder="Mínimo 6 caracteres" />
              <Field label="Confirmar senha" value={senha2} onChangeText={setSenha2} secureTextEntry placeholder="Repita a senha" />
              <Button label="Criar senha" onPress={handleCriarSenha} loading={loading} fullWidth />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={C.text2} autoCapitalize="none" {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  scroll:    { flexGrow: 1, padding: 20, paddingBottom: 40 },
  topCard:   { backgroundColor: C.primaryDim, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8, marginBottom: 28 },
  topTitle:  { fontSize: 20, fontWeight: '800', color: C.text },
  topSub:    { fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 19 },
  form:      { gap: 4 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel:{ fontSize: 12, fontWeight: '600', color: C.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:     { height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#fff', paddingHorizontal: 16, fontSize: 15, color: C.text },
  doneIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  doneSub:   { fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
