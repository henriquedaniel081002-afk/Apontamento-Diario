import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Save } from 'lucide-react';
import { Apontamento, ApontamentoEditPayload, FaltaItem, Linha, NaoConformidadeItem, ObservacaoItem, ParadaFaltaMaterialItem, ParadaMaquinaItem, ProducaoItem, User } from '../../types';
import { ProducaoSection } from '../apontamento/ProducaoSection';
import { ImportedProductionSection } from '../apontamento/ImportedProductionSection';
import { ParadasFaltaMaterialSection } from '../apontamento/ParadasFaltaMaterialSection';
import { ParadasMaquinaSection } from '../apontamento/ParadasMaquinaSection';
import { NaoConformidadesSection } from '../apontamento/NaoConformidadesSection';
import { FaltasSection } from '../apontamento/FaltasSection';
import { ObservacoesSection } from '../apontamento/ObservacoesSection';
import { SummaryHeader } from '../apontamento/SummaryHeader';
import { ModalShell } from '../common/ModalShell';
import { Button, FieldError } from '../common/ui';

interface Props { apontamento: Apontamento | null; isOpen: boolean; onClose: () => void; onSave: (data: ApontamentoEditPayload) => Promise<void>; contextLabel?: string; }
type Step = 1 | 2 | 3 | 4 | 5 | 6;
const clone = <T,>(items: T[] | undefined): T[] => (items || []).map((item) => ({ ...item }));

