import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardPlus,
  Clock3,
  Factory,
  Loader2,
  Save,
} from 'lucide-react';
import {
  Apontamento,
  FaltaItem,
  NaoConformidadeItem,
  ObservacaoItem,
  ParadaFaltaMaterialItem,
  ParadaMaquinaItem,
  Setor,
  Turno,
  User,
} from '../types';
import { apontamentoService } from '../services/apontamentoService';
import { formatDateBR } from '../utils/formatters';
import { ParadasFaltaMaterialSection } from '../components/apontamento/ParadasFaltaMaterialSection';
import { ParadasMaquinaSection } from '../components/apontamento/ParadasMaquinaSection';
import { NaoConformidadesSection } from '../components/apontamento/NaoConformidadesSection';
import { FaltasSection } from '../components/apontamento/FaltasSection';
import { ObservacoesSection } from '../components/apontamento/ObservacoesSection';
import { ReviewSection } from '../components/apontamento/ReviewSection';
import { SummaryHeader } from '../components/apontamento/SummaryHeader';
import { Toast, ToastMessage } from '../components/common/Toast';
import {
  Badge,
  Button,
  DateInput,
  Field,
  PageContainer,
  PageHeader,
  Stepper,
  Surface,
} from '../components/common/ui';

interface Props {
  user: User;
  onNavigateToHistory: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type OccurrenceSector = 'PINTURA' | 'SOLDA' | 'MONTAGEM NUCLEO' | 'CORTE LASER' | 'FERRAGEM';

const TURNOS: Turno[] = ['1º turno', '2º turno'];
const CORTE_AREAS: OccurrenceSector[] = ['CORTE LASER', 'FERRAGEM'];
const OCCURRENCE_SECTORS = new Set<OccurrenceSector>(['PINTURA', 'SOLDA', 'MONTAGEM NUCLEO', 'CORTE LASER', 'FERRAGEM']);
const SECTOR_LABELS: Record<OccurrenceSector, string> = {
  PINTURA: 'Pintura',
  SOLDA: 'Solda',
  'MONTAGEM NUCLEO': 'Montagem do Núcleo',
  'CORTE LASER': 'Corte do Laser',
  FERRAGEM: 'Ferragem',
};
const stepLabels = ['Falta de material', 'Máquina quebrada', 'Não conformidade', 'Faltas', 'Observações', 'Revisão e envio'] as const;

function todayLocalYmd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const clone = <T,>(items: T[] | undefined): T[] => (items || []).map((item) => ({ ...item }));
const sameTurn = (value: string | undefined, turno: Turno) => String(value || '').trim().toLowerCase() === turno.toLowerCase();

export const TurnOccurrencePage: React.FC<Props> = ({ user, onNavigateToHistory }) => {
  const isCorteFerragemLogin = user.setor === 'CORTE LASER';
  const defaultSector = OCCURRENCE_SECTORS.has(String(user.setor || '') as OccurrenceSector) && !isCorteFerragemLogin
    ? String(user.setor) as OccurrenceSector
    : null;

  const [selectedTurn, setSelectedTurn] = useState<Turno | null>(null);
  const [selectedSector, setSelectedSector] = useState<OccurrenceSector | null>(defaultSector);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayLocalYmd);
  const [record, setRecord] = useState<Apontamento | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [paradasFaltaMaterial, setParadasFaltaMaterial] = useState<ParadaFaltaMaterialItem[]>([]);
  const [paradasMaquina, setParadasMaquina] = useState<ParadaMaquinaItem[]>([]);
  const [naoConformidades, setNaoConformidades] = useState<NaoConformidadeItem[]>([]);
  const [faltas, setFaltas] = useState<FaltaItem[]>([]);
  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [draftResetVersion, setDraftResetVersion] = useState(0);

