import type { DetailedTipo } from './importDetailedExcel';
export type Row = {
  op:string;setor:string;linha:string;cliente:string;potencia:string;referencia:string;
  data_programada:string;qtde_total_op:number;programados:number;produzidos:number|null;
  pendentes_vencidos:number|null;produzidos_em_atraso:number|null;dias_programados:number;primeira_data_programada:string;
  ultima_data_programada:string;motivo:string|null;previsao_regularizacao:string|null;responsavel:string|null;
  criado_em:string|null;situacao:string;
};
export type Series = {serie:string;data_programada:string;data_produzida:string|null;situacao:string};
export type Progress = {setor:string;programados:number;produzidos:number|null;pendentes_vencidos:number|null;quantidade_op:number};
export type History = {id:number;motivo:string;previsao_regularizacao:string|null;criado_em:string;responsavel:string};
export type Summary = {kpis?:Record<string,number>;periodo:{inicio:string;fim:string;hoje:string};rows:Row[];total:number;page:number;importacoes:{tipo:DetailedTipo;esperado:number;atualizado_em:string}[]};
export type Mismatch = {serie:string;setor:string;op_programacao:string;op_apontamento:string;origem:string};
export const field='w-full rounded-xl border border-white/15 bg-[#111f18] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';
export const button='inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50';
export const fmt=(n:number|null)=>n===null?'—':Number(n||0).toLocaleString('pt-BR');
export const br=(v:string|null|undefined)=>v&&/^\d{4}-\d{2}-\d{2}/.test(v)?`${v.slice(8,10)}/${v.slice(5,7)}/${v.slice(0,4)}`:'—';
export const situation:Record<string,string>={SEM_JUSTIFICATIVA:'Atraso sem observação',SEM_PRAZO:'Atraso sem prazo',JUSTIFICADO:'Atraso com observação',PRAZO_VENCIDO:'Atraso com prazo vencido',REGULARIZADO:'Concluída',CONCLUIDO_APOS_PRAZO:'Concluído após o prazo',SEM_APONTAMENTO:'Produção indisponível',NO_PRAZO:'Dentro do prazo',PRODUZIDO_ATRASADO:'Produzido após a data',PRODUZIDO_NO_PRAZO:'Produzido no prazo',PENDENTE_VENCIDO:'Pendente vencido',PENDENTE_NO_PRAZO:'Pendente no prazo'};

