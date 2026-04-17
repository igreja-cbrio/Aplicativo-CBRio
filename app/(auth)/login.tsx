import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, View, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { C } from '@/constants/Colors';

export default function Login() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  const handleMagicLink = async () => {
    if (!email.trim()) { Alert.alert('Informe seu e-mail'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: 'cbrio://auth/callback' },
    });
    setLoading(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setSent(true);
  };

  return (
    <LinearGradient colors={['#00B39D', '#008f7d']} style={s.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo area */}
          <View style={s.logoArea}>
            <View style={s.logoCircle}>
              <Text style={s.logoText}>CB</Text>
            </View>
            <Text style={s.appName}>CBRio</Text>
            <Text style={s.tagline}>Bem-vindo à nossa comunidade</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            {!sent ? (
              <>
                <Text style={s.cardTitle}>Entrar</Text>
                <Text style={s.cardSub}>
                  Informe seu e-mail e enviaremos um link de acesso.
                </Text>

                <View style={s.inputWrap}>
                  <Text style={s.label}>E-mail</Text>
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="seu@email.com"
                    placeholderTextColor={C.text2}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Button
                  label="Enviar link de acesso"
                  onPress={handleMagicLink}
                  loading={loading}
                  fullWidth
                />

                <Text style={s.hint}>
                  Primeira vez aqui? Use o e-mail que você cadastrou na igreja.
                </Text>
              </>
            ) : (
              <View style={s.sentWrap}>
                <Text style={s.sentIcon}>✉️</Text>
                <Text style={s.sentTitle}>Verifique seu e-mail</Text>
                <Text style={s.sentSub}>
                  Enviamos um link para{'\n'}
                  <Text style={{ fontWeight: '700', color: C.primary }}>{email}</Text>
                  {'\n'}Abra-o no celular para entrar.
                </Text>
                <Button label="Usar outro e-mail" variant="ghost" onPress={() => setSent(false)} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  gradient:   { flex: 1 },
  scroll:     { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea:   { alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText:   { fontSize: 28, fontWeight: '800', color: '#fff' },
  appName:    { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline:    { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card:       { backgroundColor: '#fff', borderRadius: 28, padding: 28, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  cardTitle:  { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 6 },
  cardSub:    { fontSize: 14, color: C.text2, marginBottom: 24, lineHeight: 20 },
  inputWrap:  { marginBottom: 20 },
  label:      { fontSize: 12, fontWeight: '600', color: C.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 16, fontSize: 15, color: C.text },
  hint:       { fontSize: 12, color: C.text2, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  sentWrap:   { alignItems: 'center', paddingVertical: 8 },
  sentIcon:   { fontSize: 48, marginBottom: 16 },
  sentTitle:  { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 },
  sentSub:    { fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
});
