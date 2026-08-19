import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Filter,
  Inbox,
  ListFilter,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { Apontamento, StatusAprovacao, User } from '../types';
import { coordenacaoService } from '../services/coordenacaoService';
import { formatDateBR, formatPotencia } from '../utils/formatters';
import { exportApontamentosExcel } from '../utils/exportExcel';
import {
  filterCoordinationApontamentos,
  getOperationalStatus,
  getPreviousWorkingDayYmd,
} from '../utils/operational';
import { DetailModal } from '../components/historico/DetailModal';
import { EditApontamentoModal } from '../components/coordenacao/EditApontamentoModal';
import { CoordinationRecords } from '../components/coordenacao/CoordinationRecords';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Toast, ToastMessage } from '../components/common/Toast';

interface CoordenacaoPageProps {
  user: User;
}

interface KpiCardProps {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}

function KpiCard({ label, value, helper, icon, tone = 'neutral' }: KpiCardProps) {
  const toneClasses = {
    neutral: 'border-white/10 bg-[#0D120F] text-slate-100',
    success: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100',
    warning: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-100',
  };

  return (
    <article className={`kpi-industrial rounded-2xl border p-4 shadow-lg ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p>
          <p className="mt-2 whitespace-nowrap text-xl font-black tracking-tight sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{helper}</p>
        </div>
        <div className="hidden rounded-xl border border-white/10 bg-black/15 p-2.5 text-slate-300 sm:flex" aria-hidden="true">{icon}</div>
      </div>
    </article>
  );
}

export const CoordenacaoPage: React.FC<CoordenacaoPageProps> = ({ user }) => {
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [dataFilter, setDataFilter] = useState(() => getPreviousWorkingDayYmd());
  const [setorFilter, setSetorFilter] = useState('ALL');
  const [linhaFilter, setLinhaFilter] = useState('ALL');
  const [potenciaFilter, setPotenciaFilter] = useState('ALL');
  const [detailItem, setDetailItem] = useState<Apontamento | null>(null);
  const [editItem, setEditItem] = useState<Apontamento | null>(null);
  const [deleteItem, setDeleteItem] = useState<Apontamento | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadData = useCallback(async (showFeedback = false) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await coordenacaoService.getAll();
      setApontamentos(data);
      if (showFeedback) {
        setToast({
          id: Date.now().toString(),
          type: 'success',
          message: `Registros atualizados. ${data.length} apontamento(s) carregado(s).`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar os apontamentos.';
      setLoadError(message);
      if (showFeedback) {
        setToast({ id: Date.now().toString(), type: 'error', message });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setores = useMemo(
    () => Array.from(new Set(apontamentos.map((record) => String(record.setor)).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [apontamentos],
  );

  const linhas = useMemo(
    () => Array.from(new Set(apontamentos.flatMap((record) => [
      ...record.producoes.map((item) => item.linha),
      ...record.faltas.map((item) => item.linha),
      ...record.observacoes.map((item) => item.linha),
    ])))
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [apontamentos],
  );

  const potencias = useMemo(
    () => Array.from(new Set(
      apontamentos.flatMap((record) => record.producoes.map((item) => Number(item.potencia)))
        .filter(Number.isFinite),
    )).sort((a, b) => a - b),
    [apontamentos],
  );

  const operationalStatus = useMemo(
    () => getOperationalStatus(apontamentos, dataFilter),
    [apontamentos, dataFilter],
  );

  const filtered = useMemo(
    () => filterCoordinationApontamentos(apontamentos, {
      data: dataFilter,
      setor: setorFilter,
      linha: linhaFilter,
      potencia: potenciaFilter,
    }),
    [apontamentos, dataFilter, linhaFilter, potenciaFilter, setorFilter],
  );

  const hasFilters = dataFilter !== getPreviousWorkingDayYmd()
    || setorFilter !== 'ALL'
    || linhaFilter !== 'ALL'
    || potenciaFilter !== 'ALL';

  const clearFilters = () => {
    setDataFilter(getPreviousWorkingDayYmd());
    setSetorFilter('ALL');
    setLinhaFilter('ALL');
    setPotenciaFilter('ALL');
  };

  const handleSaveEdit = async (
    payload: Pick<Apontamento, 'data' | 'producoes' | 'faltas' | 'observacoes'>,
  ) => {
    if (!editItem) return;
    const updated = await coordenacaoService.update(editItem.id, payload);
    setApontamentos((current) => current
      .map((record) => record.id === updated.id ? updated : record)
      .sort((a, b) => b.data.localeCompare(a.data) || Number(b.id) - Number(a.id)));
    if (detailItem?.id === updated.id) setDetailItem(updated);
    setEditItem(null);
    setToast({ id: Date.now().toString(), type: 'success', message: 'Apontamento atualizado com sucesso.' });
  };

  const handleExport = async () => {
    if (exporting) return;
    if (filtered.length === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'warning',
        message: 'Não há registros nos filtros atuais para exportar.',
      });
      return;
    }
    setExporting(true);
    try {
      exportApontamentosExcel(filtered);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: `Excel gerado com ${filtered.length} apontamento(s).`,
      });
    } catch (error) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: error instanceof Error ? error.message : 'Falha ao gerar o Excel.',
      });
    } finally {
      setExporting(false);
    }
  };


  const handleApprovalChange = async (record: Apontamento, status: StatusAprovacao) => {
    if (approvalBusyId) return;
    setApprovalBusyId(record.id);
    try {
      const updated = await coordenacaoService.setApproval(record.id, status);
      setApontamentos((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (detailItem?.id === updated.id) setDetailItem(updated);
      if (editItem?.id === updated.id) setEditItem(updated);
      setToast({
        id: Date.now().toString(),
        type: status === 'APROVADO' ? 'success' : 'warning',
        message: status === 'APROVADO'
          ? 'Apontamento aprovado com sucesso.'
          : 'A aprovação foi desfeita. O apontamento voltou para Pendente.',
      });
    } catch (error) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: error instanceof Error ? error.message : 'Falha ao atualizar a aprovação.',
      });
    } finally {
      setApprovalBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || deleting) return;
    setDeleting(true);
    try {
      await coordenacaoService.delete(deleteItem.id);
      setApontamentos((current) => current.filter((record) => record.id !== deleteItem.id));
      if (detailItem?.id === deleteItem.id) setDetailItem(null);
      if (editItem?.id === deleteItem.id) setEditItem(null);
      setDeleteItem(null);
      setToast({ id: Date.now().toString(), type: 'success', message: 'Apontamento excluído com sucesso.' });
    } catch (error) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: error instanceof Error ? error.message : 'Falha ao excluir o apontamento.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="app-page mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <section className="industrial-hero flex flex-col gap-5 rounded-2xl border p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-emerald-400">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Acesso da coordenação
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-50 sm:text-3xl">Visão geral dos apontamentos</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
            Acompanhe a cobertura diária, analise registros e exporte o recorte filtrado.
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Sessão: {user.name}</p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={loading || !!loadError || exporting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 text-sm font-black text-emerald-200 transition-colors hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-slate-300 transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </section>

      {loading ? (
        <section aria-label="Carregando indicadores" aria-busy="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
          ))}
          <span className="sr-only">Carregando indicadores...</span>
        </section>
      ) : loadError ? (
        <section role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-6 text-center sm:p-8">
          <AlertCircle className="mx-auto size-9 text-rose-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-black text-slate-100">Não foi possível carregar os apontamentos</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-400">{loadError}</p>
          <p className="mx-auto mt-2 max-w-xl text-xs text-slate-500">Os indicadores foram ocultados para não apresentar números incompletos.</p>
          <button
            type="button"
            onClick={() => void loadData(true)}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-[#041007] hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D120F]"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </section>
      ) : (
        <section aria-label="Indicadores do dia" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Data analisada"
            value={dataFilter ? formatDateBR(dataFilter) : 'Selecione'}
            helper={dataFilter ? 'Referência das pendências' : 'Escolha uma data nos filtros'}
            icon={<CalendarDays className="size-5" />}
          />
          <KpiCard
            label="Apontamentos registrados"
            value={dataFilter ? String(operationalStatus.records) : '—'}
            helper="Somente na data selecionada"
            icon={<ClipboardCheck className="size-5" />}
          />
          <KpiCard
            label="Unidades concluídas"
            value={dataFilter ? `${operationalStatus.completedUnits}/${operationalStatus.totalUnits}` : '—/12'}
            helper="Unidades operacionais distintas"
            icon={<CheckCircle2 className="size-5" />}
            tone={dataFilter && operationalStatus.pendingUnits.length === 0 ? 'success' : 'neutral'}
          />
          <KpiCard
            label="Unidades pendentes"
            value={dataFilter ? `${operationalStatus.pendingUnits.length}/${operationalStatus.totalUnits}` : '—/12'}
            helper="Independe dos demais filtros"
            icon={<TimerReset className="size-5" />}
            tone={dataFilter && operationalStatus.pendingUnits.length > 0 ? 'warning' : 'neutral'}
          />
        </section>
      )}

      {!loading && !loadError && (
        !dataFilter ? (
          <section className="rounded-2xl border border-white/10 bg-[#0D120F] p-5 text-center">
            <CalendarDays className="mx-auto size-7 text-slate-500" aria-hidden="true" />
            <h2 className="mt-2 text-sm font-black text-slate-100">Selecione uma data para analisar as pendências</h2>
            <p className="mt-1 text-xs text-slate-500">Nenhum status de conclusão é calculado sem uma data de referência.</p>
          </section>
        ) : operationalStatus.pendingUnits.length > 0 ? (
          <section aria-labelledby="pending-title" className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 shadow-lg sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-2.5 text-amber-300">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h2 id="pending-title" className="text-sm font-black text-slate-100">Unidades pendentes</h2>
                  <span className="text-xs font-bold text-slate-500">{formatDateBR(dataFilter)}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  O cálculo usa todos os registros desta data e não é afetado pelos filtros de setor, linha ou potência.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {operationalStatus.pendingUnits.map((unit) => (
                    <span key={unit.id} className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 text-xs font-bold text-amber-200">
                      {unit.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section aria-labelledby="complete-title" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 shadow-lg sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2.5 text-emerald-300">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="complete-title" className="text-sm font-black text-slate-100">Todas as 12 unidades concluíram o apontamento</h2>
                <p className="mt-1 text-xs text-emerald-200/80">Cobertura confirmada para {formatDateBR(dataFilter)}.</p>
              </div>
            </div>
          </section>
        )
      )}

      <section aria-labelledby="coord-filters-title" className="filter-panel rounded-2xl border p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-emerald-400" aria-hidden="true" />
            <h2 id="coord-filters-title" className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">Filtros dos registros</h2>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ListFilter className="size-4" aria-hidden="true" />
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Data</span>
            <input
              type="date"
              value={dataFilter}
              onChange={(event) => setDataFilter(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-white/15 bg-[#080C09] px-3 py-2.5 text-sm font-semibold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Setor</span>
            <select
              value={setorFilter}
              onChange={(event) => setSetorFilter(event.target.value)}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-[#080C09] px-3 py-2.5 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <option value="ALL">Todos os setores</option>
              {setores.map((setor) => <option key={setor} value={setor}>{setor}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Linha</span>
            <select
              value={linhaFilter}
              onChange={(event) => setLinhaFilter(event.target.value)}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-[#080C09] px-3 py-2.5 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <option value="ALL">Todas as linhas</option>
              {linhas.map((linha) => <option key={linha} value={linha}>{linha}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Potência</span>
            <select
              value={potenciaFilter}
              onChange={(event) => setPotenciaFilter(event.target.value)}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-[#080C09] px-3 py-2.5 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <option value="ALL">Todas as potências</option>
              {potencias.map((potencia) => (
                <option key={potencia} value={String(potencia)}>{formatPotencia(potencia)} kVA</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!loading && !loadError && (
        apontamentos.length === 0 ? (
          <section className="rounded-2xl border border-white/10 bg-[#0D120F] p-8 text-center sm:p-12">
            <Inbox className="mx-auto size-10 text-slate-500" aria-hidden="true" />
            <h2 className="mt-3 text-base font-black text-slate-100">Ainda não há apontamentos registrados</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Quando as unidades enviarem registros, eles aparecerão nesta visão.</p>
          </section>
        ) : filtered.length === 0 ? (
          <section className="rounded-2xl border border-white/10 bg-[#0D120F] p-8 text-center sm:p-12">
            <ListFilter className="mx-auto size-9 text-slate-500" aria-hidden="true" />
            <h2 className="mt-3 text-base font-black text-slate-100">Nenhum registro corresponde aos filtros</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">A cobertura diária acima continua sendo calculada apenas pela data selecionada.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-slate-200 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <ListFilter className="size-4" aria-hidden="true" />
              Limpar filtros
            </button>
          </section>
        ) : (
          <section aria-labelledby="coord-results-title" className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 id="coord-results-title" className="text-sm font-black text-slate-200">Registros filtrados</h2>
              <p className="text-xs font-semibold text-slate-500" aria-live="polite">{filtered.length} de {apontamentos.length}</p>
            </div>
            <CoordinationRecords
              records={filtered}
              onView={setDetailItem}
              onEdit={setEditItem}
              onDelete={setDeleteItem}
              onApprovalChange={(record, status) => void handleApprovalChange(record, status)}
              approvalBusyId={approvalBusyId}
              showApprovalActions
            />
          </section>
        )
      )}

      <DetailModal apontamento={detailItem} isOpen={!!detailItem} onClose={() => setDetailItem(null)} />

      <EditApontamentoModal
        apontamento={editItem}
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSaveEdit}
      />

      <ConfirmModal
        isOpen={!!deleteItem}
        title="Excluir apontamento?"
        description={deleteItem
          ? `O registro de ${formatDateBR(deleteItem.data)} da unidade ${deleteItem.setor} será removido permanentemente.`
          : ''}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => !deleting && setDeleteItem(null)}
        isBusy={deleting}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
