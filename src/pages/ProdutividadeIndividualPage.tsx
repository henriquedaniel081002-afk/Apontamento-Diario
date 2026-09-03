import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Gauge, LayoutDashboard, RefreshCw, Settings2 } from 'lucide-react';
import { Button, PageContainer, PageHeader } from '../components/common/ui';
import { FilterBar } from '../productivity/components/FilterBar';
import { KpiCards } from '../productivity/components/KpiCards';
import { ProductivityTable } from '../productivity/components/ProductivityTable';
import { LateralAnalyticsPanel } from '../productivity/components/LateralAnalyticsPanel';
import { SettingsView } from '../productivity/components/SettingsView';
import { EmployeeDetailView } from '../productivity/components/EmployeeDetailView';
import { ConsolidatedEmployeeDay, Employee, FilterState, ProductionRecord, WorkdayConfig } from '../productivity/types';
import { calculateKPIs, consolidateEmployeeDays } from '../productivity/utils/calculations';
import { isSupabaseConfigured } from '../productivity/lib/supabase';
import { loadDashboardData, replaceOfficialWorkdays } from '../productivity/services/dashboardService';
import '../productivity/productivity.css';

type ProductivityView = 'dashboard' | 'settings';

const defaultFilters: FilterState = {
  startDate: '',
  endDate: '',
  sector: 'Todos',
  shift: 'Todos',
  employeeSearch: '',
  employeeId: '',
};

