import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Eye,
  RefreshCw,
  RotateCcw,
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
import { DailySectorDetailModal } from '../producao-diaria/DailySectorDetailModal';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterPanel,
  LoadingState,
  MetricCard,
  PageContainer,
  PageHeader,
  SectionCard,
  cx,
} from '../components/common/ui';
import { formatNum, formatPct } from '../dashboard/lib/formatters';
import { buildDailyProductionMetrics } from '../producao-diaria/metrics';
import type { DailyProductionSectorMetric } from '../producao-diaria/types';
import { SectorMultiSelect } from '../producao-diaria/SectorMultiSelect';
import { previousLocalDate, type DailyProductionObservation } from '../producao-diaria/observacoes';
import { producaoDiariaService } from '../services/producaoDiariaService';
import '../producao-diaria/producao-diaria.css';

function initialPeriod() {
  const yesterday = previousLocalDate();
  return { start: yesterday, end: yesterday };
}

function adherencePresentation(value: number | null) {
  if (value === null) return { color: '#708078', className: 'is-neutral', label: 'Sem programação' };
  if (value >= 100) return { color: '#34d399', className: 'is-success', label: 'Adequado' };
  if (value >= 90) return { color: '#fbbf24', className: 'is-warning', label: 'Atenção' };
  return { color: '#fb7185', className: 'is-danger', label: 'Abaixo do programado' };
}

function RankingTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as DailyProductionSectorMetric | undefined;
  if (!row) return null;
  return (
    <div className="daily-tooltip">
      <strong>{row.setor}</strong>
      <span>Programado: {formatNum(row.programado)}</span>
      <span>Produzido: {formatNum(row.produzido)}</span>
      <span>Aderência: {row.aderencia === null ? '—' : formatPct(row.aderencia)}</span>
    </div>
  );
}

function SectorCard({
  row,
  observacoes,
  onOpen,
}: {
  row: DailyProductionSectorMetric;
  observacoes: DailyProductionObservation[];
  onOpen: (setor: string) => void;
}) {
  const presentation = adherencePresentation(row.aderencia);
  const gaugeStyle = {
    '--daily-progress': `${Math.min(Math.max(row.aderencia || 0, 0), 100) * 3.6}deg`,
    '--daily-color': presentation.color,
  } as CSSProperties;

  return (
    <article className={cx('daily-sector-card', presentation.className)}>
      <div className="daily-sector-card__heading">
        <div>
          <span>Setor</span>
          <h3>{row.setor}</h3>
        </div>
        <span className="daily-sector-card__status">{presentation.label}</span>
      </div>
      <div className="daily-sector-card__body">
        <div className="daily-sector-gauge" style={gaugeStyle} aria-label={`Aderência: ${row.aderencia === null ? 'sem programação' : formatPct(row.aderencia)}`}>
          <div>
            <strong>{row.aderencia === null ? '—' : formatPct(row.aderencia)}</strong>
            <span>Aderência</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>Programado</dt>
            <dd>{formatNum(row.programado)}</dd>
          </div>
          <div>
            <dt>Produzido</dt>
            <dd>{formatNum(row.produzido)}</dd>
          </div>
        </dl>
      </div>
      <div className="daily-sector-card__details">
        <button
          type="button"
          className="daily-sector-details-button"
          aria-label={`Ver detalhes de ${row.setor}`}
          title={`Ver detalhes de ${row.setor}`}
          onClick={() => onOpen(row.setor)}
        >
          <Eye className="size-4" aria-hidden="true" />
          <span>Detalhes</span>
          {observacoes.some((note) => note.setor === row.setor && note.linha === 'GERAL') && (
            <span className="daily-sector-details-note" aria-label="Há observação registrada" title="Há observação registrada" />
          )}
        </button>
      </div>
    </article>
  );
}

