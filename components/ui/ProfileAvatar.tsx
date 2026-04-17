import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '@/constants/Colors';

interface Props {
  nome?: string;
  size?: number;
}

export function ProfileAvatar({ nome, size = 36 }: Props) {
  const router   = useRouter();
  const iniciais = nome
    ? nome.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?';

  return (
    <TouchableOpacity
      onPress={() => router.push('/perfil')}
      style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      activeOpacity={0.8}
    >
      <Text style={[s.text, { fontSize: size * 0.38 }]}>{iniciais}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  text: { fontWeight: '800', color: '#fff' },
});