  const activeSector = selectedSector;
  const activeSectorLabel = activeSector ? SECTOR_LABELS[activeSector] : null;
  const pageSectorLabel = isCorteFerragemLogin ? 'Corte do Laser/Ferragem' : (defaultSector ? SECTOR_LABELS[defaultSector] : String(user.setor || 'Setor'));
  const reviewUser = useMemo<User>(() => ({ ...user, setor: (activeSector || user.setor) as Setor }), [activeSector, user]);

  useEffect(() => {
    if (!registrationOpen || !selectedTurn || !activeSector) return;
    let active = true;

    const load = async () => {
      setLoadingRecord(true);
      setLoadError(null);
      setSaveError(null);
      try {
        const existing = await apontamentoService.getByDateAndSector(selectedDate, activeSector, user.id);
        if (!active) return;
        setRecord(existing);
        const pick = <T extends { turno?: Turno }>(items: T[] | undefined): T[] => clone(items).filter((item) => sameTurn(item.turno, selectedTurn));
        setParadasFaltaMaterial(pick(existing?.paradasFaltaMaterial));
        setParadasMaquina(pick(existing?.paradasMaquina));
        setNaoConformidades(pick(existing?.naoConformidades));
        setFaltas(pick(existing?.faltas));
        setObservacoes(pick(existing?.observacoes));
        setCurrentStep(1);
        setDraftResetVersion((value) => value + 1);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Não foi possível carregar as ocorrências desta data.';
        setLoadError(message);
        setRecord(null);
        setParadasFaltaMaterial([]);
        setParadasMaquina([]);
        setNaoConformidades([]);
        setFaltas([]);
        setObservacoes([]);
      } finally {
        if (active) setLoadingRecord(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [activeSector, registrationOpen, selectedDate, selectedTurn, user.id]);

  const producoes = record?.producoes || [];
  const productionForTurn = useMemo(() => {
    if (!selectedTurn) return producoes;
    const productionTurn = selectedTurn === '1º turno' ? '1º' : '2º';
    const scoped = producoes.filter((item) => item.turno === productionTurn);
    return scoped.length ? scoped : producoes.filter((item) => !item.turno);
  }, [producoes, selectedTurn]);
  const totalProducao = productionForTurn.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalFaltas = faltas.reduce((sum, item) => sum + (typeof item.quantidade === 'number' ? item.quantidade : 1), 0);
  const turnAlreadyDone = selectedTurn === '1º turno' ? record?.turno1Complementado === true : record?.turno2Complementado === true;

  const steps = [
    { id: 'material', label: 'Material', description: 'Falta de material', count: paradasFaltaMaterial.length },
    { id: 'maquina', label: 'Máquina', description: 'Quebra', count: paradasMaquina.length },
    { id: 'nc', label: 'Não conform.', description: 'Qualidade', count: naoConformidades.length },
    { id: 'faltas', label: 'Faltas', description: 'Colaboradores', count: faltas.length },
    { id: 'observacoes', label: 'Observações', description: 'Meta e jornada', count: observacoes.length },
    { id: 'revisao', label: 'Revisão', description: 'Conferir e enviar' },
  ];

  const goToStep = (step: Step) => { if (!isSaving) setCurrentStep(step); };
  const goNext = () => currentStep < 6 && goToStep((currentStep + 1) as Step);
  const goBack = () => currentStep > 1 && goToStep((currentStep - 1) as Step);

  const openRegistration = () => {
    if (!selectedTurn || !activeSector) return;
    setSelectedDate(todayLocalYmd());
    setRegistrationOpen(true);
    setCurrentStep(1);
  };

  const closeRegistration = () => {
    if (isSaving) return;
    setRegistrationOpen(false);
    setRecord(null);
    setLoadError(null);
    setSaveError(null);
    setCurrentStep(1);
  };

  const handleSave = async () => {
    if (!selectedTurn || !activeSector || isSaving || !OCCURRENCE_SECTORS.has(activeSector)) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const stampTurn = <T extends { turno?: Turno }>(items: T[]): T[] => items.map((item) => ({ ...item, turno: selectedTurn }));
      const updated = await apontamentoService.saveOccurrences({
        data: selectedDate,
        setor: activeSector,
        turno: selectedTurn,
        paradasFaltaMaterial: stampTurn(paradasFaltaMaterial),
        paradasMaquina: stampTurn(paradasMaquina),
        naoConformidades: stampTurn(naoConformidades),
        faltas: stampTurn(faltas),
        observacoes: stampTurn(observacoes),
      });
      const finishedTurn = selectedTurn;
      const finishedSectorLabel = activeSectorLabel || activeSector;
      setRecord(updated);
      setRegistrationOpen(false);
      setSelectedTurn(null);
      if (isCorteFerragemLogin) setSelectedSector(null);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: `${finishedSectorLabel} · ${finishedTurn} registrado com sucesso em ${formatDateBR(selectedDate)}. ${updated.producoes.length ? 'A produção já está vinculada ao apontamento.' : 'As ocorrências ficarão salvas até a produção ser importada.'}`,
        action: updated.complementado ? { label: 'Ver histórico', onClick: onNavigateToHistory } : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar as ocorrências.';
      setSaveError(message);
      setToast({ id: Date.now().toString(), type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!registrationOpen) {
    return (
      <PageContainer className="app-page space-y-5 py-6 sm:py-8">
        <PageHeader
          icon={<ClipboardPlus className="size-5" aria-hidden="true" />}
          eyebrow="Registro por turno"
          title="Ocorrências do apontamento"
          description="Selecione o turno antes de iniciar. As ocorrências podem ser registradas mesmo antes da importação da produção."
          metadata={<Badge variant="neutral">{pageSectorLabel}</Badge>}
        />

        <Surface tone="base" padding="md" className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">1. Selecione o turno</p>
            <h2 className="mt-1 text-lg font-black text-[var(--text-primary)]">Qual turno você está apontando?</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">O turno escolhido será aplicado a todas as ocorrências registradas.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TURNOS.map((turno) => {
              const active = selectedTurn === turno;
              return (
                <button
                  key={turno}
                  type="button"
                  onClick={() => setSelectedTurn(turno)}
                  aria-pressed={active}
                  className={`rounded-2xl border p-4 text-left transition-colors ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--accent-border)]'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {active ? <CheckCircle2 className="h-5 w-5 text-[var(--accent)]" /> : <Clock3 className="h-5 w-5 text-[var(--text-tertiary)]" />}
                      <div>
                        <p className="font-black text-[var(--text-primary)]">{turno}</p>
                        <p className="mt-0.5 text-xs font-semibold text-[var(--text-tertiary)]">{active ? 'Selecionado' : 'Clique para selecionar'}</p>
                      </div>
                    </div>
                    {active && <Badge variant="success">Selecionado</Badge>}
                  </div>
                </button>
              );
            })}
          </div>

          {isCorteFerragemLogin && (
            <div className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">2. Selecione o setor</p>
                <h2 className="mt-1 text-lg font-black text-[var(--text-primary)]">Onde a ocorrência aconteceu?</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Corte do Laser e Ferragem usam o mesmo login, mas os registros permanecem separados no sistema.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {CORTE_AREAS.map((sector) => {
                  const active = selectedSector === sector;
                  return (
                    <button
                      key={sector}
                      type="button"
                      onClick={() => setSelectedSector(sector)}
                      aria-pressed={active}
                      className={`rounded-2xl border p-4 text-left transition-colors ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--accent-border)]'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {active ? <CheckCircle2 className="h-5 w-5 text-[var(--accent)]" /> : <Factory className="h-5 w-5 text-[var(--text-tertiary)]" />}
                          <div>
                            <p className="font-black text-[var(--text-primary)]">{SECTOR_LABELS[sector]}</p>
                            <p className="mt-0.5 text-xs font-semibold text-[var(--text-tertiary)]">{active ? 'Setor selecionado' : 'Clique para selecionar'}</p>
                          </div>
                        </div>
                        {active && <Badge variant="success">Selecionado</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{isCorteFerragemLogin ? '3. Registrar' : '2. Registrar'}</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                  {!selectedTurn
                    ? 'Selecione um turno para continuar'
                    : !activeSector
                      ? 'Selecione Corte do Laser ou Ferragem para continuar'
                      : `${activeSectorLabel} · ${selectedTurn} pronto para registrar`}
                </p>
              </div>
              <Button disabled={!selectedTurn || !activeSector} leftIcon={<ClipboardPlus className="h-4 w-4" />} onClick={openRegistration}>
                Registrar ocorrências
              </Button>
            </div>
          </div>
        </Surface>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="app-page space-y-5 py-6 sm:py-8" aria-busy={loadingRecord || isSaving || undefined}>
      <PageHeader
        icon={<ClipboardPlus className="size-5" aria-hidden="true" />}
        eyebrow="Registro de ocorrências"
        title={`${activeSectorLabel || activeSector} · ${selectedTurn}`}
        description="A data vem preenchida com o dia atual, mas pode ser alterada. A produção pode ser importada depois sem apagar estas informações."
        metadata={<span className="flex flex-wrap items-center gap-2"><Badge variant="neutral">{activeSectorLabel || activeSector}</Badge><Badge variant="info">{selectedTurn}</Badge></span>}
        actions={<Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />} disabled={isSaving} onClick={closeRegistration}>{isCorteFerragemLogin ? 'Trocar turno/setor' : 'Trocar turno'}</Button>}
      />

      <Surface tone="base" padding="md" className="grid gap-4 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-end">
        <Field label="Data" hint="Por padrão, o sistema usa a data de hoje.">
          <DateInput value={selectedDate} disabled={isSaving} onChange={(event) => setSelectedDate(event.target.value)} />
        </Field>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--accent)]" />
            <strong className="text-sm text-[var(--text-primary)]">{formatDateBR(selectedDate)}</strong>
            <Badge variant="neutral">{activeSectorLabel || activeSector}</Badge>
            {turnAlreadyDone && <Badge variant="success">Turno já registrado</Badge>}
            {record?.producoes.length ? <Badge variant="success">Produção importada</Badge> : <Badge variant="warning">Produção aguardando importação</Badge>}
          </div>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">Se já houver ocorrências neste setor/turno/data, elas serão carregadas para conferência e atualização.</p>
        </div>
      </Surface>

      {loadingRecord ? (
        <Surface tone="base" padding="lg" className="flex min-h-48 items-center justify-center">
          <div role="status" className="flex items-center gap-3 text-sm font-bold text-[var(--text-secondary)]"><Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />Carregando ocorrências da data…</div>
        </Surface>
      ) : loadError ? (
        <Surface tone="base" padding="md">
          <div role="alert" className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{loadError}</div>
        </Surface>
      ) : (
        <>
          <Surface tone="base" padding="sm" className="filter-panel">
            <Stepper steps={steps} activeStep={currentStep - 1} onStepChange={(index) => goToStep((index + 1) as Step)} ariaLabel="Etapas do registro de ocorrências" />
          </Surface>
          <SummaryHeader totalProducao={totalProducao} totalParadasMaterial={paradasFaltaMaterial.length} totalParadasMaquina={paradasMaquina.length} totalNaoConformidades={naoConformidades.length} totalFaltas={totalFaltas} totalObservacoes={observacoes.length} />
          {!record?.producoes.length && (
            <Surface tone="muted" padding="sm" className="text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">Produção ainda não importada.</strong> Você pode finalizar as ocorrências normalmente; quando a Coordenação importar esta data, a produção será vinculada ao mesmo apontamento.
            </Surface>
          )}
          <div>
            <div hidden={currentStep !== 1}><ParadasFaltaMaterialSection key={`material-${activeSector}-${selectedDate}-${selectedTurn}-${draftResetVersion}`} itens={paradasFaltaMaterial} onAdd={(item) => setParadasFaltaMaterial((current) => [...current, item])} onUpdate={(item) => setParadasFaltaMaterial((current) => current.map((value) => value.id === item.id ? item : value))} onDelete={(id) => setParadasFaltaMaterial((current) => current.filter((value) => value.id !== id))} /></div>
            <div hidden={currentStep !== 2}><ParadasMaquinaSection key={`maquina-${activeSector}-${selectedDate}-${selectedTurn}-${draftResetVersion}`} itens={paradasMaquina} onAdd={(item) => setParadasMaquina((current) => [...current, item])} onUpdate={(item) => setParadasMaquina((current) => current.map((value) => value.id === item.id ? item : value))} onDelete={(id) => setParadasMaquina((current) => current.filter((value) => value.id !== id))} /></div>
            <div hidden={currentStep !== 3}><NaoConformidadesSection key={`nc-${activeSector}-${selectedDate}-${selectedTurn}-${draftResetVersion}`} itens={naoConformidades} onAdd={(item) => setNaoConformidades((current) => [...current, item])} onUpdate={(item) => setNaoConformidades((current) => current.map((value) => value.id === item.id ? item : value))} onDelete={(id) => setNaoConformidades((current) => current.filter((value) => value.id !== id))} /></div>
            <div hidden={currentStep !== 4}><FaltasSection key={`faltas-${activeSector}-${selectedDate}-${selectedTurn}-${draftResetVersion}`} faltas={faltas} onAdd={(item) => setFaltas((current) => [...current, item])} onUpdate={(item) => setFaltas((current) => current.map((value) => value.id === item.id ? item : value))} onDelete={(id) => setFaltas((current) => current.filter((value) => value.id !== id))} /></div>
            <div hidden={currentStep !== 5}><ObservacoesSection key={`obs-${activeSector}-${selectedDate}-${selectedTurn}-${draftResetVersion}`} observacoes={observacoes} onAdd={(item) => setObservacoes((current) => [...current, item])} onUpdate={(item) => setObservacoes((current) => current.map((value) => value.id === item.id ? item : value))} onDelete={(id) => setObservacoes((current) => current.filter((value) => value.id !== id))} /></div>
            <div hidden={currentStep !== 6}>
              <ReviewSection
                user={reviewUser}
                selectedDate={selectedDate}
                tipoBobina=""
                producoes={productionForTurn}
                paradasFaltaMaterial={paradasFaltaMaterial}
                paradasMaquina={paradasMaquina}
                naoConformidades={naoConformidades}
                faltas={faltas}
                observacoes={observacoes}
                onEditStep={(step) => {
                  if (step >= 2 && step <= 6) goToStep((step - 1) as Step);
                }}
                productionReadOnly
                showProduction={false}
              />
            </div>
          </div>
          {saveError && <div role="alert" className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{saveError}</div>}
          <div className="sticky-action-bar sticky bottom-3 z-20 rounded-2xl border p-3 backdrop-blur-2xl sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{activeSectorLabel || activeSector} · {selectedTurn} · Etapa {currentStep} de 6 · {stepLabels[currentStep - 1]}</p>
                <p className="mt-0.5 hidden text-xs text-[var(--text-tertiary)] sm:block">Nenhuma ocorrência é obrigatória. A produção será preservada ou vinculada quando for importada.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex">
                {currentStep > 1 && <Button variant="secondary" disabled={isSaving} leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={goBack}>Voltar</Button>}
                {currentStep < 6 ? <Button className={currentStep === 1 ? 'min-[380px]:col-span-2 sm:col-span-1' : undefined} rightIcon={<ArrowRight className="h-4 w-4" />} onClick={goNext}>Avançar</Button> : <Button isLoading={isSaving} loadingLabel="Salvando…" leftIcon={<Save className="h-4 w-4" />} onClick={() => void handleSave()}>Finalizar {selectedTurn}</Button>}
              </div>
            </div>
          </div>
        </>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </PageContainer>
  );
};