export function ProducaoDiariaPage() {
  const defaults = useMemo(initialPeriod, []);
  const [dataInicio, setDataInicio] = useState(defaults.start);
  const [dataFim, setDataFim] = useState(defaults.end);
  const [linha, setLinha] = useState('ALL');
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[] | null>(null);
  const [observacoes, setObservacoes] = useState<DailyProductionObservation[]>([]);
  const [observacoesError, setObservacoesError] = useState('');
  const [modal, setModal] = useState<string | null>(null);
  const [textoObservacao, setTextoObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof producaoDiariaService.getData>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const invalidPeriod = !dataInicio || !dataFim || dataInicio > dataFim;

  useEffect(() => {
    if (invalidPeriod) {
      setLoading(false);
      setError('A data inicial não pode ser posterior à data final.');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
    const observacoesRequest = dataInicio === dataFim
      ? producaoDiariaService.getObservacoes(dataInicio, dataFim)
        .then((items) => ({ items, error: '' }))
        .catch(() => ({ items: [] as DailyProductionObservation[], error: 'Não foi possível carregar as observações. Tente atualizar.' }))
      : Promise.resolve({ items: [] as DailyProductionObservation[], error: '' });
    void Promise.all([producaoDiariaService.getData(dataInicio, dataFim, linha), observacoesRequest])
      .then(([result, noteResult]) => {
        if (!active) return;
        setData(result);
        setObservacoes(noteResult.items);
        setObservacoesError(noteResult.error);
        if (linha !== 'ALL' && !result.filtros.linhas.includes(linha)) setLinha('ALL');
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Falha ao carregar a Produção Diária.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [dataFim, dataInicio, invalidPeriod, linha, refreshKey]);

  const setoresDisponiveis = useMemo(
    () => (data?.setores || []).map((row) => row.setor).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [data],
  );
  const metrics = useMemo(() => buildDailyProductionMetrics(
    (data?.setores || []).filter((row) => setoresSelecionados === null || setoresSelecionados.includes(row.setor)),
  ), [data, setoresSelecionados]);
  const ranking = useMemo(() => [...metrics.setores].sort((a, b) => {
    if (a.aderencia === null && b.aderencia !== null) return 1;
    if (a.aderencia !== null && b.aderencia === null) return -1;
    return (b.aderencia || 0) - (a.aderencia || 0) || a.setor.localeCompare(b.setor, 'pt-BR');
  }), [metrics.setores]);
  const chartHeight = Math.max(320, ranking.length * 48 + 44);
  const lineOptions = [
    { value: 'ALL', label: 'Todas as linhas' },
    ...(data?.filtros.linhas || []).map((value) => ({ value, label: value })),
  ];
  const hasData = metrics.setores.length > 0;

  const clearFilters = () => {
    setDataInicio(defaults.start);
    setDataFim(defaults.end);
    setLinha('ALL');
    setSetoresSelecionados(null);
  };

  const openDetails = (setor: string) => {
    const note = observacoes.find((item) => item.data === dataInicio && item.setor === setor && item.linha === 'GERAL');
    setTextoObservacao(note?.observacao || '');
    setSaveError('');
    setModal(setor);
  };

  const saveObservation = async () => {
    if (!modal || !textoObservacao.trim() || salvando || dataInicio !== dataFim || observacoesError) return;
    setSalvando(true);
    setSaveError('');
    try {
      const saved = await producaoDiariaService.saveObservacao(dataInicio, modal, 'GERAL', textoObservacao.trim());
      setObservacoes((current) => [...current.filter((item) => !(item.data === saved.data && item.setor === saved.setor && item.linha === saved.linha)), saved]);
      setModal(null);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Não foi possível salvar a observação.');
    } finally {
      setSalvando(false);
    }
  };
  const modalMetric = metrics.setores.find((item) => item.setor === modal);
  const singleDay = dataInicio === dataFim;

  return (
    <PageContainer size="wide" className="daily-production-page space-y-5 py-6 sm:py-8">
      <PageHeader
        eyebrow="COORDENAÇÃO · PRODUÇÃO"
        title="Produção Diária"
        description="Acompanhe o desempenho da produção por setor no período selecionado."
        icon={<CalendarRange className="size-5" aria-hidden="true" />}
        metadata={data ? <span>Atualizado em {new Date(data.geradoEm).toLocaleString('pt-BR')}</span> : undefined}
        actions={(
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
            isLoading={loading}
            loadingLabel="Atualizando"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={invalidPeriod}
          >
            Atualizar
          </Button>
        )}
      />

      <FilterPanel
        title="Filtros"
        description="O período inclui integralmente a data inicial e a data final."
        actions={(
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="size-4" aria-hidden="true" />} onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
        contentClassName="sm:grid-cols-2 xl:grid-cols-4"
      >
        <Field label="Data inicial" error={invalidPeriod ? 'Revise o período informado.' : undefined}>
          <input className="field-control" type="date" value={dataInicio} max={dataFim || undefined} onChange={(event) => setDataInicio(event.target.value)} />
        </Field>
        <Field label="Data final" error={invalidPeriod ? 'Revise o período informado.' : undefined}>
          <input className="field-control" type="date" value={dataFim} min={dataInicio || undefined} onChange={(event) => setDataFim(event.target.value)} />
        </Field>
        <Field label="Linha">
          <CustomSelect ariaLabel="Linha" value={linha} options={lineOptions} onChange={setLinha} />
        </Field>
        <Field label="Setores">
          <SectorMultiSelect options={setoresDisponiveis} selected={setoresSelecionados} onChange={setSetoresSelecionados} />
        </Field>
      </FilterPanel>

      {loading ? (
        <LoadingState label="Carregando Produção Diária..." description="Consolidando programação e produção no período selecionado." />
      ) : error ? (
        <ErrorState
          title="Não foi possível carregar a Produção Diária"
          description={error}
          action={!invalidPeriod ? <Button variant="secondary" onClick={() => setRefreshKey((value) => value + 1)}>Tentar novamente</Button> : undefined}
        />
      ) : !hasData ? (
        <EmptyState
          icon={<BarChart3 className="size-6" aria-hidden="true" />}
          title="Nenhum dado encontrado para os filtros selecionados."
          description="Ajuste o período ou selecione outra linha para consultar a produção disponível."
        />
      ) : (
        <>
          <section className="daily-summary-grid" aria-label="Resumo da Produção Diária">
            <MetricCard label="Programado Total" value={`${formatNum(metrics.totais.programado)} unidades`} icon={<ClipboardList className="size-5" aria-hidden="true" />} tone="info" />
            <MetricCard label="Produzido Total" value={`${formatNum(metrics.totais.produzido)} unidades`} icon={<CheckCircle2 className="size-5" aria-hidden="true" />} tone="success" />
            <MetricCard label="Aderência Geral" value={metrics.totais.aderencia === null ? '—' : formatPct(metrics.totais.aderencia)} description="Produzido total ÷ programado total" icon={<Gauge className="size-5" aria-hidden="true" />} tone={metrics.totais.aderencia !== null && metrics.totais.aderencia >= 100 ? 'success' : 'warning'} featured />
          </section>

          <section aria-labelledby="setores-producao-diaria">
            <div className="daily-section-heading">
              <div>
                <h2 id="setores-producao-diaria">Desempenho por setor</h2>
                <p>Programado, produzido e aderência consolidados para os filtros ativos.</p>
              </div>
              <span>{metrics.setores.length} setor(es)</span>
            </div>
            {!singleDay && <p className="daily-observation-hint">Os detalhes abrangem o período filtrado. Para registrar observações, selecione apenas um dia.</p>}
            {observacoesError && <p className="daily-observation-hint" role="alert">{observacoesError}</p>}
            <div className="daily-sector-grid">
              {metrics.setores.map((row) => <SectorCard
                key={row.setor}
                row={row}
                observacoes={observacoes}
                onOpen={openDetails}
              />)}
            </div>
          </section>

          <SectionCard
            title="Ranking de Aderência por Setor"
            description="Ordenado da maior para a menor aderência. Setores sem programação aparecem ao final."
            icon={<BarChart3 className="size-4" aria-hidden="true" />}
          >
            <div className="daily-ranking-chart" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ranking} layout="vertical" margin={{ top: 8, right: 78, bottom: 8, left: 12 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.055)" horizontal={false} />
                  <XAxis type="number" domain={[0, 'auto']} tickFormatter={(value) => `${formatNum(Number(value), 0)}%`} tick={{ fill: '#708078', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                  <YAxis type="category" dataKey="setor" width={160} tick={{ fill: '#bdc8c1', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<RankingTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
                  <Bar dataKey={(row: DailyProductionSectorMetric) => row.aderencia || 0} radius={[0, 7, 7, 0]} maxBarSize={24}>
                    <LabelList dataKey={(row: DailyProductionSectorMetric) => row.aderencia === null ? '—' : formatPct(row.aderencia)} position="right" fill="#e5eee9" fontSize={12} fontWeight={800} />
                    {ranking.map((row) => <Cell key={row.setor} fill={adherencePresentation(row.aderencia).color} fillOpacity={0.9} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </>
      )}
      <DailySectorDetailModal
        sector={modal}
        metric={modalMetric}
        dataInicio={dataInicio}
        dataFim={dataFim}
        observacoesError={observacoesError}
        textoObservacao={textoObservacao}
        onTextoObservacaoChange={setTextoObservacao}
        onClose={() => setModal(null)}
        onSave={() => void saveObservation()}
        salvando={salvando}
        saveError={saveError}
      />
    </PageContainer>
  );
}
