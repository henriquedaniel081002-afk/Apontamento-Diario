import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileUp,
  Filter,
  Inbox,
  ListFilter,
  RefreshCw,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { Apontamento, ApontamentoEditPayload, ProductionImportGroup, StatusAprovacao, User } from '../types';
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
import { ImportProductionModal } from '../components/coordenacao/ImportProductionModal';
import { ImportProgramacaoModal } from '../components/coordenacao/ImportProgramacaoModal';
import type { ProgramacaoImportGroup } from '../utils/importProgramacaoExcel';
import { CoordinationRecords } from '../components/coordenacao/CoordinationRecords';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Toast, ToastMessage } from '../components/common/Toast';
import { CustomSelect } from '../components/common/CustomSelect';
import {
  Button,
  DateInput,
  EmptyState,
  ErrorState,
  Field,
  FilterPanel,
  LoadingState,
  MetricCard,
  PageContainer,
  PageHeader,
} from '../components/common/ui';

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
  return (
    <MetricCard
      label={label}
      value={value}
      description={helper}
      icon={icon}
      tone={tone}
      className="min-h-32"
    />
  );
}

export const CoordenacaoPage: React.FC<CoordenacaoPageProps> = ({ user }) => {
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [programacaoImportOpen, setProgramacaoImportOpen] = useState(false);
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
    payload: ApontamentoEditPayload,
  ) => {
    if (!editItem) return;
    const updated = await coordenacaoService.update(editItem.id, payload);
    setApontamentos((current) => current
      .map((record) => record.id === updated.id ? updated : record)
      .sort((a, b) => b.data.localeCompare(a.data) || Number(b.id) - Number(a.id)));
    if (detailItem?.id === updated.id) setDetailItem(updated);
    setEditItem(null);
    setToast({ id: Date.now().toString(), type: 'success', message: updated.origemProducao === 'IMPORTADO' ? 'Apontamento atualizado e finalizado. Já está disponível para aprovação.' : 'Apontamento atualizado com sucesso.' });
  };

  const handleImportProduction = async (data: string, groups: ProductionImportGroup[]) => {
    const result = await coordenacaoService.importProduction({ data, grupos: groups });
    setDataFilter(data);
    setSetorFilter('ALL');
    setLinhaFilter('ALL');
    setPotenciaFilter('ALL');
    await loadData(false);
    setToast({
      id: Date.now().toString(),
      type: 'success',
      message: `Produção de ${formatDateBR(data)} importada: ${result.totalQuantidade.toLocaleString('pt-BR')} unidades em ${result.totalUnidades} unidade(s) operacional(is).`,
    });
  };

  const handleImportProgramacao = async (mesReferencia: string, grupos: ProgramacaoImportGroup[]) => {
    const result = await coordenacaoService.importProgramacao({ mesReferencia, grupos });
    const [ano, mes] = result.mesReferencia.split('-');
    setToast({
      id: Date.now().toString(),
      type: 'success',
      message: `Programação de ${mes}/${ano} substituída com sucesso: ${result.totalQuantidade.toLocaleString('pt-BR')} unidades em ${result.grupos.toLocaleString('pt-BR')} combinações consolidadas.`,
    });
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
    <PageContainer className="app-page space-y-5 py-6 sm:py-8">
      <PageHeader
        icon={<ShieldCheck className="size-5" aria-hidden="true" />}
        eyebrow="Acesso da coordenação"
        title="Visão geral dos apontamentos"
        description="Acompanhe a cobertura diária, analise registros e exporte o recorte filtrado."
        metadata={<span>Sessão: <strong className="text-[var(--text-primary)]">{user.name}</strong></span>}
        actions={<>
          <Button type="button" onClick={() => setImportOpen(true)} disabled={loading} leftIcon={<FileUp className="size-4" aria-hidden="true" />}>Importar produção</Button>
          <Button type="button" variant="secondary" onClick={() => setProgramacaoImportOpen(true)} disabled={loading} leftIcon={<FileSpreadsheet className="size-4" aria-hidden="true" />}>Importar programação</Button>
          <Button type="button" variant="success" onClick={() => void handleExport()} disabled={loading || !!loadError || exporting} isLoading={exporting} loadingLabel="Exportando…" leftIcon={<Download className="size-4" aria-hidden="true" />}>Exportar Excel</Button>
          <Button type="button" variant="ghost" onClick={() => void loadData(true)} disabled={loading} leftIcon={<RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />}>Atualizar</Button>
        </>}
      />

      {loading ? (
        <LoadingState label="Carregando indicadores" description="Atualizando cobertura, pendências e registros do dia." />
      ) : loadError ? (
        <ErrorState
          title="Não foi possível carregar os apontamentos"
          description={<>{loadError} Os indicadores foram ocultados para não apresentar números incompletos.</>}
          action={<Button type="button" onClick={() => void loadData(true)} leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}>Tentar novamente</Button>}
        />
      ) : (
        <section aria-label="Indicadores do dia" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
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
          <EmptyState icon={<CalendarDays className="size-6" aria-hidden="true" />} title="Selecione uma data para analisar as pendências" description="Nenhum status de conclusão é calculado sem uma data de referência." />
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

      <FilterPanel
        aria-label="Filtros dos registros"
        title={<span className="flex items-center gap-2"><Filter className="size-4 text-emerald-400" aria-hidden="true" />Filtros dos registros</span>}
        description="A lista e a exportação respeitam este mesmo recorte."
        actions={<Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={!hasFilters} leftIcon={<ListFilter className="size-4" aria-hidden="true" />}>Limpar filtros</Button>}
        contentClassName="sm:[grid-template-columns:repeat(2,minmax(0,1fr))] xl:[grid-template-columns:repeat(4,minmax(0,1fr))]"
      >
          <Field label="Data" htmlFor="coord-date-filter">
            <DateInput
              id="coord-date-filter"
              value={dataFilter}
              onChange={(event) => setDataFilter(event.target.value)}
            />
          </Field>

          <Field label="Setor">
            <CustomSelect
              value={setorFilter}
              onChange={setSetorFilter}
              ariaLabel="Filtrar por setor"
              options={[
                { value: 'ALL', label: 'Todos os setores' },
                ...setores.map((setor) => ({ value: setor, label: setor })),
              ]}
            />
          </Field>

          <Field label="Linha">
            <CustomSelect
              value={linhaFilter}
              onChange={setLinhaFilter}
              ariaLabel="Filtrar por linha"
              options={[
                { value: 'ALL', label: 'Todas as linhas' },
                ...linhas.map((linha) => ({ value: linha, label: linha })),
              ]}
            />
          </Field>

          <Field label="Potência">
            <CustomSelect
              value={potenciaFilter}
              onChange={setPotenciaFilter}
              ariaLabel="Filtrar por potência"
              options={[
                { value: 'ALL', label: 'Todas as potências' },
                ...potencias.map((potencia) => ({ value: String(potencia), label: `${formatPotencia(potencia)} kVA` })),
              ]}
            />
          </Field>
      </FilterPanel>

      {!loading && !loadError && (
        apontamentos.length === 0 ? (
          <EmptyState icon={<Inbox className="size-6" aria-hidden="true" />} title="Ainda não há apontamentos registrados" description="Quando as unidades enviarem registros, eles aparecerão nesta visão." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ListFilter className="size-6" aria-hidden="true" />}
            title="Nenhum registro corresponde aos filtros"
            description="A cobertura diária acima continua sendo calculada apenas pela data selecionada."
            action={<Button type="button" variant="secondary" onClick={clearFilters} leftIcon={<ListFilter className="size-4" aria-hidden="true" />}>Limpar filtros</Button>}
          />
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

      <ImportProductionModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportProduction}
      />
      <ImportProgramacaoModal
        isOpen={programacaoImportOpen}
        onClose={() => setProgramacaoImportOpen(false)}
        onImport={handleImportProgramacao}
      />

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
    </PageContainer>
  );
};
