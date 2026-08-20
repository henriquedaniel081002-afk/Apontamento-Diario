import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  Filter,
  History,
  Inbox,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Apontamento, ApontamentoEditPayload, User } from '../types';
import { apontamentoService } from '../services/apontamentoService';
import { formatDateBR } from '../utils/formatters';
import {
  filterHistoryApontamentos,
  HistoryPeriod,
} from '../utils/operational';
import { DetailModal } from '../components/historico/DetailModal';
import { HistoryRecords } from '../components/historico/HistoryRecords';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EditApontamentoModal } from '../components/coordenacao/EditApontamentoModal';
import { Toast, ToastMessage } from '../components/common/Toast';
import { CustomSelect } from '../components/common/CustomSelect';

interface HistoricoPageProps {
  user: User;
}

export const HistoricoPage: React.FC<HistoricoPageProps> = ({ user }) => {
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [selectedLinhaFilter, setSelectedLinhaFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState<HistoryPeriod>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailItem, setDetailItem] = useState<Apontamento | null>(null);
  const [editItem, setEditItem] = useState<Apontamento | null>(null);
  const [deleteItem, setDeleteItem] = useState<Apontamento | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apontamentoService.getByUserSector(user.id, String(user.setor || ''));
      setApontamentos(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar o histórico.';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [user.id, user.setor]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredApontamentos = useMemo(
    () => filterHistoryApontamentos(apontamentos, {
      data: dateFilter,
      linha: selectedLinhaFilter,
      period: periodFilter,
      search: searchTerm,
    }),
    [apontamentos, dateFilter, periodFilter, searchTerm, selectedLinhaFilter],
  );

  const hasActiveFilters = dateFilter.length > 0
    || selectedLinhaFilter !== 'ALL'
    || periodFilter !== 'ALL'
    || searchTerm.length > 0;

  const clearFilters = () => {
    setDateFilter('');
    setSelectedLinhaFilter('ALL');
    setPeriodFilter('ALL');
    setSearchTerm('');
  };

  const handleSaveEdit = async (
    payload: ApontamentoEditPayload,
  ) => {
    if (!editItem) return;
    const updated = await apontamentoService.update(editItem.id, payload);
    setApontamentos((current) => current.map((record) => record.id === updated.id ? updated : record));
    if (detailItem?.id === updated.id) setDetailItem(updated);
    setEditItem(null);
    setToast({
      id: Date.now().toString(),
      type: 'success',
      message: 'Apontamento atualizado com sucesso.',
    });
  };

  const handleDeleteRecord = async () => {
    if (!deleteItem || deleting) return;
    setDeleting(true);
    try {
      await apontamentoService.delete(deleteItem.id);
      setApontamentos((current) => current.filter((record) => record.id !== deleteItem.id));
      if (detailItem?.id === deleteItem.id) setDetailItem(null);
      if (editItem?.id === deleteItem.id) setEditItem(null);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Apontamento excluído do histórico com sucesso.',
      });
      setDeleteItem(null);
    } catch (error) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: error instanceof Error ? error.message : 'Erro ao excluir apontamento.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="app-page mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <section className="industrial-hero flex flex-col gap-5 rounded-2xl border p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-emerald-400">
            <History className="size-4" aria-hidden="true" />
            Consultas e registros
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-50 sm:text-3xl">Histórico de apontamentos</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
            Consulte e corrija os registros salvos pela sua unidade operacional.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-[#080C09] px-4 py-3">
          <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-400">
            <CalendarRange className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Unidade</p>
            <p className="mt-0.5 text-sm font-bold text-slate-200">{user.setor || 'Não informada'}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="history-filters-title" className="filter-panel rounded-2xl border p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-emerald-400" aria-hidden="true" />
            <h2 id="history-filters-title" className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">Filtros</h2>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[190px_minmax(260px,1fr)_210px_auto] xl:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Data</span>
            <span className="relative block">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-[#080C09] py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label="Filtrar histórico por data"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Buscar no histórico</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Data ou texto de observação"
                className="min-h-11 w-full rounded-xl border border-white/15 bg-[#080C09] py-2.5 pl-10 pr-3 text-sm font-medium text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </span>
          </label>

          <div className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Período</span>
            <CustomSelect
              value={periodFilter}
              onChange={(value) => setPeriodFilter(value as HistoryPeriod)}
              ariaLabel="Filtrar período do histórico"
              options={[
                { value: 'ALL', label: 'Todo o período' },
                { value: '7DAYS', label: 'Últimos 7 dias' },
                { value: 'MONTH', label: 'Este mês' },
              ]}
            />
          </div>

          {user.linhas.length > 1 && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold text-slate-400">Linha</legend>
              <div className="flex min-h-11 items-center rounded-xl border border-white/10 bg-[#080C09] p-1">
                <button
                  type="button"
                  onClick={() => setSelectedLinhaFilter('ALL')}
                  aria-pressed={selectedLinhaFilter === 'ALL'}
                  className={`min-h-9 rounded-lg px-3 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selectedLinhaFilter === 'ALL' ? 'bg-emerald-400 text-[#041007]' : 'text-slate-400 hover:text-slate-100'}`}
                >
                  Todas
                </button>
                {user.linhas.map((linha) => (
                  <button
                    key={linha}
                    type="button"
                    onClick={() => setSelectedLinhaFilter(linha)}
                    aria-pressed={selectedLinhaFilter === linha}
                    className={`min-h-9 rounded-lg px-3 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selectedLinhaFilter === linha ? 'bg-emerald-400 text-[#041007]' : 'text-slate-400 hover:text-slate-100'}`}
                  >
                    {linha}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </section>

      {loading ? (
        <section aria-label="Carregando histórico" aria-busy="true" className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
          ))}
          <p className="sr-only">Carregando histórico...</p>
        </section>
      ) : loadError ? (
        <section role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-6 text-center sm:p-8">
          <AlertCircle className="mx-auto size-9 text-rose-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-black text-slate-100">Não foi possível carregar o histórico</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-slate-400">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-[#041007] hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D120F]"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </section>
      ) : apontamentos.length === 0 ? (
        <section className="rounded-2xl border border-white/10 bg-[#0D120F] p-8 text-center sm:p-12">
          <Inbox className="mx-auto size-10 text-slate-500" aria-hidden="true" />
          <h2 className="mt-3 text-base font-black text-slate-100">Seu histórico ainda está vazio</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Os apontamentos enviados por esta unidade aparecerão aqui.</p>
        </section>
      ) : filteredApontamentos.length === 0 ? (
        <section className="rounded-2xl border border-white/10 bg-[#0D120F] p-8 text-center sm:p-12">
          <Search className="mx-auto size-9 text-slate-500" aria-hidden="true" />
          <h2 className="mt-3 text-base font-black text-slate-100">Nenhum resultado para estes filtros</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Os registros continuam no histórico. Ajuste ou limpe os filtros para visualizá-los.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-slate-200 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Limpar filtros
          </button>
        </section>
      ) : (
        <section aria-labelledby="history-results-title" className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 id="history-results-title" className="text-sm font-black text-slate-200">Registros encontrados</h2>
            <p className="text-xs font-semibold text-slate-500" aria-live="polite">
              {filteredApontamentos.length} de {apontamentos.length}
            </p>
          </div>
          <HistoryRecords
            records={filteredApontamentos}
            onView={setDetailItem}
            onEdit={setEditItem}
            onDelete={setDeleteItem}
          />
        </section>
      )}

      <DetailModal apontamento={detailItem} isOpen={!!detailItem} onClose={() => setDetailItem(null)} />

      <EditApontamentoModal
        apontamento={editItem}
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSaveEdit}
        contextLabel="Correção do próprio apontamento"
      />

      <ConfirmModal
        isOpen={!!deleteItem}
        title="Excluir apontamento?"
        description={deleteItem
          ? `O registro de ${formatDateBR(deleteItem.data)} será removido permanentemente do histórico.`
          : ''}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => void handleDeleteRecord()}
        onCancel={() => !deleting && setDeleteItem(null)}
        isBusy={deleting}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
