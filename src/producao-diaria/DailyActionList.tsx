import { useEffect, useState } from 'react';
import { Button } from '../components/common/ui';
import { ModalShell } from '../components/common/ModalShell';
import { ApiError } from '../services/apiClient';
import { producaoDiariaService } from '../services/producaoDiariaService';
import { ACTION_STATUS_LABELS, isOverdue, type ActionEvent, type ActionFields, type ActionFilters, type DailyAction } from './acoes';
import { actionDateLabel, actionError, actionLineLabel, DailyActionForm } from './DailyActionForm';
import { todayInManaus } from './observacoes';

const historyFields: Array<[keyof ActionFields, string]> = [
  ['situacao', 'Situação'], ['prazo', 'Prazo'], ['responsavel', 'Responsável'],
  ['observacao', 'Observação'], ['plano_acao', 'Plano'], ['setor', 'Setor'], ['linha', 'Linha'],
];

function historyValue(field: keyof ActionFields, value: ActionEvent['depois'] | ActionFields) {
  if (field === 'situacao') return ACTION_STATUS_LABELS[value.situacao];
  if (field === 'prazo') return actionDateLabel(value.prazo);
  if (field === 'linha') return actionLineLabel(value.linha);
  return value[field] ?? 'Sem observação vinculada';
}

function ActionHistory({ action, onClose }: { action: DailyAction; onClose: () => void }) {
  const [events, setEvents] = useState<ActionEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [next, setNext] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    void producaoDiariaService.getAcaoHistorico(action.id, cursor).then((result) => {
      if (!active) return;
      setEvents((current) => cursor ? [...current, ...result.eventos] : result.eventos);
      setNext(result.proximoCursor);
    }).catch((reason) => { if (active) setError(actionError(reason)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [action.id, cursor, revision]);

  return (
    <ModalShell isOpen title="Histórico da ação" description={`${action.setor} · ${actionDateLabel(action.data_origem)}`} onClose={onClose} size="lg">
      <ol className="daily-action-history">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.tipo === 'CRIACAO' ? 'Criação' : 'Alteração'} · {event.autor_login}</strong>
            <time dateTime={event.criado_em}>{new Date(event.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Manaus' })}</time>
            <dl>
              {historyFields.filter(([key]) => !event.antes || (event.antes[key] ?? null) !== (event.depois[key] ?? null)).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{event.antes && <><del>{historyValue(key, event.antes)}</del>{' → '}</>}{historyValue(key, event.depois)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      {busy && <p className="daily-observation-hint">Carregando histórico…</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {error && <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</Button>}
      {!busy && !error && next && <Button variant="secondary" onClick={() => setCursor(next)}>Carregar eventos anteriores</Button>}
    </ModalShell>
  );
}

function ActionEditor({ action, onClose, onChanged }: {
  action: DailyAction; onClose: () => void; onChanged: () => void;
}) {
  const [current, setCurrent] = useState(action);
  const [draft, setDraft] = useState<ActionFields>(action);
  const [latestChanges, setLatestChanges] = useState<Array<[keyof ActionFields, string]>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { setor, linha, observacao, plano_acao, responsavel, prazo, situacao } = draft;
      await producaoDiariaService.updateAcao(action.id, {
        setor, linha, observacao: observacao?.trim() || undefined, plano_acao, responsavel, prazo, situacao, versao: current.versao,
      });
      onClose();
      onChanged();
    } catch (reason) {
      setError(actionError(reason));
      setConflict(reason instanceof ApiError && reason.status === 409);
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    setBusy(true);
    setError('');
    try {
      const latest = await producaoDiariaService.getAcao(action.id);
      const keptEdits = Object.fromEntries(historyFields
        .filter(([key]) => current[key] !== draft[key]).map(([key]) => [key, draft[key]]));
      setLatestChanges(historyFields.filter(([key]) => latest[key] !== current[key]));
      setDraft({ ...latest, ...keptEdits });
      setCurrent(latest);
      setConflict(false);
    } catch (reason) {
      setError(actionError(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalShell isOpen title="Editar ação" description={`Origem ${actionDateLabel(action.data_origem)} · Criada por ${action.criado_por_login}`}
      onClose={onClose} busy={busy}>
      {latestChanges.length > 0 && (
        <div className="daily-observation-hint mb-3" role="status">
          <strong>Alterações no servidor</strong>
          <ul>{latestChanges.map(([key, label]) => <li key={key}>{label} · {historyValue(key, current)}</li>)}</ul>
        </div>
      )}
      <DailyActionForm value={draft} onChange={setDraft} onSubmit={() => { if (!conflict) void save(); }}
        editing observationRequired={current.observacao != null} busy={busy} error={error} onRefresh={conflict ? () => void reload() : undefined} />
    </ModalShell>
  );
}

export function DailyActionList({ filters, onChanged }: {
  filters: ActionFilters; onChanged: () => void;
}) {
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<DailyAction | null>(null);
  const [history, setHistory] = useState<DailyAction | null>(null);
  const today = todayInManaus();

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    void producaoDiariaService.getAcoes({ ...filters, cursor }).then((result) => {
      if (!active) return;
      setActions((current) => {
        if (!cursor) return result.acoes;
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...result.acoes.filter((item) => !existing.has(item.id))];
      });
      setNext(result.proximoCursor);
    }).catch((reason) => { if (active) setError(actionError(reason)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [filters, retry, cursor]);

  return (
    <div className="daily-action-list">
      {actions.map((action) => (
        <article className="daily-action-card" key={action.id}>
          <div className="daily-action-card__header">
            <strong>{action.setor} · {actionLineLabel(action.linha)}</strong>
            <span>{ACTION_STATUS_LABELS[action.situacao]}</span>
            {isOverdue(action, today) && <span className="daily-action-overdue">Prazo vencido</span>}
          </div>
          {action.observacao
            ? <p className="daily-action-text"><strong>Observação</strong> {action.observacao}</p>
            : <p className="daily-observation-hint">Ação legada sem observação vinculada.</p>}
          <p className="daily-action-text"><strong>Plano de ação</strong> <span>{action.plano_acao}</span></p>
          <dl className="daily-action-facts">
            <div><dt>Origem</dt><dd>{actionDateLabel(action.data_origem)}</dd></div>
            <div><dt>Responsável</dt><dd>{action.responsavel}</dd></div>
            <div><dt>Prazo</dt><dd>{actionDateLabel(action.prazo)}</dd></div>
            <div><dt>Autor</dt><dd>{action.criado_por_login}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditor(action)}>Editar ação</Button>
            <Button size="sm" variant="ghost" onClick={() => setHistory(action)}>Ver histórico</Button>
          </div>
        </article>
      ))}
      {busy && <p className="daily-observation-hint">Carregando ações…</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {error && <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</Button>}
      {!busy && !error && !actions.length && <p className="daily-observation-hint">Nenhuma ação encontrada.</p>}
      {!busy && !error && next && <Button variant="secondary" onClick={() => setCursor(next)}>Carregar mais ações</Button>}
      {editor && <ActionEditor key={editor.id} action={editor} onClose={() => setEditor(null)} onChanged={onChanged} />}
      {history && <ActionHistory key={history.id} action={history} onClose={() => setHistory(null)} />}
    </div>
  );
}
