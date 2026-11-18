import { idConversaValido } from './assistenteChat';

export type CampoAcao = { chave: 'tamanho_camisa'; rotulo: string; tipo: 'opcoes'; opcoes: string[]; obrigatorio: boolean };
export type PropostaAssistente = { id: string; tipo: 'next' | 'batismo'; titulo: string; resumo: string; termos: string; expira_em: string; campos?: CampoAcao[] };
export type FormularioAssistente = { tipo: 'abrir_formulario'; destino: '/inscricao-next' | '/inscricao-batismo' | '/perfil'; titulo?: string; resumo?: string };

// Telas que o Pedrinho pode abrir pelo botão do chat (formulário interno em vez do
// link externo · pedido de 17/11/2026). Lista FECHADA espelhada no ERP
// (backend/utils/pedrinhoDestinos.js · FORMULARIOS[*].app): o servidor não vira
// roteador aberto. Único parâmetro aceito: o slug do evento.
export const DESTINOS_TELA = ['/next', '/inscricao-batismo', '/grupos', '/voluntariado', '/apresentacao-crianca', '/perfil', '/evento'] as const;
export type DestinoTela = typeof DESTINOS_TELA[number];
export type TelaAssistente = { tipo: 'abrir_tela'; destino: DestinoTela; params?: { slug: string }; titulo?: string; resumo?: string };
export type AcaoAssistente = PropostaAssistente | FormularioAssistente | TelaAssistente;

/** Cabeçalho que diz ao ERP o que este app sabe desenhar (sem ele, só o legado). */
export const CABECALHO_CAPACIDADES = { 'X-Pedrinho-Capacidades': 'abrir_tela' } as const;
const RE_SLUG = /^[A-Za-z0-9_-]{1,80}$/;

/** Para onde o botão leva. Só ações já validadas por `lerAcaoAssistente`. */
export function destinoDaAcao(acao: FormularioAssistente | TelaAssistente) {
  if (acao.tipo === 'abrir_tela' && acao.params) return { pathname: acao.destino, params: { ...acao.params } };
  return acao.destino;
}

/** O servidor determina a ação; respostas desconhecidas não criam botões de escrita. */
export function lerAcaoAssistente(valor: unknown): AcaoAssistente | null {
  if (!valor || typeof valor !== 'object') return null;
  const a = valor as Record<string, unknown>;
  if (a.tipo === 'abrir_tela') {
    if (!(DESTINOS_TELA as readonly string[]).includes(String(a.destino))) return null;
    const destino = a.destino as DestinoTela;
    let params: { slug: string } | undefined;
    if (a.params !== undefined) {
      const p = a.params as Record<string, unknown> | null;
      if (destino !== '/evento' || !p || typeof p !== 'object' || Array.isArray(p)) return null;
      const chaves = Object.keys(p);
      if (chaves.length !== 1 || chaves[0] !== 'slug' || typeof p.slug !== 'string' || !RE_SLUG.test(p.slug)) return null;
      params = { slug: p.slug };
    } else if (destino === '/evento') return null; // evento sem slug não leva a lugar nenhum
    return { tipo: 'abrir_tela', destino, ...(params ? { params } : {}),
      titulo: typeof a.titulo === 'string' ? a.titulo : undefined, resumo: typeof a.resumo === 'string' ? a.resumo : undefined };
  }
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
