import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { apiGet } from './api';
import { compartilharPdfPrivado, salvarPdfPrivado } from './pdfPrivado';
export type DevocionalKids = { id: string; semana: string; titulo: string; serie: string; descricao: string };
export function carregarDevocionaisKids(antes?: string, semana?: string) {
  return apiGet<{ itens: DevocionalKids[]; proxima: string | null }>('/app/kids/devocionais' + (semana ? '?semana=' + encodeURIComponent(semana) : antes ? '?antes=' + encodeURIComponent(antes) : ''));
}
async function obterUrl(id: string) {
  const r = await apiGet<{ url: string }>(`/app/kids/devocionais/${encodeURIComponent(id)}/pdf`);
  const u = new URL(r.url);
  if (u.protocol !== 'https:' || u.host !== 'hhntwfawfnxvuobhdfkb.supabase.co' || !u.pathname.startsWith('/storage/v1/object/sign/kids-devocionais/')) throw new Error('Não foi possível abrir o PDF.');
  return r.url;
}
export async function abrirDevocionalKids(i: DevocionalKids) {
  const url = await obterUrl(i.id);
  if (Platform.OS === 'web') await Linking.openURL(url);
  else WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'close' }).catch(() => {});
}
const opcoes = (i: DevocionalKids) => ({ obterUrl: () => obterUrl(i.id), prefixo: 'devocional-kids', nomeArquivo: `Devocional Kids - ${i.semana}.pdf`, titulo: i.titulo, erroDownload: 'Não foi possível baixar o devocional. Tente novamente.' });
export const salvarDevocionalKids = (i: DevocionalKids) => salvarPdfPrivado(opcoes(i));
export const compartilharDevocionalKids = (i: DevocionalKids) => compartilharPdfPrivado(opcoes(i));
