import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  FileCheck2,
  FileWarning,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  UserRoundX,
  UsersRound,
} from 'lucide-react';
import { CustomSelect } from '../components/common/CustomSelect';
import {
  Badge,
  Button,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  Field,
  FilterPanel,
  MetricCard,
  PageContainer,
  PageHeader,
  ProgressLoadingState,
  SectionCard,
} from '../components/common/ui';
import { useLoadingProgress } from '../hooks/useLoadingProgress';
import {
  controleFaltasService,
  type ControleFaltasRegistro,
} from '../services/controleFaltasService';
import { formatDateBR } from '../utils/formatters';
import '../dashboard/controle-faltas.css';

interface RankingItem {
  nome: string;
  setor: string;
  total: number;
  comAtestado: number;
  semAtestado: number;
  ultimaFalta: string;
}

function todayYmd(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function firstDayOfCurrentMonthYmd(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function formatSectorLabel(value: string): string {
  const normalized = String(value || '').trim().toUpperCase();
  const fixed: Record<string, string> = {
    'BOBINAGEM': 'Bobinagem',
    'BOBINA AT': 'Bobinagem AT',
    'BOBINA BT': 'Bobinagem BT',
    'CORTE DO LASER': 'Corte do Laser',
    'CORTE DO NUCLEO': 'Corte do Núcleo',
    'MONTAGEM DO NUCLEO': 'Montagem do Núcleo',
    'MONTAGEM FINAL': 'Montagem Final',
    'MPA': 'MPA',
    'MPA MON': 'MPA MON',
    'MPA TRI': 'MPA TRI',
    'EPOXI': 'Epóxi',
  };
  if (fixed[normalized]) return fixed[normalized];
  return normalized
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s|\/|-)([a-záàâãéêíóôõúç])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`);
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function recordQuantity(record: ControleFaltasRegistro): number {
  return Math.max(0, Number(record.quantidade) || 0);
}

function EvolutionChart({ records, dataInicio, dataFim }: { records: ControleFaltasRegistro[]; dataInicio: string; dataFim: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const data = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const record of records) {
      byDate.set(record.data, (byDate.get(record.data) || 0) + recordQuantity(record));
    }

    const items: Array<{ date: string; value: number }> = [];
    const cursor = new Date(`${dataInicio}T00:00:00Z`);
    const end = new Date(`${dataFim}T00:00:00Z`);
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      const value = byDate.get(date) || 0;
      const dayOfWeek = cursor.getUTCDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

      // O gráfico mostra os dias úteis normalmente. Sábado e domingo
      // só entram na linha do tempo quando houver falta registrada.
      if (isWeekday || value > 0) {
        items.push({ date, value });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return items;
  }, [dataFim, dataInicio, records]);

  if (!data.length) {
    return <EmptyState title="Sem faltas no período" description="Não há registros aprovados nos filtros atuais." />;
  }

  const width = 760;
  const height = 260;
  const padding = { top: 24, right: 18, bottom: 48, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const x = (index: number) => data.length === 1
    ? padding.left + chartWidth / 2
    : padding.left + (index / (data.length - 1)) * chartWidth;
  const y = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight;
  const points = data.map((item, index) => `${x(index)},${y(item.value)}`).join(' ');
  const gridValues = [...new Set([0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxValue * ratio)))].sort((a, b) => a - b);
  const labelStep = Math.max(1, Math.ceil(data.length / 7));
  const hitWidth = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
  const hovered = hoveredIndex === null ? null : data[hoveredIndex];
  const tooltipWidth = 142;
  const tooltipHeight = 56;
  const tooltipX = hoveredIndex === null
    ? 0
    : Math.min(width - padding.right - tooltipWidth, Math.max(padding.left, x(hoveredIndex) - tooltipWidth / 2));
  const tooltipY = hoveredIndex === null || !hovered
    ? 0
    : (() => {
        const preferredAbove = y(hovered.value) - tooltipHeight - 15;
        if (preferredAbove >= 7) return preferredAbove;
        return Math.min(height - padding.bottom - tooltipHeight, y(hovered.value) + 15);
      })();

  return (
    <div className="absence-line-chart" role="img" aria-label="Evolução das faltas ao longo do período selecionado">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(value)}
              y2={y(value)}
              className="absence-chart-gridline"
            />
            <text x={padding.left - 10} y={y(value) + 4} textAnchor="end" className="absence-chart-axis-label">
              {value}
            </text>
          </g>
        ))}
        <polyline points={points} className="absence-chart-line" />
        {data.map((item, index) => (
          <g key={item.date}>
            {item.value > 0 && (
              <>
                <circle cx={x(index)} cy={y(item.value)} r="4.5" className="absence-chart-point" />
                <text x={x(index)} y={y(item.value) - 10} textAnchor="middle" className="absence-chart-value">
                  {item.value}
                </text>
              </>
            )}
            {(index % labelStep === 0 || index === data.length - 1) && (
              <text x={x(index)} y={height - 19} textAnchor="middle" className="absence-chart-axis-label">
                {item.date.slice(8, 10)}/{item.date.slice(5, 7)}
              </text>
            )}
            <rect
              x={index === 0 ? padding.left : x(index) - hitWidth / 2}
              y={padding.top}
              width={data.length === 1
                ? chartWidth
                : index === 0 || index === data.length - 1
                  ? hitWidth / 2
                  : hitWidth}
              height={chartHeight}
              className="absence-chart-hit-area"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseMove={() => setHoveredIndex(index)}
            />
          </g>
        ))}
        {hovered && hoveredIndex !== null && (
          <g className="absence-chart-tooltip" pointerEvents="none">
            <line
              x1={x(hoveredIndex)}
              x2={x(hoveredIndex)}
              y1={padding.top}
              y2={padding.top + chartHeight}
              className="absence-chart-hover-line"
            />
            <circle cx={x(hoveredIndex)} cy={y(hovered.value)} r="6" className="absence-chart-point absence-chart-point-active" />
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx="8"
              className="absence-chart-tooltip-box"
            />
            <text x={tooltipX + 12} y={tooltipY + 21} className="absence-chart-tooltip-date">
              {formatDateBR(hovered.date)}
            </text>
            <text x={tooltipX + 12} y={tooltipY + 42} className="absence-chart-tooltip-value">
              Faltas: {hovered.value.toLocaleString('pt-BR')}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function SectorChart({ records }: { records: ControleFaltasRegistro[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of records) {
      map.set(record.setor, (map.get(record.setor) || 0) + recordQuantity(record));
    }
    return [...map.entries()]
      .map(([setor, total]) => ({ setor, total }))
      .sort((a, b) => b.total - a.total || a.setor.localeCompare(b.setor, 'pt-BR'));
  }, [records]);

  if (!data.length) {
    return <EmptyState title="Sem setores para exibir" description="Não há faltas aprovadas nos filtros atuais." />;
  }

  const max = Math.max(1, ...data.map((item) => item.total));
  return (
    <div className="absence-sector-bars">
      {data.map((item) => (
        <div className="absence-sector-row" key={item.setor}>
          <div className="absence-sector-label" title={formatSectorLabel(item.setor)}>{formatSectorLabel(item.setor)}</div>
          <div className="absence-sector-track" aria-hidden="true">
            <span style={{ width: `${Math.max(5, (item.total / max) * 100)}%` }} />
          </div>
          <strong>{item.total.toLocaleString('pt-BR')}</strong>
        </div>
      ))}
    </div>
  );
}

export function ControleFaltasPage() {
  const [dataInicio, setDataInicio] = useState(firstDayOfCurrentMonthYmd);
  const [dataFim, setDataFim] = useState(todayYmd);
  const [setor, setSetor] = useState('ALL');
  const [turno, setTurno] = useState('ALL');
  const [colaborador, setColaborador] = useState('ALL');
  const [records, setRecords] = useState<ControleFaltasRegistro[]>([]);
  const [geradoEm, setGeradoEm] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { progress, startProgress, completeProgress } = useLoadingProgress();

  const validRange = Boolean(dataInicio && dataFim && dataInicio <= dataFim);

  const load = useCallback(async (forceRefresh = false) => {
    if (!validRange) return;
    setLoading(true);
    setError(null);
    startProgress();
    try {
      const response = await controleFaltasService.getData(dataInicio, dataFim, forceRefresh);
      setRecords(response.registros);
      setGeradoEm(response.geradoEm);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar o Controle de Faltas.');
    } finally {
      await completeProgress();
      setLoading(false);
    }
  }, [completeProgress, dataFim, dataInicio, startProgress, validRange]);

  useEffect(() => {
    if (validRange) void load();
  }, [load, validRange]);

  const setorOptions = useMemo(() => [
    { value: 'ALL', label: 'Todos os setores' },
    ...[...new Set(records.map((record) => record.setor).filter(Boolean))]
      .sort((a, b) => formatSectorLabel(a).localeCompare(formatSectorLabel(b), 'pt-BR'))
      .map((value) => ({ value, label: formatSectorLabel(value) })),
  ], [records]);

  const turnoOptions = useMemo(() => [
    { value: 'ALL', label: 'Todos os turnos' },
    ...[...new Set(records.map((record) => record.turno).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: value })),
  ], [records]);

  const colaboradorOptions = useMemo(() => [
    { value: 'ALL', label: 'Todos os colaboradores' },
    ...[...new Set(records.map((record) => normalizeName(record.nome)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: value })),
  ], [records]);

  useEffect(() => {
    if (setor !== 'ALL' && !setorOptions.some((option) => option.value === setor)) setSetor('ALL');
  }, [setor, setorOptions]);

  useEffect(() => {
    if (turno !== 'ALL' && !turnoOptions.some((option) => option.value === turno)) setTurno('ALL');
  }, [turno, turnoOptions]);

  useEffect(() => {
    if (colaborador !== 'ALL' && !colaboradorOptions.some((option) => option.value === colaborador)) setColaborador('ALL');
  }, [colaborador, colaboradorOptions]);

  const filtered = useMemo(() => records.filter((record) => {
    if (setor !== 'ALL' && record.setor !== setor) return false;
    if (turno !== 'ALL' && record.turno !== turno) return false;
    if (colaborador !== 'ALL' && normalizeName(record.nome) !== colaborador) return false;
    return true;
  }), [colaborador, records, setor, turno]);

  const totals = useMemo(() => {
    let total = 0;
    let comAtestado = 0;
    let semAtestado = 0;
    const people = new Set<string>();

    for (const record of filtered) {
      const quantity = recordQuantity(record);
      total += quantity;
      if (record.atestado) comAtestado += quantity;
      else semAtestado += quantity;
      const name = normalizeName(record.nome);
      if (name) people.add(name.toLocaleLowerCase('pt-BR'));
    }

    return { total, comAtestado, semAtestado, colaboradores: people.size };
  }, [filtered]);

  const ranking = useMemo<RankingItem[]>(() => {
    const byPerson = new Map<string, RankingItem & { setorCounts: Map<string, number> }>();
    for (const record of filtered) {
      const nome = normalizeName(record.nome);
      if (!nome) continue;
      const key = nome.toLocaleLowerCase('pt-BR');
      const current = byPerson.get(key) || {
        nome,
        setor: record.setor,
        total: 0,
        comAtestado: 0,
        semAtestado: 0,
        ultimaFalta: record.data,
        setorCounts: new Map<string, number>(),
      };
      const quantity = recordQuantity(record);
      current.total += quantity;
      if (record.atestado) current.comAtestado += quantity;
      else current.semAtestado += quantity;
      if (record.data > current.ultimaFalta) current.ultimaFalta = record.data;
      current.setorCounts.set(record.setor, (current.setorCounts.get(record.setor) || 0) + quantity);
      byPerson.set(key, current);
    }

    return [...byPerson.values()]
      .map((item) => {
        const mainSector = [...item.setorCounts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0]?.[0] || item.setor;
        return { ...item, setor: mainSector };
      })
      .sort((a, b) => b.total - a.total || b.ultimaFalta.localeCompare(a.ultimaFalta) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 10);
  }, [filtered]);

  const clearFilters = () => {
    setDataInicio(firstDayOfCurrentMonthYmd());
    setDataFim(todayYmd());
    setSetor('ALL');
    setTurno('ALL');
    setColaborador('ALL');
  };

  const hasFilters = dataInicio !== firstDayOfCurrentMonthYmd()
    || dataFim !== todayYmd()
    || setor !== 'ALL'
    || turno !== 'ALL'
    || colaborador !== 'ALL';

  if (loading) {
    return (
      <PageContainer className="py-6 sm:py-8">
        <ProgressLoadingState
          progress={progress}
          label="Carregando Controle de Faltas"
          description="Buscando as faltas aprovadas do período para montar os indicadores e análises."
        />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="py-6 sm:py-8">
        <ErrorState
          title="Não foi possível carregar o Controle de Faltas"
          description={error}
          action={<Button onClick={() => void load(true)} leftIcon={<RefreshCw className="size-4" />}>Tentar novamente</Button>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide" className="absence-dashboard space-y-5 py-6 sm:py-8">
      <PageHeader
        icon={<UserRoundX className="size-5" aria-hidden="true" />}
        eyebrow="Coordenação"
        title="Controle de Faltas"
        description="Dashboard de absenteísmo para acompanhar faltas aprovadas por período, setor, turno e colaborador."
        metadata={geradoEm ? <span>Atualizado em {new Date(geradoEm).toLocaleString('pt-BR')}</span> : undefined}
        actions={(
          <Button
            variant="secondary"
            onClick={() => void load(true)}
            leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
          >
            Atualizar
          </Button>
        )}
      />

      <FilterPanel
        title="Filtros da análise"
        description="O período consulta apenas as faltas aprovadas; os demais filtros são aplicados instantaneamente."
        actions={(
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasFilters}
            onClick={clearFilters}
            leftIcon={<RotateCcw className="size-4" aria-hidden="true" />}
          >
            Limpar filtros
          </Button>
        )}
      >
        <Field label="Data inicial" error={!validRange ? 'A data inicial deve ser anterior ou igual à data final.' : undefined}>
          <DateInput value={dataInicio} max={dataFim || undefined} onChange={(event) => setDataInicio(event.target.value)} />
        </Field>
        <Field label="Data final" error={!validRange ? 'Revise o período selecionado.' : undefined}>
          <DateInput value={dataFim} min={dataInicio || undefined} onChange={(event) => setDataFim(event.target.value)} />
        </Field>
        <Field label="Setor">
          <CustomSelect value={setor} options={setorOptions} onChange={setSetor} />
        </Field>
        <Field label="Turno">
          <CustomSelect value={turno} options={turnoOptions} onChange={setTurno} />
        </Field>
        <Field label="Colaborador">
          <CustomSelect value={colaborador} options={colaboradorOptions} onChange={setColaborador} />
        </Field>
      </FilterPanel>

      <section className="absence-kpi-grid" aria-label="Indicadores de faltas">
        <MetricCard
          label="Faltas no período"
          value={totals.total.toLocaleString('pt-BR')}
          description="Total de faltas nos filtros atuais"
          icon={<CalendarDays className="size-5" />}
          tone="info"
        />
        <MetricCard
          label="Com atestado"
          value={totals.comAtestado.toLocaleString('pt-BR')}
          description={totals.total ? `${Math.round((totals.comAtestado / totals.total) * 100)}% do total de faltas` : 'Nenhuma falta no período'}
          icon={<FileCheck2 className="size-5" />}
          tone="success"
        />
        <MetricCard
          label="Sem atestado"
          value={totals.semAtestado.toLocaleString('pt-BR')}
          description={totals.total ? `${Math.round((totals.semAtestado / totals.total) * 100)}% do total de faltas` : 'Nenhuma falta no período'}
          icon={<FileWarning className="size-5" />}
          tone="warning"
        />
        <MetricCard
          label="Colaboradores"
          value={totals.colaboradores.toLocaleString('pt-BR')}
          description="Colaboradores com pelo menos uma falta"
          icon={<UsersRound className="size-5" />}
          tone="primary"
        />
      </section>

      <section className="absence-chart-grid">
        <SectionCard
          title="Evolução das faltas"
          description="Quantidade de faltas por dia nos filtros selecionados."
          icon={<TrendingUp className="size-5" aria-hidden="true" />}
          className="min-w-0"
        >
          <EvolutionChart records={filtered} dataInicio={dataInicio} dataFim={dataFim} />
        </SectionCard>

        <SectionCard
          title="Faltas por setor"
          description="Ranking dos setores com maior número de faltas."
          icon={<UserRoundX className="size-5" aria-hidden="true" />}
          className="min-w-0"
        >
          <SectorChart records={filtered} />
        </SectionCard>
      </section>

      <SectionCard
        title="Colaboradores com mais faltas"
        description="Ranking dos 10 colaboradores com maior quantidade de faltas no período filtrado."
      >
        <DataTable<RankingItem>
          rows={ranking}
          getRowKey={(row) => row.nome}
          caption="Ranking de colaboradores com mais faltas"
          emptyState={<EmptyState title="Nenhum colaborador encontrado" description="Não há faltas nominais aprovadas nos filtros atuais." />}
          columns={[
            {
              id: 'colaborador',
              header: 'Colaborador',
              cell: (row, index) => (
                <div className="flex items-center gap-3">
                  <span className="absence-rank-number">{index + 1}</span>
                  <span className="font-bold text-white">{row.nome}</span>
                </div>
              ),
            },
            {
              id: 'setor',
              header: 'Setor',
              cell: (row) => <Badge variant="neutral">{formatSectorLabel(row.setor)}</Badge>,
            },
            {
              id: 'faltas',
              header: 'Faltas',
              align: 'center',
              cell: (row) => <strong className="text-rose-300">{row.total}</strong>,
            },
            {
              id: 'atestado',
              header: 'Com atestado',
              align: 'center',
              cell: (row) => <strong className="text-emerald-300">{row.comAtestado}</strong>,
            },
            {
              id: 'sem-atestado',
              header: 'Sem atestado',
              align: 'center',
              cell: (row) => <strong className="text-amber-300">{row.semAtestado}</strong>,
            },
            {
              id: 'ultima',
              header: 'Última falta',
              align: 'right',
              cell: (row) => formatDateBR(row.ultimaFalta),
            },
          ]}
        />
      </SectionCard>
    </PageContainer>
  );
}
