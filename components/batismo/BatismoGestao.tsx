import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import { font, radius, spacing, type Palette } from '@/constants/theme';
import { BRAND_FONT } from '@/lib/fonts';
import { TecladoSeguro } from '@/components/ui/TecladoSeguro';
import {
  adicionarPessoaBatismo,
  aprovarPessoaBatismo,
  checkinPessoaBatismo,
  editarPessoaBatismo,
  getBatismoGestao,
  retirarPessoaBatismo,
  type BatismoGestao,
  type BatismoPessoaGestao,
  type BatismoPessoaPayload,
} from '@/lib/batismoGestao';

type Aba = 'dia' | 'aprovacoes';
type FormPessoa = {
  nome: string;
  sobrenome: string;
  telefone: string;
  email: string;
  data_nascimento: string;
  data_batismo: string;
  horario_culto: string;
  tamanho_camisa: string;
  observacoes: string;
};

const FORM_VAZIO: FormPessoa = {
  nome: '', sobrenome: '', telefone: '', email: '', data_nascimento: '',
  data_batismo: '', horario_culto: '', tamanho_camisa: '', observacoes: '',
};

function dataCurta(iso: string): { dia: string; mes: string; semana: string } {
  const d = new Date(`${iso}T12:00:00`);
  return {
    dia: d.toLocaleDateString('pt-BR', { day: '2-digit' }),
    mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    semana: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
  };
}

function dataLonga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

function iniciais(p: BatismoPessoaGestao): string {
  return `${p.nome?.[0] || ''}${p.sobrenome?.[0] || ''}`.toUpperCase() || '?';
}

function payloadDoForm(form: FormPessoa): BatismoPessoaPayload {
  return {
    nome: form.nome.trim(),
    sobrenome: form.sobrenome.trim(),
    telefone: form.telefone.trim() || null,
    email: form.email.trim() || null,
    data_nascimento: form.data_nascimento.trim() || null,
    data_batismo: form.data_batismo,
    horario_culto: form.horario_culto.trim() || null,
    tamanho_camisa: form.tamanho_camisa.trim() || null,
    observacoes: form.observacoes.trim() || null,
  };
}

