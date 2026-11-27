// Avisos usam o dia civil do Rio, e não blocos de 24 horas desde o envio.
const FUSO = 'America/Sao_Paulo';
const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function diaCivilAvisos(valor: string | number): string {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return '';
  const partes = formatoDia.formatToParts(data);
  const parte = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export function rotuloDataAviso(
  iso: string | null,
  hoje: string,
  t: (texto: string) => string,
  idioma = 'pt-BR',
  compacto = true,
): string {
  if (!iso) return '';
  const dia = diaCivilAvisos(iso);
  if (!dia) return '';
  const dias = (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dia}T00:00:00Z`)) / 86400000;
  if (dias === 0) return t('Hoje');
  if (dias === 1) return t('Ontem');
  if (compacto && dias > 1 && dias < 7) return t('Há {dias} dias').replace('{dias}', String(dias));
  return new Intl.DateTimeFormat(idioma, {
    timeZone: FUSO, day: '2-digit', month: compacto ? 'short' : 'long',
    ...(dia.slice(0, 4) !== hoje.slice(0, 4) ? { year: 'numeric' as const } : {}),
  }).format(new Date(iso));
}
