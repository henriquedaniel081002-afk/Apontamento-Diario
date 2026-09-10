import { useEffect, useRef, useState } from 'react';
import { CheckCheck, ClipboardClock, RefreshCw } from 'lucide-react';
import type { Apontamento } from '../../types';
import {
  pendenciasAprovacaoService, PENDING_TYPES,
  type PendingApproval, type PendingApprovalFilters, type PendingApprovalResult,
} from '../../services/pendenciasAprovacaoService';
import { formatDateBR } from '../../utils/formatters';
import { ModalShell } from '../common/ModalShell';
import type { ToastMessage } from '../common/Toast';
import { CustomSelect } from '../common/CustomSelect';
import { Badge, Button, DateInput, EmptyState, ErrorState, Field, FilterPanel, LoadingState, Surface } from '../common/ui';

const EMPTY_FILTERS: PendingApprovalFilters = { dataInicio: '', dataFim: '', setor: '', tipo: '' };

interface Props {
  recordsRevision: Apontamento[];
  approvalBusyId: string | null;
  feedback: ToastMessage | null;
  onApprove: (record: Pick<Apontamento, 'id'>) => Promise<void>;
}

function approvalBlock(record: PendingApproval): string | null {
  if (!record.possuiProducao) return 'Aguardando importação da produção para liberar a aprovação.';
  if (String(record.origemProducao || '').toUpperCase() === 'IMPORTADO' && record.complementado === false) {
    return 'Aguardando o apontador finalizar o complemento das ocorrências.';
  }
  return null;
}

