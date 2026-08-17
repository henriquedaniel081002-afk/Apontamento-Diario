import { CalendarDays, Eye, MessageSquareText, Pencil, Trash2, UserX, Zap } from 'lucide-react';
import { Apontamento } from '../../types';
import { formatDateBR, formatDateShort } from '../../utils/formatters';
import {
  getApontamentoLines,
  getApontamentoTotals,
  getOperationalUnitLabel,
} from '../../utils/operational';

interface HistoryRecordsProps {
  records: Apontamento[];
  onView: (record: Apontamento) => void;
  onEdit: (record: Apontamento) => void;
  onDelete: (record: Apontamento) => void;
}

function SummaryPills({ record }: { record: Apontamento }) {
  const totals = getApontamentoTotals(record);

  return (
    <div className="flex flex-wrap gap-2" aria-label="Resumo do apontamento">
      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 text-xs font-bold text-emerald-200">
        <Zap className="size-3.5" aria-hidden="true" />
        {totals.producao} unid.
      </span>
      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 text-xs font-bold text-amber-200">
        <UserX className="size-3.5" aria-hidden="true" />
        {totals.faltas} faltas
      </span>
      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-xs font-bold text-slate-300">
        <MessageSquareText className="size-3.5" aria-hidden="true" />
        {totals.observacoes} obs.
      </span>
    </div>
  );
}

function ActionButtons({ record, onView, onEdit, onDelete, compact = false }: HistoryRecordsProps & { record: Apontamento; compact?: boolean }) {
  const label = `${getOperationalUnitLabel(record)} em ${formatDateBR(record.data)}`;

  return (
    <div className={`flex items-center gap-2 ${compact ? 'justify-end' : ''}`}>
      <button
        type="button"
        onClick={() => onView(record)}
        className={`${compact ? 'size-10 p-0' : 'min-h-10 flex-1 px-3'} inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-xs font-bold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
        aria-label={`Ver detalhes de ${label}`}
      >
        <Eye className="size-4" aria-hidden="true" />
        {!compact && <span>Detalhes</span>}
      </button>
      <button
        type="button"
        onClick={() => onEdit(record)}
        className={`${compact ? 'size-10 p-0' : 'min-h-10 flex-1 px-3'} inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
        aria-label={`Editar ${label}`}
      >
        <Pencil className="size-4" aria-hidden="true" />
        {!compact && <span>Editar</span>}
      </button>
      <button
        type="button"
        onClick={() => onDelete(record)}
        className={`${compact ? 'size-10 p-0' : 'min-h-10 px-3'} inline-flex items-center justify-center gap-2 rounded-xl border border-transparent text-xs font-bold text-slate-400 transition-colors hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400`}
        aria-label={`Excluir ${label}`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {!compact && <span className="sr-only">Excluir</span>}
      </button>
    </div>
  );
}

export function HistoryRecords(props: HistoryRecordsProps) {
  const { records, onView, onEdit, onDelete } = props;

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-[#0D120F] shadow-xl lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">Apontamentos encontrados no histórico</caption>
            <thead className="sticky top-0 z-10 bg-[#111813] text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th scope="col" className="px-5 py-3.5">Data</th>
                <th scope="col" className="px-4 py-3.5">Unidade</th>
                <th scope="col" className="px-4 py-3.5">Linhas</th>
                <th scope="col" className="px-4 py-3.5">Produção</th>
                <th scope="col" className="px-4 py-3.5">Faltas</th>
                <th scope="col" className="px-4 py-3.5">Observações</th>
                <th scope="col" className="sticky right-0 bg-[#111813] px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07]">
              {records.map((record) => {
                const totals = getApontamentoTotals(record);
                const lines = getApontamentoLines(record);
                return (
                  <tr key={record.id} className="group transition-colors hover:bg-white/[0.025]">
                    <th scope="row" className="whitespace-nowrap px-5 py-4 font-bold text-slate-100">
                      <span className="block text-sm">{formatDateBR(record.data)}</span>
                      <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{formatDateShort(record.data)}</span>
                    </th>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-200">{getOperationalUnitLabel(record)}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-400">{lines.length ? lines.join(' / ') : '—'}</td>
                    <td className="px-4 py-4 text-sm font-black text-emerald-300">{totals.producao}</td>
                    <td className="px-4 py-4 text-sm font-black text-amber-200">{totals.faltas}</td>
                    <td className="px-4 py-4 text-sm font-black text-slate-300">{totals.observacoes}</td>
                    <td className="sticky right-0 bg-[#0D120F] px-5 py-4 group-hover:bg-[#111713]">
                      <ActionButtons {...props} record={record} compact />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {records.map((record) => {
          const lines = getApontamentoLines(record);
          return (
            <article key={record.id} className="rounded-2xl border border-white/10 bg-[#0D120F] p-4 shadow-lg">
              <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-black text-slate-100">
                    <CalendarDays className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                    {formatDateBR(record.data)}
                  </p>
                  <h2 className="mt-1 truncate text-sm font-semibold text-slate-300">{getOperationalUnitLabel(record)}</h2>
                </div>
                {lines.length > 0 && (
                  <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-black text-slate-300">
                    {lines.join(' / ')}
                  </span>
                )}
              </header>
              <div className="py-3">
                <SummaryPills record={record} />
              </div>
              <footer className="border-t border-white/[0.07] pt-3">
                <ActionButtons {...props} record={record} />
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}
