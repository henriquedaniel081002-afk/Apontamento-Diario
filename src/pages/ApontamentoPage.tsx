import React, { useState, useEffect } from 'react';
import { User, ProducaoItem, FaltaItem, ObservacaoItem } from '../types';
import { getTodayDateString, formatDateBR } from '../utils/formatters';
import { apontamentoService } from '../services/apontamentoService';
import { ProducaoSection } from '../components/apontamento/ProducaoSection';
import { FaltasSection } from '../components/apontamento/FaltasSection';
import { ObservacoesSection } from '../components/apontamento/ObservacoesSection';
import { SummaryHeader } from '../components/apontamento/SummaryHeader';
import { Toast, ToastMessage } from '../components/common/Toast';
import { Calendar, Save, Loader2, Sparkles, ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface ApontamentoPageProps {
  user: User;
  onNavigateToHistory: () => void;
}

type Step = 1 | 2 | 3;

const steps: Array<{ id: Step; label: string; shortLabel: string }> = [
  { id: 1, label: 'Produção', shortLabel: 'Produção' },
  { id: 2, label: 'Faltas e ausências', shortLabel: 'Faltas' },
  { id: 3, label: 'Observações', shortLabel: 'Observações' },
];

export const ApontamentoPage: React.FC<ApontamentoPageProps> = ({ user }) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [existingRecordId, setExistingRecordId] = useState<string | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState<Step>(1);

  const [producoes, setProducoes] = useState<ProducaoItem[]>([]);
  const [faltas, setFaltas] = useState<FaltaItem[]>([]);
  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setCurrentStep(1);
      try {
        const record = await apontamentoService.getByDateAndSector(selectedDate, user.setor, user.id);
        if (!isMounted) return;

        if (record) {
          setExistingRecordId(record.id);
          setProducoes(record.producoes || []);
          setFaltas(record.faltas || []);
          setObservacoes(record.observacoes || []);
        } else {
          setExistingRecordId(undefined);
          setProducoes([]);
          setFaltas([]);
          setObservacoes([]);
        }
      } catch (err) {
        console.error('Error loading daily record:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, user]);

  const handleAddProducao = (item: ProducaoItem) => setProducoes((prev) => [...prev, item]);
  const handleUpdateProducao = (updated: ProducaoItem) => setProducoes((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  const handleDeleteProducao = (id: string) => setProducoes((prev) => prev.filter((p) => p.id !== id));

  const handleAddFalta = (item: FaltaItem) => setFaltas((prev) => [...prev, item]);
  const handleUpdateFalta = (updated: FaltaItem) => setFaltas((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  const handleDeleteFalta = (id: string) => setFaltas((prev) => prev.filter((f) => f.id !== id));

  const handleAddObservacao = (item: ObservacaoItem) => setObservacoes((prev) => [...prev, item]);
  const handleUpdateObservacao = (updated: ObservacaoItem) => setObservacoes((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  const handleDeleteObservacao = (id: string) => setObservacoes((prev) => prev.filter((o) => o.id !== id));

  const handleSave = async () => {
    if (!selectedDate) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: 'A data do apontamento é obrigatória.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await apontamentoService.save({
        id: existingRecordId,
        data: selectedDate,
        setor: user.setor,
        userId: user.id,
        userName: user.name,
        producoes,
        faltas,
        observacoes,
      });

      setExistingRecordId(saved.id);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Apontamento salvo com sucesso!',
      });
    } catch (err) {
      console.error('Error saving:', err);
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: 'Falha ao salvar apontamento. Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalProducao = producoes.reduce((sum, p) => sum + p.quantidade, 0);
  const totalFaltas = faltas.reduce((sum, f) => sum + f.quantidade, 0);

  const setToday = () => setSelectedDate(getTodayDateString());
  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const goNext = () => {
    if (currentStep < 3) setCurrentStep((currentStep + 1) as Step);
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as Step);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0D120F] p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl shadow-black/10">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Posto de Trabalho • {user.setor}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Apontamento Diário</h1>
          <p className="text-xs text-slate-500 mt-0.5">Preencha o apontamento em três etapas simples.</p>
        </div>

        <div className="bg-[#080C09] border border-white/10 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <label className="text-xs font-bold text-slate-200 shrink-0">
              Data do apontamento <span className="text-rose-400">*</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#0D120F] border border-white/15 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer [color-scheme:dark]"
            />

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={setToday}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  selectedDate === getTodayDateString()
                    ? 'bg-emerald-500 text-[#041007] font-extrabold'
                    : 'bg-white/5 border border-white/10 text-slate-500 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={setYesterday}
                className="px-2 py-1 text-[11px] font-semibold bg-white/5 border border-white/10 text-slate-500 hover:bg-white/10 hover:text-slate-200 rounded-md transition-colors"
              >
                Ontem
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0D120F] border border-white/10 rounded-2xl p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {steps.map((step) => {
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;
            return (
              <div key={step.id} className="relative flex items-center gap-2 sm:gap-3 min-w-0">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 border transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-[#041007] border-emerald-400 shadow-lg shadow-emerald-950/20'
                      : isComplete
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-white/5 text-slate-500 border-white/10'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <div className="min-w-0">
                  <span className="hidden sm:block text-[10px] uppercase tracking-wider font-bold text-slate-500">Etapa {step.id}</span>
                  <span className={`block text-[11px] sm:text-xs font-bold truncate ${isActive ? 'text-slate-100' : isComplete ? 'text-emerald-300' : 'text-slate-500'}`}>
                    <span className="sm:hidden">{step.shortLabel}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </span>
                </div>
                {step.id < 3 && <div className="hidden sm:block absolute left-[calc(100%-10px)] w-5 h-px bg-white/10" />}
              </div>
            );
          })}
        </div>
      </div>

      <SummaryHeader
        totalProducao={totalProducao}
        totalFaltas={totalFaltas}
        totalObservacoes={observacoes.length}
      />

      {isLoading ? (
        <div className="bg-[#0D120F] border border-white/10 rounded-2xl p-12 text-center text-slate-500">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold">Carregando dados de {formatDateBR(selectedDate)}...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {currentStep === 1 && (
            <ProducaoSection
              user={user}
              producoes={producoes}
              onAdd={handleAddProducao}
              onUpdate={handleUpdateProducao}
              onDelete={handleDeleteProducao}
            />
          )}

          {currentStep === 2 && (
            <FaltasSection
              user={user}
              faltas={faltas}
              onAdd={handleAddFalta}
              onUpdate={handleUpdateFalta}
              onDelete={handleDeleteFalta}
            />
          )}

          {currentStep === 3 && (
            <ObservacoesSection
              user={user}
              observacoes={observacoes}
              onAdd={handleAddObservacao}
              onUpdate={handleUpdateObservacao}
              onDelete={handleDeleteObservacao}
            />
          )}

          <div className="sticky bottom-4 z-20 bg-[#0A0F0C]/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
              <span>
                Etapa {currentStep} de 3 • <strong className="text-slate-300">{steps[currentStep - 1].label}</strong>
              </span>
              <span className="hidden sm:inline mx-2 text-slate-300">•</span>
              <span className="block sm:inline text-[11px] text-slate-500">Dados já adicionados permanecem ao avançar ou voltar.</span>
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 sm:flex-none border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-4 py-3 rounded-xl transition-all flex items-center justify-center space-x-2 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#041007] font-extrabold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center space-x-2 text-sm"
                >
                  <span>Avançar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#041007] font-extrabold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar apontamento</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