export const EditApontamentoModal: React.FC<Props> = ({ apontamento, isOpen, onClose, onSave, contextLabel = 'Edição de apontamento' }) => {
  const [data, setData] = useState(''); const [producoes, setProducoes] = useState<ProducaoItem[]>([]); const [paradasFaltaMaterial, setParadasFaltaMaterial] = useState<ParadaFaltaMaterialItem[]>([]); const [paradasMaquina, setParadasMaquina] = useState<ParadaMaquinaItem[]>([]); const [naoConformidades, setNaoConformidades] = useState<NaoConformidadeItem[]>([]); const [faltas, setFaltas] = useState<FaltaItem[]>([]); const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]); const [step, setStep] = useState<Step>(1); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!apontamento) return; setData(apontamento.data); setProducoes(clone(apontamento.producoes)); setParadasFaltaMaterial(clone(apontamento.paradasFaltaMaterial)); setParadasMaquina(clone(apontamento.paradasMaquina)); setNaoConformidades(clone(apontamento.naoConformidades)); setFaltas(clone(apontamento.faltas)); setObservacoes(clone(apontamento.observacoes)); setStep(1); setError(null); }, [apontamento]);

  const editorUser = useMemo<User | null>(() => { if (!apontamento) return null; const usedLines = [...apontamento.producoes.map((x) => x.linha), ...apontamento.faltas.map((x) => x.linha), ...apontamento.observacoes.map((x) => x.linha)].filter(Boolean) as Linha[]; let lines = apontamento.linhasPermitidas?.filter(Boolean) || []; if (!lines.length) lines = [...new Set(usedLines)]; if (!lines.length) lines = apontamento.setor === 'EPOXI' ? ['EPO'] : ['MON', 'TRI']; return { id: apontamento.userId, name: apontamento.userName, perfil: 'APONTADOR', setor: apontamento.setor, linhas: lines }; }, [apontamento]);
  if (!apontamento || !editorUser) return null;
  const isImported = apontamento.origemProducao === 'IMPORTADO';
  const totalProducao = producoes.reduce((sum, x) => sum + Number(x.quantidade || 0), 0);
  const totalFaltas = faltas.reduce((sum, x) => sum + (typeof x.quantidade === 'number' ? x.quantidade : 1), 0);
  const handleSave = async () => { if (!data) { setError('A data do apontamento é obrigatória.'); return; } setSaving(true); setError(null); try { await onSave({ data, producoes, paradasFaltaMaterial, paradasMaquina, naoConformidades, faltas, observacoes }); } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao salvar as alterações.'); } finally { setSaving(false); } };
  const tabs: Array<{ id: Step; label: string; count: number }> = [
    { id: 1, label: 'Produção', count: producoes.length }, { id: 2, label: 'Material', count: paradasFaltaMaterial.length }, { id: 3, label: 'Máquina', count: paradasMaquina.length }, { id: 4, label: 'Não conform.', count: naoConformidades.length }, { id: 5, label: 'Faltas', count: faltas.length }, { id: 6, label: 'Observações', count: observacoes.length },
  ];

  return <ModalShell isOpen={isOpen} onClose={onClose} title="Editar apontamento" description={`${contextLabel} • ${apontamento.setor} • Responsável: ${apontamento.userName}`} size="xl" busy={saving} footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-xs leading-relaxed text-slate-500">{isImported ? 'Produção e data vieram do Excel e ficam bloqueadas. As ocorrências podem ser corrigidas sem alterar a produção importada.' : 'Setor, responsável e tipo de bobina originais são preservados.'}</p><div className="flex shrink-0 gap-2"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button onClick={() => void handleSave()} isLoading={saving} loadingLabel="Salvando…" leftIcon={<Save className="size-4" />}>Salvar alterações</Button></div></div>}>
    <div className="space-y-5"><div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[260px_1fr]"><label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300"><Calendar className="size-4 text-emerald-400" />Data do apontamento</span><input type="date" value={data} disabled={isImported} onChange={(e) => { setData(e.target.value); if (e.target.value) setError(null); }} className="min-h-11 w-full rounded-xl border border-white/15 bg-[#070B08] px-3 py-2.5 text-sm font-bold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" /></label><SummaryHeader totalProducao={totalProducao} totalParadasMaterial={paradasFaltaMaterial.length} totalParadasMaquina={paradasMaquina.length} totalNaoConformidades={naoConformidades.length} totalFaltas={totalFaltas} totalObservacoes={observacoes.length} /></div>
    <nav aria-label="Seções da edição" className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-black/15 p-1.5 sm:grid-cols-3 lg:grid-cols-6">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setStep(tab.id)} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors ${step === tab.id ? 'bg-emerald-400 text-[#041007]' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'}`}>{step === tab.id && <Check className="hidden size-3.5 sm:block" />}<span className="truncate">{tab.label}</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] ${step === tab.id ? 'bg-black/15' : 'bg-white/[0.07]'}`}>{tab.count}</span></button>)}</nav>
    <div hidden={step !== 1}>{isImported ? <ImportedProductionSection producoes={producoes} /> : <ProducaoSection user={editorUser} producoes={producoes} onAdd={(x) => setProducoes((c) => [...c, x])} onUpdate={(x) => setProducoes((c) => c.map((e) => e.id === x.id ? x : e))} onDelete={(id) => setProducoes((c) => c.filter((e) => e.id !== id))} />}</div>
    <div hidden={step !== 2}><ParadasFaltaMaterialSection itens={paradasFaltaMaterial} onAdd={(x) => setParadasFaltaMaterial((c) => [...c, x])} onUpdate={(x) => setParadasFaltaMaterial((c) => c.map((e) => e.id === x.id ? x : e))} onDelete={(id) => setParadasFaltaMaterial((c) => c.filter((e) => e.id !== id))} /></div>
    <div hidden={step !== 3}><ParadasMaquinaSection itens={paradasMaquina} onAdd={(x) => setParadasMaquina((c) => [...c, x])} onUpdate={(x) => setParadasMaquina((c) => c.map((e) => e.id === x.id ? x : e))} onDelete={(id) => setParadasMaquina((c) => c.filter((e) => e.id !== id))} /></div>
    <div hidden={step !== 4}><NaoConformidadesSection itens={naoConformidades} onAdd={(x) => setNaoConformidades((c) => [...c, x])} onUpdate={(x) => setNaoConformidades((c) => c.map((e) => e.id === x.id ? x : e))} onDelete={(id) => setNaoConformidades((c) => c.filter((e) => e.id !== id))} /></div>
    <div hidden={step !== 5}><FaltasSection faltas={faltas} onAdd={(x) => setFaltas((c) => [...c, x])} onUpdate={(x) => setFaltas((c) => c.map((e) => e.id === x.id ? x : e))} onDelete={(id) => setFaltas((c) => c.filter((e) => e.id !== id))} /></div>
    <div hidden={step !== 6}><ObservacoesSection observacoes={observacoes} onAdd={(x) => setObservacoes((c) => [...c, x])} onUpdate={(x) => setObservacoes((c) => c.map((e) => e.id === x.id ? x : e))} onDelete={(id) => setObservacoes((c) => c.filter((e) => e.id !== id))} /></div>
    <FieldError role="alert">{error}</FieldError></div>
  </ModalShell>;
};
