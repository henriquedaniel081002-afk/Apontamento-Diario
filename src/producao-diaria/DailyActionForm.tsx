import type { ComponentProps, FormEvent } from 'react';
import { CustomSelect } from '../components/common/CustomSelect';
import { Button, Field } from '../components/common/ui';
import {
  ACTION_OBSERVATION_LIMIT, ACTION_PLAN_LIMIT, ACTION_RESPONSIBLE_LIMIT, ACTION_STATUSES, ACTION_STATUS_LABELS,
  type ActionFields, type ActionStatus,
} from './acoes';
import { DAILY_SECTORS, dailySectorLines, type DailyObservationLine } from './escopo';

export const actionLineLabel = (line: DailyObservationLine) => line === 'GERAL' ? 'Todas as linhas' : line;
export const actionSectorOptions = DAILY_SECTORS.map((value) => ({ value, label: value }));
export const actionDateLabel = (date: string) => date.split('-').reverse().join('/');
export const actionError = (reason: unknown) => reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.';

export type ActionDraft = Pick<ActionFields, 'observacao' | 'plano_acao' | 'responsavel' | 'prazo' | 'situacao'>;
export const emptyActionDraft: ActionDraft = { observacao: '', plano_acao: '', responsavel: '', prazo: '', situacao: 'PENDENTE' };
const statusOptions = ACTION_STATUSES.map((value) => ({ value, label: ACTION_STATUS_LABELS[value] }));

export function DailyActionSelect({ label, ...props }: Pick<ComponentProps<typeof CustomSelect>,
  'value' | 'onChange' | 'options' | 'disabled'> & { label: string }) {
  return <Field label={label}><CustomSelect floating ariaLabel={label} {...props} /></Field>;
}

export function DailyActionForm({
  value, onChange, onSubmit, editing, observationRequired, busy, error, onRefresh,
}: {
  value: ActionFields;
  onChange: (values: ActionFields) => void;
  onSubmit: () => void;
  editing?: boolean;
  observationRequired: boolean;
  busy: boolean;
  error: string;
  onRefresh?: () => void;
}) {
  const valid = (!observationRequired || Boolean(value.observacao?.trim()))
    && Boolean(value.plano_acao.trim() && value.responsavel.trim() && value.prazo);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && valid && !onRefresh) onSubmit();
  };
  return (
    <form className="daily-action-form" onSubmit={submit}>
      <div className="daily-action-fields">
        {editing && <DailyActionSelect label="Setor da ação" value={value.setor} disabled={busy} options={actionSectorOptions} onChange={(setor) => {
            onChange({ ...value, setor, linha: dailySectorLines(setor).includes(value.linha) ? value.linha : 'GERAL' });
          }} />}
        <DailyActionSelect label={editing ? 'Linha da ação' : 'Linha da observação e do plano'} value={value.linha} disabled={busy}
            options={dailySectorLines(value.setor).map((line) => ({ value: line, label: actionLineLabel(line) }))}
          onChange={(line) => onChange({ ...value, linha: line as DailyObservationLine })} />
      </div>
      <Field label="Observação" required={observationRequired} hint={observationRequired ? 'Descreva o problema ou o motivo da ocorrência.' : 'Ação legada. Preencha para vincular uma observação a esta ação.'}>
        <textarea className="field-control min-h-20 resize-y" value={value.observacao ?? ''} required={observationRequired}
          disabled={busy} maxLength={ACTION_OBSERVATION_LIMIT}
          onChange={(event) => onChange({ ...value, observacao: event.target.value })} />
      </Field>
      <Field label="Plano de ação" required>
        <textarea className="field-control min-h-20 resize-y" value={value.plano_acao} required disabled={busy}
          maxLength={ACTION_PLAN_LIMIT} onChange={(event) => onChange({ ...value, plano_acao: event.target.value })} />
      </Field>
      <div className="daily-action-fields">
        <Field label="Responsável" required>
          <input className="field-control" value={value.responsavel} required disabled={busy}
            maxLength={ACTION_RESPONSIBLE_LIMIT} onChange={(event) => onChange({ ...value, responsavel: event.target.value })} />
        </Field>
        <Field label="Prazo" required>
          <input className="field-control" type="date" value={value.prazo} required disabled={busy}
            onChange={(event) => onChange({ ...value, prazo: event.target.value })} />
        </Field>
        <DailyActionSelect label="Situação da ação" value={value.situacao} disabled={busy} options={statusOptions}
          onChange={(status) => onChange({ ...value, situacao: status as ActionStatus })} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {onRefresh && <Button variant="secondary" onClick={onRefresh} disabled={busy}>Recarregar ação</Button>}
        <Button type="submit" isLoading={busy} disabled={!valid || Boolean(onRefresh)}>
          {editing ? 'Salvar alterações' : 'Salvar ocorrência e plano'}
        </Button>
      </div>
    </form>
  );
}
