import type { FormEvent } from 'react';
import { Button, Field } from '../components/common/ui';
import {
  ACTION_PLAN_LIMIT, ACTION_RESPONSIBLE_LIMIT, ACTION_STATUSES, ACTION_STATUS_LABELS,
  type ActionFields, type ActionStatus,
} from './acoes';
import { DAILY_SECTORS, dailySectorLines, type DailyObservationLine } from './escopo';

export const actionLineLabel = (line: DailyObservationLine) => line === 'GERAL' ? 'Todas as linhas' : line;
export const actionDateLabel = (date: string) => date.split('-').reverse().join('/');
export const actionError = (reason: unknown) => reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.';

export type ActionDraft = Pick<ActionFields, 'plano_acao' | 'responsavel' | 'prazo' | 'situacao'>;
export const emptyActionDraft: ActionDraft = { plano_acao: '', responsavel: '', prazo: '', situacao: 'PENDENTE' };

export function DailyActionForm({
  value, onChange, onSubmit, editing, busy, error, onRefresh,
}: {
  value: ActionFields;
  onChange: (values: ActionFields) => void;
  onSubmit: () => void;
  editing?: boolean;
  busy: boolean;
  error: string;
  onRefresh?: () => void;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) onSubmit();
  };
  return (
    <form className="daily-action-form" onSubmit={submit}>
      {editing && <div className="daily-action-fields">
        <Field label="Setor da ação">
          <select className="field-control" value={value.setor} disabled={busy} onChange={(event) => {
            const setor = event.target.value;
            onChange({ ...value, setor, linha: dailySectorLines(setor).includes(value.linha) ? value.linha : 'GERAL' });
          }}>
            {DAILY_SECTORS.map((setor) => <option key={setor}>{setor}</option>)}
          </select>
        </Field>
        <Field label="Linha da ação">
          <select className="field-control" value={value.linha} disabled={busy}
            onChange={(event) => onChange({ ...value, linha: event.target.value as DailyObservationLine })}>
            {dailySectorLines(value.setor).map((line) => <option key={line} value={line}>{actionLineLabel(line)}</option>)}
          </select>
        </Field>
      </div>}
      <Field label="Plano de ação">
        <textarea className="field-control min-h-20 resize-y" value={value.plano_acao} required disabled={busy}
          maxLength={ACTION_PLAN_LIMIT} onChange={(event) => onChange({ ...value, plano_acao: event.target.value })} />
      </Field>
      <div className="daily-action-fields">
        <Field label="Responsável">
          <input className="field-control" value={value.responsavel} required disabled={busy}
            maxLength={ACTION_RESPONSIBLE_LIMIT} onChange={(event) => onChange({ ...value, responsavel: event.target.value })} />
        </Field>
        <Field label="Prazo">
          <input className="field-control" type="date" value={value.prazo} required disabled={busy}
            onChange={(event) => onChange({ ...value, prazo: event.target.value })} />
        </Field>
        <Field label="Situação da ação">
          <select className="field-control" value={value.situacao} disabled={busy}
            onChange={(event) => onChange({ ...value, situacao: event.target.value as ActionStatus })}>
            {ACTION_STATUSES.map((status) => <option key={status} value={status}>{ACTION_STATUS_LABELS[status]}</option>)}
          </select>
        </Field>
      </div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {onRefresh && <Button variant="secondary" onClick={onRefresh} disabled={busy}>Recarregar ação</Button>}
        <Button type="submit" isLoading={busy} disabled={!value.plano_acao.trim() || !value.responsavel.trim() || !value.prazo}>
          {editing ? 'Salvar alterações' : 'Criar ação'}
        </Button>
      </div>
    </form>
  );
}
