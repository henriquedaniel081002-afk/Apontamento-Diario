import React, { useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Factory,
  Info,
  Save,
  Sparkles,
} from 'lucide-react';
import { FaltaItem, ObservacaoItem, ProducaoItem, TipoBobina, User } from '../types';
import { getTodayDateString } from '../utils/formatters';
import { apontamentoService } from '../services/apontamentoService';
import { FaltasSection } from '../components/apontamento/FaltasSection';
import { ObservacoesSection } from '../components/apontamento/ObservacoesSection';
import { ProducaoSection } from '../components/apontamento/ProducaoSection';
import { ReviewSection } from '../components/apontamento/ReviewSection';
import { SummaryHeader } from '../components/apontamento/SummaryHeader';
import { Toast, ToastMessage } from '../components/common/Toast';
import { Badge, Button, FieldError, Stepper, Surface } from '../components/common/ui';

interface ApontamentoPageProps {
  user: User;
  onNavigateToHistory: () => void;
}

type Step = 1 | 2 | 3 | 4;

interface ContextErrors {
  date?: string;
  setor?: string;
  tipoBobina?: string;
}

const getYesterdayDateString = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const stepLabels = ['Produção', 'Faltas e ausências', 'Observações', 'Revisão e envio'] as const;

export const ApontamentoPage: React.FC<ApontamentoPageProps> = ({ user, onNavigateToHistory }) => {
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [tipoBobina, setTipoBobina] = useState<TipoBobina | ''>('');
  const [producoes, setProducoes] = useState<ProducaoItem[]>([]);
  const [faltas, setFaltas] = useState<FaltaItem[]>([]);
  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [contextErrors, setContextErrors] = useState<ContextErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [draftResetVersion, setDraftResetVersion] = useState(0);

  const dateInputId = useId();
  const dateErrorId = `${dateInputId}-error`;
  const bobinaErrorId = `${dateInputId}-bobina-error`;
  const dateInputRef = useRef<HTMLInputElement>(null);
  const bobinaGroupRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  const totalProducao = producoes.reduce((sum, item) => sum + item.quantidade, 0);
  const totalFaltas = faltas.reduce((sum, item) => sum + item.quantidade, 0);
  const isBobinagem = user.setor === 'BOBINA AT/BT';

  const steps = [
    { id: 'producao', label: 'Produção', description: 'Potências e quantidades', count: producoes.length },
    { id: 'faltas', label: 'Faltas', description: 'Ausências por turno', count: faltas.length },
    { id: 'observacoes', label: 'Observações', description: 'Ocorrências da jornada', count: observacoes.length },
    { id: 'revisao', label: 'Revisão', description: 'Conferir e enviar' },
  ];

  const handleSave = async () => {
    if (savingRef.current) return;

    const nextErrors: ContextErrors = {};
    if (!selectedDate) nextErrors.date = 'Selecione a data do apontamento.';
    if (!user.setor) nextErrors.setor = 'O usuário atual não possui um setor configurado.';
    if (isBobinagem && !tipoBobina) nextErrors.tipoBobina = 'Selecione Bobina AT ou Bobina BT antes de salvar.';

    setContextErrors(nextErrors);
    setSaveError(null);

    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.date) {
        dateInputRef.current?.focus();
      } else if (nextErrors.tipoBobina) {
        bobinaGroupRef.current?.focus();
      }
      return;
    }

    const setor = user.setor;
    if (!setor) return;

    savingRef.current = true;
    setIsSaving(true);
    try {
      await apontamentoService.save({
        data: selectedDate,
        setor,
        tipoBobina: tipoBobina || undefined,
        userId: user.id,
        userName: user.name,
        producoes,
        faltas,
        observacoes,
      });

      setProducoes([]);
      setFaltas([]);
      setObservacoes([]);
      setTipoBobina('');
      setContextErrors({});
      setSaveError(null);
      setDraftResetVersion((version) => version + 1);
      setCurrentStep(1);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Apontamento salvo com sucesso.',
        action: {
          label: 'Ver histórico',
          onClick: onNavigateToHistory,
        },
      });
    } catch (error) {
      console.error('Error saving:', error);
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o apontamento. Tente novamente.';
      setSaveError(message);
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message,
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const goToStep = (step: Step) => {
    if (!isSaving) setCurrentStep(step);
  };

  const goNext = () => {
    if (currentStep < 4) goToStep((currentStep + 1) as Step);
  };

  const goBack = () => {
    if (currentStep > 1) goToStep((currentStep - 1) as Step);
  };

  return (
    <div className="app-page mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8" aria-busy={isSaving || undefined}>
      <Surface tone="raised" padding="lg" className="industrial-hero relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),transparent_65%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                <Sparkles aria-hidden="true" className="h-4 w-4" /> Novo registro
              </span>
              <Badge variant="neutral">{user.setor || 'Setor não definido'}</Badge>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Apontamento diário
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              Registre a jornada em quatro etapas. As informações ficam preservadas enquanto você navega ou ajusta a data.
            </p>
          </div>

          <div className="glass-panel w-full rounded-2xl p-4 lg:max-w-md">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor={dateInputId} className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <CalendarDays aria-hidden="true" className="h-4 w-4 text-[var(--accent)]" />
                Data do apontamento
              </label>
              <span className="text-xs font-medium text-[var(--danger)]">Obrigatória</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                ref={dateInputRef}
                id={dateInputId}
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setContextErrors((current) => ({ ...current, date: undefined }));
                }}
                aria-invalid={Boolean(contextErrors.date)}
                aria-describedby={contextErrors.date ? dateErrorId : undefined}
                className="field-control min-w-0 flex-1 [color-scheme:dark]"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedDate === getTodayDateString() ? 'primary' : 'secondary'}
                  onClick={() => {
                    setSelectedDate(getTodayDateString());
                    setContextErrors((current) => ({ ...current, date: undefined }));
                  }}
                >
                  Hoje
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedDate === getYesterdayDateString() ? 'primary' : 'secondary'}
                  onClick={() => {
                    setSelectedDate(getYesterdayDateString());
                    setContextErrors((current) => ({ ...current, date: undefined }));
                  }}
                >
                  Ontem
                </Button>
              </div>
            </div>
            {contextErrors.date && <FieldError id={dateErrorId} role="alert">{contextErrors.date}</FieldError>}
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[var(--text-tertiary)]">
              <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Alterar a data não apaga o rascunho atual.
            </p>
          </div>
        </div>
      </Surface>

      {isBobinagem && (
        <Surface tone="base" padding="md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Factory aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Tipo de bobina</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Defina a unidade operacional deste apontamento.</p>
              </div>
            </div>

            <div>
              <div
                ref={bobinaGroupRef}
                role="radiogroup"
                aria-label="Tipo de bobina"
                aria-invalid={Boolean(contextErrors.tipoBobina)}
                aria-describedby={contextErrors.tipoBobina ? bobinaErrorId : undefined}
                tabIndex={-1}
                className="grid grid-cols-2 gap-2 sm:w-72"
              >
                {(['AT', 'BT'] as TipoBobina[]).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    role="radio"
                    aria-checked={tipoBobina === tipo}
                    onClick={() => {
                      setTipoBobina(tipo);
                      setContextErrors((current) => ({ ...current, tipoBobina: undefined }));
                    }}
                    className={`min-h-11 rounded-xl border px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      tipoBobina === tipo
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-emerald-950'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Bobina {tipo}
                  </button>
                ))}
              </div>
              {contextErrors.tipoBobina && <FieldError id={bobinaErrorId} role="alert">{contextErrors.tipoBobina}</FieldError>}
            </div>
          </div>
        </Surface>
      )}

      {contextErrors.setor && (
        <div role="alert" className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
          {contextErrors.setor}
        </div>
      )}

      <Surface tone="base" padding="sm" className="filter-panel">
        <Stepper
          steps={steps}
          activeStep={currentStep - 1}
          onStepChange={(index) => goToStep((index + 1) as Step)}
          ariaLabel="Etapas do novo apontamento"
        />
      </Surface>

      <SummaryHeader
        totalProducao={totalProducao}
        totalFaltas={totalFaltas}
        totalObservacoes={observacoes.length}
      />

      <div>
        <div hidden={currentStep !== 1} aria-hidden={currentStep !== 1}>
          <ProducaoSection
            key={`producao-${user.id}-${draftResetVersion}`}
            user={user}
            producoes={producoes}
            onAdd={(item) => setProducoes((current) => [...current, item])}
            onUpdate={(item) => setProducoes((current) => current.map((existing) => existing.id === item.id ? item : existing))}
            onDelete={(id) => setProducoes((current) => current.filter((item) => item.id !== id))}
          />
        </div>

        <div hidden={currentStep !== 2} aria-hidden={currentStep !== 2}>
          <FaltasSection
            key={`faltas-${user.id}-${draftResetVersion}`}
            user={user}
            faltas={faltas}
            onAdd={(item) => setFaltas((current) => [...current, item])}
            onUpdate={(item) => setFaltas((current) => current.map((existing) => existing.id === item.id ? item : existing))}
            onDelete={(id) => setFaltas((current) => current.filter((item) => item.id !== id))}
          />
        </div>

        <div hidden={currentStep !== 3} aria-hidden={currentStep !== 3}>
          <ObservacoesSection
            key={`observacoes-${user.id}-${draftResetVersion}`}
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
            selectedDate={selectedDate}
            tipoBobina={tipoBobina}
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
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Etapa {currentStep} de 4 · {stepLabels[currentStep - 1]}
            </p>
            <p className="mt-0.5 hidden text-xs text-[var(--text-tertiary)] sm:block">
              Itens adicionados e campos em edição permanecem ao avançar ou voltar.
            </p>
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
                loadingLabel="Salvando..."
                leftIcon={<Save aria-hidden="true" className="h-4 w-4" />}
                onClick={handleSave}
              >
                <span className="sm:hidden">Salvar</span>
                <span className="hidden sm:inline">Salvar apontamento</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
