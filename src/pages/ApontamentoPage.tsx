import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardCheck, Inbox, Loader2, RefreshCw, Save, Sparkles } from 'lucide-react';
import { Apontamento, FaltaItem, NaoConformidadeItem, ObservacaoItem, ParadaFaltaMaterialItem, ParadaMaquinaItem, User } from '../types';
import { apontamentoService } from '../services/apontamentoService';
import { formatDateBR } from '../utils/formatters';
import { ImportedProductionSection } from '../components/apontamento/ImportedProductionSection';
import { ParadasFaltaMaterialSection } from '../components/apontamento/ParadasFaltaMaterialSection';
import { ParadasMaquinaSection } from '../components/apontamento/ParadasMaquinaSection';
import { NaoConformidadesSection } from '../components/apontamento/NaoConformidadesSection';
import { FaltasSection } from '../components/apontamento/FaltasSection';
import { ObservacoesSection } from '../components/apontamento/ObservacoesSection';
import { ReviewSection } from '../components/apontamento/ReviewSection';
import { SummaryHeader } from '../components/apontamento/SummaryHeader';
import { Toast, ToastMessage } from '../components/common/Toast';
import { Badge, Button, EmptyState, Stepper, Surface } from '../components/common/ui';

interface Props { user: User; onNavigateToHistory: () => void; }
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const stepLabels = ['Produção importada', 'Falta de material', 'Máquina quebrada', 'Não conformidade', 'Faltas', 'Observações', 'Revisão e envio'] as const;

function recordLabel(record: Apontamento): string {
  if (record.setor === 'BOBINA AT' || record.setor === 'BOBINA BT') return record.setor.replace('BOBINA', 'Bobina');
  if (record.setor === 'MONTAGEM FINAL') { const line = record.producoes[0]?.linha || record.linhasPermitidas?.[0]; return `Montagem Final${line ? ` ${line}` : ''}`; }
  if (record.setor === 'MPA') { const line = record.producoes[0]?.linha || record.linhasPermitidas?.[0]; return `MPA${line ? ` ${line}` : ''}`; }
  const labels: Record<string, string> = { 'CORTE LASER': 'Corte do Laser', ISOLANTE: 'Isolante', 'MONTAGEM NUCLEO': 'Montagem do Núcleo', PINTURA: 'Pintura', SOLDA: 'Solda', EPOXI: 'Epóxi' };
  return labels[record.setor] || String(record.setor);
}

const clone = <T,>(items: T[] | undefined): T[] => (items || []).map((item) => ({ ...item }));

