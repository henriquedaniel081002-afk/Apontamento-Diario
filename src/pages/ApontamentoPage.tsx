import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Inbox,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { Apontamento, FaltaItem, ObservacaoItem, User } from '../types';
import { apontamentoService } from '../services/apontamentoService';
import { formatDateBR } from '../utils/formatters';
import { FaltasSection } from '../components/apontamento/FaltasSection';
import { ObservacoesSection } from '../components/apontamento/ObservacoesSection';
import { ImportedProductionSection } from '../components/apontamento/ImportedProductionSection';
import { ReviewSection } from '../components/apontamento/ReviewSection';
import { SummaryHeader } from '../components/apontamento/SummaryHeader';
import { Toast, ToastMessage } from '../components/common/Toast';
import { Badge, Button, EmptyState, Stepper, Surface } from '../components/common/ui';

interface ApontamentoPageProps {
  user: User;
  onNavigateToHistory: () => void;
}

type Step = 1 | 2 | 3 | 4;

const stepLabels = ['Produção importada', 'Faltas e ausências', 'Observações', 'Revisão e envio'] as const;

function recordLabel(record: Apontamento): string {
  if (record.setor === 'BOBINA AT' || record.setor === 'BOBINA BT') return record.setor.replace('BOBINA', 'Bobina');
  if (record.setor === 'MONTAGEM FINAL') {
    const line = record.producoes[0]?.linha || record.linhasPermitidas?.[0];
    return `Montagem Final${line ? ` ${line}` : ''}`;
  }
  if (record.setor === 'MPA') {
    const line = record.producoes[0]?.linha || record.linhasPermitidas?.[0];
    return `MPA${line ? ` ${line}` : ''}`;
  }
  const labels: Record<string, string> = {
    'CORTE LASER': 'Corte do Laser',
    ISOLANTE: 'Isolante',
    'MONTAGEM NUCLEO': 'Montagem do Núcleo',
    PINTURA: 'Pintura',
    SOLDA: 'Solda',
    EPOXI: 'Epóxi',
  };
  return labels[record.setor] || String(record.setor);
}

