import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  SlidersHorizontal,
} from 'lucide-react';
import { ConsolidatedEmployeeDay } from '../types';
import { formatDateBR, formatPercentage } from '../utils/calculations';

type SortField = 'date' | 'registration' | 'name' | 'productivityPercent';
type SortDirection = 'asc' | 'desc';

interface ProductivityTableProps {
  data: ConsolidatedEmployeeDay[];
  isLoading?: boolean;
  onSelectRow?: (row: ConsolidatedEmployeeDay) => void;
}

export const ProductivityTable: React.FC<ProductivityTableProps> = ({
  data,
  isLoading = false,
  onSelectRow,
}) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'productivityPercent' ? 'desc' : 'asc');
    }
  };

  const processedData = useMemo(() => {
    const result = [...data];
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date': comparison = a.date.localeCompare(b.date); break;
        case 'registration': comparison = a.employee.registration.localeCompare(b.employee.registration); break;
        case 'name': comparison = a.employee.name.localeCompare(b.employee.name); break;
        case 'productivityPercent': comparison = a.productivityPercent - b.productivityPercent; break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [data, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
      : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />;
  };

  // Meta: 95%. Verde >=95%; amarelo entre 80% e 94,99%; vermelho <80%.
  const getProductivityStyle = (percent: number) => {
    if (percent >= 95) {
      return {
        text: 'text-emerald-400',
        bgBar: 'bg-emerald-400',
        glow: 'shadow-[0_0_8px_rgba(16,185,129,0.35)]',
      };
    }
    if (percent >= 80) {
      return {
        text: 'text-amber-400',
        bgBar: 'bg-amber-400',
        glow: 'shadow-[0_0_8px_rgba(251,191,36,0.28)]',
      };
    }
    return {
      text: 'text-red-400',
      bgBar: 'bg-red-500',
      glow: 'shadow-[0_0_8px_rgba(248,113,113,0.28)]',
    };
  };

  return (
    <div
      id="productivity-table-card"
      className="bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] overflow-hidden flex flex-col shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
    >
      <div className="table-card-header p-2.5 sm:p-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-100">Produtividade por colaborador</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">Role a tabela e clique em um colaborador para abrir o detalhamento diário.</p>
        </div>
        <div className="shrink-0 px-2 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[10px] text-slate-400 font-mono">
          {processedData.length} registros
        </div>
      </div>

      <div className="dashboard-table-scroll overflow-auto">
        <table id="main-productivity-table" className="w-full text-left border-collapse min-w-[700px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[11px] font-semibold tracking-wider text-slate-400 uppercase select-none shadow-[0_1px_0_rgba(255,255,255,0.04)]">
              <th onClick={() => handleSort('date')} className="py-2 px-3 cursor-pointer hover:text-slate-200 transition-colors group">
                <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/><span>Data</span>{getSortIcon('date')}</div>
              </th>
              <th onClick={() => handleSort('registration')} className="py-2 px-3 cursor-pointer hover:text-slate-200 transition-colors group">
                <div className="flex items-center gap-1.5"><span>Matrícula</span>{getSortIcon('registration')}</div>
              </th>
              <th onClick={() => handleSort('name')} className="py-2 px-3 cursor-pointer hover:text-slate-200 transition-colors group">
                <div className="flex items-center gap-1.5"><span>Nome</span>{getSortIcon('name')}</div>
              </th>
              <th onClick={() => handleSort('productivityPercent')} className="py-2 px-3 cursor-pointer hover:text-slate-200 transition-colors group min-w-[210px]">
                <div className="flex items-center gap-1.5"><span>Produtividade %</span>{getSortIcon('productivityPercent')}</div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[0.07] text-xs">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-2.5 px-3"><div className="h-4 bg-white/[0.06] rounded w-20" /></td>
                  <td className="py-2.5 px-3"><div className="h-4 bg-white/[0.06] rounded w-16" /></td>
                  <td className="py-2.5 px-3"><div className="h-4 bg-white/[0.06] rounded w-36" /></td>
                  <td className="py-2.5 px-3"><div className="h-4 bg-white/[0.06] rounded w-44" /></td>
                </tr>
              ))
            ) : processedData.length > 0 ? (
              processedData.map((row) => {
                const prodStyle = getProductivityStyle(row.productivityPercent);
                const boundedPercentage = Math.min(Math.max(row.productivityPercent, 0), 100);
                return (
                  <tr
                    key={`${row.date}_${row.employeeId}`}
                    onClick={() => onSelectRow?.(row)}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && onSelectRow) {
                        event.preventDefault();
                        onSelectRow(row);
                      }
                    }}
                    tabIndex={onSelectRow ? 0 : undefined}
                    role={onSelectRow ? 'button' : undefined}
                    className="hover:bg-white/[0.05] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-emerald-500/60 transition-colors group cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-300 whitespace-nowrap">{formatDateBR(row.date)}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold whitespace-nowrap">{row.employee.registration}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-white/[0.07] text-slate-200 text-[11px] font-bold flex items-center justify-center border border-[var(--border-subtle)]">{row.employee.name.charAt(0)}</div>
                        <div>
                          <div className="font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">{row.employee.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>{row.employee.sector}</span><span>•</span><span>{row.employee.shift}</span>
                            {row.recordsCount > 1 && <span className="ml-1 px-1 rounded bg-white/[0.06] text-cyan-400 text-[9px]">{row.recordsCount} lotes</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 min-w-[190px]">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`font-mono font-extrabold text-[13px] ${prodStyle.text}`}>{formatPercentage(row.productivityPercent, 1)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{Math.round(row.totalProducedMinutes)} / {Math.round(row.totalAvailableMinutes)} min</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] overflow-hidden p-0.5">
                          <div className={`h-full rounded-full transition-all duration-500 ${prodStyle.bgBar} ${prodStyle.glow}`} style={{ width: `${boundedPercentage}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 rounded-full bg-white/[0.05] text-slate-400 border border-[var(--border-subtle)]"><SlidersHorizontal className="w-6 h-6" /></div>
                    <span className="text-sm font-medium text-slate-200">Nenhum registro de produtividade encontrado</span>
                    <span className="text-xs text-slate-400 max-w-sm">Tente alterar as datas selecionadas, o setor ou o colaborador nos filtros acima.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