export function BatismoGestaoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [estado, setEstado] = useState<BatismoGestao | null>(null);
  const [aba, setAba] = useState<Aba>('dia');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const [editando, setEditando] = useState<BatismoPessoaGestao | null | 'nova'>(null);

  const carregar = useCallback(async (data?: string, silencioso = false) => {
    if (!silencioso) setErro(null);
    try {
      const r = await getBatismoGestao(data);
      setEstado(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t('Erro ao carregar o Batismo.'));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const pessoas = useMemo(() => {
    const lista = aba === 'dia' ? estado?.pessoas || [] : estado?.aprovacoes || [];
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    if (!q) return lista;
    return lista.filter(p => `${p.nome} ${p.sobrenome || ''} ${p.telefone || ''}`.toLocaleLowerCase('pt-BR').includes(q));
  }, [aba, busca, estado]);

  async function refrescar() {
    setRefrescando(true);
    try { await carregar(estado?.data, true); } finally { setRefrescando(false); }
  }

  async function selecionarData(data: string) {
    if (data === estado?.data) return;
    setEstado(null);
    await carregar(data);
  }

  async function alternarCheckin(p: BatismoPessoaGestao) {
    const presente = !p.checkin_em;
    setProcessando(p.id);
    try {
      const atualizada = await checkinPessoaBatismo(p.id, presente);
      setEstado(prev => prev ? {
        ...prev,
        pessoas: prev.pessoas.map(x => x.id === p.id ? atualizada : x),
        resumo: {
          ...prev.resumo,
          presentes: Math.max(0, prev.resumo.presentes + (presente ? 1 : -1)),
        },
      } : prev);
      Haptics.notificationAsync(
        presente ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    } catch (e) {
      Alert.alert(t('Não foi possível atualizar'), e instanceof Error ? e.message : t('Tente novamente.'));
    } finally { setProcessando(null); }
  }

  function aprovar(p: BatismoPessoaGestao) {
    if (!estado?.data) return;
    Alert.alert(
      t('Aprovar para este Batismo?'),
      `${p.nome} ${p.sobrenome || ''}\n${dataLonga(estado.data)}`,
      [
        { text: t('Cancelar'), style: 'cancel' },
        {
          text: t('Aprovar'),
          onPress: async () => {
            setProcessando(p.id);
            try {
              await aprovarPessoaBatismo(p.id, { data_batismo: estado.data, horario_culto: p.horario_culto });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              await carregar(estado.data, true);
            } catch (e) {
              Alert.alert(t('Não foi possível aprovar'), e instanceof Error ? e.message : t('Tente novamente.'));
            } finally { setProcessando(null); }
          },
        },
      ],
    );
  }

  function retirar(p: BatismoPessoaGestao) {
    Alert.alert(
      t('Retirar deste Batismo?'),
      t('A pessoa sairá da lista do dia, mas o histórico ficará preservado no sistema.'),
      [
        { text: t('Cancelar'), style: 'cancel' },
        {
          text: t('Retirar'), style: 'destructive',
          onPress: async () => {
            setProcessando(p.id);
            try {
              await retirarPessoaBatismo(p.id);
              await carregar(estado?.data, true);
            } catch (e) {
              Alert.alert(t('Não foi possível retirar'), e instanceof Error ? e.message : t('Tente novamente.'));
            } finally { setProcessando(null); }
          },
        },
      ],
    );
  }

  if (!estado && !erro) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (erro && !estado) {
    return (
      <View style={styles.center}>
        <Ionicons name='cloud-offline-outline' size={34} color={colors.textMuted} />
        <Text style={styles.centerTxt}>{erro}</Text>
        <Pressable style={styles.retry} onPress={() => carregar()}>
          <Ionicons name='refresh' size={17} color={colors.primary} />
          <Text style={styles.retryTxt}>{t('Tentar novamente')}</Text>
        </Pressable>
      </View>
    );
  }

  if (!estado) return null;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps='handled'
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.eyebrow}>{t('Equipe de Batismo')}</Text>
              <Text style={styles.heroTitle}>{t('Cuidar de cada história')}</Text>
            </View>
            <View style={styles.drop}><Ionicons name='water' size={22} color='#fff' /></View>
          </View>
          <Text style={styles.heroDate}>{dataLonga(estado.data)}</Text>
          <View style={styles.stats}>
            <Stat valor={estado.resumo.previstos} label={t('previstos')} styles={styles} />
            <View style={styles.statDiv} />
            <Stat valor={estado.resumo.presentes} label={t('presentes')} styles={styles} />
            <View style={styles.statDiv} />
            <Stat valor={estado.resumo.aguardando} label={t('aguardando')} styles={styles} />
          </View>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionLabel}>{t('Dia do Batismo')}</Text>
            <Text style={styles.sectionHint}>{t('A data mais próxima já vem selecionada')}</Text>
          </View>
          <Pressable style={styles.addMini} onPress={() => setEditando('nova')} accessibilityRole='button'>
            <Ionicons name='person-add' size={17} color='#fff' />
            <Text style={styles.addMiniTxt}>{t('Adicionar')}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRail}>
          {estado.datas.map(data => {
            const d = dataCurta(data);
            const ativo = data === estado.data;
            const hoje = data === estado.hoje;
            return (
              <Pressable
                key={data}
                onPress={() => selecionarData(data)}
                style={[styles.dateCard, ativo && styles.dateCardActive]}
                accessibilityRole='button'
                accessibilityState={{ selected: ativo }}
              >
                <Text style={[styles.dateWeek, ativo && styles.dateTextActive]}>{d.semana}</Text>
                <Text style={[styles.dateDay, ativo && styles.dateTextActive]}>{d.dia}</Text>
                <Text style={[styles.dateMonth, ativo && styles.dateTextActive]}>{d.mes}</Text>
                {hoje ? <View style={[styles.todayDot, ativo && { backgroundColor: '#fff' }]} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.tabs}>
          <Tab
            label={t('Pessoas do dia')}
            count={estado.resumo.previstos}
            active={aba === 'dia'}
            onPress={() => setAba('dia')}
            styles={styles}
          />
          <Tab
            label={t('Aprovações')}
            count={estado.resumo.aguardando}
            active={aba === 'aprovacoes'}
            onPress={() => setAba('aprovacoes')}
            styles={styles}
          />
        </View>

        <View style={styles.search}>
          <Ionicons name='search' size={18} color={colors.textMuted} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder={t('Buscar por nome ou telefone')}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {busca ? (
            <Pressable onPress={() => setBusca('')} hitSlop={8}>
              <Ionicons name='close-circle' size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {pessoas.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name={aba === 'dia' ? 'people-outline' : 'checkmark-done-circle-outline'} size={38} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{aba === 'dia' ? t('Ninguém previsto para esta data') : t('Tudo aprovado por aqui')}</Text>
            <Text style={styles.emptyTxt}>
              {aba === 'dia' ? t('Adicione uma pessoa ou escolha outra data.') : t('Novas solicitações aparecerão nesta aba.')}
            </Text>
          </View>
        ) : pessoas.map(p => (
          <PessoaCard
            key={p.id}
            pessoa={p}
            aprovacao={aba === 'aprovacoes'}
            processando={processando === p.id}
            onCheckin={() => alternarCheckin(p)}
            onAprovar={() => aprovar(p)}
            onEditar={() => setEditando(p)}
            onRetirar={() => retirar(p)}
            colors={colors}
            styles={styles}
          />
        ))}
      </ScrollView>

      <PessoaModal
        alvo={editando}
        dataPadrao={estado.data}
        horarios={estado.horarios}
        onClose={() => setEditando(null)}
        onSaved={async () => { setEditando(null); await carregar(estado.data, true); }}
        colors={colors}
        styles={styles}
      />
    </>
  );
}

function Stat({ valor, label, styles }: { valor: number; label: string; styles: ReturnType<typeof makeStyles> }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{valor}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Tab({ label, count, active, onPress, styles }: {
  label: string; count: number; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]} accessibilityRole='tab' accessibilityState={{ selected: active }}>
      <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{label}</Text>
      <View style={[styles.tabCount, active && styles.tabCountActive]}><Text style={[styles.tabCountTxt, active && styles.tabCountTxtActive]}>{count}</Text></View>
    </Pressable>
  );
}

function PessoaCard({ pessoa: p, aprovacao, processando, onCheckin, onAprovar, onEditar, onRetirar, colors, styles }: {
  pessoa: BatismoPessoaGestao;
  aprovacao: boolean;
  processando: boolean;
  onCheckin: () => void;
  onAprovar: () => void;
  onEditar: () => void;
  onRetirar: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const nome = `${p.nome} ${p.sobrenome || ''}`.trim();
  return (
    <View style={[styles.personCard, !!p.checkin_em && styles.personChecked]}>
      <View style={styles.personTop}>
        <View style={[styles.avatar, !!p.checkin_em && styles.avatarChecked]}>
          {p.checkin_em ? <Ionicons name='checkmark' size={21} color='#fff' /> : <Text style={styles.avatarTxt}>{iniciais(p)}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.personName} numberOfLines={1}>{nome}</Text>
          <View style={styles.metaRow}>
            {p.horario_culto ? <Text style={styles.meta}>{p.horario_culto.slice(0, 5)}</Text> : null}
            {p.tamanho_camisa ? <Text style={styles.meta}>{t('Camisa')} {p.tamanho_camisa}</Text> : null}
            {p.telefone ? <Text style={styles.meta} numberOfLines={1}>{p.telefone}</Text> : null}
          </View>
        </View>
        <Pressable onPress={onEditar} style={styles.iconBtn} hitSlop={8} accessibilityLabel={t('Editar dados')}>
          <Ionicons name='create-outline' size={19} color={colors.textMuted} />
        </Pressable>
      </View>

      {p.observacoes ? <Text style={styles.note} numberOfLines={2}>{p.observacoes}</Text> : null}

      <View style={styles.cardActions}>
        <Pressable onPress={onRetirar} disabled={processando} style={styles.removeBtn}>
          <Ionicons name='person-remove-outline' size={17} color={colors.danger} />
          <Text style={styles.removeTxt}>{t('Retirar')}</Text>
        </Pressable>
        {aprovacao ? (
          <Pressable onPress={onAprovar} disabled={processando} style={styles.primaryBtn}>
            {processando ? <ActivityIndicator size='small' color='#fff' /> : <><Ionicons name='checkmark-circle' size={18} color='#fff' /><Text style={styles.primaryBtnTxt}>{t('Aprovar')}</Text></>}
          </Pressable>
        ) : (
          <Pressable onPress={onCheckin} disabled={processando} style={[styles.primaryBtn, !!p.checkin_em && styles.undoBtn]}>
            {processando ? <ActivityIndicator size='small' color={p.checkin_em ? colors.primary : '#fff'} /> : <>
              <Ionicons name={p.checkin_em ? 'return-up-back' : 'checkmark'} size={18} color={p.checkin_em ? colors.primary : '#fff'} />
              <Text style={[styles.primaryBtnTxt, !!p.checkin_em && { color: colors.primary }]}>{p.checkin_em ? t('Desfazer check-in') : t('Fazer check-in')}</Text>
            </>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function PessoaModal({ alvo, dataPadrao, horarios, onClose, onSaved, colors, styles }: {
  alvo: BatismoPessoaGestao | null | 'nova';
  dataPadrao: string;
  horarios: { horario: string; label: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [salvando, setSalvando] = useState(false);
  const inicial = useMemo<FormPessoa>(() => alvo && alvo !== 'nova' ? {
    nome: alvo.nome || '', sobrenome: alvo.sobrenome || '', telefone: alvo.telefone || '',
    email: alvo.email || '', data_nascimento: alvo.data_nascimento || '',
    data_batismo: alvo.data_batismo || dataPadrao, horario_culto: alvo.horario_culto || '',
    tamanho_camisa: alvo.tamanho_camisa || '', observacoes: alvo.observacoes || '',
  } : { ...FORM_VAZIO, data_batismo: dataPadrao }, [alvo, dataPadrao]);
  const [form, setForm] = useState(inicial);

  useEffect(() => { setForm(inicial); }, [inicial]);

  if (!alvo) return null;
  const novo = alvo === 'nova';
  const alvoId = alvo === 'nova' ? null : alvo.id;
  const set = (campo: keyof FormPessoa) => (v: string) => setForm(s => ({ ...s, [campo]: v }));

  async function salvar() {
    if (!form.nome.trim() || !form.sobrenome.trim()) {
      Alert.alert(t('Confira os dados'), t('Nome e sobrenome são obrigatórios.'));
      return;
    }
    setSalvando(true);
    try {
      if (novo) await adicionarPessoaBatismo(payloadDoForm(form));
      else if (alvoId) await editarPessoaBatismo(alvoId, payloadDoForm(form));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await onSaved();
    } catch (e) {
      Alert.alert(t('Não foi possível salvar'), e instanceof Error ? e.message : t('Tente novamente.'));
    } finally { setSalvando(false); }
  }

  return (
    <Modal visible animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <TecladoSeguro style={[styles.modalPage, { paddingBottom: insets.bottom }]}>
        <View style={styles.modalHead}>
          <View><Text style={styles.modalTitle}>{novo ? t('Adicionar pessoa') : t('Editar pessoa')}</Text><Text style={styles.modalSub}>{dataLonga(form.data_batismo)}</Text></View>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name='close' size={25} color={colors.text} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={styles.form}>
          <View style={styles.twoCols}>
            <Campo label={t('Nome')} value={form.nome} onChange={set('nome')} styles={styles} />
            <Campo label={t('Sobrenome')} value={form.sobrenome} onChange={set('sobrenome')} styles={styles} />
          </View>
          <Campo label={t('Telefone')} value={form.telefone} onChange={set('telefone')} keyboard='phone-pad' styles={styles} />
          <Campo label={t('E-mail')} value={form.email} onChange={set('email')} keyboard='email-address' styles={styles} />
          <Campo label={t('Nascimento')} hint='AAAA-MM-DD' value={form.data_nascimento} onChange={set('data_nascimento')} styles={styles} />
          <Campo label={t('Data do Batismo')} hint='AAAA-MM-DD' value={form.data_batismo} onChange={set('data_batismo')} styles={styles} />
          <Text style={styles.fieldLabel}>{t('Horário')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable onPress={() => set('horario_culto')('')} style={[styles.option, !form.horario_culto && styles.optionActive]}><Text style={[styles.optionTxt, !form.horario_culto && styles.optionTxtActive]}>{t('Sem horário')}</Text></Pressable>
            {horarios.map(h => <Pressable key={h.horario} onPress={() => set('horario_culto')(h.horario)} style={[styles.option, form.horario_culto === h.horario && styles.optionActive]}><Text style={[styles.optionTxt, form.horario_culto === h.horario && styles.optionTxtActive]}>{h.label}</Text></Pressable>)}
          </ScrollView>
          <Campo label={t('Tamanho da camisa')} hint='P, M, G…' value={form.tamanho_camisa} onChange={set('tamanho_camisa')} styles={styles} />
          <Campo label={t('Observações')} value={form.observacoes} onChange={set('observacoes')} multiline styles={styles} />
          <Pressable onPress={salvar} disabled={salvando} style={styles.saveBtn}>
            {salvando ? <ActivityIndicator color='#fff' /> : <Text style={styles.saveBtnTxt}>{novo ? t('Adicionar ao Batismo') : t('Salvar alterações')}</Text>}
          </Pressable>
        </ScrollView>
      </TecladoSeguro>
    </Modal>
  );
}

function Campo({ label, hint, value, onChange, multiline, keyboard, styles }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; multiline?: boolean;
  keyboard?: 'default' | 'phone-pad' | 'email-address'; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={styles.fieldLabel}>{label}{hint ? <Text style={styles.fieldHint}> · {hint}</Text> : null}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={keyboard || 'default'} autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'} multiline={multiline} style={[styles.field, multiline && styles.fieldMulti]} placeholderTextColor={styles.fieldHint.color as string} />
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
    centerTxt: { color: c.textMuted, textAlign: 'center', fontSize: font.size.md },
    retry: { flexDirection: 'row', gap: 7, alignItems: 'center', borderWidth: 1, borderColor: c.primary, borderRadius: radius.full, paddingHorizontal: 15, paddingVertical: 9 },
    retryTxt: { color: c.primary, fontWeight: '700' },
    content: { padding: spacing.lg, paddingBottom: 130, gap: spacing.md },
    hero: { backgroundColor: c.primary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, overflow: 'hidden' },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    eyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
    heroTitle: { color: '#fff', fontFamily: BRAND_FONT, fontSize: font.size.xl, marginTop: 3 },
    drop: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
    heroDate: { color: '#fff', fontSize: font.size.sm, fontWeight: '700', textTransform: 'capitalize' },
    stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: radius.md, paddingVertical: spacing.sm },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { color: '#fff', fontFamily: BRAND_FONT, fontSize: 24 },
    statLabel: { color: 'rgba(255,255,255,0.76)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
    statDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
    sectionLabel: { color: c.text, fontSize: font.size.md, fontWeight: '800' },
    sectionHint: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    addMini: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary, borderRadius: radius.full, paddingHorizontal: 13, paddingVertical: 9 },
    addMiniTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
    dateRail: { gap: 9, paddingRight: spacing.lg },
    dateCard: { width: 64, minHeight: 86, borderRadius: radius.md, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', paddingVertical: 7 },
    dateCardActive: { backgroundColor: c.primary, borderColor: c.primary, transform: [{ translateY: -2 }] },
    dateWeek: { color: c.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    dateDay: { color: c.text, fontFamily: BRAND_FONT, fontSize: 27, lineHeight: 31 },
    dateMonth: { color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    dateTextActive: { color: '#fff' },
    todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.primary, marginTop: 4 },
    tabs: { flexDirection: 'row', padding: 4, borderRadius: radius.full, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.glassBorder },
    tab: { flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.full },
    tabActive: { backgroundColor: c.surface },
    tabTxt: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    tabTxtActive: { color: c.text },
    tabCount: { minWidth: 21, height: 21, borderRadius: 11, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glass },
    tabCountActive: { backgroundColor: c.primary },
    tabCountTxt: { color: c.textMuted, fontSize: 10, fontWeight: '800' },
    tabCountTxtActive: { color: '#fff' },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: radius.full, borderWidth: 1, borderColor: c.glassBorder, paddingHorizontal: 14, height: 46 },
    searchInput: { flex: 1, color: c.text, fontSize: font.size.sm, paddingVertical: 0 },
    empty: { alignItems: 'center', padding: spacing.xl, gap: 7, backgroundColor: c.surfaceAlt, borderRadius: radius.lg },
    emptyTitle: { color: c.text, fontWeight: '800', fontSize: font.size.md, textAlign: 'center' },
    emptyTxt: { color: c.textMuted, fontSize: font.size.sm, textAlign: 'center' },
    personCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md, gap: spacing.sm },
    personChecked: { borderColor: c.success + '66', backgroundColor: c.success + '09' },
    personTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary + '20', alignItems: 'center', justifyContent: 'center' },
    avatarChecked: { backgroundColor: c.success },
    avatarTxt: { color: c.primary, fontWeight: '900', fontSize: font.size.md },
    personName: { color: c.text, fontWeight: '800', fontSize: font.size.md },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 3 },
    meta: { color: c.textMuted, fontSize: 11 },
    iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
    note: { color: c.textMuted, fontSize: 12, backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: 9 },
    cardActions: { flexDirection: 'row', gap: spacing.sm },
    removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: c.danger + '66', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 10 },
    removeTxt: { color: c.danger, fontSize: 12, fontWeight: '700' },
    primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.primary, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 11 },
    primaryBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
    undoBtn: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.primary },
    modalPage: { flex: 1, backgroundColor: c.background },
    modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    modalTitle: { color: c.text, fontFamily: BRAND_FONT, fontSize: font.size.xl },
    modalSub: { color: c.textMuted, fontSize: 11, textTransform: 'capitalize', marginTop: 2 },
    form: { padding: spacing.lg, paddingBottom: 50, gap: spacing.md },
    twoCols: { flexDirection: 'row', gap: spacing.sm },
    fieldLabel: { color: c.text, fontSize: 12, fontWeight: '700' },
    fieldHint: { color: c.textMuted, fontWeight: '400' },
    field: { minHeight: 46, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10 },
    fieldMulti: { minHeight: 90, textAlignVertical: 'top' },
    option: { borderWidth: 1, borderColor: c.glassBorder, borderRadius: radius.full, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: c.surface },
    optionActive: { backgroundColor: c.primary, borderColor: c.primary },
    optionTxt: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    optionTxtActive: { color: '#fff' },
    saveBtn: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: c.primary, marginTop: spacing.sm },
    saveBtnTxt: { color: '#fff', fontWeight: '800', fontSize: font.size.md },
  });
}
