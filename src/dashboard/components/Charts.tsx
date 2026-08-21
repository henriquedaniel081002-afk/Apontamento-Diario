import { useId, useMemo } from 'react';
import type { CSSProperties } from 'react';
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
  const chartWidth = `clamp(42rem, ${Math.max(data.length, 1) * 3.75}rem, 112rem)`;
  return <section className="evolution-panel" aria-labelledby={titleId}>
    <header className="evolution-panel__header">
      <div className="evolution-panel__heading"><span className="evolution-panel__icon"><ChartNoAxesCombined className="size-5"/></span><div><h2 id={titleId}>Evolução diária</h2><p>Programado x produzido — {mesLabel}</p></div></div>
      <ul className="evolution-panel__legend"><li><span style={{backgroundColor:'var(--chart-planned)'}}/>Programado</li><li><span style={{backgroundColor:'var(--chart-produced-positive)'}}/>Produzido ≥ programado</li><li><span style={{backgroundColor:'var(--chart-produced-negative)'}}/>Produzido &lt; programado</li></ul>
    </header>
    <div className="evolution-panel__content">
      {!data.length ? <div className="evolution-empty"><ChartNoAxesCombined className="size-7" aria-hidden="true"/><p>Nenhum registro para exibir</p><span>Não há programação nem apontamento para os filtros selecionados.</span></div> :
      <div className="evolution-panel__scroll" tabIndex={0} role="region" aria-label="Gráfico diário; use a rolagem horizontal para ver todos os dias">
        <div className="evolution-bars" style={{ '--chart-width': chartWidth } as CSSProperties}>
          {data.map(item=>{
            const ph=Math.max(item.programado?8:0,(item.programado/max)*220);
            const rh=Math.max(item.produzido?8:0,(item.produzido/max)*220);
            const ok=item.produzido>=item.programado && item.programado>0;
            const ader=item.programado ? item.produzido/item.programado*100 : null;
            const label=`${item.data}: programado ${fmt(item.programado)}, produzido ${fmt(item.produzido)}${ader===null?'':`, aderência ${ader.toFixed(2)}%`}`;
            return <button key={item.data} type="button" onClick={()=>onDayClick?.(item)} className="evolution-day" title={label} aria-label={`${label}. Abrir detalhes do dia.`}>
              <div className="evolution-day__bars" aria-hidden="true">
                <div className="evolution-bar evolution-bar--planned" style={{height:ph}}><span>{item.programado||''}</span></div>
                <div className={`evolution-bar ${ok?'evolution-bar--success':'evolution-bar--danger'} ${item.produzido===0?'evolution-bar--empty':''}`} style={{height:rh}}><span>{item.produzido||''}</span></div>
              </div>
              <span className="evolution-day__label">{item.dia}</span>
            </button>;
          })}
        </div>
      </div>}
      <div className="evolution-chart-note" role="note"><Info className="size-3.5"/><span>Clique nas colunas para abrir os detalhes do dia. Verde indica acima da programação; vermelho, abaixo.</span></div>
    </div>
  </section>;
}
