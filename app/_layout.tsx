import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';

function Guard({ session }: { session: Session | null }) {
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth)   router.replace('/(auth)/login');
    if (session  &&  inAuth)   router.replace('/(tabs)');
  }, [session, segments]);

  return null;
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Guard session={session} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="visitante" options={{ presentation: 'modal', headerShown: true, title: 'Cadastro de Visitante' }} />
      </Stack>
    </>
  );
}
