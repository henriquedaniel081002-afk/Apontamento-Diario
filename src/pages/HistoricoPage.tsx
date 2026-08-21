import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import {
  Button,
  DateInput,
  EmptyState,
  ErrorState,
  Field,
  FilterPanel,
  Input,
  LoadingState,
  PageContainer,
  PageHeader,
} from '../components/common/ui';

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
    <PageContainer className="app-page space-y-5 py-6 sm:py-8">
      <PageHeader
        icon={<History className="size-5" aria-hidden="true" />}
        eyebrow="Consultas e registros"
        title="Histórico de apontamentos"
        description="Consulte e corrija os registros salvos pela sua unidade operacional."
        metadata={<span className="inline-flex items-center gap-2"><CalendarRange className="size-4 text-emerald-400" aria-hidden="true" /><span>Unidade: <strong className="text-[var(--text-primary)]">{user.setor || 'Não informada'}</strong></span></span>}
      />

      <FilterPanel
        aria-label="Filtros do histórico"
        title={<span className="flex items-center gap-2"><Filter className="size-4 text-emerald-400" aria-hidden="true" />Filtros</span>}
        description="Refine por data, conteúdo, período ou linha."
        actions={<Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={!hasActiveFilters} leftIcon={<RotateCcw className="size-4" aria-hidden="true" />}>Limpar filtros</Button>}
        contentClassName="md:[grid-template-columns:repeat(2,minmax(0,1fr))] xl:[grid-template-columns:190px_minmax(260px,1fr)_210px_auto] xl:items-end"
      >
          <Field label="Data" htmlFor="history-date-filter">
            <DateInput
              id="history-date-filter"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              aria-label="Filtrar histórico por data"
            />
          </Field>

          <Field label="Buscar no histórico" htmlFor="history-search-filter">
            <Input
              id="history-search-filter"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Data ou texto de observação"
            />
          </Field>

          <Field label="Período">
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
          </Field>

          {user.linhas.length > 1 && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold text-slate-400">Linha</legend>
              <div className="flex min-h-11 items-center rounded-xl border border-white/10 bg-[#080C09] p-1">
                <button
                  type="button"
                  onClick={() => setSelectedLinhaFilter('ALL')}
                  aria-pressed={selectedLinhaFilter === 'ALL'}
                  className={`min-h-11 rounded-lg px-3 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selectedLinhaFilter === 'ALL' ? 'bg-emerald-400 text-[#041007]' : 'text-slate-400 hover:text-slate-100'}`}
                >
                  Todas
                </button>
                {user.linhas.map((linha) => (
                  <button
                    key={linha}
                    type="button"
                    onClick={() => setSelectedLinhaFilter(linha)}
                    aria-pressed={selectedLinhaFilter === linha}
                    className={`min-h-11 rounded-lg px-3 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selectedLinhaFilter === linha ? 'bg-emerald-400 text-[#041007]' : 'text-slate-400 hover:text-slate-100'}`}
                  >
                    {linha}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
      </FilterPanel>

      {loading ? (
        <LoadingState label="Carregando histórico" description="Buscando os registros da sua unidade operacional." />
      ) : loadError ? (
        <ErrorState
          title="Não foi possível carregar o histórico"
          description={loadError}
          action={<Button type="button" onClick={() => void loadData()} leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}>Tentar novamente</Button>}
        />
      ) : apontamentos.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" aria-hidden="true" />} title="Seu histórico ainda está vazio" description="Os apontamentos enviados por esta unidade aparecerão aqui." />
      ) : filteredApontamentos.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" aria-hidden="true" />}
          title="Nenhum resultado para estes filtros"
          description="Os registros continuam no histórico. Ajuste ou limpe os filtros para visualizá-los."
          action={<Button type="button" variant="secondary" onClick={clearFilters} leftIcon={<RotateCcw className="size-4" aria-hidden="true" />}>Limpar filtros</Button>}
        />
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
    </PageContainer>
  );
};
