import { lazy, Suspense, useRef, useState } from 'react';
import { CheckCircle2, ClipboardList, Gauge } from 'lucide-react';
import { ModalShell } from '../components/common/ModalShell';
import { Button, MetricCard } from '../components/common/ui';
import { formatNum, formatPct } from '../dashboard/lib/formatters';
import type { DailyProductionSectorMetric } from './types';

import { DailySectorManagement, type ManagementDrafts } from './DailySectorManagement';
import type { DailyObservationLine } from './escopo';
import type { DailyProductionObservation } from './observacoes';
import { actionDateLabel } from './DailyActionForm';

const EmbeddedMonthlyDashboard = lazy(() => import('../pages/DashboardPage').then(
  ({ DashboardPage }) => ({ default: DashboardPage }),
));

interface Props {
  sector: string | null;
  metric?: DailyProductionSectorMetric;
  dataInicio: string;
  dataFim: string;
  productionLine: string;
  observacoes: DailyProductionObservation[];
  observacoesError: string;
  onObservationSaved: (note: DailyProductionObservation) => void;
  revision: number;
  onActionChanged: () => void;
  onClose: () => void;
}

function potencyLabel(potencia: string) {
  const numeric = Number(potencia);
  return Number.isFinite(numeric) && potencia.trim()
    ? `${numeric.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kVA`
    : potencia;
}

export function DailySectorDetailModal({
  sector, metric, dataInicio, dataFim, productionLine, observacoes, observacoesError,
  onObservationSaved, revision, onActionChanged, onClose,
}: Props) {
  const singleDay = dataInicio === dataFim;
  const [line, setLine] = useState<DailyObservationLine>('GERAL');
  const [view, setView] = useState<'details' | 'monthly'>('details');
  const [busy, setBusy] = useState(false);
  const drafts = useRef<ManagementDrafts>({ notes: {}, plans: {}, requests: {} }).current;
  const close = () => {
    setLine('GERAL');
    setView('details');
    onClose();
  };
  return (
    <ModalShell
      isOpen={Boolean(sector)}
      onClose={close}
      title={`Detalhes · ${sector || ''}`}
      description={`Programação e produção no período de ${actionDateLabel(dataInicio)} a ${actionDateLabel(dataFim)}.`}
      size={view === 'monthly' ? '2xl' : 'lg'}
      busy={busy}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={close} disabled={busy}>Fechar</Button></div>}
    >
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Visões de detalhes">
        <Button size="sm" variant={view === 'details' ? 'secondary' : 'ghost'} aria-pressed={view === 'details'}
          disabled={busy} onClick={() => setView('details')}>Produção e ações</Button>
        <Button size="sm" variant={view === 'monthly' ? 'secondary' : 'ghost'} aria-pressed={view === 'monthly'}
          disabled={busy} onClick={() => setView('monthly')}>Aderência Mensal</Button>
      </div>
      <div className="space-y-5" hidden={view !== 'details'} inert={view !== 'details'}>
        <div className="daily-observation-metrics">
          <MetricCard label="Programado" value={formatNum(metric?.programado || 0)}
            icon={<ClipboardList className="size-5" aria-hidden="true" />} tone="info" />
          <MetricCard label="Produzido" value={formatNum(metric?.produzido || 0)}
            icon={<CheckCircle2 className="size-5" aria-hidden="true" />} tone="success" />
          <MetricCard label="Aderência" value={metric?.aderencia == null ? '—' : formatPct(metric.aderencia)}
            icon={<Gauge className="size-5" aria-hidden="true" />}
            tone={metric?.aderencia != null && metric.aderencia >= 100 ? 'success' : 'warning'} />
        </div>

        <section aria-label="Desempenho por linha">
          <div className="daily-detail-heading">
            <h3>Desempenho por linha</h3>
            <span>Programado · Realizado · Aderência</span>
          </div>
          {metric?.linhas?.length ? (
            <div className="daily-detail-lines">
              {metric.linhas.map((item) => {
                const aderencia = item.programado > 0 ? item.produzido / item.programado * 100 : null;
                const title = item.linha === 'MON' ? 'Monofásico (MON)'
                  : item.linha === 'TRI' ? 'Trifásico (TRI)' : `Linha ${item.linha}`;
                return (
                  <article key={item.linha} className="daily-detail-line">
                    <div className="daily-detail-line__heading"><h4>{title}</h4></div>
                    <dl className="daily-detail-line__metrics">
                      <div><dt>Programado</dt><dd>{formatNum(item.programado)}</dd></div>
                      <div><dt>Realizado</dt><dd>{formatNum(item.produzido)}</dd></div>
                      <div><dt>Aderência</dt><dd>{aderencia == null ? '—' : formatPct(aderencia)}</dd></div>
                    </dl>
                    <div className="daily-detail-line__potencies">
                      <h5>Quantidade produzida por potência</h5>
                      {item.potencias.length ? (
                        <ul>
                          {item.potencias.map((pot) => (
                            <li key={pot.potencia}>
                              <span>{potencyLabel(pot.potencia)}</span>
                              <strong>{formatNum(pot.produzido)} un.</strong>
                            </li>
                          ))}
                        </ul>
                      ) : <p>Nenhuma produção registrada nesta linha no período.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <p className="daily-observation-hint">Não há detalhamento por linha disponível para este período.</p>}
        </section>

        {singleDay && sector ? (
          <DailySectorManagement data={dataInicio} setor={sector} linha={line} onLineChange={setLine} drafts={drafts}
            observacoes={observacoes} observacoesError={observacoesError} onObservationSaved={onObservationSaved}
            revision={revision} onActionChanged={onActionChanged} setBusy={setBusy} />
        ) : <p className="daily-observation-hint">Selecione uma única data para consultar ou registrar observações e planos deste setor.</p>}
      </div>
      {view === 'monthly' && sector && (
        <Suspense fallback={<p role="status">Carregando Aderência Mensal…</p>}>
          <EmbeddedMonthlyDashboard embedded initialFilters={{
            mes: dataInicio.slice(0, 7), setor: sector, linha: line === 'GERAL' ? productionLine : line,
          }} />
        </Suspense>
      )}
    </ModalShell>
  );
}
