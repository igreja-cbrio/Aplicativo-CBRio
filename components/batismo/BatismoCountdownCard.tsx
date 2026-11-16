import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/ui/Typography';
import { BRAND_FONT } from '@/lib/fonts';
import { useT } from '@/lib/i18n';
import { contagemBatismo, type AgendaBatismo } from '@/lib/batismoContagem';
import { formatDataLonga } from '@/lib/cultos';

export function BatismoCountdownCard({ batismo, agora }: { batismo: AgendaBatismo; agora: number }) {
  const t = useT();
  const c = contagemBatismo(batismo, agora);
  const contando = c.estado === 'agendado' || c.estado === 'hoje';
  const titulo = c.estado === 'hoje' ? t('É hoje. Viva esse momento!')
    : c.estado === 'realizado' ? t('Uma nova história começou.')
    : c.estado === 'passado' ? t('Uma decisão para lembrar.')
    : c.estado === 'sem-data' ? t('Seu próximo passo começa aqui.')
    : c.estado === 'cancelado' ? t('Inscrição cancelada')
    : t('Uma nova história está chegando.');
  return <LinearGradient colors={['#355b62', '#193c44']} style={s.hero}>
    <View pointerEvents="none" style={s.waves} accessible={false}>
      <Svg width="100%" height="150" viewBox="0 0 400 150" preserveAspectRatio="none">
        <Path d="M0 70 Q100 0 210 75 T400 65 L400 150 L0 150 Z" fill="#a1bec1" opacity="0.09" />
        <Path d="M0 110 Q110 35 230 100 T400 90" fill="none" stroke="#dce7e5" strokeWidth="1" opacity="0.2" />
      </Svg>
    </View>
    <View style={s.eyebrowRow}><Ionicons name="water-outline" size={19} color="#dce7e5" /><Text style={s.eyebrow}>{t('MEU BATISMO')}</Text></View>
    <Text accessibilityRole="header" style={s.title}>{titulo}</Text>
    <Text style={s.subtitle}>{contando ? t('Um passo de fé. Uma vida com Jesus. Vamos celebrar com você!')
      : c.estado === 'sem-data' ? t('Recebemos sua inscrição. A equipe vai confirmar a data com você.')
      : c.estado === 'realizado' ? t('Que alegria fazer parte desse momento da sua caminhada com Jesus.')
      : c.estado === 'cancelado' ? t('Fale com a equipe para acompanhar sua inscrição.')
      : t('Acompanhe aqui os registros e as fotos desse dia especial.')}</Text>
    {contando && <View style={s.counter}>
      <Text style={s.counterLabel}>{c.estado === 'hoje' ? t('O grande dia chegou') : t('CONTAGEM REGRESSIVA')}</Text>
      <View style={s.units}>
        <View style={s.day}><Text numberOfLines={1} adjustsFontSizeToFit style={s.dayNumber}>{String(Math.max(0, c.dias ?? 0)).padStart(2, '0')}</Text><Text style={s.unitLabel}>{c.dias === 1 ? t('dia') : t('dias')}</Text></View>
        {c.horas !== null && <>
          <View style={s.unit}><Text style={s.number}>{String(c.horas).padStart(2, '0')}</Text><Text style={s.unitLabel}>{t('horas')}</Text></View>
          <View style={s.unit}><Text style={s.number}>{String(c.minutos).padStart(2, '0')}</Text><Text style={s.unitLabel}>{t('minutos')}</Text></View>
        </>}
      </View>
    </View>}
    {c.data && <View style={s.schedule}>
      <Ionicons name="calendar-outline" size={19} color="#dce7e5" />
      <View style={{ flex: 1, gap: 5 }}><Text style={s.date}>{formatDataLonga(c.data)}</Text>
        <Text style={s.time}>{c.horario ? `${c.horario} · ${t('Horário de Brasília')}` : t('Horário a confirmar com a equipe')}</Text>
      </View>
    </View>}
  </LinearGradient>;
}
const s = StyleSheet.create({
  hero: { borderRadius: 28, padding: 24, gap: 17, overflow: 'hidden' },
  waves: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#dce7e5', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, flexShrink: 1 },
  title: { color: '#fff', fontFamily: BRAND_FONT, fontSize: 34 },
  subtitle: { color: '#dce7e5', fontSize: 13, lineHeight: 21 },
  counter: { gap: 10, marginVertical: 4 },
  counterLabel: { color: '#dce7e5', fontSize: 10, letterSpacing: 1.1, fontWeight: '700' },
  units: { flexDirection: 'row', alignItems: 'stretch', gap: 9, flexWrap: 'wrap' },
  day: { flexGrow: 1.3, flexBasis: 88, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, minWidth: 88 },
  dayNumber: { color: '#fff', fontFamily: BRAND_FONT, fontSize: 76, width: '100%', textAlign: 'center', fontVariant: ['tabular-nums'] },
  unit: { flexGrow: 1, flexBasis: 70, minWidth: 70, backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center', padding: 10, gap: 8 },
  number: { color: '#fff', fontSize: 29, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unitLabel: { color: '#dce7e5', fontSize: 11 },
  schedule: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', paddingTop: 18 },
  date: { color: '#fff', fontSize: 14, fontWeight: '700' },
  time: { color: '#dce7e5', fontSize: 11 },
});
