import {describe,it,expect} from 'vitest';
import {nextLocalizacaoDisponivel,nextErroExigeLimpeza,nextContextoMudou} from '../lib/nextCampus';
describe('NEXT · localização e conteúdo local',()=>{
 it('não oferece check-in sem localização nem quando configuração foi recusada',()=>{
  expect(nextLocalizacaoDisponivel(null)).toBe(false);expect(nextLocalizacaoDisponivel({igreja:null})).toBe(false);
  expect(nextLocalizacaoDisponivel({localizacao_configurada:false,igreja:{lat:-22,lng:-43,raio_m:200}})).toBe(false);
  expect(nextLocalizacaoDisponivel({igreja:{lat:0,lng:0,raio_m:200}})).toBe(true);
 });
 it('coordenadas impossíveis ou raio ausente não são substituídos pela Sede',()=>{
  for(const local of [{lat:91,lng:0,raio_m:100},{lat:0,lng:181,raio_m:100},{lat:0,lng:0,raio_m:0},{lat:NaN,lng:0,raio_m:100}])expect(nextLocalizacaoDisponivel({igreja:local})).toBe(false);
 });
 it('perda de autorização, identidade ou campus remove conteúdo anterior',()=>{
  for(const erro of [{status:403},{status:401},{status:503,corpo:{code:'campus_superficie_pendente'}},{status:409,corpo:{code:'next_identidade_pendente'}},{code:'CAMPUS_CONTEXT_CHANGED'}])expect(nextErroExigeLimpeza(erro)).toBe(true);
  expect(nextErroExigeLimpeza(new Error('Sem rede'))).toBe(false);expect(nextContextoMudou({code:'CAMPUS_CONTEXT_CHANGED'})).toBe(true);
 });
});
