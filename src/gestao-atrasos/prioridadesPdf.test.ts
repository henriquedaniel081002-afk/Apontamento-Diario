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
    expect(txt.match(/\(OP 44120 /g)?.length).toBe(2);
    expect(txt).toContain('Total OP 16');
    expect(txt).toContain('Pendente 3');
    expect(txt).toContain('ATRASADAS');
    expect(txt).toContain('HOJE');
    expect(txt).toContain('Observa');
    expect(txt).toContain('/Count 1');
  });
  it('mantém setores identificados e ordenação cronológica na mesma página',()=>{
    const bytes=gerarPdfPrioridades({hoje:'2026-11-04',rows:[
      {...base}, {...base,op:'44121',setor:'ISOLANTE'}]},filtros);
    const txt=asText(bytes);
    expect(txt).toContain('/Count 1');
    expect(txt).toContain('|   BOBINAGEM');
    expect(txt).toContain('|   ISOLANTE');
  });
  it('preserva o fim de observações longas, acentos e prazo entre páginas',()=>{
    const motivo=Array.from({length:57},(_,i)=>'Conferência '+i+' — setor elétrico').join('\n')+'\nFIM INTEGRAL';
    const rows=[{...base,motivo,referencia:'DES-123',previsao_regularizacao:'2026-11-12'}];
    const txt=asText(gerarPdfPrioridades({hoje:'2026-11-04',rows},filtros));
    expect(txt).toContain('FIM INTEGRAL');
    expect(txt).toContain('DES-123');
    expect(txt).toContain('Prazo: 12/11/2026');
    expect(txt).toContain('/Count 3');
    expect(txt).toBe(asText(gerarPdfPrioridades({hoje:'2026-11-04',rows},filtros)));
  });
  it('rejeita PDF vazio, em vez de gerar arquivo sem páginas',()=>{
    expect(()=>gerarPdfPrioridades({hoje:'2026-11-04',rows:[]},filtros)).toThrow('Sem dados');
  });
});
