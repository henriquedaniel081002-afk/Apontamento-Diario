import React, { useEffect } from 'react';
import { AlertTriangle, Boxes, CalendarDays, Clock3, Factory, Gauge, UserRound, X } from 'lucide-react';
import { ConsolidatedEmployeeDay } from '../types';
import { formatDateBR, formatNumberBR, formatPercentage } from '../utils/calculations';

interface EmployeeDetailViewProps {
  day: ConsolidatedEmployeeDay;
  onClose: () => void;
}

export const EmployeeDetailView: React.FC<EmployeeDetailViewProps> = ({ day, onClose }) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const productivityClass = day.productivityPercent >= 95
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
    : day.productivityPercent >= 80
      ? 'text-amber-400 border-amber-500/30 bg-amber-950/20'
      : 'text-red-400 border-red-500/30 bg-red-950/20';

  const hasStoppage = day.totalStoppageMinutes > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] p-2 sm:p-4 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhamento diário de ${day.employee.name}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-6xl max-h-[calc(100vh-1.5rem)] bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold mb-0.5">Detalhamento diário</div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-100 truncate">{day.employee.name}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] sm:text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5"/>Matrícula {day.employee.registration}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5"/>{formatDateBR(day.date)}</span>
              <span className="inline-flex items-center gap-1.5"><Factory className="w-3.5 h-3.5"/>{day.employee.sector}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-lg border border-[var(--border-subtle)] bg-white/[0.06] hover:bg-white/[0.08] text-slate-300 flex items-center justify-center transition-colors"
            aria-label="Fechar detalhamento"
          >
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className={`p-3 border-b border-[var(--border-subtle)] grid grid-cols-2 ${hasStoppage ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2 shrink-0`}>
          <Summary label="Tempo produzido" value={`${Math.round(day.totalProducedMinutes)} min`} icon={<Clock3 className="w-3.5 h-3.5"/>}/>
          <Summary label="Tempo disponível" value={`${Math.round(day.totalAvailableMinutes)} min`} icon={<Clock3 className="w-3.5 h-3.5"/>}/>
          <Summary label="Peças produzidas" value={`${formatNumberBR(day.totalConvertedPieces, 0)} unid.`} icon={<Boxes className="w-3.5 h-3.5"/>}/>
          {hasStoppage && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-950/15 p-2">
              <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-wide text-orange-300/80 font-bold">
                <AlertTriangle className="w-3.5 h-3.5"/>Tempo parado
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-orange-300 mt-0.5">{Math.round(day.totalStoppageMinutes)} min</div>
            </div>
          )}
          <div className={`rounded-lg border p-2 ${productivityClass}`}>
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-wide font-bold opacity-80"><Gauge className="w-3.5 h-3.5"/>Produtividade</div>
            <div className="text-base sm:text-lg font-black font-mono mt-0.5">{formatPercentage(day.productivityPercent, 1)}</div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-100">Produção detalhada</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">OPs, tempos e observações do dia.</p>
          </div>
          <span className="text-[10px] text-slate-400 border border-[var(--border-subtle)] bg-white/[0.05] px-2 py-1 rounded-md font-mono whitespace-nowrap">{day.records.length} itens</span>
        </div>

        <div className="overflow-y-auto overflow-x-hidden min-h-0 p-3 space-y-2">
          {day.records.map((record) => {
            const recordHasStoppage = record.stoppageMinutes > 0;
            const hasObservation = Boolean(record.notes?.trim());
            const hasStoppageReason = Boolean(record.stoppageReason?.trim());

            return (
              <div key={record.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] overflow-hidden hover:border-[var(--border-subtle)] transition-colors">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-3 gap-y-2 px-3 py-2.5">
                  <DetailField label="OP" value={record.op || '-'} accent="text-emerald-400" mono />
                  <DetailField label="Desenho" value={record.drawing || record.partCode || '-'} mono />
                  <DetailField label="Classe" value={record.className || '-'} />
                  <DetailField label="Potência" value={record.power || '-'} />
                  <DetailField label="Qtde" value={formatNumberBR(record.rawQuantity, 0)} mono />
                  <DetailField label="Produzido" value={`${Math.round(record.producedMinutes)} min`} accent="text-cyan-300" mono />
                  <DetailField label="Setor" value={record.sector || day.employee.sector || '-'} />
                  <DetailField label="Máquina" value={record.machine || '-'} />
                </div>

                {(hasObservation || recordHasStoppage) && (
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3">
                    {recordHasStoppage && (
                      <div className="lg:col-span-3 rounded-md border border-orange-500/20 bg-orange-950/10 px-2.5 py-2">
                        <div className="text-[9px] uppercase tracking-wide font-bold text-orange-300/70">Tempo parado</div>
                        <div className="text-xs font-bold font-mono text-orange-300 mt-0.5">{Math.round(record.stoppageMinutes)} min</div>
                        {hasStoppageReason && <div className="text-[10px] text-slate-400 mt-1 leading-snug">{record.stoppageReason}</div>}
                      </div>
                    )}
                    {hasObservation && (
                      <div className={recordHasStoppage ? 'lg:col-span-9' : 'lg:col-span-12'}>
                        <div className="text-[9px] uppercase tracking-wide font-bold text-slate-500 mb-1">Observações</div>
                        <div className="text-[11px] text-slate-300 leading-relaxed break-words whitespace-pre-wrap">{record.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Summary = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-lg border border-[var(--border-subtle)] bg-white/[0.05] p-2">
    <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-wide text-slate-500 font-bold">{icon}{label}</div>
    <div className="text-base sm:text-lg font-black font-mono text-slate-100 mt-0.5">{value}</div>
  </div>
);

const DetailField = ({ label, value, mono = false, accent = 'text-slate-200' }: { label: string; value: string; mono?: boolean; accent?: string }) => (
  <div className="min-w-0">
    <div className="text-[9px] uppercase tracking-wide font-bold text-slate-600 mb-0.5">{label}</div>
    <div className={`text-[11px] font-semibold truncate ${accent} ${mono ? 'font-mono' : ''}`} title={value}>{value}</div>
  </div>
);
