import { apiGet, apiPost } from './api';
export type PedidoTransferencia = {
  id: string;
  igreja_destino: string;
  status: 'em_cuidados' | 'aguardando_integracao' | 'finalizada' | 'cancelada';
  created_at: string;
  encaminhado_em?: string | null;
  finalizado_em?: string | null;
};
export type MeusPedidosTransferencia = {
  pessoa: { nome: string; email: string | null; telefone: string | null };
  pode_solicitar: boolean;
  pedidos: PedidoTransferencia[];
};
export const STATUS_TRANSFERENCIA = {
  em_cuidados: 'Em atendimento por Cuidados',
  aguardando_integracao: 'Aguardando Integração',
  finalizada: 'Transferência finalizada',
  cancelada: 'Pedido cancelado',
} as const;
export function pedidoAberto(pedidos: PedidoTransferencia[]) {
  return pedidos.find(
    (p) => p.status === 'em_cuidados' || p.status === 'aguardando_integracao',
  );
}
export function nomeIgrejaValido(nome: string) {
  const n = nome.trim().replace(/\s+/g, ' ');
  return n.length >= 2 && n.length <= 160 && !/[\u0000-\u001f\u007f]/.test(n);
}
export const carregarTransferencias = () =>
  apiGet<MeusPedidosTransferencia>('/app/carta-transferencia');
export const solicitarTransferencia = (igreja: string) =>
  apiPost<{ pedido: PedidoTransferencia }>('/app/carta-transferencia', {
    igreja_destino: igreja.trim().replace(/\s+/g, ' '),
  });
