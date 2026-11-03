const labels: Record<string,string> = {
  ops_atrasadas:'OPs atrasadas', transformadores_vencidos:'Transformadores vencidos',
  produzidos_fora_prazo:'Produzidos fora do prazo', sem_justificativa:'Sem justificativa',
  prazo_vencido:'Prazo vencido', regularizados:'Regularizados',
};
export function OpKpis({values,loading}:{values?:Record<string,number>;loading:boolean}) {
  return <section aria-label="Indicadores da Visão OP" aria-busy={loading}>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Object.entries(labels).map(([key,label])=><article key={key} className="rounded-2xl border border-emerald-400/20 bg-[#0b1710] p-4">
      <p className="text-xs text-slate-300">{label}</p><p className="mt-2 text-2xl font-bold text-emerald-200">{values?Number(values[key]||0).toLocaleString('pt-BR'):'—'}</p>
    </article>)}</div>
    <p className="mt-2 text-xs text-slate-400">Todos os filtros se aplicam aos indicadores, em todas as páginas. OPs e transformadores são distintos; demais indicadores contam OP/setor ou produção em cada setor.</p>
  </section>;
}
