import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Printer,
  RefreshCw,
  RotateCcw,
  Settings2,
  AlertTriangle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CustomSelect } from '../components/common/CustomSelect';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FilterPanel,
  LoadingState,
  PageContainer,
  PageHeader,
  SectionCard,
  type DataTableColumn,
} from '../components/common/ui';
import { AtrasoImportModal } from '../atraso/components/AtrasoImportModal';
import { AtrasoPrintModal } from '../atraso/components/AtrasoPrintModal';
import { atrasoService } from '../atraso/services/atrasoService';
import type { AtrasoRecord, AtrasoStatus } from '../atraso/types';
import '../atraso/atraso.css';

function formatDateBR(value: string): string {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '-');
}

function formatPower(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function normalizeLabel(value: string): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s|\/|-)([a-záàâãéêíóôõúç])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`);
}

interface ChartRow {
  setor: string;
  label: string;
  total: number;
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#08100b]/95 px-3 py-2 shadow-2xl backdrop-blur">
      <div className="text-xs font-extrabold text-white">{row.label}</div>
      <div className="mt-1 text-xs text-slate-400">{row.total.toLocaleString('pt-BR')} registro(s)</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Clique para filtrar a tabela</div>
    </div>
  );
}

export function AtrasoPage() {
  const [records, setRecords] = useState<AtrasoRecord[]>([]);
  const [status, setStatus] = useState<AtrasoStatus>('ATRASO');
  const [linha, setLinha] = useState('ALL');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await atrasoService.getAll();
      setRecords(data);
      setUpdatedAt(new Date());
    } catch (e: any) {
      const message = e?.message || 'Não foi possível carregar a tabela controle_atrasos.';
      if (/relation .*controle_atrasos.* does not exist|Could not find the table/i.test(message)) {
        setError('A tabela controle_atrasos não foi encontrada no Supabase. Execute o script SQL combinado antes de usar esta aba.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lineOptions = useMemo(() => [
    { value: 'ALL', label: 'Todas as linhas' },
    ...[...new Set(records.map((record) => record.linha).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: value })),
  ], [records]);

  const statusAndLineRecords = useMemo(() => records.filter((record) =>
    record.status === status && (linha === 'ALL' || record.linha === linha),
  ), [linha, records, status]);

  const chartData = useMemo<ChartRow[]>(() => {
    const grouped = new Map<string, number>();
    for (const record of statusAndLineRecords) {
      grouped.set(record.setor, (grouped.get(record.setor) || 0) + 1);
    }
    return [...grouped.entries()]
      .map(([setor, total]) => ({ setor, label: normalizeLabel(setor), total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
  }, [statusAndLineRecords]);

  useEffect(() => {
    if (selectedSector && !chartData.some((item) => item.setor === selectedSector)) {
      setSelectedSector(null);
    }
  }, [chartData, selectedSector]);

  const tableRows = useMemo(() => statusAndLineRecords
    .filter((record) => !selectedSector || record.setor === selectedSector)
    .sort((a, b) => a.data_programada.localeCompare(b.data_programada) || a.serie - b.serie),
  [selectedSector, statusAndLineRecords]);

  const columns = useMemo<DataTableColumn<AtrasoRecord>[]>(() => [
    {
      id: 'serie',
      header: 'Série',
      align: 'right',
      cell: (row) => <span className="font-mono font-bold tabular-nums text-slate-100">{row.serie}</span>,
    },
    {
      id: 'op',
      header: 'OP',
      align: 'right',
      cell: (row) => <span className="font-mono tabular-nums text-slate-300">{row.op ?? '-'}</span>,
    },
    {
      id: 'cliente',
      header: 'Cliente',
      cell: (row) => <span className="font-semibold text-slate-200">{row.cliente || '-'}</span>,
    },
    {
      id: 'data',
      header: 'Data Programada',
      cell: (row) => <span className="tabular-nums text-slate-300">{formatDateBR(row.data_programada)}</span>,
    },
    {
      id: 'potencia',
      header: 'Potência',
      align: 'right',
      cell: (row) => <span className="tabular-nums text-slate-300">{formatPower(row.potencia)}</span>,
    },
    {
      id: 'linha',
      header: 'Linha',
      cell: (row) => <Badge variant="neutral">{row.linha || '-'}</Badge>,
    },
  ], []);

  const resetFilters = () => {
    setStatus('ATRASO');
    setLinha('ALL');
    setSelectedSector(null);
  };

  const statusLabel = status === 'ATRASO' ? 'Atraso' : 'Adiantamento';
  const statusColor = status === 'ATRASO' ? '#fb7185' : '#34d399';
  const chartHeight = Math.max(320, chartData.length * 48 + 42);

  return (
    <PageContainer size="wide" className="atraso-page space-y-5 py-6 sm:py-8">
      <PageHeader
        eyebrow="COORDENAÇÃO · SUPABASE"
        title="Atraso"
        description="Acompanhamento dos registros em atraso e adiantamento por setor, com detalhamento integrado e importação da base oficial."
        icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        metadata={updatedAt ? <span>Atualizado em {updatedAt.toLocaleString('pt-BR')}</span> : undefined}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer className="size-4" aria-hidden="true" />}
              onClick={() => setPrintOpen(true)}
              disabled={loading}
            >
              Imprimir Atraso
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Settings2 className="size-4" aria-hidden="true" />}
              onClick={() => setImportOpen(true)}
            >
              Configurações
            </Button>
            <Button
              variant="ghost"
              size="sm"
              isLoading={loading}
              loadingLabel="Atualizando"
              leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
              onClick={() => void load()}
            >
              Atualizar
            </Button>
          </div>
        )}
      />

      <FilterPanel
        title="Filtros"
        description="O status é exclusivo: o dashboard exibe Atraso ou Adiantamento, nunca os dois ao mesmo tempo."
        actions={(
          <Button variant="ghost" size="sm" onClick={resetFilters} leftIcon={<RotateCcw className="size-4" aria-hidden="true" />}>
            Limpar filtros
          </Button>
        )}
        contentClassName="md:grid-cols-[minmax(0,1.2fr)_minmax(14rem,.8fr)]"
      >
          <Field label="Status">
            <div className="atraso-status-toggle" role="radiogroup" aria-label="Status do dashboard">
              <button
                type="button"
                role="radio"
                aria-checked={status === 'ATRASO'}
                className={status === 'ATRASO' ? 'is-active is-danger' : ''}
                onClick={() => { setStatus('ATRASO'); setSelectedSector(null); }}
              >
                <span className="status-dot status-dot--danger" aria-hidden="true" />
                Atraso
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={status === 'ADIANTAMENTO'}
                className={status === 'ADIANTAMENTO' ? 'is-active is-success' : ''}
                onClick={() => { setStatus('ADIANTAMENTO'); setSelectedSector(null); }}
              >
                <span className="status-dot status-dot--success" aria-hidden="true" />
                Adiantamento
              </button>
            </div>
          </Field>
          <Field label="Linha">
            <CustomSelect
              value={linha}
              options={lineOptions}
              onChange={(value) => { setLinha(value); setSelectedSector(null); }}
            />
          </Field>
      </FilterPanel>

      {loading ? (
        <LoadingState label="Carregando Controle de Atrasos..." description="Consultando a tabela controle_atrasos pela conexão segura do sistema." />
      ) : error ? (
        <ErrorState
          title="Não foi possível carregar a aba Atraso"
          description={error}
          action={<Button variant="secondary" onClick={() => void load()}>Tentar novamente</Button>}
        />
      ) : (
        <>
          <SectionCard
            title={`${statusLabel} por setor`}
            description="Clique em uma barra para restringir a tabela ao setor selecionado."
            icon={<BarChart3 className="size-4" aria-hidden="true" />}
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status === 'ATRASO' ? 'danger' : 'success'}>{statusAndLineRecords.length.toLocaleString('pt-BR')} registros</Badge>
                {selectedSector && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSector(null)}>
                    Limpar setor
                  </Button>
                )}
              </div>
            )}
          >
            {chartData.length ? (
              <div className="atraso-chart-wrap" style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 8, right: 48, bottom: 8, left: 12 }}
                  >
                    <CartesianGrid stroke="rgba(255,255,255,0.055)" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fill: '#708078', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={148}
                      tick={{ fill: '#bdc8c1', fontSize: 11, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
                    <Bar
                      dataKey="total"
                      radius={[0, 7, 7, 0]}
                      maxBarSize={24}
                      onClick={(entry: any) => {
                        const setorValue = entry?.payload?.setor || entry?.setor;
                        if (setorValue) setSelectedSector((current) => current === setorValue ? null : setorValue);
                      }}
                      className="atraso-clickable-bar"
                    >
                      <LabelList
                        dataKey="total"
                        position="right"
                        className="atraso-bar-label"
                        fill="#e5eee9"
                        fontSize={12}
                        fontWeight={800}
                      />
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.setor}
                          fill={statusColor}
                          fillOpacity={selectedSector && selectedSector !== entry.setor ? 0.28 : 0.9}
                          stroke={selectedSector === entry.setor ? '#ffffff' : statusColor}
                          strokeOpacity={selectedSector === entry.setor ? 0.65 : 0.18}
                          strokeWidth={selectedSector === entry.setor ? 1.5 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title={`Nenhum registro de ${statusLabel.toLocaleLowerCase('pt-BR')}`} description="Não existem registros para a combinação de status e linha selecionada." />
            )}
          </SectionCard>

          <SectionCard
            title="Detalhamento"
            description={selectedSector
              ? `Tabela filtrada pelo setor ${normalizeLabel(selectedSector)}.`
              : 'A tabela acompanha os filtros de Status e Linha do dashboard.'}
            actions={<Badge variant="neutral">{tableRows.length.toLocaleString('pt-BR')} linhas</Badge>}
          >
            <DataTable
              columns={columns}
              rows={tableRows}
              getRowKey={(row, index) => `${row.serie}-${row.setor}-${row.status}-${row.data_programada}-${index}`}
              caption="Detalhamento dos registros de atraso ou adiantamento"
              emptyState={<EmptyState title="Nenhum registro encontrado" description="Ajuste os filtros ou limpe o setor selecionado no gráfico." />}
              className="min-w-[62rem]"
            />
          </SectionCard>
        </>
      )}

      <AtrasoImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          setSelectedSector(null);
          await load();
        }}
      />
      <AtrasoPrintModal isOpen={printOpen} onClose={() => setPrintOpen(false)} records={records} />
    </PageContainer>
  );
}
