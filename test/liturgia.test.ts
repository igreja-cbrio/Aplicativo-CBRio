import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { horaBRT, duracaoCurta, dividirSecoes, rotaLiturgia, type ItemLiturgia } from '../lib/liturgia';
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
  it('a tela é só leitura: não chama verbo de escrita', () => {
    const s = semComentarios(readFileSync('app/(app)/liturgia.tsx', 'utf8'));
    expect(s).toContain('rotaLiturgia(');
    expect(s).toContain('useFocusEffect');
    expect(s).not.toMatch(/api(Post|Patch|Put|Delete)/);
  });
  it('card da escala abre a liturgia pelo culto que o servidor mandou', () => {
    const s = semComentarios(readFileSync('app/(app)/voluntariado.tsx', 'utf8'));
    expect(s).toContain('service_id: e.service_id ?? null');
    expect(s).toMatch(/pathname: "\/liturgia", params: \{ id: e\.service_id/);
  });
  it('Montar escala tem o relógio do culto escolhido', () => {
    const s = semComentarios(readFileSync('app/(app)/escala-supervisor.tsx', 'utf8'));
    expect(s).toMatch(/pathname: "\/liturgia", params: \{ id: servicoSel\.id/);
  });
});
