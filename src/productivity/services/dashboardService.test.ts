import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const {from,orders,selects,signalSpy}=vi.hoisted(()=>({from:vi.fn(),orders:vi.fn(),selects:vi.fn(),signalSpy:vi.fn()}));
vi.mock('../lib/supabase',()=>({isSupabaseConfigured:true,supabase:{from}}));
import {loadDashboardData} from './dashboardService';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VITE_PRODUTIVIDADE_PROJECAO_VALIDADA','1');});
afterEach(()=>vi.unstubAllEnvs());
describe('Produtividade — contrato de leitura',()=>{
 it('projeta campos usados, ordena por data e ID, mantém horas e dados de desligamento',async()=>{
  const signal=new AbortController().signal;
  from.mockImplementation(table=>{
   const rows=table==='vw_producao_detalhada'?[{id:'1',matricula:'001',nome:'Pessoa sintética',setor:'BOBINAGEM',turno:2,data:'2026-09-01',quantidade_produzida:10,desenho:'X',tempo_produzido_min:200,tempo_parado_min:30,hora_extra_min:45}]:table==='colaboradores_desligados'?[{matricula:'001',nome:'Pessoa sintética',data_desligamento:'2026-09-10'}]:table==='dias_trabalho'?[{data:'2026-09-01'}]:[];
   const builder:any={select:(columns:string)=>{selects(table,columns);return builder;},order:(...args:any[])=>{orders(...args);return builder;},eq:()=>builder,abortSignal:(value:any)=>{signalSpy(value);return builder;},range:async()=>({data:rows,error:null}),then:(resolve:any)=>Promise.resolve({data:rows,error:null}).then(resolve)};
   return builder;
  });
  const result=await loadDashboardData(signal);
  expect(selects.mock.calls.every(([,fields])=>fields!=='*')).toBe(true);
  expect(orders).toHaveBeenCalledWith('id',{ascending:true});
  expect(signalSpy).toHaveBeenCalledWith(signal);
  expect(from).toHaveBeenCalledTimes(4);
  expect(result.records[0]).toMatchObject({employeeId:'001',producedMinutes:200,stoppageMinutes:30,overtimeMinutes:45,rawQuantity:10});
  expect(result.employees[0]).toMatchObject({status:'Desligado',terminationDate:'2026-09-10',firstProductionDate:'2026-09-01',shift:'2º Turno'});
  vi.stubEnv('VITE_PRODUTIVIDADE_PROJECAO_VALIDADA','');
  selects.mockClear();
  await loadDashboardData();
  expect(selects).toHaveBeenCalledWith('vw_producao_detalhada','*');
 });
});
