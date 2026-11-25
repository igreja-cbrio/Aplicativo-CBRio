import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, BackHandler, findNodeHandle, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Typography';
import { useTutorial, type TutorialTargetId } from '@/contexts/TutorialContext';
import { useCadastroReady } from '@/components/auth/CadastroGate';
import { useMenu } from '@/contexts/MenuContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import { podeMostrarTutorial, recorteTutorial, type TutorialRect } from '@/lib/tutorial';

export function HomeTutorial({ children }: { children: ReactNode }) {
  const tutorial = useTutorial()!;
  const pathname = usePathname(), focused = useIsFocused(), cadastroReady = useCadastroReady();
  const { visible: menuOpen } = useMenu();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  const visible = podeMostrarTutorial({ ...tutorial, cadastroReady, home: pathname === '/', focused, active, menuOpen });
  const host = useRef<View>(null);
  return <View ref={host} collapsable={false} style={styles.host}>
    <View style={styles.host} pointerEvents={visible ? 'none' : 'auto'} accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
    {visible ? <TutorialOverlay host={host} /> : null}
  </View>;
}

function TutorialOverlay({ host }: { host: React.RefObject<View | null> }) {
  const tutorial = useTutorial()!, t = useT(), insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const { mode, fontMultiplier } = useTheme();
  const dark = mode === 'dark';
  const paper = dark ? '#21383e' : '#f5f5ef', ink = dark ? '#f2f5f3' : '#233e45', muted = dark ? '#c3d2d3' : '#52666a';
  const action = dark ? '#c7e1df' : '#294b53', onAction = dark ? '#183038' : '#ffffff';
  const steps: { id: TutorialTargetId; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
    { id: 'care', icon: 'heart-outline', title: t('Você não está sozinho.'), body: t('Peça oração ou converse com um pastor quando precisar de cuidado.') },
    { id: 'devotional', icon: 'book-outline', title: t('Um tempo com Deus.'), body: t('Encontre a Bíblia, os planos de leitura e o devocional por aqui.') },
    { id: 'groups', icon: 'people-outline', title: t('Viva em comunidade.'), body: t('Encontre um grupo para caminhar com você e acompanhe seus encontros.') },
    { id: 'serve', icon: 'hand-left-outline', title: t('Seus dons fazem diferença.'), body: t('Conheça as oportunidades de servir. Se já é voluntário, veja suas escalas.') },
    { id: 'giving', icon: 'gift-outline', title: t('Generosidade, com liberdade.'), body: t('Quando quiser contribuir, este é o seu atalho. A escolha é sempre sua.') },
    { id: 'menu', icon: 'menu-outline', title: t('Tem mais para descobrir.'), body: t('Abra o menu para encontrar Inscrições, Pregações, Kids e seu perfil.') },
  ];
  const [step, setStep] = useState(-1), [hole, setHole] = useState<TutorialRect | null>(null);
  const [bounds, setBounds] = useState({ width, height });
  const [cardHeight, setCardHeight] = useState(260);
  const [reduceMotion, setReduceMotion] = useState(true);
  const progress = useRef(new Animated.Value(1)).current;
  const heading = useRef<React.ElementRef<typeof Text>>(null);
  const targetId = step >= 0 ? steps[step].id : null;
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduceMotion(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const back = BackHandler.addEventListener('hardwareBackPress', () => { tutorial.finish(); return true; });
    return () => { live = false; sub.remove(); back.remove(); };
  }, [tutorial.finish]);
  useEffect(() => {
    let live = true, frame = 0, second = 0;
    setHole(null);
    const target = targetId ? tutorial.targets.current.get(targetId) ?? (targetId === 'menu' ? null : tutorial.targets.current.get('dock')) : null;
    target?.reveal?.();
    frame = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        host.current?.measureInWindow((x, y, w, h) => {
          if (!live || w <= 0 || h <= 0) return;
          setBounds({ width: w, height: h });
          target?.view.measureInWindow((tx, ty, tw, th) => {
            if (live) setHole(recorteTutorial({ x: tx, y: ty, width: tw, height: th }, { x, y, width: w, height: h }));
          });
        });
        const node = findNodeHandle(heading.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      });
    });
    return () => { live = false; cancelAnimationFrame(frame); cancelAnimationFrame(second); };
  }, [targetId, tutorial.revision, tutorial.targets, host, width, height, fontScale, fontMultiplier]);
  useEffect(() => {
    progress.setValue(reduceMotion ? 1 : 0);
    const animation = Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : 220, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [step, progress, reduceMotion]);
  const topLimit = insets.top + 12, bottomLimit = bounds.height - insets.bottom - 12;
  const desiredTop = hole ? (targetId === 'menu' ? hole.y + hole.height + 18 : hole.y - cardHeight - 18) : (bounds.height - cardHeight) / 2;
  const top = Math.max(topLimit, Math.min(desiredTop, bottomLimit - cardHeight));
  const mask = `M0 0H${bounds.width}V${bounds.height}H0Z` + (hole ? ` M${hole.x} ${hole.y}v${hole.height}h${hole.width}v-${hole.height}Z` : '');
  const label = step < 0 ? t('Boas-vindas') : t('Etapa {atual} de {total}').replace('{atual}', String(step + 1)).replace('{total}', String(steps.length));
  return <View style={[StyleSheet.absoluteFill, styles.overlay]} accessibilityViewIsModal onAccessibilityEscape={tutorial.finish} importantForAccessibility="yes">
    <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} />
    <Svg pointerEvents="none" width={bounds.width} height={bounds.height} style={StyleSheet.absoluteFill}><Path d={mask} fill="rgba(6,29,41,0.68)" fillRule="evenodd" /></Svg>
    {hole ? <View pointerEvents="none" style={[styles.outline, { left: hole.x, top: hole.y, width: hole.width, height: hole.height }]} /> : null}
    <Animated.View onLayout={event => setCardHeight(event.nativeEvent.layout.height)} style={[styles.card, { top, maxHeight: bottomLimit - topLimit, backgroundColor: paper, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 6, 0] }) }] }]}>
      <View style={styles.row}>
        <Text style={[styles.count, { color: muted }]}>{label}</Text>
        <Pressable accessibilityRole="button" onPress={tutorial.finish} style={styles.skip}><Text style={{ color: muted }}>{t('Pular')}</Text></Pressable>
      </View>
      <ScrollView style={styles.copy} contentContainerStyle={styles.copyContent} bounces={false}>
        {step >= 0 ? <Ionicons name={steps[step].icon} size={28} color={ink} accessible={false} /> : null}
        <Text ref={heading} accessibilityRole="header" accessibilityLabel={`${label}. ${step < 0 ? t('Sua igreja, mais perto.') : steps[step].title}`} style={[styles.title, { color: ink }]}>{step < 0 ? t('Sua igreja, mais perto.') : steps[step].title}</Text>
        <Text style={[styles.body, { color: muted }]}>{step < 0 ? t('Vamos conhecer os principais atalhos do app? É rápido, e você pode pular quando quiser.') : steps[step].body}</Text>
      </ScrollView>
      <View style={styles.actions}>
        {step >= 0 ? <Pressable accessibilityRole="button" accessibilityLabel={t('Voltar')} onPress={() => setStep(value => value - 1)} style={[styles.back, { borderColor: muted }]}><Ionicons name="arrow-back" size={20} color={ink} /></Pressable> : null}
        <View style={styles.dots} accessible={false}>{steps.map((item, i) => <View key={item.id} style={{ width: i === step ? 14 : 4, height: 4, borderRadius: 4, backgroundColor: i === step ? action : muted }} />)}</View>
        <Pressable accessibilityRole="button" onPress={() => step === steps.length - 1 ? tutorial.finish() : setStep(value => value + 1)} style={[styles.next, { backgroundColor: action }]}>
          <Text style={[styles.nextLabel, { color: onAction }]}>{step < 0 ? t('Conhecer o app') : step === steps.length - 1 ? t('Concluir') : t('Próximo')}</Text>
          <Ionicons name="arrow-forward" size={18} color={onAction} />
        </Pressable>
      </View>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  host: { flex: 1 },
  overlay: { zIndex: 100, elevation: 100 },
  outline: { position: 'absolute', borderWidth: 2, borderColor: '#ffffff', borderRadius: 12 },
  card: { position: 'absolute', left: 16, right: 16, padding: 20, borderRadius: 24, gap: 12, elevation: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  count: { fontSize: 12, flexShrink: 1 },
  skip: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  copy: { flexShrink: 1 },
  copyContent: { gap: 12, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '500' },
  body: { fontSize: 15, lineHeight: 23 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  back: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 4, flexGrow: 1 },
  next: { minHeight: 48, borderRadius: 28, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  nextLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
