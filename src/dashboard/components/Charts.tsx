import { useId, useMemo } from 'react';
import { ChartNoAxesCombined, Info } from 'lucide-react';

export type EvolutionItem = {
  dia: string;
  data: string;
  programado: number;
  produzido: number;
};

const fmt = (n:number) => Math.round(n).toLocaleString('pt-BR');

export function EvolutionChart({ data, mesLabel, onDayClick }: { data: EvolutionItem[]; mesLabel: string; onDayClick?: (item: EvolutionItem)=>void }) {
  const titleId=useId();
  const max=useMemo(()=>Math.max(1,...data.flatMap(r=>[r.programado,r.produzido])),[data]);
  return <section className="evolution-panel" aria-labelledby={titleId}>
    <header className="evolution-panel__header">
      <div className="evolution-panel__heading"><span className="evolution-panel__icon"><ChartNoAxesCombined className="size-5"/></span><div><h2 id={titleId}>Evolução diária</h2><p>Programado x produzido — {mesLabel}</p></div></div>
      <ul className="evolution-panel__legend"><li><span style={{backgroundColor:'#2f7df4'}}/>Programado</li><li><span style={{backgroundColor:'#2dd6a0'}}/>Produzido ≥ programado</li><li><span style={{backgroundColor:'#ef5350'}}/>Produzido &lt; programado</li></ul>
    </header>
    <div className="evolution-panel__content">
      {!data.length ? <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-bg-main/30 px-6 text-center"><ChartNoAxesCombined className="mb-3 size-7 text-text-secondary"/><p className="text-sm font-bold text-white">Nenhum registro para exibir</p><p className="mt-1 text-xs text-text-secondary">Não há programação nem apontamento para os filtros selecionados.</p></div> :
      <div className="overflow-x-auto pb-2">
        <div className="flex min-h-[300px] min-w-[720px] items-end gap-2 px-2 pt-10">
          {data.map(item=>{
            const ph=Math.max(item.programado?8:0,(item.programado/max)*220);
            const rh=Math.max(item.produzido?8:0,(item.produzido/max)*220);
            const ok=item.produzido>=item.programado && item.programado>0;
            const ader=item.programado ? item.produzido/item.programado*100 : null;
            return <button key={item.data} type="button" onClick={()=>onDayClick?.(item)} className="group flex min-w-[38px] flex-1 flex-col items-center justify-end gap-1 rounded-lg px-1 pb-1 pt-2 hover:bg-white/[0.035]" title={`${item.data} • Programado ${fmt(item.programado)} • Produzido ${fmt(item.produzido)}${ader===null?'':` • ${ader.toFixed(2)}%`}`}>
              <div className="flex h-[240px] w-full items-end justify-center gap-1.5">
                <div className="relative w-[42%] max-w-6 rounded-t-md bg-[#2f7df4] shadow-[0_0_12px_rgba(47,125,244,.22)]" style={{height:ph}}><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-extrabold text-slate-200">{item.programado||''}</span></div>
                <div className={`relative w-[42%] max-w-6 rounded-t-md ${ok?'bg-[#2dd6a0] shadow-[0_0_12px_rgba(45,214,160,.2)]':'bg-[#ef5350] shadow-[0_0_12px_rgba(239,83,80,.2)]'} ${item.produzido===0?'opacity-25':''}`} style={{height:rh}}><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-extrabold text-slate-200">{item.produzido||''}</span></div>
              </div>
              <span className="mt-1 text-[10px] font-bold text-slate-300">{item.dia}</span>
            </button>;
          })}
        </div>
      </div>}
      <div className="evolution-chart-note" role="note"><Info className="size-3.5"/><span>Clique nas colunas para abrir os detalhes do dia. Verde indica acima da programação; vermelho, abaixo.</span></div>
    </div>
  </section>;
}