export const ApontamentoPage: React.FC<Props> = ({ user, onNavigateToHistory }) => {
  const [pendingImports, setPendingImports] = useState<Apontamento[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [paradasFaltaMaterial, setParadasFaltaMaterial] = useState<ParadaFaltaMaterialItem[]>([]);
  const [paradasMaquina, setParadasMaquina] = useState<ParadaMaquinaItem[]>([]);
  const [naoConformidades, setNaoConformidades] = useState<NaoConformidadeItem[]>([]);
  const [faltas, setFaltas] = useState<FaltaItem[]>([]);
  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [draftResetVersion, setDraftResetVersion] = useState(0);

  const selected = useMemo(() => pendingImports.find((r) => r.id === selectedId) || pendingImports[0] || null, [pendingImports, selectedId]);
  const loadPending = useCallback(async (showFeedback = false) => {
    setLoading(true); setLoadError(null);
    try {
      const records = await apontamentoService.getPendingImported();
      setPendingImports(records);
      setSelectedId((current) => records.some((r) => r.id === current) ? current : records[0]?.id || null);
      if (showFeedback) setToast({ id: Date.now().toString(), type: 'success', message: records.length ? `${records.length} apontamento(s) aguardando complemento.` : 'Nenhum apontamento aguardando complemento.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar a produção importada.';
      setLoadError(message); if (showFeedback) setToast({ id: Date.now().toString(), type: 'error', message });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadPending(); }, [loadPending]);
  useEffect(() => {
    if (!selected) { setParadasFaltaMaterial([]); setParadasMaquina([]); setNaoConformidades([]); setFaltas([]); setObservacoes([]); return; }
    setParadasFaltaMaterial(clone(selected.paradasFaltaMaterial));
    setParadasMaquina(clone(selected.paradasMaquina));
    setNaoConformidades(clone(selected.naoConformidades));
    setFaltas(clone(selected.faltas));
    setObservacoes(clone(selected.observacoes));
    setCurrentStep(1); setSaveError(null); setDraftResetVersion((v) => v + 1);
  }, [selected?.id]);

  const producoes = selected?.producoes || [];
  const totalProducao = producoes.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalFaltas = faltas.reduce((sum, item) => sum + (typeof item.quantidade === 'number' ? item.quantidade : 1), 0);
  const steps = [
    { id: 'producao', label: 'Produção', description: 'Dados importados', count: producoes.length },
    { id: 'material', label: 'Material', description: 'Falta de material', count: paradasFaltaMaterial.length },
    { id: 'maquina', label: 'Máquina', description: 'Quebra', count: paradasMaquina.length },
    { id: 'nc', label: 'Não conform.', description: 'Qualidade', count: naoConformidades.length },
    { id: 'faltas', label: 'Faltas', description: 'Colaboradores', count: faltas.length },
    { id: 'observacoes', label: 'Observações', description: 'Meta e jornada', count: observacoes.length },
    { id: 'revisao', label: 'Revisão', description: 'Conferir e enviar' },
  ];

  const goToStep = (step: Step) => { if (!isSaving) setCurrentStep(step); };
  const goNext = () => currentStep < 7 && goToStep((currentStep + 1) as Step);
  const goBack = () => currentStep > 1 && goToStep((currentStep - 1) as Step);

  const handleSave = async () => {
    if (!selected || isSaving) return;
    setIsSaving(true); setSaveError(null);
    try {
      await apontamentoService.completeImported(selected.id, { paradasFaltaMaterial, paradasMaquina, naoConformidades, faltas, observacoes });
      const remaining = pendingImports.filter((r) => r.id !== selected.id);
      setPendingImports(remaining); setSelectedId(remaining[0]?.id || null); setCurrentStep(1);
      setToast({ id: Date.now().toString(), type: 'success', message: `Apontamento de ${formatDateBR(selected.data)} finalizado com sucesso.`, action: { label: 'Ver histórico', onClick: onNavigateToHistory } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível finalizar o apontamento.';
      setSaveError(message); setToast({ id: Date.now().toString(), type: 'error', message });
    } finally { setIsSaving(false); }
  };

  return <div className="app-page mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8" aria-busy={loading || isSaving || undefined}>
    <Surface tone="raised" padding="lg" className="industrial-hero relative overflow-hidden"><div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),transparent_65%)]" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]"><Sparkles className="h-4 w-4" /> Complemento diário</span><Badge variant="neutral">{user.setor || 'Setor não definido'}</Badge></div><h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">Ocorrências do apontamento</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Confira a produção importada e registre somente as ocorrências que realmente aconteceram. Nenhuma categoria é obrigatória.</p></div><div className="glass-panel w-full rounded-2xl p-4 lg:max-w-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Aguardando complemento</p><p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{pendingImports.length}</p></div><Button size="sm" variant="secondary" disabled={loading || isSaving} leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />} onClick={() => void loadPending(true)}>Atualizar</Button></div></div></div></Surface>

    {loading ? <Surface tone="base" padding="lg" className="flex min-h-56 items-center justify-center"><div role="status" className="flex items-center gap-3 text-sm font-bold text-[var(--text-secondary)]"><Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />Carregando produção importada…</div></Surface>
    : loadError ? <Surface tone="base" padding="lg"><EmptyState icon={<Inbox className="h-6 w-6" />} title="Não foi possível carregar os apontamentos" description={loadError} action={<Button onClick={() => void loadPending(true)}>Tentar novamente</Button>} /></Surface>
    : pendingImports.length === 0 ? <Surface tone="base" padding="lg"><EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="Nenhum apontamento aguardando complemento" description="Quando a Coordenação importar uma produção para sua unidade, o registro aparecerá aqui para você complementar as ocorrências do dia." action={<Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadPending(true)}>Verificar novamente</Button>} /></Surface>
    : selected && <>
      <Surface tone="base" padding="md"><div className="mb-3"><h2 className="text-sm font-bold text-[var(--text-primary)]">Selecione o dia para completar</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">A produção permanece bloqueada para edição.</p></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{pendingImports.map((record) => { const active = record.id === selected.id; const total = record.producoes.reduce((sum, item) => sum + Number(item.quantidade || 0), 0); return <button key={record.id} type="button" onClick={() => !isSaving && setSelectedId(record.id)} aria-pressed={active} className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--accent-border)]'}`}><div className="flex items-center justify-between gap-2"><span className={`text-sm font-black ${active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{formatDateBR(record.data)}</span>{active && <Badge variant="success">Selecionado</Badge>}</div><p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{recordLabel(record)}</p><p className="mt-2 text-xs text-[var(--text-tertiary)]">{total} unidades · {record.producoes.length} combinação(ões)</p></button>; })}</div></Surface>
      <Surface tone="raised" padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><CalendarDays className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Complete o apontamento de</p><h2 className="mt-1 text-lg font-black text-[var(--text-primary)]">{formatDateBR(selected.data)} · {recordLabel(selected)}</h2></div></div><Badge variant="warning">Aguardando complemento</Badge></Surface>
      <Surface tone="base" padding="sm" className="filter-panel"><Stepper steps={steps} activeStep={currentStep - 1} onStepChange={(index) => goToStep((index + 1) as Step)} ariaLabel="Etapas do complemento do apontamento" /></Surface>
      <SummaryHeader totalProducao={totalProducao} totalParadasMaterial={paradasFaltaMaterial.length} totalParadasMaquina={paradasMaquina.length} totalNaoConformidades={naoConformidades.length} totalFaltas={totalFaltas} totalObservacoes={observacoes.length} />
      <div>
        <div hidden={currentStep !== 1}><ImportedProductionSection producoes={producoes} /></div>
        <div hidden={currentStep !== 2}><ParadasFaltaMaterialSection key={`material-${selected.id}-${draftResetVersion}`} itens={paradasFaltaMaterial} onAdd={(item) => setParadasFaltaMaterial((c) => [...c, item])} onUpdate={(item) => setParadasFaltaMaterial((c) => c.map((x) => x.id === item.id ? item : x))} onDelete={(id) => setParadasFaltaMaterial((c) => c.filter((x) => x.id !== id))} /></div>
        <div hidden={currentStep !== 3}><ParadasMaquinaSection key={`maquina-${selected.id}-${draftResetVersion}`} itens={paradasMaquina} onAdd={(item) => setParadasMaquina((c) => [...c, item])} onUpdate={(item) => setParadasMaquina((c) => c.map((x) => x.id === item.id ? item : x))} onDelete={(id) => setParadasMaquina((c) => c.filter((x) => x.id !== id))} /></div>
        <div hidden={currentStep !== 4}><NaoConformidadesSection key={`nc-${selected.id}-${draftResetVersion}`} itens={naoConformidades} onAdd={(item) => setNaoConformidades((c) => [...c, item])} onUpdate={(item) => setNaoConformidades((c) => c.map((x) => x.id === item.id ? item : x))} onDelete={(id) => setNaoConformidades((c) => c.filter((x) => x.id !== id))} /></div>
        <div hidden={currentStep !== 5}><FaltasSection key={`faltas-${selected.id}-${draftResetVersion}`} faltas={faltas} onAdd={(item) => setFaltas((c) => [...c, item])} onUpdate={(item) => setFaltas((c) => c.map((x) => x.id === item.id ? item : x))} onDelete={(id) => setFaltas((c) => c.filter((x) => x.id !== id))} /></div>
        <div hidden={currentStep !== 6}><ObservacoesSection key={`obs-${selected.id}-${draftResetVersion}`} observacoes={observacoes} onAdd={(item) => setObservacoes((c) => [...c, item])} onUpdate={(item) => setObservacoes((c) => c.map((x) => x.id === item.id ? item : x))} onDelete={(id) => setObservacoes((c) => c.filter((x) => x.id !== id))} /></div>
        <div hidden={currentStep !== 7}><ReviewSection user={user} selectedDate={selected.data} tipoBobina={selected.tipoBobina || ''} producoes={producoes} paradasFaltaMaterial={paradasFaltaMaterial} paradasMaquina={paradasMaquina} naoConformidades={naoConformidades} faltas={faltas} observacoes={observacoes} onEditStep={(step) => goToStep(step)} productionReadOnly /></div>
      </div>
      {saveError && <div role="alert" className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{saveError}</div>}
      <div className="sticky-action-bar sticky bottom-3 z-20 rounded-2xl border p-3 backdrop-blur-2xl sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[var(--text-primary)]">Etapa {currentStep} de 7 · {stepLabels[currentStep - 1]}</p><p className="mt-0.5 hidden text-xs text-[var(--text-tertiary)] sm:block">Nenhuma ocorrência é obrigatória. A produção não pode ser alterada.</p></div><div className="grid grid-cols-2 gap-2 sm:flex">{currentStep > 1 && <Button variant="secondary" disabled={isSaving} leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={goBack}>Voltar</Button>}{currentStep < 7 ? <Button className={currentStep === 1 ? 'col-span-2 sm:col-span-1' : undefined} rightIcon={<ArrowRight className="h-4 w-4" />} onClick={goNext}>Avançar</Button> : <Button isLoading={isSaving} loadingLabel="Salvando…" leftIcon={<Save className="h-4 w-4" />} onClick={() => void handleSave()}>Finalizar apontamento</Button>}</div></div></div>
    </>}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
};