const defaultWorkdayConfig: WorkdayConfig = {
  officialWorkdays: [],
  conversionRules: [
    { letter: 'T', divisor: 3, description: 'Segunda letra "T": Peças divididas por 3 (ex: DT-4029, CT-1020)' },
    { letter: 'M', divisor: 2, description: 'Segunda letra "M": Peças divididas por 2 (ex: BM-3011, AM-5502)' },
    { letter: 'B', divisor: 2, description: 'Segunda letra "B": Peças divididas por 2 (ex: AB-2040, PB-7789)' },
  ],
  standardMinutes: {
    monday: 424,
    tuesday: 424,
    wednesday: 424,
    thursday: 424,
    friday: 389,
    weekend: 0,
  },
  productivityTarget: 95,
};

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function ProdutividadeIndividualPage() {
  const [view, setView] = useState<ProductivityView>('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [workdayConfig, setWorkdayConfig] = useState<WorkdayConfig>(defaultWorkdayConfig);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [selectedEmployeeDay, setSelectedEmployeeDay] = useState<ConsolidatedEmployeeDay | null>(null);
  const [employeeControlReady, setEmployeeControlReady] = useState(false);

  const refreshData = async (resetDateRange = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const data = await loadDashboardData();
      setEmployees(data.employees);
      setRecords(data.records);
      setWorkdayConfig((prev) => ({
        ...prev,
        officialWorkdays: data.officialWorkdays,
        productivityTarget: 95,
      }));
      setEmployeeControlReady(data.employeeControlReady);

      const dates = data.records.map((record) => record.date).sort();
      setFilters((prev) => ({
        ...prev,
        startDate: resetDateRange ? (dates[0] || '') : (prev.startDate || dates[0] || ''),
        endDate: resetDateRange
          ? (dates[dates.length - 1] || '')
          : (prev.endDate || dates[dates.length - 1] || ''),
      }));
      setSelectedEmployeeDay(null);
      setLastUpdated(new Date());
    } catch (error: any) {
      setLoadError(error?.message || 'Não foi possível carregar os dados do Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  const sectors = useMemo(
    () => ['Todos', ...Array.from(new Set(employees.map((employee) => employee.sector))).sort()],
    [employees],
  );
  const shifts = ['Todos', '1º Turno', '2º Turno', 'Não informado'];
  const employeesMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const employeesInScope = useMemo(
    () => employees.filter((employee) =>
      (filters.sector === 'Todos' || employee.sector === filters.sector)
      && (filters.shift === 'Todos' || employee.shift === filters.shift)
      && (!filters.employeeId || employee.id === filters.employeeId)),
    [employees, filters.sector, filters.shift, filters.employeeId],
  );

  const filteredRecords = useMemo(() => {
    const ids = new Set(employeesInScope.map((employee) => employee.id));
    return records.filter((record) =>
      (!filters.startDate || record.date >= filters.startDate)
      && (!filters.endDate || record.date <= filters.endDate)
      && ids.has(record.employeeId));
  }, [records, employeesInScope, filters.startDate, filters.endDate]);

  const consolidatedDays = useMemo(
    () => consolidateEmployeeDays(filteredRecords, employeesMap, workdayConfig),
    [filteredRecords, employeesMap, workdayConfig],
  );

  const stats = useMemo(
    () => calculateKPIs(
      consolidatedDays,
      employeesInScope,
      filters.startDate,
      filters.endDate,
      workdayConfig.officialWorkdays,
      workdayConfig,
    ),
    [consolidatedDays, employeesInScope, filters.startDate, filters.endDate, workdayConfig],
  );

  const resetFilters = () => {
    const dates = records.map((record) => record.date).sort();
    setFilters({
      ...defaultFilters,
      startDate: dates[0] || '',
      endDate: dates[dates.length - 1] || '',
    });
  };

  const saveWorkdays = async (newConfig: WorkdayConfig) => {
    const normalizedConfig = { ...newConfig, productivityTarget: 95 };
    if (isSupabaseConfigured) {
      await replaceOfficialWorkdays(normalizedConfig.officialWorkdays);
    }
    setWorkdayConfig(normalizedConfig);
    setLastUpdated(new Date());
  };

  const changeView = (nextView: ProductivityView) => {
    setSelectedEmployeeDay(null);
    setView(nextView);
  };

  return (
    <PageContainer size="wide" className="productivity-page space-y-5 py-6 sm:py-8">
      <PageHeader
        eyebrow="COORDENAÇÃO · SUPABASE"
        title="Produtividade Individual"
        description="Acompanhamento da produtividade por colaborador com as regras operacionais atuais da Bobinagem."
        icon={<Gauge className="size-5" aria-hidden="true" />}
        metadata={<span>Atualizado em {formatUpdatedAt(lastUpdated)}</span>}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button
              variant={view === 'dashboard' ? 'success' : 'secondary'}
              size="sm"
              leftIcon={<LayoutDashboard className="size-4" aria-hidden="true" />}
              onClick={() => changeView('dashboard')}
            >
              Dashboard
            </Button>
            <Button
              variant={view === 'settings' ? 'success' : 'secondary'}
              size="sm"
              leftIcon={<Settings2 className="size-4" aria-hidden="true" />}
              onClick={() => changeView('settings')}
            >
              Configurações
            </Button>
            <Button
              variant="ghost"
              size="sm"
              isLoading={loading}
              loadingLabel="Atualizando"
              leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
              onClick={() => void refreshData(false)}
            >
              Atualizar
            </Button>
          </div>
        )}
      />

      {!isSupabaseConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-4 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-extrabold">Supabase não configurado neste ambiente.</p>
            <p className="mt-1 text-amber-100/75">
              Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no projeto da Vercel para carregar a Produtividade Individual.
            </p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/[0.08] p-4 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-extrabold">Falha ao carregar a Produtividade Individual.</p>
            <p className="mt-1 text-rose-100/75">{loadError}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[45vh] items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
          <div className="flex items-center gap-3 text-sm font-bold text-slate-300">
            <RefreshCw className="size-5 animate-spin text-emerald-300" aria-hidden="true" />
            Carregando dados de produtividade...
          </div>
        </div>
      ) : view === 'dashboard' ? (
        <div className="flex flex-col gap-4">
          <FilterBar
            filters={filters}
            onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onResetFilters={resetFilters}
            employees={employees}
            sectors={sectors}
            shifts={shifts}
          />

          {isSupabaseConfigured && records.length === 0 && !loadError && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-4 text-sm text-amber-100">
              Nenhum registro de produção foi retornado pelo Supabase. Verifique as permissões da view <code>vw_producao_detalhada</code>.
            </div>
          )}

          <KpiCards stats={stats} productivityTarget={95} />

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-9">
              <ProductivityTable data={consolidatedDays} onSelectRow={setSelectedEmployeeDay} />
            </div>
            <div className="min-w-0 xl:col-span-3">
              <LateralAnalyticsPanel stats={stats} productivityTarget={95} />
            </div>
          </div>
        </div>
      ) : (
        <SettingsView
          config={workdayConfig}
          onSaveConfig={saveWorkdays}
          employees={employees}
          employeeControlReady={employeeControlReady}
          onImported={async () => { await refreshData(true); }}
          onEmployeeChanged={async () => { await refreshData(false); }}
        />
      )}

      {!loading && view === 'dashboard' && selectedEmployeeDay && (
        <EmployeeDetailView day={selectedEmployeeDay} onClose={() => setSelectedEmployeeDay(null)} />
      )}
    </PageContainer>
  );
}
