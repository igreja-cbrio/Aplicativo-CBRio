import { idConversaValido } from './assistenteChat';

export type CampoAcao = { chave: 'tamanho_camisa'; rotulo: string; tipo: 'opcoes'; opcoes: string[]; obrigatorio: boolean };
export type PropostaAssistente = { id: string; tipo: 'next' | 'batismo'; titulo: string; resumo: string; termos: string; expira_em: string; campos?: CampoAcao[] };
export type FormularioAssistente = { tipo: 'abrir_formulario'; destino: '/inscricao-next' | '/inscricao-batismo' | '/perfil'; titulo?: string; resumo?: string };
export type AcaoAssistente = PropostaAssistente | FormularioAssistente;

/** O servidor determina a ação; respostas desconhecidas não criam botões de escrita. */
export function lerAcaoAssistente(valor: unknown): AcaoAssistente | null {
  if (!valor || typeof valor !== 'object') return null;
  const a = valor as Record<string, unknown>;
  if (a.tipo === 'abrir_formulario') {
    if (!['/inscricao-next', '/inscricao-batismo', '/perfil'].includes(String(a.destino))) return null;
    return { tipo: a.tipo, destino: a.destino as FormularioAssistente['destino'],
      titulo: typeof a.titulo === 'string' ? a.titulo : undefined, resumo: typeof a.resumo === 'string' ? a.resumo : undefined };
  }
  if (!['next', 'batismo'].includes(String(a.tipo)) || !idConversaValido(a.id)
    || !['titulo', 'resumo', 'termos', 'expira_em'].every(k => typeof a[k] === 'string' && (a[k] as string).trim())
    || !Number.isFinite(Date.parse(a.expira_em as string))) return null;
  if (a.campos !== undefined && (!Array.isArray(a.campos) || a.campos.length > 1 || !a.campos.every(c =>
    c?.chave === 'tamanho_camisa' && c.tipo === 'opcoes' && typeof c.rotulo === 'string'
    && typeof c.obrigatorio === 'boolean' && Array.isArray(c.opcoes) && c.opcoes.length > 0 && c.opcoes.length <= 12
    && c.opcoes.every((o: unknown) => typeof o === 'string' && o.length > 0 && o.length <= 20)))) return null;
  return a as unknown as PropostaAssistente;
}

export function podeConfirmarAcao(acao: PropostaAssistente, aceitou: boolean, campos: Record<string, string>, agora: number): boolean {
  return aceitou && Date.parse(acao.expira_em) > agora && (acao.campos || []).every(c =>
    !c.obrigatorio && !campos[c.chave] || c.opcoes.includes(campos[c.chave]));
}
