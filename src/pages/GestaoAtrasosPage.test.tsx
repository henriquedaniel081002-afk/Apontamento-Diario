import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {GestaoAtrasosPage} from './GestaoAtrasosPage';
import {apiRequest} from '../services/apiClient';
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn()}));
const api=vi.mocked(apiRequest);
const user={id:'1',name:'Coordenação',perfil:'COORDENACAO' as const,setor:'SOLDA' as const,linhas:[]};
const row=(op:string)=>({op,setor:'SOLDA',linha:'TRI',cliente:'Cliente teste',programados:10,produzidos:2,pendentes_vencidos:8,produzidos_em_atraso:1,dias_programados:2,primeira_data_programada:'2026-07-01',ultima_data_programada:'2026-07-31',situacao:'SEM_JUSTIFICATIVA'});
const summary=(op='111')=>({rows:[row(op)],total:1,page:1,periodo:{inicio:'2026-07-01',fim:'2026-07-31',hoje:'2026-10-30'},kpis:{ops_atrasadas:1},importacoes:[{tipo:'APONTAMENTO',esperado:10}]});
afterEach(cleanup);
beforeEach(()=>{api.mockReset();});
describe('Visão OP — concorrência e contexto',()=>{
 it('ignora resposta antiga mesmo quando o transporte ignora AbortSignal',async()=>{
   let oldResolve:any,newResolve:any;const signals:AbortSignal[]=[];
   api.mockImplementation(async(path,init)=>{
     if(path.includes('permissoes'))return {setores:[]};
     signals.push(init!.signal as AbortSignal);
     return new Promise(resolve=>{if(path.includes('op=222'))newResolve=resolve;else oldResolve=resolve;});
   });
   render(<GestaoAtrasosPage user={user} active/>);
   await waitFor(()=>expect(oldResolve).toBeTypeOf('function'));
   fireEvent.change(screen.getByLabelText('OP'),{target:{value:'222'}});
   expect(signals[0].aborted).toBe(true);
   await waitFor(()=>expect(newResolve).toBeTypeOf('function'));
   await act(async()=>newResolve(summary('222')));
   await screen.findByText('OP 222');
   await act(async()=>oldResolve(summary('111')));
   expect(screen.queryByText('OP 111')).not.toBeInTheDocument();
   expect(screen.getByText('OP 222')).toBeVisible();
 });
 it('fecha modal cancelando GETs e mantém o período selecionado nos detalhes',async()=>{
   let detailSignal:AbortSignal|undefined;
   api.mockImplementation(async(path,init)=>{
     if(path.includes('permissoes'))return {setores:[]};
     if(path.includes('/resumo'))return summary();
     if(path.includes('/justificativas'))return {rows:[]};
     expect(path).toContain('inicio=2026-07-01&fim=2026-07-31');
     detailSignal=init!.signal as AbortSignal;
     return new Promise(()=>{});
   });
   render(<GestaoAtrasosPage user={user} active/>);
   fireEvent.click(await screen.findByText('OP 111'));
   const modal=screen.getByRole('dialog');
   expect(within(modal).getByText('Carregando detalhamento...')).toBeVisible();
   fireEvent.keyDown(document,{key:'Escape'});
   expect(detailSignal?.aborted).toBe(true);
   expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('apresenta falha local do modal e permite tentar novamente',async()=>{
   api.mockImplementation(async(path)=>{
     if(path.includes('permissoes'))return {setores:[]};
     if(path.includes('/resumo'))return summary();
     if(path.includes('/justificativas'))return {rows:[]};
     throw new Error('Falha controlada');
   });
   render(<GestaoAtrasosPage user={user} active/>);
   fireEvent.click(await screen.findByText('OP 111'));
   const modal=screen.getByRole('dialog');
   expect(await within(modal).findByRole('alert')).toHaveTextContent('Falha controlada');
   expect(within(modal).getByRole('button',{name:'Tentar novamente'})).toBeEnabled();
   fireEvent.click(within(modal).getByRole('button',{name:'Justificativa'}));
   expect(within(modal).getByRole('button',{name:'Registrar justificativa e prazo'})).toBeDisabled();
 });
 it('não consulta a aba inativa',async()=>{
   render(<GestaoAtrasosPage user={user} active={false}/>);
   await new Promise(resolve=>setTimeout(resolve,300));
   expect(api).not.toHaveBeenCalled();
 });
 it('salva justificativa com período, recarrega histórico e preserva a navegação do modal',async()=>{
   let saved=false;
   api.mockImplementation(async(path,init)=>{
     if(path.includes('permissoes'))return {setores:[]};
     if(path.includes('/resumo'))return summary();
     if(init?.method==='POST'){
       expect(JSON.parse(String(init.body))).toMatchObject({op:'111',setor:'SOLDA',motivo:'Teste local de justificativa',previsao_regularizacao:'2026-11-15',inicio:'2026-07-01',fim:'2026-07-31'});
       saved=true;return {};
     }
     if(path.includes('/justificativas'))return {rows:saved?[{id:'1',motivo:'Teste local de justificativa',responsavel:'Teste',criado_em:'2026-10-30T16:00:00Z',previsao_regularizacao:'2026-11-15'}]:[]};
     return {series:[],progresso:[],apontamentoImportado:true};
   });
   render(<GestaoAtrasosPage user={user} active/>);
   fireEvent.click(await screen.findByText('OP 111'));
   const modal=screen.getByRole('dialog');
   await within(modal).findByText(/Progresso dos setores/);
   fireEvent.click(within(modal).getByRole('button',{name:'Justificativa'}));
   fireEvent.change(within(modal).getByLabelText('Motivo'),{target:{value:'Teste local de justificativa'}});
   fireEvent.change(within(modal).getByLabelText('Previsão de regularização'),{target:{value:'2026-11-15'}});
   fireEvent.click(within(modal).getByRole('button',{name:'Registrar justificativa e prazo'}));
   await waitFor(()=>expect(saved).toBe(true));
   fireEvent.click(within(modal).getByRole('button',{name:'Histórico'}));
   expect(await within(modal).findByText('Teste local de justificativa')).toBeVisible();
 });
});
