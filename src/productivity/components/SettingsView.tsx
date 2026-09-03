import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Power,
  Save,
  Search,
  Settings2,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { Employee, WorkdayConfig } from '../types';
import { formatDateBR } from '../utils/calculations';
import { ImportView } from './ImportView';
import { deleteRecordsByMonth, setEmployeeActiveStatus } from '../services/dashboardService';

interface SettingsViewProps {
  config: WorkdayConfig;
  onSaveConfig: (newConfig: WorkdayConfig) => void | Promise<void>;
  onImported: () => Promise<void>;
  employees: Employee[];
  onEmployeeChanged: () => Promise<void>;
  employeeControlReady: boolean;
}

type SettingsSection = 'import' | 'employees' | 'workdays' | 'cleanup';

const localISODate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onSaveConfig,
  onImported,
  employees,
  onEmployeeChanged,
  employeeControlReady,
}) => {
  const [section, setSection] = useState<SettingsSection>('import');

  const sections = [
    { id: 'import' as const, label: 'Importação', description: 'Atualizar produção', icon: FileSpreadsheet },
    { id: 'employees' as const, label: 'Colaboradores', description: 'Gerenciar desligamentos', icon: UsersRound },
    { id: 'workdays' as const, label: 'Dias de trabalho', description: 'Calendário de faltas', icon: CalendarIcon },
    { id: 'cleanup' as const, label: 'Apagar registros', description: 'Excluir dados por mês', icon: Trash2 },
  ];

  return <div className="w-full flex flex-col gap-3">
    <div className="bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 shrink-0"><Settings2 className="w-5 h-5"/></div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-100">Configurações do sistema</h2>
          <p className="text-xs text-slate-400 mt-0.5">Importação, colaboradores, calendário oficial e manutenção de registros em uma única área.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 xl:min-w-[720px]">
        {sections.map(item => {
          const Icon = item.icon;
          const active = section === item.id;
          return <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`text-left rounded-lg border px-3 py-2 transition ${active ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200' : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-slate-300 hover:bg-white/[0.05]'}`}>
            <div className="flex items-center gap-2"><Icon className="w-4 h-4 shrink-0"/><span className="text-xs font-bold">{item.label}</span></div>
            <div className="text-[10px] mt-0.5 text-slate-500 truncate">{item.description}</div>
          </button>;
        })}
      </div>
    </div>

    {section === 'import' && <ImportView embedded onImported={onImported}/>} 
    {section === 'employees' && <EmployeeManagement employees={employees} onEmployeeChanged={onEmployeeChanged} employeeControlReady={employeeControlReady}/>} 
    {section === 'workdays' && <WorkdayCalendar config={config} onSaveConfig={onSaveConfig}/>} 
    {section === 'cleanup' && <RecordsCleanup onRecordsDeleted={onImported}/>} 
  </div>;
};

