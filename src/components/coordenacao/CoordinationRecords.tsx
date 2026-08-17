import { CalendarDays, Eye, MessageSquareText, Pencil, Trash2, UserRound, UserX, Zap } from 'lucide-react';
import { Apontamento } from '../../types';
import { formatDateBR } from '../../utils/formatters';
import {
  getApontamentoLines,
  getApontamentoTotals,
  getOperationalUnitLabel,
} from '../../utils/operational';

interface CoordinationRecordsProps {
  records: Apontamento[];
  onView: (record: Apontamento) => void;
  onEdit: (record: Apontamento) => void;
  onDelete: (record: Apontamento) => void;
}

interface RecordActionsProps extends CoordinationRecordsProps {
  record: Apontamento;
  compact?: boolean;
}

function RecordActions({ record, onView, onEdit, onDelete, compact = false }: RecordActionsProps) {
  const accessibleRecordName = `${getOperationalUnitLabel(record)} em ${formatDateBR(record.data)}`;

  return (
    <div className={`flex items-center gap-2 ${compact ? 'justify-end' : ''}`}>
      <button
        type="button"
        onClick={() => onView(record)}
        className={`${compact ? 'size-10' : 'min-h-10 flex-1 px-3'} inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-xs font-bold text-slate-200 transition-colors hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
        aria-label={`Ver detalhes de ${accessibleRecordName}`}
      >
        <Eye className="size-4" aria-hidden="true" />
        {!compact && 'Detalhes'}
      </button>
      <button
        type="button"
        onClick={() => onEdit(record)}
        className={`${compact ? 'size-10' : 'min-h-10 flex-1 px-3'} inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
        aria-label={`Editar ${accessibleRecordName}`}
      >
        <Pencil className="size-4" aria-hidden="true" />
        {!compact && 'Editar'}
      </button>
      <button
        type="button"
        onClick={() => onDelete(record)}
        className={`${compact ? 'size-10' : 'min-h-10 px-3'} inline-flex items-center justify-center rounded-xl border border-transparent text-slate-400 transition-colors hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400`}
        aria-label={`Excluir ${accessibleRecordName}`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function MobileSummary({ record }: { record: Apontamento }) {
  const totals = getApontamentoTotals(record);
  return (
    <dl className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] p-2.5">
        <dt className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">
          <Zap className="size-3" aria-hidden="true" /> Produção
        </dt>
        <dd className="mt-1 text-base font-black text-emerald-100">{totals.producao}</dd>
      </div>
      <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.07] p-2.5">
        <dt className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
          <UserX className="size-3" aria-hidden="true" /> Faltas
        </dt>
        <dd className="mt-1 text-base font-black text-amber-100">{totals.faltas}</dd>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
        <dt className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
          <MessageSquareText className="size-3" aria-hidden="true" /> Obs.
        </dt>
        <dd className="mt-1 text-base font-black text-slate-200">{totals.observacoes}</dd>
      </div>
    </dl>
  );
}

export function CoordinationRecords(props: CoordinationRecordsProps) {
  const { records } = props;

  return (
    <>
      <div className="hidden max-h-[600px] overflow-auto rounded-2xl border border-white/10 bg-[#0D120F] shadow-xl lg:block">
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <caption className="sr-only">Registros filtrados de todos os setores</caption>
          <thead className="sticky top-0 z-20 bg-[#111813] text-[11px] font-black uppercase tracking-[0.11em] text-slate-400 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
            <tr>
              <th scope="col" className="px-4 py-3.5">Data</th>
              <th scope="col" className="px-4 py-3.5">Unidade</th>
              <th scope="col" className="px-4 py-3.5">Responsável</th>
              <th scope="col" className="px-4 py-3.5">Linhas</th>
              <th scope="col" className="px-4 py-3.5 text-right">Produção</th>
              <th scope="col" className="px-4 py-3.5 text-right">Faltas</th>
              <th scope="col" className="px-4 py-3.5 text-right">Observações</th>
              <th scope="col" className="sticky right-0 bg-[#111813] px-4 py-3.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.07]">
            {records.map((record) => {
              const totals = getApontamentoTotals(record);
              const lines = getApontamentoLines(record);
              return (
                <tr key={record.id} className="group transition-colors hover:bg-white/[0.025]">
                  <th scope="row" className="whitespace-nowrap px-4 py-4 text-sm font-black text-slate-100">
                    {formatDateBR(record.data)}
                  </th>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-200">{getOperationalUnitLabel(record)}</td>
                  <td className="max-w-44 px-4 py-4 text-sm text-slate-300">
                    <span className="block truncate" title={record.userName}>{record.userName}</span>
                  </td>
                  <td className="px-4 py-4 text-xs font-black text-slate-400">{lines.length ? lines.join(' / ') : '—'}</td>
                  <td className="px-4 py-4 text-right text-sm font-black text-emerald-300">{totals.producao}</td>
                  <td className="px-4 py-4 text-right text-sm font-black text-amber-200">{totals.faltas}</td>
                  <td className="px-4 py-4 text-right text-sm font-black text-slate-300">{totals.observacoes}</td>
                  <td className="sticky right-0 bg-[#0D120F] px-4 py-4 group-hover:bg-[#111713]">
                    <RecordActions {...props} record={record} compact />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                  <h2 className="mt-1 text-sm font-semibold text-slate-300">{getOperationalUnitLabel(record)}</h2>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                    <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                    {record.userName}
                  </p>
                </div>
                {lines.length > 0 && (
                  <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-black text-slate-300">
                    {lines.join(' / ')}
                  </span>
                )}
              </header>
              <div className="py-3">
                <MobileSummary record={record} />
              </div>
              <footer className="border-t border-white/[0.07] pt-3">
                <RecordActions {...props} record={record} />
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}
