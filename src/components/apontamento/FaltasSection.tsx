import React, { useState } from 'react';
import { Linha, Turno, FaltaItem, User } from '../../types';
import { LineSelector } from '../common/LineSelector';
import { ShiftSelector } from '../common/ShiftSelector';
import { ConfirmModal } from '../common/ConfirmModal';
import { UserX, Plus, Trash2, Edit2, Check } from 'lucide-react';

interface FaltasSectionProps {
  user: User;
  faltas: FaltaItem[];
  onAdd: (item: FaltaItem) => void;
  onUpdate: (item: FaltaItem) => void;
  onDelete: (id: string) => void;
}

export const FaltasSection: React.FC<FaltasSectionProps> = ({
  user,
  faltas,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const defaultLinha: Linha = user.linhas[0] || 'MON';
  const [selectedLinha, setSelectedLinha] = useState<Linha>(defaultLinha);
  const [selectedTurno, setSelectedTurno] = useState<Turno>('1º turno');
  const [quantidadeInput, setQuantidadeInput] = useState<string>('');
  const [justificativaInput, setJustificativaInput] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalFaltas = faltas.reduce((sum, f) => sum + f.quantidade, 0);

  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();

    const qtdNum = parseInt(quantidadeInput.trim(), 10);
    if (isNaN(qtdNum) || qtdNum <= 0) {
      alert('Informe uma quantidade de faltas válida maior que 0.');
      return;
    }

    if (editingId) {
      onUpdate({
        id: editingId,
        linha: selectedLinha,
        turno: selectedTurno,
        quantidade: qtdNum,
        justificativa: justificativaInput.trim() || undefined,
      });
      setEditingId(null);
    } else {
      onAdd({
        id: `falta-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        linha: selectedLinha,
        turno: selectedTurno,
        quantidade: qtdNum,
        justificativa: justificativaInput.trim() || undefined,
      });
    }

    setQuantidadeInput('');
    setJustificativaInput('');
  };

  const handleStartEdit = (item: FaltaItem) => {
    setEditingId(item.id);
    setSelectedLinha(item.linha);
    setSelectedTurno(item.turno);
    setQuantidadeInput(item.quantidade.toString());
    setJustificativaInput(item.justificativa || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setQuantidadeInput('');
    setJustificativaInput('');
  };

  return (
    <div className="bg-[#0D120F] rounded-xl border border-white/10 p-5 sm:p-6 shadow-xs hover:border-white/15 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/5 gap-2">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight">FALTAS E AUSÊNCIAS</h2>
            <p className="text-xs text-slate-500">Registre o número de faltas do turno e a justificativa operacional (opcional).</p>
          </div>
        </div>

        {/* Total Badge */}
        <div className="flex items-center space-x-2 bg-[#090D0A] border border-white/10 px-3 py-1.5 rounded-lg w-fit">
          <span className="text-xs text-slate-500 font-medium">Total de faltas:</span>
          <span className={`text-xs font-bold ${totalFaltas > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {totalFaltas} {totalFaltas === 1 ? 'falta' : 'faltas'}
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleAddOrUpdate} className="mt-5 bg-[#090D0A] p-4 rounded-xl border border-white/10 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* Linha Selector */}
          {user.linhas.length > 1 && (
            <div className="sm:col-span-4">
              <LineSelector
                linhas={user.linhas}
                selectedLinha={selectedLinha}
                onChange={setSelectedLinha}
              />
            </div>
          )}

          {/* Turno Selector */}
          <div className={user.linhas.length > 1 ? 'sm:col-span-5' : 'sm:col-span-6'}>
            <ShiftSelector
              selectedShift={selectedTurno}
              onChange={setSelectedTurno}
            />
          </div>

          {/* Quantidade input */}
          <div className={user.linhas.length > 1 ? 'sm:col-span-3' : 'sm:col-span-6'}>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Quantidade de faltas
            </label>
            <input
              type="number"
              min="1"
              value={quantidadeInput}
              onChange={(e) => setQuantidadeInput(e.target.value)}
              placeholder="Ex: 2"
              className="w-full bg-[#0D120F] border border-white/15 rounded-lg px-3 py-2 text-sm font-semibold text-slate-100 placeholder:text-slate-500 placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Justificativa textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Justificativa <span className="text-slate-500 font-normal">(opcional)</span>
          </label>
          <textarea
            rows={2}
            value={justificativaInput}
            onChange={(e) => setJustificativaInput(e.target.value)}
            placeholder="Ex: 1 funcionário apresentou atestado médico e 1 falta não justificada."
            className="w-full bg-[#0D120F] border border-white/15 rounded-lg px-3 py-2 text-xs font-medium text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
          />
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          {editingId ? (
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors shadow-2xs"
              >
                <Check className="w-4 h-4" />
                <span>Salvar falta</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-white/[0.10] hover:bg-white/[0.15] text-slate-300 font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="submit"
              className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#041007] font-bold py-2 px-4 rounded-lg text-xs transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar falta</span>
            </button>
          )}
        </div>
      </form>

      {/* Absences List */}
      <div className="mt-5 space-y-2">
        {faltas.length === 0 ? (
          <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-xl bg-[#090D0A]">
            <UserX className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-slate-500">Nenhuma falta registrada</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Se houver ausências no turno, registre os detalhes acima.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-[#0D120F]">
            {faltas.map((item) => (
              <div key={item.id} className="p-3 sm:px-4 hover:bg-[#090D0A] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      {user.linhas.length > 1 && (
                        <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                          {item.linha}
                        </span>
                      )}
                      <span className="bg-amber-500/15 text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
                        {item.turno}
                      </span>
                      <span className="text-xs font-bold text-slate-100">
                        {item.quantidade} {item.quantidade === 1 ? 'falta' : 'faltas'}
                      </span>
                    </div>

                    {item.justificativa && (
                      <p className="text-xs text-slate-500 bg-[#090D0A] p-2 rounded-lg border border-white/5 mt-1">
                        <strong className="text-slate-300">Justificativa:</strong> {item.justificativa}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(item)}
                      title="Editar"
                      className="text-slate-500 hover:text-emerald-400 p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      title="Excluir"
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir falta registrada?"
        description="Esta ação removerá o registro de falta da lista de apontamento atual."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};
