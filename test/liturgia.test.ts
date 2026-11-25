import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  horaBRT, duracaoCurta, dividirSecoes, rotaLiturgia, type ItemLiturgia,
  segParaMMSS, mmssParaSeg, rascunhoDe, moverItem, itensParaSalvar, rotuloMusica, previstoAoEscolher, type RascunhoItem,
} from '../lib/liturgia';
import { rotaPai } from '../lib/hierarquia';

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('liturgia do culto · formatação', () => {
  it('hora em Brasília, inclusive quando o UTC já virou o dia', () => {
    expect(horaBRT('2026-11-29T22:05:00Z')).toBe('19:05');
    expect(horaBRT('2026-11-26T01:30:00Z')).toBe('22:30');
    expect(horaBRT(null)).toBeNull();
    expect(horaBRT('lixo')).toBeNull();
  });
  it('duração curta', () => {
    expect(duracaoCurta(300)).toBe('5 min');
    expect(duracaoCurta(330)).toBe('5min30');
    expect(duracaoCurta(3900)).toBe('1h05');
    expect(duracaoCurta(0)).toBe('0 min');
    expect(duracaoCurta(null)).toBeNull();
    expect(duracaoCurta(-1)).toBeNull();
  });
  it('separa culto e pós-culto mantendo a ordem do servidor', () => {
    const it = (ordem: number, secao: 'culto' | 'pos_culto'): ItemLiturgia =>
      ({ ordem, titulo: String(ordem), secao, previsto_seg: 60, inicio: null, observacao: null, especial: false });
    const r = dividirSecoes([it(1, 'culto'), it(2, 'pos_culto'), it(3, 'culto')]);
    expect(r.culto.map(i => i.ordem)).toEqual([1, 3]);
    expect(r.posCulto.map(i => i.ordem)).toEqual([2]);
  });
  it('rota escapa o id', () => {
    expect(rotaLiturgia('a/b')).toBe('/app/voluntariado/liturgia/a%2Fb');
  });
});

