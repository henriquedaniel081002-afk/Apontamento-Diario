import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Save } from 'lucide-react';
import { Apontamento, FaltaItem, Linha, ObservacaoItem, ProducaoItem, User } from '../../types';
import { ProducaoSection } from '../apontamento/ProducaoSection';
import { ImportedProductionSection } from '../apontamento/ImportedProductionSection';
import { FaltasSection } from '../apontamento/FaltasSection';
import { ObservacoesSection } from '../apontamento/ObservacoesSection';
import { SummaryHeader } from '../apontamento/SummaryHeader';
import { ModalShell } from '../common/ModalShell';
import { Button, FieldError } from '../common/ui';

interface EditApontamentoModalProps {
  apontamento: Apontamento | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Pick<Apontamento, 'data' | 'producoes' | 'faltas' | 'observacoes'>) => Promise<void>;
  contextLabel?: string;
}

type Step = 1 | 2 | 3;

export const EditApontamentoModal: React.FC<EditApontamentoModalProps> = ({
  apontamento,
  isOpen,
  onClose,
  onSave,
  contextLabel = 'Edição de apontamento',
}) => {
  const [data, setData] = useState('');
  const [producoes, setProducoes] = useState<ProducaoItem[]>([]);
  const [faltas, setFaltas] = useState<FaltaItem[]>([]);
  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apontamento) return;
    setData(apontamento.data);
    setProducoes(apontamento.producoes.map((item) => ({ ...item })));
    setFaltas(apontamento.faltas.map((item) => ({ ...item })));
    setObservacoes(apontamento.observacoes.map((item) => ({ ...item })));
    setStep(1);
    setError(null);
  }, [apontamento]);

  const editorUser = useMemo<User | null>(() => {
    if (!apontamento) return null;

    const usedLines = [
      ...apontamento.producoes.map((item) => item.linha),
      ...apontamento.faltas.map((item) => item.linha),
      ...apontamento.observacoes.map((item) => item.linha),
    ].filter(Boolean) as Linha[];

    let lines = apontamento.linhasPermitidas?.filter(Boolean) || [];
    if (!lines.length) lines = [...new Set(usedLines)];
    if (!lines.length) lines = apontamento.setor === 'EPOXI' ? ['EPO'] : ['MON', 'TRI'];

    return {
      id: apontamento.userId,
      name: apontamento.userName,
      perfil: 'APONTADOR',
      setor: apontamento.setor,
      linhas: lines,
    };
  }, [apontamento]);

  if (!apontamento || !editorUser) return null;

  const isImported = apontamento.origemProducao === 'IMPORTADO';
  const totalProducao = producoes.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalFaltas = faltas.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

  const handleSave = async () => {
    if (!data) {
      setError('A data do apontamento é obrigatória.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // The update contract intentionally contains only date and the three collections.
      await onSave({ data, producoes, faltas, observacoes });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ id: Step; label: string; count: number }> = [
    { id: 1, label: 'Produção', count: producoes.length },
    { id: 2, label: 'Faltas', count: faltas.length },
    { id: 3, label: 'Observações', count: observacoes.length },
  ];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Editar apontamento"
      description={`${contextLabel} • ${apontamento.setor} • Responsável: ${apontamento.userName}`}
      size="xl"
      busy={saving}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-slate-500">
            {isImported
              ? 'Produção e data vieram do Excel e ficam bloqueadas. Para corrigi-las, faça uma nova importação da data pela Coordenação.'
              : 'Setor, responsável e tipo de bobina originais são preservados. O envio altera somente data, produção, faltas e observações.'}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button
              onClick={() => void handleSave()}
              isLoading={saving}
              loadingLabel="Salvando…"
              leftIcon={<Save className="size-4" aria-hidden="true" />}
            >
              Salvar alterações
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[260px_1fr]">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <Calendar className="size-4 text-emerald-400" aria-hidden="true" />
              Data do apontamento
            </span>
            <input
              type="date"
              value={data}
              disabled={isImported}
              onChange={(event) => {
                setData(event.target.value);
                if (event.target.value) setError(null);
              }}
              aria-invalid={!data || undefined}
              aria-describedby={error ? 'edit-apontamento-error' : undefined}
              className="min-h-11 w-full rounded-xl border border-white/15 bg-[#070B08] px-3 py-2.5 text-sm font-bold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            />
          </label>

          <SummaryHeader
            totalProducao={totalProducao}
            totalFaltas={totalFaltas}
            totalObservacoes={observacoes.length}
          />
        </div>

        <nav aria-label="Seções da edição" className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-black/15 p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStep(tab.id)}
              aria-current={step === tab.id ? 'step' : undefined}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                step === tab.id
                  ? 'bg-emerald-400 text-[#041007]'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
              }`}
            >
              {step === tab.id && <Check className="hidden size-3.5 sm:block" aria-hidden="true" />}
              <span className="truncate">{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${step === tab.id ? 'bg-black/15' : 'bg-white/[0.07]'}`}>{tab.count}</span>
            </button>
          ))}
        </nav>

        <div className={step === 1 ? 'block' : 'hidden'} aria-hidden={step !== 1}>
          {isImported ? (
            <ImportedProductionSection producoes={producoes} />
          ) : (
            <ProducaoSection
              user={editorUser}
              producoes={producoes}
              onAdd={(item) => setProducoes((current) => [...current, item])}
              onUpdate={(item) => setProducoes((current) => current.map((entry) => entry.id === item.id ? item : entry))}
              onDelete={(id) => setProducoes((current) => current.filter((entry) => entry.id !== id))}
            />
          )}
        </div>

        <div className={step === 2 ? 'block' : 'hidden'} aria-hidden={step !== 2}>
          <FaltasSection
            user={editorUser}
            faltas={faltas}
            onAdd={(item) => setFaltas((current) => [...current, item])}
            onUpdate={(item) => setFaltas((current) => current.map((entry) => entry.id === item.id ? item : entry))}
            onDelete={(id) => setFaltas((current) => current.filter((entry) => entry.id !== id))}
          />
        </div>

        <div className={step === 3 ? 'block' : 'hidden'} aria-hidden={step !== 3}>
          <ObservacoesSection
            user={editorUser}
            observacoes={observacoes}
            onAdd={(item) => setObservacoes((current) => [...current, item])}
            onUpdate={(item) => setObservacoes((current) => current.map((entry) => entry.id === item.id ? item : entry))}
            onDelete={(id) => setObservacoes((current) => current.filter((entry) => entry.id !== id))}
          />
        </div>

        <FieldError id="edit-apontamento-error" role="alert">{error}</FieldError>
      </div>
    </ModalShell>
  );
};
