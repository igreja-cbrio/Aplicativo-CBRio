import { describe,it,expect } from 'vitest';
import { tokenSupervisor,destinoSupervisor,conviteDaUrl } from '../lib/supervisorConvite';
const token='a'.repeat(64);
describe('destino fechado do convite de supervisor',()=>{
  it('retoma somente Servir com token válido',()=>{
    expect(destinoSupervisor(token)).toBe(`/voluntariado?convite=${token}`);
    for(const v of ['https://evil.test','//evil.test',null,[],token+'?next=foo','a']) expect(destinoSupervisor(v)).toBeNull();
  });
  it('não captura URLs de terceiros como convites',()=>{
    expect(conviteDaUrl(`cbrio://voluntariado?convite=${token}`)).toBe(token);
    expect(conviteDaUrl(`https://voluntariado?convite=${token}`)).toBeNull();
    expect(conviteDaUrl(`cbrio://voluntariado/falso?convite=${token}`)).toBeNull();
    expect(conviteDaUrl(`cbrio://familia?convite=${token}`)).toBeNull();
  });
  it('query duplicada não vira token por array',()=>expect(tokenSupervisor([token,token])).toBeNull());
});
