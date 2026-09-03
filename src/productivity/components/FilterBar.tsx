import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown, Clock3, Filter, Layers, RotateCcw, Search, User, X } from 'lucide-react';
import { Employee, FilterState } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  employees: Employee[];
  sectors: string[];
  shifts: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  employees,
  sectors,
  shifts,
}) => {
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [employeeSearchText, setEmployeeSearchText] = useState('');
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEmployeeList = employees.filter((emp) => {
    const term = employeeSearchText.toLowerCase();
    const matchesSearch = emp.name.toLowerCase().includes(term)
      || emp.registration.includes(term)
      || emp.sector.toLowerCase().includes(term);
    const matchesSector = filters.sector === 'Todos' || emp.sector === filters.sector;
    const matchesShift = filters.shift === 'Todos' || emp.shift === filters.shift;
    return matchesSearch && matchesSector && matchesShift;
  });

  const selectedEmployee = employees.find((e) => e.id === filters.employeeId);
  const hasOperationalFilters = filters.sector !== 'Todos' || filters.shift !== 'Todos' || !!filters.employeeId;

  return (
    <section id="filters-section" className="bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] p-2.5 sm:p-3 shadow-[0_4px_18px_rgba(0,0,0,0.28)] flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0 border-b border-[var(--border-subtle)] pb-2">
        <Filter className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Filtros operacionais</span>
        {(hasOperationalFilters || filters.startDate || filters.endDate) && (
          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-950 text-emerald-400 rounded-full border border-emerald-500/40">Ativos</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-2 items-end">
        <div className="xl:col-span-4 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="filter-start-date" className="text-[10px] font-medium text-slate-400 mb-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-cyan-400" /> Data inicial
            </label>
            <input
              type="date"
              id="filter-start-date"
              value={filters.startDate}
              onChange={(e) => onFilterChange({ startDate: e.target.value })}
              className="date-input w-full h-8 bg-white/[0.05] border border-[var(--border-subtle)] focus:border-cyan-400 focus:outline-none rounded-md px-2 text-[11px] text-slate-100 font-mono"
            />
          </div>
          <div>
            <label htmlFor="filter-end-date" className="text-[10px] font-medium text-slate-400 mb-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-cyan-400" /> Data final
            </label>
            <input
              type="date"
              id="filter-end-date"
              value={filters.endDate}
              onChange={(e) => onFilterChange({ endDate: e.target.value })}
              className="date-input w-full h-8 bg-white/[0.05] border border-[var(--border-subtle)] focus:border-cyan-400 focus:outline-none rounded-md px-2 text-[11px] text-slate-100 font-mono"
            />
          </div>
        </div>

        <div className="xl:col-span-2">
          <label htmlFor="filter-sector" className="text-[10px] font-medium text-slate-400 mb-0.5 flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-400" /> Setor
          </label>
          <div className="relative">
            <select id="filter-sector" value={filters.sector} onChange={(e) => onFilterChange({ sector: e.target.value })} className="w-full h-8 bg-[var(--surface-muted)] border border-[var(--border-subtle)] focus:border-emerald-400 focus:outline-none rounded-md px-2 pr-7 text-[11px] text-slate-100 appearance-none cursor-pointer">
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="xl:col-span-2">
          <label htmlFor="filter-shift" className="text-[10px] font-medium text-slate-400 mb-0.5 flex items-center gap-1">
            <Clock3 className="w-3 h-3 text-cyan-400" /> Turno
          </label>
          <div className="relative">
            <select id="filter-shift" value={filters.shift} onChange={(e) => onFilterChange({ shift: e.target.value })} className="w-full h-8 bg-[var(--surface-muted)] border border-[var(--border-subtle)] focus:border-cyan-400 focus:outline-none rounded-md px-2 pr-7 text-[11px] text-slate-100 appearance-none cursor-pointer">
              {shifts.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="xl:col-span-3 relative" ref={employeeDropdownRef}>
          <label className="text-[10px] font-medium text-slate-400 mb-0.5 flex items-center gap-1">
            <User className="w-3 h-3 text-emerald-400" /> Colaborador
          </label>
          <button
            type="button"
            onClick={() => setIsEmployeeDropdownOpen(true)}
            className="w-full h-8 bg-[var(--surface-muted)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] rounded-md px-2 flex items-center justify-between text-left"
          >
            <span className="truncate text-[11px] text-slate-300">
              {selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.registration})` : 'Todos os colaboradores'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {selectedEmployee && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onFilterChange({ employeeId: '' }); }}
                  className="p-0.5 text-slate-500 hover:text-slate-200"
                ><X className="w-3 h-3" /></span>
              )}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          </button>

          {isEmployeeDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg shadow-2xl z-50 overflow-hidden max-h-64 flex flex-col">
              <div className="p-1.5 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input autoFocus value={employeeSearchText} onChange={(e) => setEmployeeSearchText(e.target.value)} placeholder="Nome, matrícula ou setor..." className="w-full h-7 bg-white/[0.05] border border-[var(--border-subtle)] focus:border-emerald-400 focus:outline-none rounded-md pl-7 pr-2 text-[11px] text-slate-100" />
                </div>
              </div>
              <div className="overflow-y-auto divide-y divide-white/[0.07] max-h-52">
                <button onClick={() => { onFilterChange({ employeeId: '' }); setIsEmployeeDropdownOpen(false); setEmployeeSearchText(''); }} className={`w-full px-2.5 py-1.5 text-[11px] flex items-center justify-between hover:bg-white/[0.05] ${!filters.employeeId ? 'text-emerald-300 bg-emerald-950/30' : 'text-slate-300'}`}>
                  <span>Todos os colaboradores</span>{!filters.employeeId && <Check className="w-3 h-3" />}
                </button>
                {filteredEmployeeList.length ? filteredEmployeeList.map((emp) => (
                  <button key={emp.id} onClick={() => { onFilterChange({ employeeId: emp.id }); setIsEmployeeDropdownOpen(false); setEmployeeSearchText(''); }} className={`w-full px-2.5 py-1.5 text-left hover:bg-white/[0.05] ${filters.employeeId === emp.id ? 'bg-emerald-950/30' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-slate-100">{emp.name}</div>
                        <div className="truncate text-[9px] text-slate-500">{emp.registration} • {emp.sector} • {emp.shift}</div>
                      </div>
                      {filters.employeeId === emp.id && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                    </div>
                  </button>
                )) : <div className="p-2 text-center text-[10px] text-slate-500">Nenhum colaborador encontrado.</div>}
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-1">
          <button id="btn-clear-filters" onClick={onResetFilters} className="w-full h-8 rounded-md border border-emerald-500/60 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors">
            <RotateCcw className="w-3 h-3" /> Limpar
          </button>
        </div>
      </div>
    </section>
  );
};
