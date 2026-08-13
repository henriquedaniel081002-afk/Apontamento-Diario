import React, { useEffect, useMemo, useState } from 'react';
import { Apontamento, FaltaItem, Linha, ObservacaoItem, ProducaoItem, User } from '../../types';
import { ProducaoSection } from '../apontamento/ProducaoSection';
import { FaltasSection } from '../apontamento/FaltasSection';
import { ObservacoesSection } from '../apontamento/ObservacoesSection';
import { SummaryHeader } from '../apontamento/SummaryHeader';
import { Calendar, Check, Loader2, Save, X } from 'lucide-react';

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
    setProducoes(apontamento.producoes.map((x) => ({ ...x })));
    setFaltas(apontamento.faltas.map((x) => ({ ...x })));
    setObservacoes(apontamento.observacoes.map((x) => ({ ...x })));
    setStep(1);
    setError(null);
  }, [apontamento]);

  const editorUser = useMemo<User | null>(() => {
    if (!apontamento) return null;

    const usadas = [
      ...apontamento.producoes.map((x) => x.linha),
      ...apontamento.faltas.map((x) => x.linha),
      ...apontamento.observacoes.map((x) => x.linha),
    ].filter(Boolean) as Linha[];

    let linhas = apontamento.linhasPermitidas?.filter(Boolean) || [];
    if (!linhas.length) linhas = [...new Set(usadas)];
    if (!linhas.length) linhas = apontamento.setor === 'EPOXI' ? ['EPO'] : ['MON', 'TRI'];

    return {
      id: apontamento.userId,
      name: apontamento.userName,
      perfil: 'APONTADOR',
      setor: apontamento.setor,
      linhas,
    };
  }, [apontamento]);

  if (!isOpen || !apontamento || !editorUser) return null;

  const totalProducao = producoes.reduce((sum, item) => sum + item.quantidade, 0);
  const totalFaltas = faltas.reduce((sum, item) => sum + item.quantidade, 0);

  const handleSave = async () => {
    if (!data) {
      setError('A data do apontamento é obrigatória.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({ data, producoes, faltas, observacoes });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ id: Step; label: string }> = [
    { id: 1, label: 'Produção' },
    { id: 2, label: 'Faltas' },
    { id: 3, label: 'Observações' },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm p-3 sm:p-5 flex items-center justify-center">
      <div className="w-full max-w-5xl max-h-[94vh] bg-[#090D0A] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 sm:px-6 border-b border-white/10 bg-[#0D120F] flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-black text-emerald-400">{contextLabel}</p>
            <h2 className="text-xl font-black text-slate-100 mt-1">Editar apontamento</h2>
            <p className="text-xs text-slate-500 mt-1">
              {apontamento.setor} • Responsável: <strong className="text-slate-300">{apontamento.userName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Fechar edição"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-end">
            <div>
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Data do apontamento
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-[#070B08] border border-white/15 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
              />
            </div>

            <SummaryHeader
              totalProducao={totalProducao}
              totalFaltas={totalFaltas}
              totalObservacoes={observacoes.length}
            />
          </div>

          <div className="bg-[#0D120F] border border-white/10 rounded-xl p-1.5 flex gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStep(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  step === tab.id
                    ? 'bg-emerald-500 text-[#041007]'
                    : 'text-slate-500 hover:text-slate-100 hover:bg-white/[0.06]'
                }`}
              >
                {step === tab.id && <Check className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            ))}
          </div>

          {step === 1 && (
            <ProducaoSection
              user={editorUser}
              producoes={producoes}
              onAdd={(item) => setProducoes((prev) => [...prev, item])}
              onUpdate={(item) => setProducoes((prev) => prev.map((x) => x.id === item.id ? item : x))}
              onDelete={(id) => setProducoes((prev) => prev.filter((x) => x.id !== id))}
            />
          )}

          {step === 2 && (
            <FaltasSection
              user={editorUser}
              faltas={faltas}
              onAdd={(item) => setFaltas((prev) => [...prev, item])}
              onUpdate={(item) => setFaltas((prev) => prev.map((x) => x.id === item.id ? item : x))}
              onDelete={(id) => setFaltas((prev) => prev.filter((x) => x.id !== id))}
            />
          )}

          {step === 3 && (
            <ObservacoesSection
              user={editorUser}
              observacoes={observacoes}
              onAdd={(item) => setObservacoes((prev) => [...prev, item])}
              onUpdate={(item) => setObservacoes((prev) => prev.map((x) => x.id === item.id ? item : x))}
              onDelete={(id) => setObservacoes((prev) => prev.filter((x) => x.id !== id))}
            />
          )}

          {error && (
            <div className="border border-rose-500/25 bg-rose-500/10 text-rose-200 rounded-xl px-4 py-3 text-xs font-semibold">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 sm:px-6 border-t border-white/10 bg-[#0D120F] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            O setor e o responsável original são preservados. Produção, faltas, observações e data podem ser corrigidos.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-[#041007] text-xs font-black hover:bg-emerald-400 disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