const EmployeeManagement: React.FC<{
  employees: Employee[];
  onEmployeeChanged: () => Promise<void>;
  employeeControlReady: boolean;
}> = ({ employees, onEmployeeChanged, employeeControlReady }) => {
  const [search, setSearch] = useState('');
  const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);
  const [terminationDate, setTerminationDate] = useState(localISODate());
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const normalizedSearch = search.trim().toLowerCase();
  const activeEmployees = useMemo(() => employees.filter(employee => employee.status !== 'Desligado'), [employees]);
  const filtered = useMemo(() => activeEmployees.filter(employee => {
    if (!normalizedSearch) return true;
    return [employee.name, employee.registration, employee.sector, employee.shift]
      .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
  }), [activeEmployees, normalizedSearch]);

  const activeCount = activeEmployees.length;

  const openDisable = (employee: Employee) => {
    setError('');
    setPendingEmployee(employee);
    const today = localISODate();
    setTerminationDate(employee.firstProductionDate && employee.firstProductionDate > today ? employee.firstProductionDate : today);
  };

  const disable = async () => {
    if (!pendingEmployee) return;
    if (!terminationDate) { setError('Informe a data de desligamento.'); return; }
    if (pendingEmployee.firstProductionDate && terminationDate < pendingEmployee.firstProductionDate) {
      setError('A data de desligamento não pode ser anterior à primeira produção do colaborador.');
      return;
    }
    setBusyId(pendingEmployee.id); setError('');
    try {
      await setEmployeeActiveStatus(pendingEmployee, false, terminationDate);
      setPendingEmployee(null);
      await onEmployeeChanged();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível desligar o colaborador.');
    } finally { setBusyId(''); }
  };


  return <div className="bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] overflow-hidden">
    <div className="p-3 sm:p-4 border-b border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-slate-100">Gerenciamento de colaboradores</h3>
        <p className="text-xs text-slate-400 mt-1">O colaborador entra automaticamente na base ao aparecer na produção. Ao desligar, ele é removido da base ativa e seus registros históricos são preservados.</p>
      </div>
      <div className="flex gap-2 text-[11px]">
        <StatPill label="Ativos" value={activeCount} tone="emerald"/>
      </div>
    </div>

    {!employeeControlReady && <div className="mx-3 sm:mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
      O gerenciamento persistente precisa das tabelas <code>colaboradores_controle</code> e <code>colaboradores_desligados</code> no Supabase. Execute o SQL de atualização incluído no projeto.
    </div>}

    {error && <div className="mx-3 sm:mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-100">{error}</div>}

    <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 border-b border-[var(--border-subtle)]">
      <label className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, matrícula, setor ou turno" className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-xs text-slate-200 outline-none focus:border-emerald-500/60"/>
      </label>
    </div>

    <div className="max-h-[58vh] overflow-auto">
      <table className="w-full text-left text-xs min-w-[820px]">
        <thead className="sticky top-0 z-10 bg-[var(--surface-raised)] text-slate-500 uppercase tracking-wide text-[10px]">
          <tr><th className="px-3 py-2">Matrícula</th><th className="px-3 py-2">Colaborador</th><th className="px-3 py-2">Setor / turno</th><th className="px-3 py-2">Início</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Ação</th></tr>
        </thead>
        <tbody className="divide-y divide-white/[0.07]">
          {filtered.map(employee => {
            const busy = busyId === employee.id;
            return <tr key={employee.id} className="hover:bg-white/[0.03]">
              <td className="px-3 py-2 font-mono text-slate-300">{employee.registration}</td>
              <td className="px-3 py-2"><div className="font-semibold text-slate-100">{employee.name}</div></td>
              <td className="px-3 py-2 text-slate-400"><div>{employee.sector}</div><div className="text-[10px] text-slate-600 mt-0.5">{employee.shift}</div></td>
              <td className="px-3 py-2 text-slate-400">{employee.firstProductionDate ? formatDateBR(employee.firstProductionDate) : '-'}</td>
              <td className="px-3 py-2">
                <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold text-emerald-300">Ativo</span>
              </td>
              <td className="px-3 py-2 text-right">
                <button disabled={busy} onClick={() => openDisable(employee)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-500/30 bg-red-950/15 text-red-300 hover:bg-red-950/30 disabled:opacity-50"><Power className="w-3.5 h-3.5"/>Desligar</button>
              </td>
            </tr>;
          })}
          {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Nenhum colaborador encontrado.</td></tr>}
        </tbody>
      </table>
    </div>

    {pendingEmployee && <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={() => !busyId && setPendingEmployee(null)}>
      <div className="w-full max-w-md rounded-[1.15rem] border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xl p-4" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><h4 className="text-sm font-bold text-slate-100">Desligar colaborador</h4><p className="text-xs text-slate-400 mt-1">{pendingEmployee.name} • {pendingEmployee.registration}</p></div>
          <button onClick={() => !busyId && setPendingEmployee(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400"><X className="w-4 h-4"/></button>
        </div>
        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Data de desligamento</label>
          <input type="date" className="date-input mt-1 w-full h-10 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-3 text-sm text-slate-100 outline-none focus:border-red-500/50" value={terminationDate} min={pendingEmployee.firstProductionDate || undefined} onChange={e => setTerminationDate(e.target.value)}/>
          <p className="text-[11px] text-slate-500 mt-2">O colaborador será removido da base ativa. Produção e demais registros históricos serão mantidos; dias posteriores ao desligamento não gerarão novas faltas.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button disabled={Boolean(busyId)} onClick={() => setPendingEmployee(null)} className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-white/[0.05] text-xs text-slate-300">Cancelar</button>
          <button disabled={Boolean(busyId)} onClick={disable} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-bold text-white">{busyId ? <Loader2 className="w-4 h-4 animate-spin"/> : <Power className="w-4 h-4"/>}{busyId ? 'Salvando...' : 'Confirmar desligamento'}</button>
        </div>
      </div>
    </div>}
  </div>;
};

const RecordsCleanup: React.FC<{ onRecordsDeleted: () => Promise<void> }> = ({ onRecordsDeleted }) => {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const monthLabel = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return month;
    const [year, monthNumber] = month.split('-').map(Number);
    const label = new Date(year, monthNumber - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [month]);

  const openConfirmation = () => {
    setError('');
    setSuccess('');
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError('Selecione o mês que deseja apagar.');
      return;
    }
    setConfirmOpen(true);
  };

  const removeMonth = async () => {
    setBusy(true); setError(''); setSuccess('');
    try {
      const result = await deleteRecordsByMonth(month);
      setConfirmOpen(false);
      setSuccess(`${result.producao_excluida} registros de produção e ${result.jornadas_excluidas} jornadas foram apagados de ${monthLabel}.`);
      await onRecordsDeleted();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível apagar os registros do mês selecionado.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] overflow-hidden">
    <div className="p-3 sm:p-4 border-b border-[var(--border-subtle)]">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-red-950/40 text-red-300 border border-red-500/30"><Trash2 className="w-5 h-5"/></div>
        <div>
          <h3 className="text-sm font-bold text-slate-100">Apagar registros por mês</h3>
          <p className="text-xs text-slate-400 mt-1">Remove a produção e as jornadas do mês selecionado. Colaboradores, desligamentos e dias oficiais de trabalho não são apagados.</p>
        </div>
      </div>
    </div>

    <div className="p-3 sm:p-4 flex flex-col gap-4 max-w-2xl">
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 flex gap-2.5 text-xs text-amber-100">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
        <div><b>Atenção:</b> esta ação é permanente. Use esta função apenas quando precisar remover uma importação ou registros incorretos de um mês inteiro.</div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-100">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-100">{success}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
        <label>
          <span className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Mês para exclusão</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="date-input mt-1 w-full h-9 bg-[var(--surface-muted)] border border-[var(--border-subtle)] focus:border-red-500/60 focus:outline-none rounded-lg px-3 text-xs text-slate-100"/>
        </label>
        <button type="button" onClick={openConfirmation} className="h-9 inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-950/25 px-4 text-xs font-bold text-red-300 hover:bg-red-950/45">
          <Trash2 className="w-4 h-4"/> Apagar mês
        </button>
      </div>
    </div>

    {confirmOpen && <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={() => !busy && setConfirmOpen(false)}>
      <div className="w-full max-w-md rounded-[1.15rem] border border-red-500/30 bg-[var(--surface-base)] shadow-2xl p-4" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-100">Confirmar exclusão mensal</h4>
            <p className="text-xs text-slate-400 mt-1">Você está prestes a apagar os registros de <b className="text-slate-200">{monthLabel}</b>.</p>
          </div>
          <button disabled={busy} onClick={() => setConfirmOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 disabled:opacity-50"><X className="w-4 h-4"/></button>
        </div>
        <div className="mt-4 rounded-lg border border-red-500/25 bg-red-950/20 p-3 text-xs text-red-100">
          Serão removidos somente <b>produção</b> e <b>jornadas</b> desse mês. Esta operação não possui desfazer automático.
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button disabled={busy} onClick={() => setConfirmOpen(false)} className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-white/[0.05] text-xs text-slate-300 disabled:opacity-50">Cancelar</button>
          <button disabled={busy} onClick={removeMonth} className="h-9 px-3 rounded-lg border border-red-500/50 bg-red-600/90 hover:bg-red-500 text-xs font-bold text-white inline-flex items-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}{busy ? 'Apagando...' : 'Sim, apagar registros'}
          </button>
        </div>
      </div>
    </div>}
  </div>;
};

const StatPill = ({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'slate' }) => <div className={`rounded-lg border px-2.5 py-1.5 ${tone === 'emerald' ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-[var(--border-subtle)] bg-white/[0.05] text-slate-300'}`}><span className="text-slate-500">{label}: </span><b>{value}</b></div>;

const WorkdayCalendar: React.FC<{ config: WorkdayConfig; onSaveConfig: (newConfig: WorkdayConfig) => void | Promise<void> }> = ({ config, onSaveConfig }) => {
  const [selectedDates, setSelectedDates] = useState<string[]>([...config.officialWorkdays]);
  const initialDate = new Date();
  const [activeMonthYear, setActiveMonthYear] = useState({ year: initialDate.getFullYear(), month: initialDate.getMonth() + 1 });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const daysCount = new Date(activeMonthYear.year, activeMonthYear.month, 0).getDate();
  const firstDay = new Date(activeMonthYear.year, activeMonthYear.month - 1, 1).getDay();
  const keyFor = (d:number) => `${activeMonthYear.year}-${String(activeMonthYear.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const toggleDay = (key:string) => setSelectedDates(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key].sort());
  const selectWeekdays = () => {
    const next = new Set(selectedDates);
    for(let d=1; d<=daysCount; d++) { const date = new Date(activeMonthYear.year, activeMonthYear.month-1, d); if(date.getDay()>=1 && date.getDay()<=5) next.add(keyFor(d)); }
    setSelectedDates([...next].sort());
  };
  const clearMonth = () => {
    const prefix = `${activeMonthYear.year}-${String(activeMonthYear.month).padStart(2,'0')}`;
    setSelectedDates(prev => prev.filter(d => !d.startsWith(prefix)));
  };
  const moveMonth = (delta:number) => setActiveMonthYear(prev => { let m=prev.month+delta,y=prev.year; if(m<1){m=12;y--;} if(m>12){m=1;y++;} return {year:y,month:m}; });
  const save = async () => {
    setSaving(true); setSaveError('');
    try {
      await onSaveConfig({...config, officialWorkdays:selectedDates});
      setSaved(true); setTimeout(()=>setSaved(false),1800);
    } catch (e:any) { setSaveError(e?.message || 'Não foi possível salvar os dias de trabalho.'); }
    finally { setSaving(false); }
  };

  return <div className="bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] p-3 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-3">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
      <div className="flex items-center gap-2.5"><div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"><CalendarIcon className="w-5 h-5"/></div><div><h3 className="text-sm font-bold text-slate-100">Calendário oficial de trabalho</h3><p className="text-xs text-slate-400">Dias selecionados são usados no cálculo de faltas.</p></div></div>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={()=>moveMonth(-1)} className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.08] border border-[var(--border-subtle)] text-slate-200"><ChevronLeft className="w-4 h-4"/></button>
        <span className="min-w-40 text-center text-xs font-bold text-slate-200">{monthNames[activeMonthYear.month-1]} de {activeMonthYear.year}</span>
        <button onClick={()=>moveMonth(1)} className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.08] border border-[var(--border-subtle)] text-slate-200"><ChevronRight className="w-4 h-4"/></button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg disabled:opacity-60">{saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}{saving ? 'Salvando...' : saved ? 'Salvo' : 'Salvar'}</button>
      </div>
    </div>

    {saveError && <div className="text-xs text-red-200 bg-red-950/30 border border-red-500/30 rounded-lg p-3">{saveError}</div>}

    <div className="flex flex-wrap justify-between gap-2 bg-[var(--surface-muted)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
      <span className="text-xs text-slate-400">Um dia selecionado sem produção do colaborador conta como falta, respeitando início e desligamento.</span>
      <div className="flex gap-2"><button onClick={selectWeekdays} className="px-2.5 py-1 rounded bg-white/[0.05] text-emerald-300 border border-emerald-500/40 text-xs font-semibold">Selecionar dias úteis</button><button onClick={clearMonth} className="px-2.5 py-1 rounded bg-white/[0.04] text-slate-300 border border-[var(--border-subtle)] text-xs">Limpar mês</button></div>
    </div>

    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider"><div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div></div>
    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className="h-12 sm:h-14 rounded-lg bg-[var(--surface-muted)]/40"/>)}
      {Array.from({length:daysCount}).map((_,i)=>{ const d=i+1,key=keyFor(d),sel=selectedDates.includes(key),date=new Date(activeMonthYear.year,activeMonthYear.month-1,d),weekend=[0,6].includes(date.getDay()); return <button key={key} onClick={()=>toggleDay(key)} className={`h-12 sm:h-14 rounded-lg p-1.5 sm:p-2 flex flex-col justify-between text-left border transition-all ${sel?'bg-white/[0.05] border-emerald-400/80 text-emerald-300':'bg-[var(--surface-base)] border-[var(--border-subtle)] text-slate-300'} ${weekend&&!sel?'opacity-60':''}`}><div className="flex justify-between"><span className="font-mono text-[11px] font-bold">{String(d).padStart(2,'0')}</span><div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${sel?'bg-emerald-500 border-emerald-400 text-slate-950':'border-slate-600'}`}>{sel&&<Check className="w-3 h-3"/>}</div></div><span className="hidden sm:block text-[9px]">{sel?'Trabalho':'Livre'}</span></button>;})}
    </div>
  </div>;
};
