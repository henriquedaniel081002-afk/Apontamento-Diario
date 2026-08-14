import React, { useEffect, useMemo, useState } from 'react';
import { Apontamento, Setor, User } from '../types';
import { coordenacaoService } from '../services/coordenacaoService';
import { formatDateBR, formatDateShort, formatPotencia } from '../utils/formatters';
import { exportApontamentosExcel } from '../utils/exportExcel';
import { DetailModal } from '../components/historico/DetailModal';
import { EditApontamentoModal } from '../components/coordenacao/EditApontamentoModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Toast, ToastMessage } from '../components/common/Toast';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  ListFilter,
  MessageSquareText,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserX,
  Zap,
} from 'lucide-react';

interface CoordenacaoPageProps {
  user: User;
}

function formatLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPreviousWorkingDayYmd(): string {
  const date = new Date();
  const day = date.getDay();

  // Segunda-feira volta para sexta. No fim de semana, mantém a referência na sexta-feira.
  const daysToSubtract = day === 1 ? 3 : day === 0 ? 2 : 1;
  date.setDate(date.getDate() - daysToSubtract);
  return formatLocalYmd(date);
}

type UnidadeApontamento = {
  id: string;
  label: string;
  setor: Setor;
  linha?: 'MON' | 'TRI' | 'EPO';
};

// Unidades que precisam apontar separadamente.
const UNIDADES_APONTAMENTO: UnidadeApontamento[] = [
  { id: 'BOBINA AT', label: 'Bobina AT', setor: 'BOBINA AT' },
  { id: 'BOBINA BT', label: 'Bobina BT', setor: 'BOBINA BT' },
  { id: 'CORTE LASER', label: 'Corte do Laser', setor: 'CORTE LASER' },
  { id: 'ISOLANTE', label: 'Isolante', setor: 'ISOLANTE' },
  { id: 'MONTAGEM NUCLEO', label: 'Montagem do Núcleo', setor: 'MONTAGEM NUCLEO' },
  { id: 'MONTAGEM FINAL MON', label: 'Montagem Final MON', setor: 'MONTAGEM FINAL', linha: 'MON' },
  { id: 'MONTAGEM FINAL TRI', label: 'Montagem Final TRI', setor: 'MONTAGEM FINAL', linha: 'TRI' },
  { id: 'MPA MON', label: 'MPA MON', setor: 'MPA', linha: 'MON' },
  { id: 'MPA TRI', label: 'MPA TRI', setor: 'MPA', linha: 'TRI' },
  { id: 'PINTURA', label: 'Pintura', setor: 'PINTURA' },
  { id: 'SOLDA', label: 'Solda', setor: 'SOLDA' },
  { id: 'EPOXI', label: 'Epóxi', setor: 'EPOXI' },
];

function apontamentoTemLinha(apontamento: Apontamento, linha: 'MON' | 'TRI' | 'EPO'): boolean {
  // linhasPermitidas permite identificar o usuário mesmo quando o apontamento
  // não possui itens de produção, faltas ou observações.
  if (apontamento.linhasPermitidas?.includes(linha)) return true;

  return (
    apontamento.producoes.some((item) => item.linha === linha) ||
    apontamento.faltas.some((item) => item.linha === linha) ||
    apontamento.observacoes.some((item) => item.linha === linha)
  );
}

function unidadeFoiApontada(unidade: UnidadeApontamento, apontamentosDoDia: Apontamento[]): boolean {
  return apontamentosDoDia.some((apontamento) => {
    if (String(apontamento.setor) !== unidade.setor) return false;
    if (!unidade.linha) return true;
    return apontamentoTemLinha(apontamento, unidade.linha);
  });
}

