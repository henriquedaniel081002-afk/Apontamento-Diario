import {describe,it,expect} from 'vitest';
import {gerarPdfPrioridades,type FiltrosPrioridades,type PrioridadeLinha} from './prioridadesPdf';

const filtros:FiltrosPrioridades={op:'',serie:'',setor:'BOBINAGEM',linha:'',cliente:'',
  inicio:'',fim:'',situacao:'TODOS',justificativa:'',multiplos:false};
const base:PrioridadeLinha={op:'44120',setor:'BOBINAGEM',linha:'TRI',cliente:'CEMIG',
  potencia:'75 kVA',data_programada:'2026-10-27',qtde_total_op:16,
  programada:8,produzida:3,pendente:5,concluida:false,motivo:null,previsao_regularizacao:null};
const asText=(bytes:Uint8Array)=>new TextDecoder().decode(bytes);
describe('PDF checklist de prioridades',()=>{
  it('gera PDF vetorial com data, total OP, prioridades e campo de justificativa',()=>{
    const bytes=gerarPdfPrioridades({hoje:'2026-11-04',rows:[
      {...base}, {...base,data_programada:'2026-10-29',programada:8,produzida:5,pendente:3},
      {...base,op:'44121',data_programada:'2026-11-04'}]},filtros);
    const txt=asText(bytes);
    expect(txt.startsWith('%PDF-1.4')).toBe(true);
    expect(txt.match(/\(OP 44120\)/g)?.length).toBe(2);
    expect(txt).toContain('Total OP 16');
    expect(txt).toContain('PEND. 3');
    expect(txt).toContain('ATRASADAS');
    expect(txt).toContain('HOJE');
    expect(txt).toContain('Justificativa / a');
    expect(txt).toContain('/Count 1');
  });
  it('inicia nova página ao trocar de setor e mantém identificação em cada página',()=>{
    const bytes=gerarPdfPrioridades({hoje:'2026-11-04',rows:[
      {...base}, {...base,op:'44121',setor:'ISOLANTE'}]},filtros);
    const txt=asText(bytes);
    expect(txt).toContain('/Count 2');
    expect(txt).toContain('SETOR: BOBINAGEM');
    expect(txt).toContain('SETOR: ISOLANTE');
  });
  it('rejeita PDF vazio, em vez de gerar arquivo sem páginas',()=>{
    expect(()=>gerarPdfPrioridades({hoje:'2026-11-04',rows:[]},filtros)).toThrow('Sem dados');
  });
});
