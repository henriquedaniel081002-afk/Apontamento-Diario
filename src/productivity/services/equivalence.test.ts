import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import * as XLSX from 'xlsx';
const {from,rpc}=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{from,rpc},isSupabaseConfigured:true}));
import {loadDashboardData} from './dashboardService';
import {loadDashboardData as baseline} from '../../../tests/fixtures/audit-productivity-dashboardService';
import {parseProductivityWorkbook,importProductivity,filterImportPreviewByMonths} from './importService';
import {parseProductivityWorkbook as baselineParse} from '../../../tests/fixtures/audit-productivity-importService';
const production=Array.from({length:2001},(_,i)=>({id:String(i),...(i%2?{matricula:'001'}:{colaborador_id:'002'}),nome:`Pessoa ${i}`,turno:i%2+1,setor:'BOBINAGEM',data:i<1000?'2026-09-01':'2026-10-01',quantidade_produzida:i%9,desenho:i%2?'AT':'AM',tempo_produzido_min:3,tempo_parado_min:2,hora_extra_min:i%60,observacao:'Teste',campo_remoto_nao_utilizado:'preservar compatibilidade'}));
let ranges:number[]=[];let aborted:AbortController|undefined;
beforeEach(()=>{
 vi.stubEnv('VITE_PRODUTIVIDADE_PROJECAO_VALIDADA','');vi.clearAllMocks();ranges=[];aborted=undefined;
 from.mockImplementation(table=>{
  const data=table==='colaboradores_controle'?[{matricula:'001',nome:'Cadastro',turno:1,primeira_producao:'2025-01-01'}]:table==='colaboradores_desligados'?[{matricula:'002',nome:'Arquivo',data_desligamento:'2026-10-02'}]:table==='dias_trabalho'?[{data:'2026-09-01'}]:[];
  const b:any={select:()=>b,order:()=>b,eq:()=>b,abortSignal:()=>b,in:()=>b,upsert:()=>b,
   range:async(start:number,end:number)=>{ranges.push(start);if(start===1000)aborted?.abort();return {data:production.slice(start,end+1),error:null};},
   then:(resolve:any)=>Promise.resolve({data,error:null}).then(resolve)};return b;
 });
});
afterEach(()=>vi.unstubAllEnvs());
describe('Produtividade — equivalência sem truncar histórico',()=>{
 it('projeta por página com registros, aliases, desligados e cálculos idênticos ao ZIP',async()=>{
  const before=await baseline();ranges=[];const after=await loadDashboardData();expect(after).toEqual(before);expect(after.records).toHaveLength(2001);expect(ranges).toEqual([0,1000,2000]);
  expect(after.employees.find(e=>e.id==='001')).toMatchObject({name:'Cadastro',firstProductionDate:'2025-01-01'});
 });
 it('interrompe paginação mesmo quando o transporte ignora o sinal',async()=>{
  aborted=new AbortController();await expect(loadDashboardData(aborted.signal)).rejects.toMatchObject({name:'AbortError'});expect(ranges).toEqual([0,1000]);
 });
 it('normaliza cabeçalhos uma vez sem alterar preview, datas, horas extras ou avisos',async()=>{
  const wb=XLSX.utils.book_new();const sheet=XLSX.utils.json_to_sheet(Array.from({length:1500},(_,i)=>({'DATA':i%2?'01/10/2026':46266,'MATRÍCULA':String(i%5),'NOME DO COLABORADOR':i%7?`Pessoa ${i}`:null,'SETOR':'BOBINAGEM','TURNO':i%2?'2º':'1º','MÁQUINA':'A','DESENHO':'AT','OP':'77','POTÊNCIA':30,'QUANTIDADE PRODUZIDA':'1.234,5','HORA EXTRA (min)':i%2?30:45,'REALIZADO':10,'OBSERVAÇÃO':'texto'})));
  XLSX.utils.book_append_sheet(wb,sheet,'BOBINAGEM (MÁQ)');const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'});const file={name:'sintetico.xlsx',arrayBuffer:async()=>bytes} as File;
  const before=await baselineParse(file),after=await parseProductivityWorkbook(file);expect(after).toEqual(before);expect(filterImportPreviewByMonths(after,['2026-10']).productionPayload.every(r=>r.data.startsWith('2026-10'))).toBe(true);
 });
 it('mantém RPC de substituição integral e não recria matrícula desligada',async()=>{
  from.mockImplementation(table=>{const b:any={select:()=>b,in:()=>b,upsert:(rows:any)=>{expect(rows.every((r:any)=>r.matricula!=='002')).toBe(true);return b;},then:(resolve:any)=>Promise.resolve({data:table==='colaboradores_desligados'?[{matricula:'002'}]:[],error:null}).then(resolve)};return b;});
  rpc.mockResolvedValue({data:{importados:2},error:null});
  const preview={fileName:'mock.xlsx',productionRows:2,firstDate:null,lastDate:null,availableMonths:[],warnings:[],productionPayload:[{matricula:'001',data:'2026-10-01',hora_extra_min:30},{matricula:'002',data:'2026-10-01',hora_extra_min:45}]};
  await importProductivity(preview);expect(rpc).toHaveBeenCalledExactlyOnceWith('importar_produtividade',{p_producao:preview.productionPayload});
 });
});
