import { CheckCircle2, ClipboardList, Gauge, Save } from 'lucide-react';
import { ModalShell } from '../components/common/ModalShell';
import { Button, Field, MetricCard } from '../components/common/ui';
import { formatNum, formatPct } from '../dashboard/lib/formatters';
import type { DailyProductionSectorMetric } from './types';

interface Props {
  sector: string | null;
  metric?: DailyProductionSectorMetric;
  dataInicio: string;
  dataFim: string;
  observacoesError: string;
  textoObservacao: string;
  onTextoObservacaoChange: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
  salvando: boolean;
  saveError: string;
}

function potencyLabel(potencia: string) {
  const numeric = Number(potencia);
  return Number.isFinite(numeric) && potencia.trim()
    ? `${numeric.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kVA`
    : potencia;
}

export function DailySectorDetailModal({
  sector, metric, dataInicio, dataFim, observacoesError, textoObservacao,
  onTextoObservacaoChange, onClose, onSave, salvando, saveError,
}: Props) {
  const singleDay = dataInicio === dataFim;
  const dateLabel = (date: string) => date.split('-').reverse().join('/');

  return (
    <ModalShell
      isOpen={Boolean(sector)}
      onClose={onClose}
      title={`Detalhes · ${sector || ''}`}
      description={`Programação e produção no período de ${dateLabel(dataInicio)} a ${dateLabel(dataFim)}.`}
      size="lg"
      busy={salvando}
      footer={<div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={salvando}>Fechar</Button>
        {singleDay && !observacoesError && (
          <Button leftIcon={<Save className="size-4" aria-hidden="true" />}
            onClick={onSave} disabled={salvando || !textoObservacao.trim()} isLoading={salvando}>
            Salvar observação
          </Button>
        )}
      </div>}
    >
      <div className="space-y-5">
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

        <section className="daily-detail-observation" aria-label="Observação do setor">
          <h3>Observação do setor</h3>
          {!singleDay ? (
            <p className="daily-observation-hint">Selecione uma única data para consultar ou registrar a observação deste setor.</p>
          ) : observacoesError ? (
            <p className="daily-observation-hint" role="alert">{observacoesError}</p>
          ) : (
            <Field label="Observação" hint="Uma observação geral por setor e data, independente da linha. Exclusivo da Coordenação.">
              <textarea className="field-control min-h-32 resize-y" maxLength={3000}
                value={textoObservacao} onChange={(event) => onTextoObservacaoChange(event.target.value)}
                placeholder="Registre os motivos do desempenho da produção..." />
            </Field>
          )}
          {saveError && <p role="alert" className="text-sm text-rose-300">{saveError}</p>}
        </section>
      </div>
    </ModalShell>
  );
}
