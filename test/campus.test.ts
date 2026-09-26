import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), values: new Map<string, string>() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: mocks.session } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: vi.fn(async (key: string) => mocks.values.get(key) || null),
  setItem: vi.fn(async (key: string, value: string) => { mocks.values.set(key, value); }),
  removeItem: vi.fn(async (key: string) => { mocks.values.delete(key); }),
} }));
import { idReservaBatismo } from '../lib/batismoReserva';
import { apiGet, apiPost, criarInscricaoApi } from '../lib/api';
import { captureCampusSession, setCampusSession } from '../lib/campusSession';
import { campusSalvo, salvarCampus, validarContextoCampus } from '../lib/campus';
import { getBatismoGestao, editarPessoaBatismo } from '../lib/batismoGestao';
import { meuBatismo, listarFotosBatismo, fazerCheckin } from '../lib/batismo';
import { getCulto, proximosCultos } from '../lib/cultos';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function deferred<T>() { let resolve: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve: (value: T) => resolve(value) }; }
beforeEach(() => {
  mocks.values.clear(); mocks.session.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  setCampusSession('pessoa', 'sede');
});
afterEach(() => { setCampusSession(null, null); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('contexto de conteúdo por campus do membro', () => {
  it('persiste a escolha separadamente por usuário', async () => {
    await salvarCampus('um', 'sede'); await salvarCampus('dois', 'outro');
    expect(await campusSalvo('um')).toBe('sede'); expect(await campusSalvo('dois')).toBe('outro');
    await salvarCampus('um', null); expect(await campusSalvo('um')).toBeNull();
  });
  it('rejeita seleção fora do catálogo e outro campus durante preparação', () => {
    const base = { estado: 'ensaio' as const, campus_legado_id: 'sede', campus_id: 'intruso', campi: [{ id: 'sede', nome: 'Sede', slug: 'sede', tipo: 'sede' }] };
    expect(() => validarContextoCampus(base)).toThrow();
    expect(() => validarContextoCampus({ ...base, estado: 'preparacao', campi: [...base.campi, { id: 'intruso', nome: 'Outro', slug: 'outro', tipo: 'sede' }] })).toThrow();
  });
  it('invalida respostas ao trocar campus ou usuário no mesmo campus', () => {
    const original = captureCampusSession(); setCampusSession('pessoa', 'outro');
    expect(original.signal.aborted).toBe(true); expect(() => original.assertCurrent()).toThrow();
    const segundo = captureCampusSession(); setCampusSession('outra-pessoa', 'outro');
    expect(() => segundo.assertCurrent()).toThrow();
  });
  it('não envia uma chamada se a seleção mudar enquanto busca o token', async () => {
    const token = deferred<unknown>(); mocks.session.mockReturnValue(token.promise);
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const request = apiGet('/app/exemplo'); setCampusSession('pessoa', 'outro');
    token.resolve({ data: { session: { access_token: 'novo' } } });
    await expect(request).rejects.toMatchObject({ code: 'CAMPUS_CONTEXT_CHANGED' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('descarta JSON antigo sem transformá-lo em sucesso vazio na gravação', async () => {
    const body = deferred<unknown>(); const response = json({}); vi.spyOn(response, 'json').mockReturnValue(body.promise);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    const request = apiPost('/app/exemplo', {});
    await vi.waitFor(() => expect(response.json).toHaveBeenCalled());
    setCampusSession('pessoa', 'outro'); body.resolve({ id: 'resultado-antigo' });
    await expect(request).rejects.toMatchObject({ code: 'CAMPUS_CONTEXT_CHANGED' });
  });
  it('envia header só nas chamadas autenticadas que têm contexto', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(json({}))); vi.stubGlobal('fetch', fetcher);
    await apiGet('/app/exemplo'); await apiGet('/public/exemplo'); await apiGet('/app/versao', { auth: false });
    expect(fetcher.mock.calls[0][1].headers['X-Campus-Id']).toBe('sede');
    expect(fetcher.mock.calls[1][1].headers['X-Campus-Id']).toBeUndefined();
    expect(fetcher.mock.calls[2][1].headers['X-Campus-Id']).toBeUndefined();
  });
  it('consulta a agenda e o detalhe apenas pelas projeções da API', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(json([]))); vi.stubGlobal('fetch', fetcher);
    await proximosCultos(7, true); await getCulto('culto/id');
    expect(fetcher.mock.calls[0][0]).toContain('/app/campus/agenda?dias=7');
    expect(fetcher.mock.calls[1][0]).toContain('/app/campus/agenda/culto%2Fid');
    expect([...mocks.values.keys()].some(key => key.includes('cultos:pessoa:sede:7:'))).toBe(true);
  });
  it('não reaproveita cache de outro campus quando fica sem rede', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json([{ id: 'culto-sede' }])).mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    await proximosCultos(7, true); setCampusSession('pessoa', 'outro');
    await expect(proximosCultos()).rejects.toThrow('offline');
  });
  it('não consulta a agenda antes de existir uma seleção validada', async () => {
    setCampusSession('pessoa', null); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(proximosCultos()).rejects.toThrow('Escolha o campus'); expect(fetcher).not.toHaveBeenCalled();
  });
});