export const CoordenacaoPage: React.FC<CoordenacaoPageProps> = ({ user }) => {
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFilter, setDataFilter] = useState(() => getPreviousWorkingDayYmd());
  const [setorFilter, setSetorFilter] = useState('ALL');
  const [linhaFilter, setLinhaFilter] = useState('ALL');
  const [potenciaFilter, setPotenciaFilter] = useState('ALL');
  const [detailItem, setDetailItem] = useState<Apontamento | null>(null);
  const [editItem, setEditItem] = useState<Apontamento | null>(null);
  const [deleteItem, setDeleteItem] = useState<Apontamento | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await coordenacaoService.getAll();
      setApontamentos(data);
    } catch (e) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: e instanceof Error ? e.message : 'Falha ao carregar os apontamentos.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const setores = useMemo<string[]>(
    () => Array.from(new Set<string>(apontamentos.map((apt) => String(apt.setor)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [apontamentos],
  );

  const linhas = useMemo(() => {
    const values = apontamentos.flatMap((apt) => [
      ...apt.producoes.map((x) => x.linha),
      ...apt.faltas.map((x) => x.linha),
      ...apt.observacoes.map((x) => x.linha),
    ]);
    return Array.from(new Set<string>(values.filter(Boolean).map(String))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [apontamentos]);

  const potencias = useMemo<number[]>(() => {
    const values = apontamentos.flatMap((apt) => apt.producoes.map((x) => Number(x.potencia))).filter(Number.isFinite);
    return Array.from(new Set<number>(values)).sort((a, b) => a - b);
  }, [apontamentos]);


  const dataReferenciaPendencias = dataFilter;

  const unidadesSemApontamento = useMemo(() => {
    if (!dataReferenciaPendencias) return [];

    const apontamentosDoDia = apontamentos.filter((apt) => apt.data === dataReferenciaPendencias);
    return UNIDADES_APONTAMENTO.filter((unidade) => !unidadeFoiApontada(unidade, apontamentosDoDia));
  }, [apontamentos, dataReferenciaPendencias]);

  const filtered = useMemo(() => apontamentos.filter((apt) => {
    if (dataFilter && apt.data !== dataFilter) return false;
    if (setorFilter !== 'ALL' && apt.setor !== setorFilter) return false;

    if (linhaFilter !== 'ALL') {
      const matches =
        apt.producoes.some((x) => x.linha === linhaFilter) ||
        apt.faltas.some((x) => x.linha === linhaFilter) ||
        apt.observacoes.some((x) => x.linha === linhaFilter);
      if (!matches) return false;
    }

    if (potenciaFilter !== 'ALL') {
      const wanted = Number(potenciaFilter);
      const matchesPotencia = apt.producoes.some((x) =>
        Math.abs(Number(x.potencia) - wanted) < 0.001 &&
        (linhaFilter === 'ALL' || x.linha === linhaFilter)
      );
      if (!matchesPotencia) return false;
    }

    return true;
  }), [apontamentos, dataFilter, setorFilter, linhaFilter, potenciaFilter]);

  const hasFilters = dataFilter !== getPreviousWorkingDayYmd() || setorFilter !== 'ALL' || linhaFilter !== 'ALL' || potenciaFilter !== 'ALL';

  const clearFilters = () => {
    setDataFilter(getPreviousWorkingDayYmd());
    setSetorFilter('ALL');
    setLinhaFilter('ALL');
    setPotenciaFilter('ALL');
  };

  const handleSaveEdit = async (payload: Pick<Apontamento, 'data' | 'producoes' | 'faltas' | 'observacoes'>) => {
    if (!editItem) return;
    const updated = await coordenacaoService.update(editItem.id, payload);
    setApontamentos((prev) =>
      prev
        .map((apt) => apt.id === updated.id ? updated : apt)
        .sort((a, b) => b.data.localeCompare(a.data) || Number(b.id) - Number(a.id))
    );
    setEditItem(null);
    setToast({ id: Date.now().toString(), type: 'success', message: 'Apontamento atualizado com sucesso.' });
  };

  const handleExport = async () => {
    try {
      await exportApontamentosExcel(filtered);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: `Excel gerado com ${filtered.length} apontamento(s).`,
      });
    } catch (e) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: e instanceof Error ? e.message : 'Falha ao gerar o Excel.',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await coordenacaoService.delete(deleteItem.id);
      setApontamentos((prev) => prev.filter((apt) => apt.id !== deleteItem.id));
      if (detailItem?.id === deleteItem.id) setDetailItem(null);
      if (editItem?.id === deleteItem.id) setEditItem(null);
      setToast({ id: Date.now().toString(), type: 'success', message: 'Apontamento excluído com sucesso.' });
    } catch (e) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: e instanceof Error ? e.message : 'Falha ao excluir o apontamento.',
      });
    } finally {
      setDeleteItem(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="bg-[#0D120F] p-5 sm:p-6 rounded-2xl border border-white/10 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Acesso da Coordenação</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Apontamentos Gerais</h1>
          <p className="text-xs text-slate-500 mt-0.5">Consulte, filtre, edite e exclua registros de todos os setores.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="bg-[#090D0A] border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300">
            {filtered.length} de {apontamentos.length} registros
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || filtered.length === 0}
            title="Exportar os registros filtrados para Excel"
            className="px-3 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-xs font-black"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Atualizar dados"
            className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs ${unidadesSemApontamento.length > 0 ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-emerald-500/[0.06] border-emerald-500/20'}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl border ${unidadesSemApontamento.length > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
            {unidadesSemApontamento.length > 0
              ? <AlertTriangle className="w-4 h-4" />
              : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Setores sem apontamento na data selecionada
              </h2>
              <span className="text-[11px] font-bold text-slate-500">{formatDateBR(dataReferenciaPendencias)}</span>
            </div>

            {unidadesSemApontamento.length > 0 ? (
              <>
                <p className="text-xs text-slate-500 mt-1">
                  {unidadesSemApontamento.length} setor(es)/linha(s) ainda não registraram nenhum apontamento em {formatDateBR(dataReferenciaPendencias)}.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {unidadesSemApontamento.map((unidade) => (
                    <span
                      key={unidade.id}
                      className="px-2.5 py-1 rounded-lg border border-amber-500/20 bg-amber-500/10 text-[11px] font-bold text-amber-200"
                    >
                      {unidade.label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs font-semibold text-emerald-300 mt-1">
                Todos os setores/linhas esperados já registraram pelo menos um apontamento em {formatDateBR(dataReferenciaPendencias)}.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#0D120F] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-2xs">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Dia</label>
            <input
              type="date"
              value={dataFilter}
              onChange={(e) => setDataFilter(e.target.value)}
              className="w-full bg-[#090D0A] border border-white/15 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Setor</label>
            <select
              value={setorFilter}
              onChange={(e) => setSetorFilter(e.target.value)}
              className="w-full bg-[#090D0A] border border-white/15 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Todos os setores</option>
              {setores.map((setor) => <option key={setor} value={setor}>{setor}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Linha</label>
            <select
              value={linhaFilter}
              onChange={(e) => setLinhaFilter(e.target.value)}
              className="w-full bg-[#090D0A] border border-white/15 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Todas as linhas</option>
              {linhas.map((linha) => <option key={linha} value={linha}>{linha}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Potência</label>
            <select
              value={potenciaFilter}
              onChange={(e) => setPotenciaFilter(e.target.value)}
              className="w-full bg-[#090D0A] border border-white/15 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Todas as potências</option>
              {potencias.map((potencia) => (
                <option key={potencia} value={String(potencia)}>{formatPotencia(potencia)} kVA</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ListFilter className="w-4 h-4" />
            Limpar filtros
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-[#0D120F] border border-white/10 rounded-2xl p-12 text-center text-slate-500">
          <RefreshCw className="w-7 h-7 animate-spin text-emerald-400 mx-auto mb-3" />
          <p className="text-xs font-semibold">Carregando apontamentos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0D120F] border border-white/10 rounded-2xl p-12 text-center space-y-2">
          <ListFilter className="w-9 h-9 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Nenhum apontamento encontrado</h3>
          <p className="text-xs text-slate-500">Não existem registros para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((apt) => {
            const totalProd = apt.producoes.reduce((sum, item) => sum + item.quantidade, 0);
            const totalFaltas = apt.faltas.reduce((sum, item) => sum + item.quantidade, 0);

            return (
              <div
                key={apt.id}
                className="bg-[#0D120F] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-white/15 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                    <span className="text-sm font-black text-slate-100 flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>{formatDateBR(apt.data)}</span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">({formatDateShort(apt.data)})</span>
                    <span className="bg-white/[0.06] text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10">
                      {apt.setor}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center space-x-1 bg-emerald-500/10 text-emerald-200 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-bold">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Produção: {totalProd} unid.</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg font-bold">
                      <UserX className="w-3.5 h-3.5 text-amber-400" />
                      <span>Faltas: {totalFaltas}</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 bg-[#090D0A] text-slate-300 border border-white/10 px-2.5 py-1 rounded-lg font-semibold">
                      <MessageSquareText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Obs: {apt.observacoes.length}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                  <button
                    type="button"
                    onClick={() => setEditItem(apt)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailItem(apt)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                  >
                    <Eye className="w-4 h-4 text-slate-500" />
                    <span>Ver detalhes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteItem(apt)}
                    title="Excluir apontamento"
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DetailModal
        apontamento={detailItem}
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
      />

      <EditApontamentoModal
        apontamento={editItem}
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSaveEdit}
      />

      <ConfirmModal
        isOpen={!!deleteItem}
        title="Excluir apontamento?"
        description={deleteItem ? `O registro de ${formatDateBR(deleteItem.data)} do setor ${deleteItem.setor} será removido permanentemente.` : ''}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
