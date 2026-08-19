import type { ReactNode } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  CircleDashed,
  Eye,
  Factory,
  GitBranch,
  Loader2,
  MessageSquareText,
  Pencil,
  Trash2,
  Undo2,
  UserRound,
  UserX,
  Zap,
} from 'lucide-react';
import { Apontamento, StatusAprovacao } from '../../types';
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
  onApprovalChange?: (record: Apontamento, status: StatusAprovacao) => void;
  approvalBusyId?: string | null;
  showApprovalActions?: boolean;
  ariaLabel?: string;
}

interface RecordActionsProps extends CoordinationRecordsProps {
  record: Apontamento;
}

function RecordActions({
  record,
  onView,
  onEdit,
  onDelete,
  onApprovalChange,
  approvalBusyId,
  showApprovalActions = false,
}: RecordActionsProps) {
  const accessibleRecordName = `${getOperationalUnitLabel(record)} em ${formatDateBR(record.data)}`;
  const isApproved = record.statusAprovacao === 'APROVADO';
  const isApprovalBusy = approvalBusyId === record.id;
  const isAnyApprovalBusy = Boolean(approvalBusyId);
  const columnsClass = showApprovalActions ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className={`grid ${columnsClass} divide-x divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.08] bg-black/10`}>
      <button
        type="button"
        onClick={() => onView(record)}
        className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-bold text-slate-300 transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
        aria-label={`Ver detalhes de ${accessibleRecordName}`}
      >
        <Eye className="size-4" aria-hidden="true" />
        <span>Detalhes</span>
      </button>
      <button
        type="button"
        onClick={() => onEdit(record)}
        className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-bold text-slate-300 transition-colors hover:bg-emerald-400/[0.08] hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
        aria-label={`Editar ${accessibleRecordName}`}
      >
        <Pencil className="size-4" aria-hidden="true" />
        <span>Editar</span>
      </button>
      {showApprovalActions && (
        <button
          type="button"
          onClick={() => onApprovalChange?.(record, isApproved ? 'PENDENTE' : 'APROVADO')}
          disabled={isAnyApprovalBusy || !onApprovalChange}
          className={`inline-flex min-h-11 items-center justify-center gap-2 px-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${isApproved
            ? 'text-amber-300 hover:bg-amber-400/[0.08] focus-visible:ring-amber-400'
            : 'text-emerald-300 hover:bg-emerald-400/[0.08] focus-visible:ring-emerald-400'}`}
          aria-label={isApproved ? `Desfazer aprovação de ${accessibleRecordName}` : `Aprovar ${accessibleRecordName}`}
        >
          {isApprovalBusy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : isApproved ? (
            <Undo2 className="size-4" aria-hidden="true" />
          ) : (
            <BadgeCheck className="size-4" aria-hidden="true" />
          )}
          <span>{isApprovalBusy ? 'Salvando…' : isApproved ? 'Desfazer' : 'Aprovar'}</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(record)}
        className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-bold text-slate-400 transition-colors hover:bg-rose-400/[0.08] hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400"
        aria-label={`Excluir ${accessibleRecordName}`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        <span>Excluir</span>
      </button>
    </div>
  );
}

function getSectorSubtitle(record: Apontamento): string {
  const labels: Partial<Record<Apontamento['setor'], string>> = {
    'BOBINA AT/BT': 'BOBINAGEM',
    'BOBINA AT': 'BOBINAGEM',
    'BOBINA BT': 'BOBINAGEM',
    'CORTE LASER': 'CORTE DO LASER',
    ISOLANTE: 'ISOLANTE',
    'MONTAGEM NUCLEO': 'MONTAGEM DO NÚCLEO',
    'MONTAGEM FINAL': 'MONTAGEM FINAL',
    MPA: 'MPA',
    PINTURA: 'PINTURA',
    SOLDA: 'SOLDA',
    EPOXI: 'EPOXI',
  };

  return labels[record.setor] ?? String(record.setor);
}

function getWeekday(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return '';

  const date = new Date(year, month - 1, day, 12);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(date)
    .replace('.', '');

  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

interface MetricProps {
  icon: ReactNode;
  label: string;
  value: number;
  valueClassName: string;
  iconClassName: string;
  helper: string;
}

function Metric({ icon, label, value, valueClassName, iconClassName, helper }: MetricProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 border-t border-white/[0.07] px-4 py-4 first:border-t-0 sm:border-l sm:border-t-0 sm:px-5 sm:first:border-l-0 lg:py-5 lg:first:border-l">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] ${iconClassName}`} aria-hidden="true">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        <p className={`mt-0.5 text-xl font-black tracking-tight ${valueClassName}`}>{value}</p>
        <p className="text-[10px] font-semibold text-slate-600">{helper}</p>
      </div>
    </div>
  );
}

function ApprovalBadge({ record }: { record: Apontamento }) {
  const isApproved = record.statusAprovacao === 'APROVADO';

  return isApproved ? (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-300"
      title={record.aprovadoPorNome ? `Aprovado por ${record.aprovadoPorNome}` : 'Registro aprovado'}
    >
      <BadgeCheck className="size-3.5" aria-hidden="true" />
      Aprovado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
      <CircleDashed className="size-3.5" aria-hidden="true" />
      Pendente
    </span>
  );
}

function CoordinationRecordCard(props: CoordinationRecordsProps & { record: Apontamento }) {
  const { record, showApprovalActions = false } = props;
  const totals = getApontamentoTotals(record);
  const lines = getApontamentoLines(record);
  const unitLabel = getOperationalUnitLabel(record);

  return (
    <article className="record-industrial group overflow-hidden rounded-2xl border transition-colors">
      <div className="grid lg:grid-cols-[minmax(190px,0.95fr)_minmax(250px,1.25fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)]">
        <section className="flex items-center gap-4 border-b border-white/[0.07] bg-gradient-to-br from-emerald-400/[0.04] to-transparent px-4 py-5 sm:px-5 lg:border-b-0">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300 shadow-[0_0_30px_rgba(0,199,111,0.07)]">
            <Factory className="size-7" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-slate-100" title={unitLabel}>{unitLabel}</h2>
            <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500" title={getSectorSubtitle(record)}>
              {getSectorSubtitle(record)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {record.tipoBobina && (
                <span className="inline-flex rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                  {record.tipoBobina}
                </span>
              )}
              {showApprovalActions && <ApprovalBadge record={record} />}
            </div>
          </div>
        </section>

        <section className="grid gap-3 border-b border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 lg:border-b-0 lg:border-l lg:py-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-black text-slate-100">
              <CalendarDays className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
              {formatDateBR(record.data)}
            </p>
            <p className="mt-1 pl-6 text-[11px] font-semibold text-slate-500">{getWeekday(record.data)}</p>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
              Responsável
            </p>
            <p className="mt-1 truncate text-sm font-bold text-slate-200" title={record.userName}>{record.userName}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              <GitBranch className="size-3.5" aria-hidden="true" />
              Linha
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {lines.length > 0 ? lines.map((line) => (
                <span key={line} className="rounded-lg border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] font-black text-slate-300">
                  {line}
                </span>
              )) : (
                <span className="text-xs font-semibold text-slate-600">—</span>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 border-b border-white/[0.07] sm:grid-cols-3 lg:contents">
          <Metric
            icon={<Zap className="size-4" />}
            label="Produção"
            value={totals.producao}
            valueClassName="text-emerald-300"
            iconClassName="text-emerald-400"
            helper="unidades"
          />
          <Metric
            icon={<UserX className="size-4" />}
            label="Faltas"
            value={totals.faltas}
            valueClassName="text-rose-300"
            iconClassName="text-rose-400"
            helper="registros"
          />
          <Metric
            icon={<MessageSquareText className="size-4" />}
            label="Observações"
            value={totals.observacoes}
            valueClassName="text-sky-300"
            iconClassName="text-sky-400"
            helper="registros"
          />
        </div>
      </div>

      <footer className="border-t border-white/[0.07] bg-black/[0.08] p-2.5 sm:px-4">
        <RecordActions {...props} record={record} />
      </footer>
    </article>
  );
}

export function CoordinationRecords(props: CoordinationRecordsProps) {
  return (
    <div className="space-y-3" aria-label={props.ariaLabel ?? 'Registros filtrados de todos os setores'}>
      {props.records.map((record) => (
        <CoordinationRecordCard key={record.id} {...props} record={record} />
      ))}
    </div>
  );
}
