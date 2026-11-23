import {beforeEach,it,expect,vi} from 'vitest';
const storage=vi.hoisted(()=>({getItem:vi.fn(),setItem:vi.fn(),removeItem:vi.fn()}));
vi.mock('@react-native-async-storage/async-storage',()=>({default:storage}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();storage.getItem.mockResolvedValue(null);storage.setItem.mockResolvedValue(undefined);storage.removeItem.mockResolvedValue(undefined);});
it('guarda intenção no login sem aceitar e elimina ao concluir',async()=>{
  const p=await import('../lib/supervisorConvitePendente');
  await p.guardarConviteSupervisor('a'.repeat(64));
  expect(await p.lerConviteSupervisor()).toBe('a'.repeat(64));
  await p.limparConviteSupervisor();expect(await p.lerConviteSupervisor()).toBeNull();
});
it('cache em memória também expira e não força login para convite antigo',async()=>{
  const now=vi.spyOn(Date,'now').mockReturnValue(1000);
  const p=await import('../lib/supervisorConvitePendente');
  await p.guardarConviteSupervisor('a'.repeat(64));
  now.mockReturnValue(1000+8*864e5);
  expect(await p.lerConviteSupervisor()).toBeNull();
});
it('arquivo inválido ou URL arbitrária não vira destino de navegação',async()=>{
  storage.getItem.mockResolvedValue('{bad');
  const p=await import('../lib/supervisorConvitePendente');
  expect(await p.lerConviteSupervisor()).toBeNull();
  await p.guardarConviteSupervisor('https://evil.test');
  expect(storage.setItem).not.toHaveBeenCalled();
});
