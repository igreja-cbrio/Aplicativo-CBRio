import React, { useRef, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/constants/Colors';

export function AnimatedDock({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  const anims = useRef(
    state.routes.map((_: any, i: number) =>
      new Animated.Value(i === state.index ? 1 : 0)
    )
  ).current;

  useEffect(() => {
    state.routes.forEach((_: any, i: number) => {
      Animated.spring(anims[i], {
        toValue: i === state.index ? 1 : 0,
        useNativeDriver: false,
        tension: 200,
        friction: 14,
      }).start();
    });
  }, [state.index]);

  return (
    <View style={[s.outer, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
      <View style={s.dock}>
        {state.routes.map((route: any, i: number) => {
          const { options } = descriptors[route.key];
          const isActive = i === state.index;
          const label = (options.tabBarLabel ?? options.title ?? route.name) as string;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const anim = anims[i];
          const labelMaxW = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 88] });
          const labelML   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
          const lineW     = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });
          const lineO     = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[s.item, isActive ? { flex: 1 } : { width: 50 }]}
            >
              <View style={s.row}>
                {options.tabBarIcon?.({
                  focused: isActive,
                  color: isActive ? C.primary : C.text2,
                  size: 22,
                })}
                <Animated.View style={{ maxWidth: labelMaxW, marginLeft: labelML, overflow: 'hidden' }}>
                  <Animated.Text style={[s.label, { opacity: anim }]} numberOfLines={1}>
                    {label}
                  </Animated.Text>
                </Animated.View>
              </View>
              <Animated.View style={[s.line, { width: lineW, opacity: lineO }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: { paddingHorizontal: 20, paddingTop: 4 },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 32,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  item:  { alignItems: 'center', gap: 3, paddingVertical: 2, paddingHorizontal: 2 },
  row:   { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '700', color: C.primary },
  line:  { height: 2.5, backgroundColor: C.primary, borderRadius: 1.5 },
});
