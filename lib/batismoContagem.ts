/** Apresentação da agenda cadastrada, no fuso da igreja; nunca estima uma data. */
export type AgendaBatismo = {
  data_batismo: string | null;
  horario_culto?: string | null;
  status: string;
};
export function contagemBatismo(batismo: AgendaBatismo, agora: number) {
  const iso = batismo.data_batismo ?? '';
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    && Number.isFinite(Date.parse(`${iso}T12:00:00Z`))
    && new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso;
  const horario = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(batismo.horario_culto ?? '')
    ? batismo.horario_culto!.slice(0, 5) : null;
  const hoje = new Date(agora - 3 * 3600000).toISOString().slice(0, 10);
  const diasCalendario = dataValida ? Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000) : null;
  const alvo = dataValida && horario ? Date.parse(`${iso}T${horario}:00-03:00`) : null;
  const minutos = alvo === null ? null : Math.max(0, Math.ceil((alvo - agora) / 60000));
  const estado = batismo.status === 'cancelado' ? 'cancelado'
    : batismo.status === 'realizado' ? 'realizado'
    : diasCalendario === null ? 'sem-data'
    : diasCalendario < 0 ? 'passado'
    : diasCalendario === 0 ? 'hoje' : 'agendado';
  return {
    estado, horario, data: dataValida ? iso : null, diasCalendario,
    dias: minutos === null ? diasCalendario : Math.floor(minutos / 1440),
    horas: minutos === null ? null : Math.floor(minutos % 1440 / 60),
    minutos: minutos === null ? null : minutos % 60,
  } as const;
}