describe('reserva de batismo do app',()=>{
 const evento='00000000-0000-0000-0000-000000000001';
 it('mantém a chave de retry por usuário, campus e evento',async()=>{
  const a=await idReservaBatismo(evento); expect(await idReservaBatismo(evento)).toBe(a);
  setCampusSession('pessoa','outra'); expect(await idReservaBatismo(evento)).not.toBe(a);
  setCampusSession('outro-usuario','sede'); expect(await idReservaBatismo(evento)).not.toBe(a);
  setCampusSession('pessoa','sede'); expect(await idReservaBatismo(evento)).toBe(a);
 });
 it('não reaproveita uma chave carregada durante a troca de campus',async()=>{
  const pending=idReservaBatismo(evento); setCampusSession('pessoa','outro');
  await expect(pending).rejects.toMatchObject({code:'CAMPUS_CONTEXT_CHANGED'});
 });
 it('usa exclusivamente a porta dedicada para batismo e mantém outros tipos',async()=>{
  const fetcher=vi.fn().mockResolvedValue(json({ok:true}));vi.stubGlobal('fetch',fetcher);
  await criarInscricaoApi({tipo:'batismo',evento_id:evento});
  expect(fetcher.mock.calls[0][0]).toContain('/app/campus/batismo/inscricoes');
  expect(fetcher.mock.calls[0][1].headers['X-Campus-Id']).toBe('sede');
  await criarInscricaoApi({tipo:'contato'});expect(fetcher.mock.calls[1][0]).toMatch(/\/app\/inscricoes$/);
 });
});


it('histórico e fotos de batismo usam inscrição própria na API, nunca pasta por data',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(json({id:'inscricao'})).mockResolvedValueOnce(json([{nome:'foto',url:'assinada'}])).mockResolvedValueOnce(json({ok:true,checkin_em:'agora'}));vi.stubGlobal('fetch',fetcher);
 await meuBatismo('membro-cliente-ignorado');await listarFotosBatismo('inscricao');await fazerCheckin('inscricao');
 expect(fetcher.mock.calls.map(c=>c[0])).toEqual(['https://www.cbrio.org/api/app/campus/batismo/me','https://www.cbrio.org/api/app/campus/batismo/inscricao/fotos','https://www.cbrio.org/api/app/campus/batismo/inscricao/checkin']);
});

it('gestão carrega e edita com campus capturado sem reaproveitar resposta após troca', async () => {
 const response=deferred<Response>();const fetcher=vi.fn().mockReturnValueOnce(response.promise).mockResolvedValue(json({id:'inscricao'}));vi.stubGlobal('fetch',fetcher);
 const request=getBatismoGestao('2099-09-27');await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());
 expect(fetcher.mock.calls[0][1].headers['X-Campus-Id']).toBe('sede');setCampusSession('pessoa','outro');response.resolve(json({pessoas:[{nome:'Pessoa da Sede'}]}));await expect(request).rejects.toThrow('campus');
 await editarPessoaBatismo('inscricao',{observacoes:'Local'});expect(fetcher.mock.calls[1][1].headers['X-Campus-Id']).toBe('outro');
});
