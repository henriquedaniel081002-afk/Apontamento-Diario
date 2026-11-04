import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GestaoAtrasosPage } from './GestaoAtrasosPage';
import { apiRequest } from '../services/apiClient';
import { readDetailedExcel } from '../gestao-atrasos/importDetailedExcel';
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn()}));
vi.mock('../gestao-atrasos/importDetailedExcel',()=>({readDetailedExcel:vi.fn()}));
const api=vi.mocked(apiRequest);
const user={id:'1',name:'Coordenação',perfil:'COORDENACAO' as const,setor:'SOLDA' as const,linhas:[]};
const combinations=[{setor:'SOLDA',linha:'MON'},{setor:'SOLDA',linha:'TRI'},{setor:'BOBINAGEM EPOXI',linha:'EPO'},{setor:'ENCAPSULAMENTO',linha:'EPO'}];
const summary={rows:[],total:150,page:1,periodo:{inicio:'2026-10-01',fim:'2026-11-30',hoje:'2026-11-03'},kpis:{ops_atrasadas:4},importacoes:[{tipo:'APONTAMENTO',esperado:10}]};
const summaries=()=>api.mock.calls.filter(([p])=>p.includes('/resumo'));
const optionsCalls=()=>api.mock.calls.filter(([p])=>p.includes('/filtros'));
async function choose(label:string,option:string){fireEvent.click(screen.getByRole('combobox',{name:label}));fireEvent.click(screen.getByRole('option',{name:option}));}
beforeEach(()=>{api.mockReset();vi.mocked(readDetailedExcel).mockReset();api.mockImplementation(async path=>path.includes('/filtros')?{combinacoes:combinations}:summary);});
afterEach(cleanup);
async function ready(){render(<GestaoAtrasosPage user={user} active/>);await waitFor(()=>expect(screen.getByRole('combobox',{name:'Setor'})).toBeEnabled());await waitFor(()=>expect(summaries()).toHaveLength(1));}
describe('Visão OP — filtros reais e importação',()=>{
 it('seleciona sem digitação, restringe linhas e limpa combinação incompatível',async()=>{
  await ready();await choose('Setor','SOLDA');await choose('Linha','TRI');
  await waitFor(()=>expect(summaries().at(-1)?.[0]).toContain('linha=TRI'));
  await choose('Setor','BOBINAGEM EPOXI');
  expect(screen.getByRole('combobox',{name:'Linha'})).toHaveTextContent('Todas');
  fireEvent.click(screen.getByRole('combobox',{name:'Linha'}));
  expect(screen.queryByRole('option',{name:'TRI'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('option',{name:'EPO'}));
  await waitFor(()=>expect(summaries().at(-1)?.[0]).toContain('linha=EPO'));
  expect(optionsCalls()).toHaveLength(1);
 });
 it('debounce combina OP, Série e Cliente sem consultar opções novamente',async()=>{
  await ready();for(const value of ['1','12','123'])fireEvent.change(screen.getByLabelText('OP'),{target:{value}});
  fireEvent.change(screen.getByLabelText('Série'),{target:{value:'987'}});fireEvent.change(screen.getByLabelText('Cliente'),{target:{value:'Cliente'}});
  await waitFor(()=>expect(summaries()).toHaveLength(2));
  const query=new URL(summaries().at(-1)![0],'http://local').searchParams;
  expect(Object.fromEntries(query)).toMatchObject({op:'123',serie:'987',cliente:'Cliente',page:'1'});expect(optionsCalls()).toHaveLength(1);
 });
 it('valida OP antes da rede e mantém a tabela acessível por teclado',async()=>{
  await ready();fireEvent.change(screen.getByLabelText('OP'),{target:{value:'ABC'}});
  await screen.findByText('Informe apenas números em OP e Série (até 20 dígitos).');expect(summaries()).toHaveLength(1);
  expect(screen.getByRole('region',{name:'Tabela de OPs com rolagem horizontal e vertical'})).toHaveAttribute('tabindex','0');
 });
 it('limpar redefine filtros, dependências e página',async()=>{
  await ready();await choose('Setor','SOLDA');await choose('Linha','MON');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Próxima'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Próxima'}));
  await waitFor(()=>expect(summaries().at(-1)?.[0]).toContain('page=2'));
  fireEvent.click(screen.getByRole('button',{name:'Limpar filtros'}));
  await waitFor(()=>expect(summaries().at(-1)?.[0]).toBe('/api/gestao-atrasos/resumo?situacao=ATRASADOS&page=1'));
  expect(screen.getByRole('combobox',{name:'Setor'})).toHaveTextContent('Todos os autorizados');
 });
 it('teclado seleciona setor e Escape fecha a lista',async()=>{
  await ready();const control=screen.getByRole('combobox',{name:'Setor'});control.focus();
  fireEvent.keyDown(control,{key:'ArrowDown'});fireEvent.keyDown(control,{key:'End'});fireEvent.keyDown(control,{key:'Enter'});
  expect(control).toHaveTextContent('ENCAPSULAMENTO');expect(control).toHaveFocus();
  fireEvent.keyDown(control,{key:'ArrowDown'});fireEvent.keyDown(control,{key:'Escape'});expect(control).toHaveAttribute('aria-expanded','false');
 });
 it('líder vê somente opções retornadas pelo escopo e não possui importação',async()=>{
  api.mockImplementation(async path=>path.includes('/filtros')?{combinacoes:[combinations[2]]}:summary);
  render(<GestaoAtrasosPage user={{...user,perfil:'APONTADOR'}} active/>);
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'Setor'})).toBeEnabled());
  fireEvent.click(screen.getByRole('combobox',{name:'Setor'}));expect(screen.queryByRole('option',{name:'SOLDA'})).not.toBeInTheDocument();
  expect(screen.queryByText('Importação detalhada · programação e apontamento')).not.toBeInTheDocument();
 });
 it('descarta opções antigas após troca de período mesmo sem cancelamento no transporte',async()=>{
  let oldResolve:any,newResolve:any;
  api.mockImplementation(async path=>!path.includes('/filtros')?summary:new Promise(resolve=>{if(path.includes('inicio='))newResolve=resolve;else oldResolve=resolve;}));
  render(<GestaoAtrasosPage user={user} active/>);await waitFor(()=>expect(oldResolve).toBeTypeOf('function'));
  fireEvent.change(screen.getByLabelText('Início'),{target:{value:'2026-10-15'}});await waitFor(()=>expect(newResolve).toBeTypeOf('function'));
  await act(async()=>newResolve({combinacoes:[combinations[2]]}));await act(async()=>oldResolve({combinacoes:[combinations[0]]}));
  fireEvent.click(screen.getByRole('combobox',{name:'Setor'}));expect(screen.queryByRole('option',{name:'SOLDA'})).not.toBeInTheDocument();expect(screen.getByRole('option',{name:'BOBINAGEM EPOXI'})).toBeVisible();
 });
 it('preserva filtro ao alternar Série/OP e revalida opções ao retornar',async()=>{
  const view=render(<GestaoAtrasosPage user={user} active/>);await waitFor(()=>expect(screen.getByRole('combobox',{name:'Setor'})).toBeEnabled());
  await choose('Setor','SOLDA');view.rerender(<GestaoAtrasosPage user={user} active={false}/>);view.rerender(<GestaoAtrasosPage user={user} active/>);
  await waitFor(()=>expect(optionsCalls()).toHaveLength(2));expect(screen.getByRole('combobox',{name:'Setor'})).toHaveTextContent('SOLDA');
 });
 it.each([false,true])('coordenação envia lotes sequenciais e finaliza somente completos (falha=%s)',async fail=>{
  let inFlight=0;
  vi.mocked(readDetailedExcel).mockResolvedValue({tipo:'PROGRAMACAO',fileName:'local.xlsx',ignored:0,rows:Array.from({length:1001},(_,i)=>({serie:String(i+1),op:'77',setor:'SOLDA',linha:'MON',data_programada:'2026-10-01'}))});
  api.mockImplementation(async(path,init)=>{
   if(path.includes('/filtros'))return {combinacoes:combinations};if(!init?.method)return summary;
   if(path.endsWith('/iniciar'))return {id:'local'};
   if(path.endsWith('/lote')){expect(inFlight).toBe(0);inFlight++;await new Promise(r=>setTimeout(r,5));inFlight--;if(fail)throw Error('Falha de lote local');return {gravados:1000};}
   return {importados:1001,divergencias:[],totalDivergencias:0,avisoConferencia:null};
  });
  await ready();fireEvent.click(screen.getByText('Importação detalhada · programação e apontamento'));
  fireEvent.change(screen.getByLabelText('Programação detalhada'),{target:{files:[new File(['mock'],'local.xlsx')]}});
  await screen.findByText(fail?/Envio interrompido/:/1.001 importados/);
  const writes=api.mock.calls.filter(([,init])=>init?.method==='POST').map(([path])=>path.split('/').at(-1));
  expect(writes).toEqual(fail?['iniciar','lote']:['iniciar','lote','lote','finalizar']);
  if(!fail)await waitFor(()=>expect(optionsCalls()).toHaveLength(2));
 });
});
