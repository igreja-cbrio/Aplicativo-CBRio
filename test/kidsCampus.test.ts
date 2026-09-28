import {describe,it,expect} from 'vitest';
import {kidsPodePreparar,kidsContextoMudou} from '../lib/kidsCampus';
import {captureCampusSession,setCampusSession} from '../lib/campusSession';
describe('Kids próprio por campus',()=>{
 it('responsabilidade global não seleciona automaticamente participação local não comprovada',()=>{
  const filhos=[{id:'local',participa_campus:true},{id:'outro',participa_campus:false},{id:'legado'}];
  expect(filhos.filter(kidsPodePreparar).map(f=>f.id)).toEqual(['local']);
 });
 it('troca de campus invalida confirmação de retirada de foto e escolha de câmera anterior',()=>{
  setCampusSession('responsavel','campus-a');const dialogo=captureCampusSession();setCampusSession('responsavel','campus-b');
  try{dialogo.assertCurrent();throw new Error('Não deveria continuar');}catch(e){expect(kidsContextoMudou(e)).toBe(true);}finally{dialogo.release();}
 });
 it('logout invalida a leitura anterior de dados médicos',()=>{
  setCampusSession('responsavel','campus-a');const leitura=captureCampusSession();setCampusSession(null,null);
  expect(()=>leitura.assertCurrent()).toThrow('O campus mudou');leitura.release();
 });
});
