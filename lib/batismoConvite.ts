import { contagemBatismo, type AgendaBatismo } from './batismoContagem';

type InscricaoConvite = AgendaBatismo & { nome: string | null; sobrenome?: string | null };
/** Só os dados públicos necessários ao convite; nunca inclui observações ou cadastro. */
export function conviteBatismo(inscricao: InscricaoConvite, agora: number) {
  const agenda = contagemBatismo(inscricao, agora);
  if (!agenda.data || !['agendado', 'hoje'].includes(agenda.estado)) return null;
  const nome = [inscricao.nome, inscricao.sobrenome].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const [ano, mes, dia] = agenda.data.split('-');
  const data = `${dia}/${mes}/${ano}`;
  const horario = agenda.horario ? `${agenda.horario} · Horário de Brasília` : 'Horário a confirmar';
  const texto = `Vou me batizar! 💙\n\nQuero você comigo nesse momento tão especial da minha caminhada com Jesus.\n\n${nome ? `${nome}\n` : ''}📅 ${data}\n🕒 ${horario}\n📍 CBRio\n\nVenha celebrar comigo!`;
  return { nome, data, horario, texto };
}
export type ConviteBatismo = NonNullable<ReturnType<typeof conviteBatismo>>;