export function PendingApprovals({ recordsRevision, approvalBusyId, feedback, onApprove }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<PendingApprovalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const invalidPeriod = Boolean(draft.dataInicio && draft.dataFim && draft.dataInicio > draft.dataFim);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    pendenciasAprovacaoService.get(filters, page, !isOpen, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Falha ao carregar as pendências.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [recordsRevision, filters, page, isOpen, refresh]);

  // Uma aprovação na lista original também muda recordsRevision e atualiza a fila.
  // Retornar à janela permite consultar novos envios sem polling contínuo.
  useEffect(() => {
    const onFocus = () => {
      if (!loading && !approvalBusyId) setRefresh((value) => value + 1);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loading, approvalBusyId]);

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };
  const changePage = (value: number) => {
    setPage(value);
    contentRef.current?.closest('[data-modal-scroll]')?.scrollTo?.({ top: 0, behavior: 'smooth' });
  };
  const pages = result ? Math.max(1, Math.ceil(result.totalFiltrado / result.tamanhoPagina)) : 1;
  const busy = loading || Boolean(approvalBusyId);

  return <>
    <Surface as="section" padding="md" aria-labelledby="approval-pending-title">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-200">
            <ClipboardClock className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="approval-pending-title" className="text-sm font-extrabold text-slate-100">Pendentes de Aprovação</h2>
            <div className="mt-1" aria-live="polite">
              {loading ? <p className="text-sm text-slate-400">Consultando pendências…</p>
                : error ? <p className="text-sm text-rose-300">Não foi possível consultar o total.</p>
                  : result && <>
                    <p className="text-xl font-black text-white">{result.total.toLocaleString('pt-BR')} apontamento(s) pendente(s)</p>
                    <p className="mt-1 text-xs text-slate-400">{result.totalOcorrencias.toLocaleString('pt-BR')} ocorrência(s) · Todos os períodos e setores</p>
                  </>}
            </div>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setIsOpen(true)} className="shrink-0" aria-haspopup="dialog">Ver pendências</Button>
      </div>
    </Surface>

    <ModalShell
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      busy={Boolean(approvalBusyId)}
      title="Pendentes de Aprovação"
      description="A aprovação vale para todas as ocorrências de cada apontamento, conforme o fluxo atual."
      size="xl"
      footer={<div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400" aria-live="polite">{!loading && !error && result ? `${result.totalFiltrado} apontamento(s) no filtro · Página ${result.pagina} de ${pages}` : 'Consultando pendências'}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" disabled={busy || !!error || !result || result.pagina <= 1} onClick={() => changePage(result!.pagina - 1)}>Anterior</Button>
          <Button variant="secondary" size="sm" disabled={busy || !!error || !result || result.pagina >= pages} onClick={() => changePage(result!.pagina + 1)}>Próxima</Button>
        </div>
      </div>}
    >
      <div ref={contentRef} className="min-w-0 space-y-4">
        <form onSubmit={(event) => {
          event.preventDefault();
          if (invalidPeriod || busy) return;
          setFilters({ ...draft });
          setPage(1);
        }}>
          <FilterPanel title="Filtros das pendências" description="O tipo seleciona apontamentos que contêm aquela ocorrência. Todas as ocorrências do conjunto ficam visíveis para análise."
            actions={<div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={clearFilters}>Limpar</Button>
              <Button type="submit" size="sm" disabled={busy || invalidPeriod}>Aplicar filtros</Button>
            </div>}
            contentClassName="sm:[grid-template-columns:repeat(2,minmax(0,1fr))]"
          >
            <Field label="Data inicial" htmlFor="pending-start">
              <DateInput id="pending-start" value={draft.dataInicio} max={draft.dataFim || undefined} disabled={busy} onChange={(e) => setDraft({ ...draft, dataInicio: e.target.value })} />
            </Field>
            <Field label="Data final" htmlFor="pending-end">
              <DateInput id="pending-end" value={draft.dataFim} min={draft.dataInicio || undefined} disabled={busy} onChange={(e) => setDraft({ ...draft, dataFim: e.target.value })} />
            </Field>
            <Field label="Setor">
              <CustomSelect ariaLabel="Setor das pendências" value={draft.setor} onChange={(setor) => setDraft({ ...draft, setor })} disabled={busy}
                options={[{ value: '', label: 'Todos os setores' }, ...Array.from(new Set([...(result?.setores || []), draft.setor].filter(Boolean))).map((setor) => ({ value: setor, label: setor }))]} />
            </Field>
            <Field label="Tipo de apontamento">
              <CustomSelect ariaLabel="Tipo das pendências" value={draft.tipo} onChange={(tipo) => setDraft({ ...draft, tipo })} disabled={busy}
                options={[{ value: '', label: 'Todos os tipos' }, ...Object.entries(PENDING_TYPES).map(([value, label]) => ({ value, label }))]} />
            </Field>
          </FilterPanel>
          {invalidPeriod && <p role="alert" className="mt-2 text-sm text-rose-300">A data inicial deve ser anterior ou igual à data final.</p>}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400" aria-live="polite">{!loading && !error && result && `${result.totalFiltrado} de ${result.total} apontamento(s) pendente(s)`}</p>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRefresh((value) => value + 1)} leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}>Atualizar pendências</Button>
        </div>

        {feedback && <Surface padding="sm" role={feedback.type === 'error' ? 'alert' : 'status'} className={feedback.type === 'error' ? 'text-rose-300' : 'text-emerald-300'}>
          <p className="text-sm [overflow-wrap:anywhere]">{feedback.message}</p>
        </Surface>}

        {loading ? <LoadingState label="Carregando pendências de aprovação…" />
          : error ? <ErrorState title="Não foi possível carregar as pendências" description={error} action={<Button onClick={() => setRefresh((value) => value + 1)}>Tentar novamente</Button>} />
            : result?.totalFiltrado === 0 ? <EmptyState icon={<CheckCheck className="size-6" aria-hidden="true" />} title={result.total === 0 ? 'Nenhum apontamento pendente de aprovação.' : 'Nenhuma pendência corresponde aos filtros.'} action={result.total > 0 ? <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button> : undefined} />
              : result?.registros.map((record) => {
                const block = approvalBlock(record);
                const createdAt = new Date(record.createdAt);
                return <Surface as="article" padding="md" key={record.id} className="min-w-0 space-y-4" aria-label={`Apontamento ${record.id} de ${record.setor}`}>
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                      <p className="text-xs font-bold text-slate-400">{formatDateBR(record.data)} · Apontamento #{record.id}</p>
                      <h3 className="mt-1 text-base font-black text-white">{record.setor}</h3>
                      <p className="mt-1 text-xs text-slate-500">Apontamento criado em {Number.isFinite(createdAt.getTime()) ? createdAt.toLocaleString('pt-BR') : 'horário não informado'}</p>
                    </div>
                    <Badge variant="warning">PENDENTE</Badge>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {record.ocorrencias.map((item) => {
                      const fields = Object.entries(item.detalhes).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');
                      return <Surface tone="inset" padding="sm" key={`${item.tipo}-${item.id}`} className="min-w-0 [overflow-wrap:anywhere]">
                        <h4 className="text-sm font-extrabold text-slate-200">{PENDING_TYPES[item.tipo]}</h4>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>Linha: {item.linha || 'não informada'}</span>
                          <span>Turno: {item.turno || 'não informado'}</span>
                        </div>
                        {fields.length ? <dl className="mt-3 space-y-2">
                          {fields.map(([label, value]) => <div key={label}>
                            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-200">{typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}</dd>
                          </div>)}
                        </dl> : <p className="mt-3 text-sm text-slate-400">Registro parcial, sem conteúdo informado.</p>}
                      </Surface>;
                    })}
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className={`min-w-0 text-xs ${block ? 'text-amber-200' : 'text-slate-400'}`}>{block || `A ação aprova as ${record.totalOcorrencias} ocorrência(s) deste apontamento.`}</p>
                    <Button variant="success" className="shrink-0" disabled={busy || !!block} isLoading={approvalBusyId === record.id} loadingLabel="Aprovando…"
                      aria-label={`Aprovar apontamento ${record.id} de ${record.setor}`} onClick={() => void onApprove(record)}>
                      Aprovar apontamento
                    </Button>
                  </div>
                </Surface>;
              })}
      </div>
    </ModalShell>
  </>;
}
