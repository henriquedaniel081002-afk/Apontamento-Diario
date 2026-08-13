import React, { useState, useEffect } from 'react';
import { User, Apontamento, Linha } from '../types';
import { apontamentoService } from '../services/apontamentoService';
import { formatDateBR, formatDateShort } from '../utils/formatters';
import { DetailModal } from '../components/historico/DetailModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EditApontamentoModal } from '../components/coordenacao/EditApontamentoModal';
import { LineSelector } from '../components/common/LineSelector';
import { Toast, ToastMessage } from '../components/common/Toast';
import { History, Calendar, Search, Eye, Trash2, Filter, Layers, Zap, UserX, MessageSquareText, ChevronRight, Pencil } from 'lucide-react';

interface HistoricoPageProps {
  user: User;
}

export const HistoricoPage: React.FC<HistoricoPageProps> = ({ user }) => {
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedLinhaFilter, setSelectedLinhaFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL'); // ALL, 7DAYS, MONTH
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [detailItem, setDetailItem] = useState<Apontamento | null>(null);
  const [editItem, setEditItem] = useState<Apontamento | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apontamentoService.getByUserSector(user.id, user.setor);
      setApontamentos(data);
    } catch (e) {
      console.error('Error loading history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);


  const handleSaveEdit = async (payload: Pick<Apontamento, 'data' | 'producoes' | 'faltas' | 'observacoes'>) => {
    if (!editItem) return;
    const updated = await apontamentoService.update(editItem.id, payload);
    setApontamentos((prev) => prev.map((apt) => apt.id === updated.id ? updated : apt));
    if (detailItem?.id === updated.id) setDetailItem(updated);
    setEditItem(null);
    setToast({
      id: Date.now().toString(),
      type: 'success',
      message: 'Apontamento atualizado com sucesso.',
    });
  };

  const handleDeleteRecord = async () => {
    if (!deleteId) return;
    try {
      await apontamentoService.delete(deleteId);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Apontamento excluído do histórico com sucesso.',
      });
      loadData();
    } catch (e) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: 'Erro ao excluir apontamento.',
      });
    } finally {
      setDeleteId(null);
    }
  };

  // Filter logic
  const filteredApontamentos = apontamentos.filter((apt) => {
    // Line filter
    if (selectedLinhaFilter !== 'ALL') {
      const hasLineInProducao = apt.producoes.some((p) => p.linha === selectedLinhaFilter);
      const hasLineInFalta = apt.faltas.some((f) => f.linha === selectedLinhaFilter);
      const hasLineInObs = apt.observacoes.some((o) => o.linha === selectedLinhaFilter);

      if (!hasLineInProducao && !hasLineInFalta && !hasLineInObs) {
        return false;
      }
    }

    // Search term (date or text)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const dateFormatted = formatDateBR(apt.data).toLowerCase();
      const dateRaw = apt.data.toLowerCase();
      const matchesDate = dateFormatted.includes(term) || dateRaw.includes(term);
      const matchesObs = apt.observacoes.some((o) => o.observacao.toLowerCase().includes(term));
      if (!matchesDate && !matchesObs) return false;
    }

    // Period filter
    if (periodFilter === '7DAYS') {
      const recordDate = new Date(apt.data + 'T00:00:00');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (recordDate < sevenDaysAgo) return false;
    } else if (periodFilter === 'MONTH') {
      const recordDate = new Date(apt.data + 'T00:00:00');
      const now = new Date();
      if (recordDate.getMonth() !== now.getMonth() || recordDate.getFullYear() !== now.getFullYear()) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      
      {/* Title */}
      <div className="bg-[#0D120F] p-5 sm:p-6 rounded-2xl border border-white/10 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            <span>Consultas e Registros</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Histórico de Apontamentos</h1>
          <p className="text-xs text-slate-500 mt-0.5">Visualização completa dos registros salvos no setor {user.setor}.</p>
        </div>

        <div className="bg-[#090D0A] border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 w-fit">
          <span>Setor: {user.setor}</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0D120F] p-4 rounded-xl border border-white/10 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por data (ex: 13/08/2026)..."
              className="w-full bg-[#090D0A] border border-white/15 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-[#0D120F] transition-all"
            />
          </div>

          {/* Period Dropdown */}
          <div className="sm:col-span-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="w-full bg-[#090D0A] border border-white/15 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">Todo o período</option>
                <option value="7DAYS">Últimos 7 dias</option>
                <option value="MONTH">Este mês</option>
              </select>
            </div>
          </div>

          {/* Line Filter (if user has > 1 line) */}
          {user.linhas.length > 1 && (
            <div className="sm:col-span-3 flex justify-start sm:justify-end">
              <div className="inline-flex p-1 bg-white/[0.06] rounded-lg border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedLinhaFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                    selectedLinhaFilter === 'ALL'
                      ? 'bg-emerald-500 text-[#041007] shadow-xs'
                      : 'text-slate-500 hover:text-slate-100'
                  }`}
                >
                  Todas
                </button>
                {user.linhas.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setSelectedLinhaFilter(l)}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                      selectedLinhaFilter === l
                        ? 'bg-emerald-500 text-[#041007] shadow-xs'
                        : 'text-slate-500 hover:text-slate-100'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* History List */}
      {loading ? (
        <div className="bg-[#0D120F] border border-white/10 rounded-2xl p-12 text-center text-slate-500">
          <p className="text-xs font-semibold">Carregando histórico...</p>
        </div>
      ) : filteredApontamentos.length === 0 ? (
        <div className="bg-[#0D120F] border border-white/10 rounded-2xl p-12 text-center space-y-2">
          <History className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Nenhum apontamento encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Não existem registros no histórico para os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApontamentos.map((apt) => {
            const totalProd = apt.producoes.reduce((s, p) => s + p.quantidade, 0);
            const totalFaltas = apt.faltas.reduce((s, f) => s + f.quantidade, 0);

            return (
              <div
                key={apt.id}
                className="bg-[#0D120F] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-white/15 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left Info */}
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

                  {/* Summary Counters Pills */}
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

                {/* Right Actions */}
                <div className="flex items-center space-x-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                  <button
                    onClick={() => setDetailItem(apt)}
                    className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                  >
                    <Eye className="w-4 h-4 text-slate-500" />
                    <span>Ver detalhes</span>
                  </button>


                  <button
                    onClick={() => setEditItem(apt)}
                    className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors border border-emerald-500/20"
                    title="Editar este apontamento"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Editar</span>
                  </button>

                  <button
                    onClick={() => setDeleteId(apt.id)}
                    title="Excluir apontamento do histórico"
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

      {/* Detail Modal */}
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
        contextLabel="Correção do próprio apontamento"
      />

      {/* Delete Record Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir apontamento?"
        description="Esta ação removerá permanentemente este registro de apontamento diário do histórico."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteRecord}
        onCancel={() => setDeleteId(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
