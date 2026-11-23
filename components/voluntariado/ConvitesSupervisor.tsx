import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import { apiGet, apiPost } from '@/lib/api';
import { tokenSupervisor } from '@/lib/supervisorConvite';
import { limparConviteSupervisor } from '@/lib/supervisorConvitePendente';
type Convite = { id:string; nome_area:string; estado:string; expires_at:string };
export function ConvitesSupervisor() {
  const { convite } = useLocalSearchParams<{convite?:string}>();
  const token = tokenSupervisor(convite);
  const [rows,setRows] = useState<Convite[]>([]);
  const [erro,setErro] = useState('');
  const [busy,setBusy] = useState<string|null>(null);
  const [versao,setVersao] = useState(0);
  const router=useRouter(); const colors=useColors(); const t=useT();
  useFocusEffect(useCallback(()=>{
    let vivo=true; setErro(''); setRows([]);
    apiGet<Convite[]>(`/app/voluntariado/supervisor-convites${token ? `?token=${token}` : ''}`).then(r=>{
      if(!vivo)return; setRows(r);
      if(token && r.length && r.every(c=>c.estado!=='pendente')) void limparConviteSupervisor().catch(()=>{});
      if(token && !r.length)setErro(t('Este convite não está disponível para a sua conta. Confira com o líder se o cadastro escolhido é o seu.'));
    }).catch(()=>{if(vivo)setErro(t('Não foi possível carregar os convites. Tente novamente.'));});
    return ()=>{vivo=false;};
  },[token,versao,t]));
  async function aceitar(c:Convite) {
    if(busy)return; setBusy(c.id); setErro('');
    try {
      await apiPost(`/app/voluntariado/supervisor-convites/${c.id}/aceitar`,{});
      await limparConviteSupervisor().catch(()=>{});
      router.replace('/escala-supervisor');
    } catch(e:any){setErro(e.message || t('Não foi possível aceitar o convite.')) ;}
    finally{setBusy(null);}
  }
  if(!rows.length && !erro)return null;
  return <View style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <Text style={{color:colors.text,fontWeight:'800',fontSize:18}}>{t('Convites para supervisão')}</Text>
    {erro ? <><Text style={{color:colors.textMuted}}>{erro}</Text><Button title={t('Tentar novamente')} onPress={()=>setVersao(v=>v+1)}/></> : null}
    {token ? <Button title={t('Ver todos os meus convites')} variant="ghost" onPress={() => { void limparConviteSupervisor().catch(()=>{}); router.replace('/voluntariado'); }} /> : null}
    {rows.map(c=><View key={c.id} style={styles.item}>
      <Text style={{color:colors.text,fontWeight:'700'}}>{c.nome_area}</Text>
      <Text style={{color:colors.textMuted}}>{t('Válido até')} {new Date(c.expires_at).toLocaleDateString()}</Text>
      <Text style={{color:colors.textMuted}}>{t('Ao aceitar, você poderá gerenciar as escalas e a equipe desta área pelo app.')}</Text>
      {c.estado==='pendente' ? <Button title={t('Aceitar convite')} loading={busy===c.id} disabled={!!busy} onPress={()=>aceitar(c)}/> : <Text style={{color:colors.textMuted}}>{c.estado==='aceito'?t('Convite já aceito. Acesse Montar escala em Servir.'):t('Este convite expirou ou foi cancelado. Peça um novo ao líder.')}</Text>}
    </View>)}
  </View>;
}
const styles=StyleSheet.create({card:{padding:16,borderWidth:1,borderRadius:16,gap:12,marginBottom:16},item:{gap:10}});
