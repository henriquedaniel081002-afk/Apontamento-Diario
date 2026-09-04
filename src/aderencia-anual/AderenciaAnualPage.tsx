import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  ChartColumnIncreasing,
  Database,
  PackageCheck,
  Percent,
  RefreshCw,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterPanel,
  LoadingState,
  MetricCard,
  PageContainer,
  PageHeader,
  Surface,
} from '../components/common/ui';
import { CustomSelect } from '../components/common/CustomSelect';
import { AderenciaAnualChart } from './components/AderenciaAnualChart';
import { AderenciaAnualImport } from './components/AderenciaAnualImport';
import { aderenciaAnualService } from './services/aderenciaAnualService';
import type { AderenciaAnualRecord, AderenciaAnualUpsertRow } from './types';
import { buildAnnualComparison, calculateAnnualMetrics, deriveAvailableYears } from './utils/metrics';

const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function AderenciaAnualPage() {
  const [records, setRecords] = useState<AderenciaAnualRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedRecords = await aderenciaAnualService.getAll();
      setRecords(loadedRecords);
      const loadedYears = deriveAvailableYears(loadedRecords);
      setSelectedYear((current) => {
        if (current != null && loadedYears.includes(current)) return current;
        const currentYear = new Date().getFullYear();
        return loadedYears.includes(currentYear) ? currentYear : loadedYears.at(-1) ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a Aderência Anual.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const years = useMemo(() => deriveAvailableYears(records), [records]);
  const metrics = useMemo(
    () => selectedYear == null ? null : calculateAnnualMetrics(records, selectedYear),
    [records, selectedYear],
  );
  const chartData = useMemo(() => buildAnnualComparison(records, years), [records, years]);

  const handleImport = async (rows: AderenciaAnualUpsertRow[]) => {
    await aderenciaAnualService.upsert(rows);
    setSuccessMessage(`${rows.length} mês(es) importado(s) com sucesso.`);
    await loadData();
  };

  return (
    <PageContainer size="wide" className="py-6 sm:py-8">
      <PageHeader
        eyebrow="Indicadores de produção"
        title="Aderência Anual"
        description="Acompanhe os indicadores do ano selecionado e compare a produção realizada entre todos os anos disponíveis."
        icon={<ChartColumnIncreasing className="size-6" aria-hidden="true" />}
        actions={<AderenciaAnualImport onImport={handleImport} />}
        metadata={(
          <>
            <Badge variant="success">Supabase</Badge>
            <span>Fonte: public.aderencia_anual</span>
          </>
        )}
      />

      <div className="mt-6 grid gap-5 sm:mt-7">
        {successMessage && (
          <div role="status" className="flex items-center justify-between gap-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm font-bold text-emerald-200">
            <span>{successMessage}</span>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-xs text-emerald-300 hover:text-white">
              Fechar
            </button>
          </div>
        )}

        {loading ? (
          <LoadingState label="Carregando Aderência Anual..." description="Consultando os dados mensais no Supabase." />
        ) : error ? (
          <ErrorState
            title="Aderência Anual indisponível"
            description={error}
            action={(
              <Button variant="secondary" leftIcon={<RefreshCw className="size-4" />} onClick={() => void loadData()}>
                Tentar novamente
              </Button>
            )}
          />
        ) : records.length === 0 ? (
          <EmptyState
            icon={<Database className="size-6" aria-hidden="true" />}
            title="Aderência Anual pronta para receber dados"
            description="Importe um Excel com a aba Aderência Anual para preencher os indicadores e o comparativo."
          />
        ) : (
          <>
            <FilterPanel
              title="Filtro dos cartões"
              description="A seleção abaixo não altera o gráfico comparativo."
              contentClassName="sm:max-w-sm"
            >
              <Field label="Ano" htmlFor="aderencia-anual-year" hint="Afeta somente os três cartões.">
                <CustomSelect
                  id="aderencia-anual-year"
                  ariaLabel="Ano"
                  value={selectedYear == null ? '' : String(selectedYear)}
                  options={years.map((year) => ({ value: String(year), label: String(year) }))}
                  onChange={(value) => setSelectedYear(Number(value))}
                  className="min-h-11"
                />
              </Field>
            </FilterPanel>

            <section aria-label={`Indicadores de ${selectedYear ?? ''}`} className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Média de Dias Úteis"
                value={metrics?.averageWorkdays == null ? '—' : decimalFormatter.format(metrics.averageWorkdays)}
                description={metrics ? `${metrics.monthCount} mês(es) existente(s) no ano` : 'Sem dados para o ano'}
                icon={<CalendarRange className="size-5" aria-hidden="true" />}
                tone="info"
              />
              <MetricCard
                label="Aderência Anual"
                value={metrics?.adherence == null ? '—' : `${percentFormatter.format(metrics.adherence)}%`}
                description={metrics ? `Calculada com ${metrics.adherenceMonthCount} mês(es) até o período aplicável` : 'Sem programação para calcular'}
                icon={<Percent className="size-5" aria-hidden="true" />}
                tone="success"
                featured
              />
              <MetricCard
                label="Total Produzido"
                value={metrics ? integerFormatter.format(metrics.totalProduced) : '—'}
                description={`Quantidade realizada em ${selectedYear ?? '—'}`}
                icon={<PackageCheck className="size-5" aria-hidden="true" />}
                tone="warning"
              />
            </section>

            <Surface as="section" padding="none" className="min-w-0 overflow-hidden" aria-labelledby="annual-comparison-title">
              <div className="flex flex-col gap-2 border-b border-white/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h2 id="annual-comparison-title" className="text-base font-extrabold text-white">Comparativo Anual</h2>
                  <p className="mt-1 text-sm text-slate-400">Quantidade realizada por mês em todos os anos disponíveis.</p>
                </div>
                <Badge variant="neutral">Todos os anos</Badge>
              </div>
              <div className="p-3 sm:p-5">
                <AderenciaAnualChart data={chartData} years={years} />
              </div>
            </Surface>
          </>
        )}
      </div>
    </PageContainer>
  );
}
