import { useMemo, useRef, useState } from 'react';
import { producaoDiariaService } from '../services/producaoDiariaService';
import type { ActionFields } from './acoes';
import { actionError, DailyActionForm, emptyActionDraft, type ActionDraft } from './DailyActionForm';
import { DailyActionList } from './DailyActionList';
import { dailySectorLines, type DailyObservationLine } from './escopo';
import type { DailyProductionObservation } from './observacoes';

export interface ManagementDrafts {
  occurrences: Record<string, ActionDraft>;
  requests: Record<string, { content: string; id: string }>;
}

export function DailySectorManagement({
  data, setor, linha, onLineChange, observacoes, observacoesError,
  revision, onActionChanged, setBusy, drafts,
}: {
  data: string;
  setor: string;
  linha: DailyObservationLine;
  onLineChange: (line: DailyObservationLine) => void;
  observacoes: DailyProductionObservation[];
  observacoesError: string;
  revision: number;
  onActionChanged: () => void;
  setBusy: (busy: boolean) => void;
  drafts: ManagementDrafts;
}) {
  const [occurrences, setOccurrences] = useState(drafts.occurrences);
  const [feedback, setFeedback] = useState<{ key: string; error?: string }>();
  const [working, setWorking] = useState(false);
  const sending = useRef(false);
  const scopeKey = JSON.stringify([data, setor, linha]);
  const note = observacoes.find((item) => item.data === data && item.setor === setor && item.linha === linha);
  const draft = occurrences[scopeKey] || emptyActionDraft;
  const filters = useMemo(() => ({ status: 'TODAS' as const, setor, linha, dataOrigem: data, incluirGeral: false }), [setor, linha, data]);

  const create = async () => {
    if (sending.current || !draft.observacao?.trim()) return;
    const payload = {
      ...draft, observacao: draft.observacao.trim(), plano_acao: draft.plano_acao.trim(), responsavel: draft.responsavel.trim(),
      data_origem: data, setor, linha,
    };
    const content = JSON.stringify(payload);
    sending.current = true;
    setWorking(true);
    setBusy(true);
    setFeedback(undefined);
    try {
      let request = drafts.requests[scopeKey];
      if (!request || request.content !== content) {
        request = { content, id: crypto.randomUUID() };
        drafts.requests[scopeKey] = request;
      }
      await producaoDiariaService.createAcao({ ...payload, chave_requisicao: request.id });
      delete drafts.requests[scopeKey];
      const { [scopeKey]: _savedDraft, ...rest } = drafts.occurrences;
      drafts.occurrences = rest;
      setOccurrences(rest);
      setFeedback({ key: scopeKey });
      onActionChanged();
    } catch (reason) {
      setFeedback({ key: scopeKey, error: actionError(reason) });
    } finally {
      sending.current = false;
      setWorking(false);
      setBusy(false);
    }
  };

  const update = ({ linha: nextLine, observacao, plano_acao, responsavel, prazo, situacao }: ActionFields) => {
    if (nextLine !== linha) {
      onLineChange(nextLine);
      return;
    }
    drafts.occurrences = { ...drafts.occurrences, [scopeKey]: { observacao, plano_acao, responsavel, prazo, situacao } };
    setOccurrences(drafts.occurrences);
  };

  if (!dailySectorLines(setor).length) return null;
  const currentFeedback = feedback?.key === scopeKey ? feedback : undefined;

  return (
    <section className="daily-detail-observation" aria-label="Observações e Planos">
      <h3>Observações e Planos</h3>
      <DailyActionForm value={{ ...draft, setor, linha }} onChange={update} onSubmit={() => void create()}
        observationRequired busy={working} error={currentFeedback?.error || ''} />
      {currentFeedback && !currentFeedback.error && <p role="status" className="text-sm text-emerald-300">Ocorrência registrada.</p>}
      {observacoesError && <p role="alert" className="daily-observation-hint">{observacoesError}</p>}
      {note && (
        <details className="daily-action-card">
          <summary className="cursor-pointer font-semibold">Observação legada sem plano vinculado</summary>
          <p className="daily-action-text mt-2">{note.observacao}</p>
        </details>
      )}
      <h4>Ações neste escopo</h4>
      <DailyActionList key={JSON.stringify([filters, revision])} filters={filters} onChanged={onActionChanged} />
    </section>
  );
}
