import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Button, Field } from '../components/common/ui';
import { ApiError } from '../services/apiClient';
import { producaoDiariaService } from '../services/producaoDiariaService';
import type { ActionFields } from './acoes';
import { actionError, actionLineLabel, DailyActionForm, emptyActionDraft, type ActionDraft } from './DailyActionForm';
import { DailyActionList } from './DailyActionList';
import { dailySectorLines, type DailyObservationLine } from './escopo';
import type { DailyProductionObservation } from './observacoes';

interface ObservationDraft { text: string; version: number | null; }
export interface ManagementDrafts {
  notes: Record<string, ObservationDraft>;
  plans: Record<string, ActionDraft>;
  requests: Record<string, { content: string; id: string }>;
}

export function DailySectorManagement({
  data, setor, linha, onLineChange, observacoes, observacoesError, onObservationSaved,
  revision, onActionChanged, setBusy, drafts,
}: {
  data: string;
  setor: string;
  linha: DailyObservationLine;
  onLineChange: (line: DailyObservationLine) => void;
  observacoes: DailyProductionObservation[];
  observacoesError: string;
  onObservationSaved: (note: DailyProductionObservation) => void;
  revision: number;
  onActionChanged: () => void;
  setBusy: (busy: boolean) => void;
  drafts: ManagementDrafts;
}) {
  const [notes, setNotes] = useState(drafts.notes);
  const [plans, setPlans] = useState(drafts.plans);
  const [message, setMessage] = useState<{ key: string; text: string }>();
  const [noteError, setNoteError] = useState<{ key: string; text: string; conflict?: boolean }>();
  const [actionErrorState, setActionErrorState] = useState<{ key: string; text: string }>();
  const [savedConflict, setSavedConflict] = useState<DailyProductionObservation | null>();
  const [working, setWorking] = useState<'note' | 'action' | 'reload' | null>(null);
  const scopeKey = JSON.stringify([data, setor, linha]);
  const note = observacoes.find((item) => item.data === data && item.setor === setor && item.linha === linha);
  const draft = notes[scopeKey] || { text: note?.observacao || '', version: note?.versao ?? null };
  const plan = plans[scopeKey] || emptyActionDraft;
  const filters = useMemo(() => ({ status: 'TODAS' as const, setor, linha, dataOrigem: data, incluirGeral: false }), [setor, linha, data]);

  const changeNote = (value: ObservationDraft) => {
    drafts.notes = { ...drafts.notes, [scopeKey]: value };
    setNotes(drafts.notes);
  };

  const save = async () => {
    if (working) return;
    setBusy(true);
    setWorking('note');
    setNoteError(undefined);
    setMessage(undefined);
    setSavedConflict(undefined);
    try {
      const saved = await producaoDiariaService.saveObservacao(data, setor, linha, draft.text.trim(), draft.version);
      const { [scopeKey]: _savedDraft, ...rest } = drafts.notes;
      drafts.notes = rest;
      setNotes(rest);
      onObservationSaved(saved);
      setMessage({ key: scopeKey, text: 'Observação salva.' });
    } catch (reason) {
      setNoteError({ key: scopeKey, text: actionError(reason), conflict: reason instanceof ApiError && reason.status === 409 });
    } finally {
      setWorking(null);
      setBusy(false);
    }
  };

  const reload = async () => {
    setWorking('reload');
    setBusy(true);
    try {
      const latest = (await producaoDiariaService.getObservacoes(data, data))
        .find((item) => item.setor === setor && item.linha === linha) || null;
      if (latest) onObservationSaved(latest);
      setSavedConflict(latest);
      changeNote({ text: draft.text, version: latest?.versao ?? null });
      setNoteError(undefined);
    } catch (reason) {
      setNoteError({ key: scopeKey, text: actionError(reason), conflict: true });
    } finally {
      setWorking(null);
      setBusy(false);
    }
  };

  const create = async () => {
    if (working) return;
    const payload = {
      ...plan, plano_acao: plan.plano_acao.trim(), responsavel: plan.responsavel.trim(),
      data_origem: data, setor, linha,
    };
    const content = JSON.stringify(payload);
    setWorking('action');
    setBusy(true);
    setActionErrorState(undefined);
    setMessage(undefined);
    try {
      let request = drafts.requests[scopeKey];
      if (!request || request.content !== content) {
        request = { content, id: crypto.randomUUID() };
        drafts.requests[scopeKey] = request;
      }
      await producaoDiariaService.createAcao({ ...payload, chave_requisicao: request.id });
      delete drafts.requests[scopeKey];
      const { [scopeKey]: _savedDraft, ...rest } = drafts.plans;
      drafts.plans = rest;
      setPlans(rest);
      setMessage({ key: scopeKey, text: 'Ação criada.' });
      onActionChanged();
    } catch (reason) {
      setActionErrorState({ key: scopeKey, text: actionError(reason) });
    } finally {
      setWorking(null);
      setBusy(false);
    }
  };

  const updatePlan = ({ plano_acao, responsavel, prazo, situacao }: ActionFields) => {
    drafts.plans = { ...drafts.plans, [scopeKey]: { plano_acao, responsavel, prazo, situacao } };
    setPlans(drafts.plans);
  };

  const currentError = noteError?.key === scopeKey ? noteError : undefined;
  const scopeLines = dailySectorLines(setor);
  if (!scopeLines.length) return null;

  return (
    <section className="daily-detail-observation" aria-label="Observações e Planos">
      <h3>Observações e Planos</h3>
      <Field label="Linha da observação e do plano">
        <select className="field-control" value={linha} disabled={Boolean(working)}
          onChange={(event) => onLineChange(event.target.value as DailyObservationLine)}>
          {scopeLines.map((item) => <option key={item} value={item}>{actionLineLabel(item)}</option>)}
        </select>
      </Field>
      {observacoesError ? <p role="alert" className="daily-observation-hint">{observacoesError}</p> : (
        <div className="daily-action-form">
          <Field label="Observação" hint={linha === 'GERAL' ? 'Observação geral do setor' : `Observação da linha ${linha}`}>
            <textarea className="field-control min-h-24 resize-y" maxLength={3000} disabled={Boolean(working)}
              value={draft.text} onChange={(event) => {
                const text = event.target.value;
                changeNote({ text, version: draft.version });
              }} placeholder="Registre os motivos do desempenho da produção..." />
          </Field>
          {savedConflict?.linha === linha && savedConflict.data === data && savedConflict.setor === setor && (
            <p className="daily-action-text"><strong>Observação atual no servidor</strong> {savedConflict.observacao}</p>
          )}
          {currentError && <p className="text-sm text-rose-300" role="alert">{currentError.text}</p>}
          <div className="flex flex-wrap gap-2">
            {currentError?.conflict && <Button variant="secondary" onClick={() => void reload()} isLoading={working === 'reload'}>
              Recarregar observação
            </Button>}
            <Button variant="secondary" leftIcon={<Save className="size-4" aria-hidden="true" />}
              onClick={() => void save()} disabled={Boolean(working) || !draft.text.trim() || currentError?.conflict} isLoading={working === 'note'}>
              Salvar observação
            </Button>
          </div>
        </div>
      )}
      <div className="daily-action-create">
        <h4>Novo plano de ação</h4>
        <DailyActionForm value={{ ...plan, setor, linha }} onChange={updatePlan} onSubmit={() => void create()}
          busy={working === 'action'} error={actionErrorState?.key === scopeKey ? actionErrorState.text : ''} />
      </div>
      {message?.key === scopeKey && <p role="status" className="text-sm text-emerald-300">{message.text}</p>}
      <h4>Ações neste escopo</h4>
      <DailyActionList key={JSON.stringify([filters, revision])} filters={filters} onChanged={onActionChanged} />
    </section>
  );
}
