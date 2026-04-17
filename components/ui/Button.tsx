import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { C } from '@/constants/Colors';

type Variant = 'primary' | 'outline' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, fullWidth }: Props) {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.base,
        isPrimary && s.primary,
        isOutline && s.outline,
        variant === 'ghost' && s.ghost,
        (disabled || loading) && s.disabled,
        fullWidth && s.full,
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading
        ? <ActivityIndicator color={isPrimary ? '#fff' : C.primary} size="small" />
        : <Text style={[s.label, !isPrimary && s.labelAlt]}>{label}</Text>
      }
    </Pressable>
  );
}

const s = StyleSheet.create({
  base:     { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primary:  { backgroundColor: C.primary },
  outline:  { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.primary },
  ghost:    { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  full:     { width: '100%' },
  label:    { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: 0.2 },
  labelAlt: { color: C.primary },
});