export const ApontamentoPage: React.FC<ApontamentoPageProps> = ({ user, onNavigateToHistory }) => {
  const [pendingImports, setPendingImports] = useState<Apontamento[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [faltas, setFaltas] = useState<FaltaItem[]>([]);
  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [draftResetVersion, setDraftResetVersion] = useState(0);

  const selected = useMemo(
    () => pendingImports.find((record) => record.id === selectedId) || pendingImports[0] || null,
    [pendingImports, selectedId],
  );

  const loadPending = useCallback(async (showFeedback = false) => {
    setLoading(true);
    setLoadError(null);
    try {
      const records = await apontamentoService.getPendingImported();
      setPendingImports(records);
      setSelectedId((current) => records.some((record) => record.id === current) ? current : records[0]?.id || null);
      if (showFeedback) {
        setToast({
          id: Date.now().toString(),
          type: 'success',
          message: records.length
            ? `${records.length} apontamento(s) aguardando complemento.`
            : 'Nenhum apontamento aguardando faltas/observações.',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar a produção importada.';
      setLoadError(message);
      if (showFeedback) setToast({ id: Date.now().toString(), type: 'error', message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!selected) {
      setFaltas([]);
      setObservacoes([]);
      return;
    }
    setFaltas(selected.faltas.map((item) => ({ ...item })));
    setObservacoes(selected.observacoes.map((item) => ({ ...item })));
    setCurrentStep(1);
    setSaveError(null);
    setDraftResetVersion((version) => version + 1);
  }, [selected?.id]);

  const producoes = selected?.producoes || [];
  const totalProducao = producoes.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalFaltas = faltas.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

  const steps = [
    { id: 'producao', label: 'Produção', description: 'Dados importados', count: producoes.length },
    { id: 'faltas', label: 'Faltas', description: 'Ausências por turno', count: faltas.length },
    { id: 'observacoes', label: 'Observações', description: 'Ocorrências da jornada', count: observacoes.length },
    { id: 'revisao', label: 'Revisão', description: 'Conferir e enviar' },
  ];

  const selectRecord = (record: Apontamento) => {
    if (isSaving || record.id === selected?.id) return;
    setSelectedId(record.id);
  };

  const handleSave = async () => {
    if (!selected || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await apontamentoService.completeImported(selected.id, { faltas, observacoes });
      const completedId = selected.id;
      const remaining = pendingImports.filter((record) => record.id !== completedId);
      setPendingImports(remaining);
      setSelectedId(remaining[0]?.id || null);
      setFaltas([]);
      setObservacoes([]);
      setCurrentStep(1);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: `Faltas e observações de ${formatDateBR(selected.data)} salvas com sucesso.`,
        action: { label: 'Ver histórico', onClick: onNavigateToHistory },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar faltas e observações.';
      setSaveError(message);
      setToast({ id: Date.now().toString(), type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const goToStep = (step: Step) => {
    if (!isSaving) setCurrentStep(step);
  };
  const goNext = () => currentStep < 4 && goToStep((currentStep + 1) as Step);
  const goBack = () => currentStep > 1 && goToStep((currentStep - 1) as Step);

  return (
    <div className="app-page mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8" aria-busy={loading || isSaving || undefined}>
      <Surface tone="raised" padding="lg" className="industrial-hero relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),transparent_65%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                <Sparkles aria-hidden="true" className="h-4 w-4" /> Complemento diário
              </span>
              <Badge variant="neutral">{user.setor || 'Setor não definido'}</Badge>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Faltas e observações
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              A produção é carregada pela Coordenação. Confira os valores importados e complete somente as faltas e observações do dia.
            </p>
          </div>

          <div className="glass-panel w-full rounded-2xl p-4 lg:max-w-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Aguardando complemento</p>
                <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{pendingImports.length}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={loading || isSaving}
                leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />}
                onClick={() => void loadPending(true)}
              >
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </Surface>

      {loading ? (
        <Surface tone="base" padding="lg" className="flex min-h-56 items-center justify-center">
          <div role="status" className="flex items-center gap-3 text-sm font-bold text-[var(--text-secondary)]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" aria-hidden="true" />
            Carregando produção importada…
          </div>
        </Surface>
      ) : loadError ? (
        <Surface tone="base" padding="lg">
          <EmptyState
            icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
            title="Não foi possível carregar os apontamentos"
            description={loadError}
            action={<Button onClick={() => void loadPending(true)}>Tentar novamente</Button>}
          />
        </Surface>
      ) : pendingImports.length === 0 ? (
        <Surface tone="base" padding="lg">
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
            title="Nenhum apontamento aguardando complemento"
            description="Quando a Coordenação importar uma produção para sua unidade, o cartão do dia aparecerá aqui para você adicionar faltas e observações."
            action={
              <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadPending(true)}>
                Verificar novamente
              </Button>
            }
          />
        </Surface>
      ) : selected && (
        <>
          <Surface tone="base" padding="md" aria-label="Apontamentos aguardando complemento">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Selecione o dia para completar</h2>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Produções já importadas e bloqueadas para edição.</p>
              </div>
              {pendingImports.length > 1 && <Badge variant="warning">{pendingImports.length} pendentes</Badge>}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pendingImports.map((record) => {
                const active = record.id === selected.id;
                const total = record.producoes.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => selectRecord(record)}
                    aria-pressed={active}
                    className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--accent-border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-black ${active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                        {formatDateBR(record.data)}
                      </span>
                      {active && <Badge variant="success">Selecionado</Badge>}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{recordLabel(record)}</p>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">{total} unidades · {record.producoes.length} combinação(ões)</p>
                  </button>
                );
              })}
            </div>
          </Surface>

          <Surface tone="raised" padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <CalendarDays aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Complete o apontamento de</p>
                <h2 className="mt-1 text-lg font-black text-[var(--text-primary)]">{formatDateBR(selected.data)} · {recordLabel(selected)}</h2>
              </div>
            </div>
            <Badge variant="warning">Aguardando faltas/observações</Badge>
          </Surface>

          <Surface tone="base" padding="sm" className="filter-panel">
            <Stepper
              steps={steps}
              activeStep={currentStep - 1}
              onStepChange={(index) => goToStep((index + 1) as Step)}
              ariaLabel="Etapas do complemento do apontamento"
            />
          </Surface>

          <SummaryHeader
            totalProducao={totalProducao}
            totalFaltas={totalFaltas}
            totalObservacoes={observacoes.length}
          />

          <div>
            <div hidden={currentStep !== 1} aria-hidden={currentStep !== 1}>
              <ImportedProductionSection producoes={producoes} />
            </div>

            <div hidden={currentStep !== 2} aria-hidden={currentStep !== 2}>
              <FaltasSection
                key={`faltas-${selected.id}-${draftResetVersion}`}
                user={user}
                faltas={faltas}
                onAdd={(item) => setFaltas((current) => [...current, item])}
                onUpdate={(item) => setFaltas((current) => current.map((existing) => existing.id === item.id ? item : existing))}
                onDelete={(id) => setFaltas((current) => current.filter((item) => item.id !== id))}
              />
            </div>

            <div hidden={currentStep !== 3} aria-hidden={currentStep !== 3}>
              <ObservacoesSection
                key={`observacoes-${selected.id}-${draftResetVersion}`}
                user={user}
                observacoes={observacoes}
                onAdd={(item) => setObservacoes((current) => [...current, item])}
                onUpdate={(item) => setObservacoes((current) => current.map((existing) => existing.id === item.id ? item : existing))}
                onDelete={(id) => setObservacoes((current) => current.filter((item) => item.id !== id))}
              />
            </div>

            <div hidden={currentStep !== 4} aria-hidden={currentStep !== 4}>
              <ReviewSection
                user={user}
                selectedDate={selected.data}
                tipoBobina={selected.tipoBobina || ''}
                producoes={producoes}
                faltas={faltas}
                observacoes={observacoes}
                onEditStep={goToStep}
              />
            </div>
          </div>

          {saveError && (
            <div role="alert" className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
              {saveError}
            </div>
          )}

          <div className="sticky-action-bar sticky bottom-3 z-20 rounded-2xl border p-3 backdrop-blur-2xl sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Etapa {currentStep} de 4 · {stepLabels[currentStep - 1]}</p>
                <p className="mt-0.5 hidden text-xs text-[var(--text-tertiary)] sm:block">A produção não pode ser alterada pelo apontador.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSaving}
                    leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
                    onClick={goBack}
                  >
                    Voltar
                  </Button>
                )}
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    variant="primary"
                    className={currentStep === 1 ? 'col-span-2 sm:col-span-1' : undefined}
                    rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}
                    onClick={goNext}
                  >
                    Avançar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    isLoading={isSaving}
                    loadingLabel="Salvando…"
                    leftIcon={<Save aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => void handleSave()}
                  >
                    Salvar faltas/observações
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