describe('liturgia do culto · telas', () => {
  it('a seta da liturgia volta para o Servir', () => {
    expect(rotaPai('/liturgia', { id: 'x' })).toBe('/voluntariado');
  });
  it('a tela só escreve pelo PUT da liturgia, com a versão lida, e só quando o servidor deixa', () => {
    const s = semComentarios(readFileSync('app/(app)/(principal)/liturgia.tsx', 'utf8'));
    expect(s).toContain('rotaLiturgia(');
    expect(s).toContain('useFocusEffect');
    expect(s).not.toMatch(/api(Post|Patch|Delete)\(/);
    expect(s).toContain('apiPut(rotaLiturgia(String(id)), { versao: dados.versao ?? 0, itens: corpo.itens })');
    expect(s).toContain('dados?.pode_editar && !editando');
    expect(s).toMatch(/status === 409/);
  });
  it('card da escala abre a liturgia pelo culto que o servidor mandou', () => {
    const s = semComentarios(readFileSync('app/(app)/(principal)/voluntariado.tsx', 'utf8'));
    expect(s).toContain('service_id: e.service_id ?? null');
    expect(s).toMatch(/pathname: "\/liturgia", params: \{ id: e\.service_id/);
  });
  it('a liturgia mostra as músicas do Louvor, com link checado e erro dito', () => {
    const s = semComentarios(readFileSync('app/(app)/(principal)/liturgia.tsx', 'utf8'));
    expect(s).toContain('dados.musicas_erro');
    expect(s).toContain('linkMusicaSeguro(m.link)');
    expect(s).toContain('Não foi possível carregar as músicas.');
  });
  it('o card "Músicas do culto de hoje" leva até a liturgia do culto', () => {
    const s = semComentarios(readFileSync('components/voluntariado/MusicasCulto.tsx', 'utf8'));
    expect(s).toMatch(/pathname: "\/liturgia", params: \{ id: culto\.id/);
  });
  it('Montar escala tem o relógio do culto escolhido', () => {
    const s = semComentarios(readFileSync('app/(app)/(principal)/escala-supervisor.tsx', 'utf8'));
    expect(s).toMatch(/pathname: "\/liturgia", params: \{ id: servicoSel\.id/);
  });
});

describe('liturgia · edição (fase 2)', () => {
  const item = (o: Partial<ItemLiturgia>): ItemLiturgia => ({
    ordem: 1, titulo: 'X', secao: 'culto', previsto_seg: 60, inicio: null, observacao: null, especial: false, ...o,
  });
  it('mm:ss nos dois sentidos; só minutos vale; lixo é recusado', () => {
    expect(segParaMMSS(330)).toBe('5:30');
    expect(segParaMMSS(null)).toBe('');
    expect(mmssParaSeg('5:30')).toBe(330);
    expect(mmssParaSeg('5')).toBe(300);
    expect(mmssParaSeg('')).toBeNull();
    expect(Number.isNaN(mmssParaSeg('5:75') as number)).toBe(true);
    expect(Number.isNaN(mmssParaSeg('abc') as number)).toBe(true);
  });
  it('rascunho guarda etapa e música; roteiro padrão ganha chave própria', () => {
    const m = { id: 'm1', titulo: 'Grande É o Senhor', artista: null, tom: 'G', link: null };
    const r = rascunhoDe([item({ etapa_id: 'e1', titulo: 'Música 1', e_musica: true, musica: m }), item({ titulo: 'Avisos' })]);
    expect(r[0]).toMatchObject({ chave: 'e1', etapa_id: 'e1', e_musica: true, musica: m, previsto: '1:00' });
    expect(r[1]).toMatchObject({ chave: 'padrao-1', etapa_id: null, e_musica: false, musica: null });
  });
  it('mover não cruza culto/pós-culto e não sai da lista', () => {
    const base: RascunhoItem[] = [
      { chave: 'a', etapa_id: 'a', titulo: 'A', secao: 'culto', previsto: '', e_musica: false, musica: null },
      { chave: 'b', etapa_id: 'b', titulo: 'B', secao: 'culto', previsto: '', e_musica: false, musica: null },
      { chave: 'p', etapa_id: 'p', titulo: 'P', secao: 'pos_culto', previsto: '', e_musica: false, musica: null },
    ];
    expect(moverItem(base, 'b', -1).map(x => x.chave)).toEqual(['b', 'a', 'p']);
    expect(moverItem(base, 'b', 1)).toBe(base);
    expect(moverItem(base, 'a', -1)).toBe(base);
    expect(moverItem(base, 'zz', 1)).toBe(base);
  });
  it('salvar manda pós-culto por último, música por id e recusa tempo ilegível pelo nome', () => {
    const base: RascunhoItem[] = [
      { chave: 'p', etapa_id: 'p', titulo: 'Oração', secao: 'pos_culto', previsto: '10', e_musica: false, musica: null },
      { chave: 'a', etapa_id: null, titulo: 'Música 1', secao: 'culto', previsto: '5:30', e_musica: true, musica: { id: 'm1', titulo: 'T', artista: null, tom: null, link: null } },
    ];
    const r = itensParaSalvar(base);
    expect('itens' in r && r.itens).toEqual([
      { etapa_id: null, titulo: 'Música 1', previsto_seg: 330, secao: 'culto', musica_id: 'm1' },
      { etapa_id: 'p', titulo: 'Oração', previsto_seg: 600, secao: 'pos_culto', musica_id: null },
    ]);
    expect(itensParaSalvar([{ ...base[0], previsto: '9:99' }])).toEqual({ erro: 'Oração' });
  });
  it('rótulo da música junta título, artista e tom', () => {
    expect(rotuloMusica({ id: '1', titulo: 'A', artista: 'B', tom: 'G', link: null })).toBe('A · B · G');
    expect(rotuloMusica(null)).toBe('');
  });
  it('o seletor usa o catálogo do servidor e não esconde erro como lista vazia', () => {
    const s = semComentarios(readFileSync('components/voluntariado/SeletorMusicaLiturgia.tsx', 'utf8'));
    expect(s).toContain('apiGet<{ musicas: MusicaCatalogo[] }>(ROTA_CATALOGO_MUSICAS)');
    expect(s).toContain('apiPost<{ musica: MusicaCatalogo }>(ROTA_CATALOGO_MUSICAS');
    expect(s).toMatch(/ListEmptyComponent=\{\s*erro \? null/);
  });
});

describe('liturgia · música com duração e preview do Planning Center', () => {
  const m = { id: 'm1', titulo: 'T', artista: null, tom: null, link: null, duracao_seg: 312 };
  it('previsto vazio ganha a duração da música; digitado nunca é trocado', () => {
    expect(previstoAoEscolher('', m)).toBe('5:12');
    expect(previstoAoEscolher('6:00', m)).toBe('6:00');
    expect(previstoAoEscolher('', { ...m, duracao_seg: null })).toBe('');
    expect(previstoAoEscolher('', null)).toBe('');
  });
  it('a tela mostra letra e cifra da música do momento e usa a duração ao escolher', () => {
    const s = semComentarios(readFileSync('app/(app)/(principal)/liturgia.tsx', 'utf8'));
    expect(s).toContain('musica.letra');
    expect(s).toContain('musica.cifra');
    expect(s).toContain('previstoAoEscolher(itemEscolhendo.previsto, m)');
  });
});
