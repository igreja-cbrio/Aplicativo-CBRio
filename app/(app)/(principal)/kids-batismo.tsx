import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import { Text } from '@/components/ui/Typography';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormScaffold } from '@/components/inscricoes/FormScaffold';
import { useDialogo } from '@/components/ui/Dialogo';
import { FilhosInscricao, useFilhosInscricao } from '@/components/kids/FilhosInscricao';
import { detalheFilhoInscricao, nascimentoBR, type FilhoDetalhe } from '@/lib/kidsFilhosInscricao';
import { formBatismoCrianca } from '@/lib/kidsBatismoForm';
import { apiGet, apiPost } from '@/lib/api';
import { dateBRToISO, isValidCPF, isValidDateBR, maskCPF, maskDateBR } from '@/lib/validators';

type DataBatismo = { data_batismo: string; horarios: { horario: string; label: string }[] };
type Textos = { termos_lgpd: string; imagem: string; aviso_optin: string };
export default function KidsBatismo() {
  const { user } = useAuth();
  return <Formulario key={user?.id || 'sem-conta'} />;
}
function Formulario() {
  const c = useColors(), t = useT(), dlg = useDialogo(), consulta = useFilhosInscricao();
  const [filho, setFilho] = useState<FilhoDetalhe | null>(null), [escolhido, setEscolhido] = useState(false);
  const [form, setForm] = useState(() => formBatismoCrianca(null));
  const [datas, setDatas] = useState<DataBatismo[]>([]), [data, setData] = useState(''), [hora, setHora] = useState('');
  const [textos, setTextos] = useState<Textos | null>(null), [carregando, setCarregando] = useState(true), [erroCarga, setErroCarga] = useState(false);
  const [ocupado, setOcupado] = useState(false), [enviado, setEnviado] = useState(false), [erro, setErro] = useState('');
  const [aceite, setAceite] = useState(false), [imagem, setImagem] = useState(false), [whatsapp, setWhatsapp] = useState(false);
  const geracao = useRef(0), ativo = useRef(true), enviando = useRef(false);
  useEffect(() => { ativo.current = true; return () => { ativo.current = false; geracao.current++; }; }, []);
  const carregar = useCallback(async () => {
    setCarregando(true); setErroCarga(false);
    try {
      const [r, tx] = await Promise.all([apiGet<{ datas: DataBatismo[] }>('/public/batismo/horarios', { auth: false }), apiGet<Textos>('/public/batismo/textos', { auth: false })]);
      if (!ativo.current) return;
      if (!Array.isArray(r.datas) || !tx.termos_lgpd || !tx.imagem) throw new Error('indisponível');
      setDatas(r.datas); setData(r.datas[0]?.data_batismo || ''); setHora(''); setTextos(tx);
    } catch { if (ativo.current) setErroCarga(true); }
    finally { if (ativo.current) setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  function iniciar(f: FilhoDetalhe | null) {
    setFilho(f); setForm(formBatismoCrianca(f, consulta.dados?.responsavel)); setEscolhido(true);
    setErro(''); setAceite(false); setImagem(false); setWhatsapp(false); setHora('');
  }
  async function escolher(chave: string) {
    const v = ++geracao.current; setOcupado(true); setErro('');
    try { const f = await detalheFilhoInscricao(chave); if (ativo.current && v === geracao.current) iniciar(f); }
    catch (e) { if (ativo.current && v === geracao.current) setErro(e instanceof Error ? e.message : t('Não foi possível consultar seus filhos.')); }
    finally { if (ativo.current && v === geracao.current) setOcupado(false); }
  }
  function campo(k: keyof typeof form, valor: string | boolean | null) { setForm(v => ({ ...v, [k]: valor })); }
  async function confirmar() {
    if (!escolhido || ocupado || enviando.current || !textos || erroCarga || carregando) return;
    if (!form.nome.trim() || !isValidDateBR(form.nascimento) || !isValidCPF(form.cpf) || !form.sexo || !form.telefone || !form.email || !form.camisa || !data || !hora || !aceite) {
      setErro(t('Complete os dados que faltam, escolha a data e o horário e aceite os termos.')); return;
    }
    if (form.mobilidade && !form.limitacao.trim()) { setErro(t('Descreva a limitação de mobilidade da criança.')); return; }
    if (!await dlg.confirmar({ titulo: t('Confirmar a inscrição desta criança?'), mensagem: `${form.nome} · ${nascimentoBR(data)} · ${hora}`, acao: t('Confirmar inscrição') })) return;
    if (!ativo.current || enviando.current) return;
    enviando.current = true; setOcupado(true); setErro('');
    try {
      const r = await apiPost<{ ok: boolean; duplicado?: boolean; mensagem?: string }>('/app/kids/inscricoes/batismo', {
        filho: filho?.chave || null, nome_completo: form.nome.trim(), cpf: form.cpf, data_nascimento: dateBRToISO(form.nascimento), sexo: form.sexo,
        telefone: form.telefone, email: form.email, tamanho_camisa: form.camisa, data_batismo: data, horario_culto: hora,
        possui_deficiencia: form.mobilidade, deficiencia_descricao: form.limitacao, observacoes: form.observacoes,
        aceita_termos: aceite, consent_imagem: imagem, whatsapp_optin: whatsapp,
      });
      if (!ativo.current) return;
      if (r.duplicado) setErro(r.mensagem || t('Esta criança já tem uma inscrição de batismo em andamento.'));
      else if (r.ok) setEnviado(true);
      else setErro(t('Não foi possível enviar.'));
    } catch (e) { if (ativo.current) setErro(e instanceof Error ? e.message : t('Não foi possível enviar.')); }
    finally { enviando.current = false; if (ativo.current) setOcupado(false); }
  }
  const horarios = datas.find(d => d.data_batismo === data)?.horarios || [];
  const opcoes = (op: { value: string; label: string }[], atual: string, mudar: (v: string) => void) => <View style={s.opcoes}>{op.map(o => <Pressable key={o.value} disabled={ocupado} accessibilityRole="radio" accessibilityState={{ checked: atual === o.value }} onPress={() => mudar(o.value)}
    style={[s.opcao, { backgroundColor: atual === o.value ? c.primary : c.surface, borderColor: c.border }]}><Text style={{ color: atual === o.value ? '#fff' : c.text }}>{o.label}</Text></Pressable>)}</View>;
  const titulo = (texto: string) => <Text style={[s.titulo, { color: c.text }]}>{texto}</Text>;
  return <FormScaffold title={t('Batismo de crianças')} subtitle={t('Escolha seu filho e complete somente o que falta para a inscrição.')} icon="water" submitLabel={t('Inscrever a criança')}
    onSubmit={confirmar} submitting={ocupado} submitDisabled={!escolhido || carregando || erroCarga || !datas.length || !horarios.length} enviado={enviado}
    enviadoTexto={t('Recebemos a inscrição da criança. A equipe entrará em contato com o responsável.')} error={erro} overlay={<dlg.Dialogo />}>
    {!escolhido ? <>
      <FilhosInscricao consulta={consulta} escolher={escolher} ocupado={ocupado} />
      <Button title={t('Inscrever uma criança ainda não cadastrada')} variant="ghost" disabled={ocupado || consulta.carregando || consulta.erro} onPress={() => iniciar(null)} />
    </> : <>
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {titulo(filho?.nome || t('Dados da criança'))}
        {filho ? <Text style={{ color: c.textMuted }}>{t('Os dados já cadastrados foram preenchidos. Complete apenas os campos que faltam.')}</Text> : null}
        {filho?.data_nascimento ? <Text style={{ color: c.text }}>{nascimentoBR(filho.data_nascimento)}</Text> : null}
        <Button title={t('Selecionar outra criança')} variant="ghost" disabled={ocupado} onPress={() => { geracao.current++; setEscolhido(false); setFilho(null); setForm(formBatismoCrianca(null)); setErro(''); }} />
      </View>
      {!filho?.nome ? <Input label={t('Nome completo da criança')} value={form.nome} onChangeText={v => campo('nome', v)} editable={!ocupado} /> : null}
      {!filho?.data_nascimento ? <Input label={t('Data de nascimento da criança')} value={form.nascimento} onChangeText={v => campo('nascimento', maskDateBR(v))} keyboardType="number-pad" placeholder="DD/MM/AAAA" editable={!ocupado} /> : null}
      {!filho?.sexo ? <>{titulo(t('Sexo'))}{opcoes([{ value: 'F', label: t('Menina') }, { value: 'M', label: t('Menino') }], form.sexo, v => campo('sexo', v))}</> : null}
      {!filho?.batismo.cpf ? <Input label={t('CPF da criança')} value={form.cpf} onChangeText={v => campo('cpf', maskCPF(v))} keyboardType="number-pad" editable={!ocupado} /> : null}
      {titulo(t('Contato do responsável'))}
      {consulta.dados?.responsavel.telefone ? <Text style={{ color: c.text }}>{form.telefone}</Text> : <Input label={t('Telefone do responsável')} value={form.telefone} onChangeText={v => campo('telefone', v)} keyboardType="phone-pad" editable={!ocupado} />}
      {consulta.dados?.responsavel.email ? <Text style={{ color: c.text }}>{form.email}</Text> : <Input label={t('E-mail do responsável')} value={form.email} onChangeText={v => campo('email', v)} keyboardType="email-address" autoCapitalize="none" editable={!ocupado} />}
      {titulo(t('Data e horário do batismo'))}
      {carregando ? <Text style={{ color: c.textMuted }}>{t('Carregando…')}</Text> : erroCarga ? <Button title={t('Tentar novamente')} onPress={carregar} /> : !datas.length ? <Text style={{ color: c.textMuted }}>{t('Não há datas de batismo abertas no momento.')}</Text> : <>
        {opcoes(datas.map(d => ({ value: d.data_batismo, label: nascimentoBR(d.data_batismo) })), data, v => { setData(v); setHora(''); })}
        {opcoes(horarios.map(h => ({ value: h.horario, label: h.label })), hora, setHora)}
        {!horarios.length ? <Text style={{ color: c.textMuted }}>{t('Não há horários disponíveis nesta data.')}</Text> : null}
      </>}
      {titulo(t('Tamanho da camisa'))}{opcoes(['PP','P','M','G','GG','XG','XGG'].map(value => ({ value, label: value })), form.camisa, v => campo('camisa', v))}
      {titulo(t('A criança tem limitação de mobilidade?'))}
      {filho?.saude.tem_limitacao_fisica !== null && filho?.saude.tem_limitacao_fisica !== undefined
        ? <Text style={{ color: c.text }}>{form.mobilidade ? t('Sim') : t('Não')}</Text>
        : opcoes([{ value: 'sim', label: t('Sim') }, { value: 'nao', label: t('Não') }], form.mobilidade === null ? '' : form.mobilidade ? 'sim' : 'nao', v => campo('mobilidade', v === 'sim'))}
      {form.mobilidade ? <Input label={t('Qual limitação?')} value={form.limitacao} onChangeText={v => campo('limitacao', v)} editable={!ocupado && !filho?.saude.limitacao_fisica_qual} /> : null}
      <Input label={t('Observações (opcional)')} value={form.observacoes} onChangeText={v => campo('observacoes', v)} multiline editable={!ocupado} />
      {textos ? <View pointerEvents={ocupado ? 'none' : 'auto'} style={{ gap: 16 }}>
        {titulo(t('Autorizações do responsável'))}
        <Checkbox label={textos.termos_lgpd} checked={aceite} onChange={setAceite} />
        <Checkbox label={textos.imagem} checked={imagem} onChange={setImagem} />
        <Checkbox label={textos.aviso_optin} checked={whatsapp} onChange={setWhatsapp} />
      </View> : null}
    </>}
  </FormScaffold>;
}
const s = StyleSheet.create({ titulo: { fontSize: 17, fontWeight: '700' }, card: { padding: 18, borderWidth: 1, borderRadius: 16, gap: 10 }, opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, opcao: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderRadius: 12 } });
