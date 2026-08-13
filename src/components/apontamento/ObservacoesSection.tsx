import React, { useState } from 'react';
import { Linha, Turno, ObservacaoItem, User } from '../../types';
import { LineSelector } from '../common/LineSelector';
import { ShiftSelector } from '../common/ShiftSelector';
import { ConfirmModal } from '../common/ConfirmModal';
import { MessageSquareText, Plus, Trash2, Edit2, Check } from 'lucide-react';

interface ObservacoesSectionProps {
  user: User;
  observacoes: ObservacaoItem[];
  onAdd: (item: ObservacaoItem) => void;
  onUpdate: (item: ObservacaoItem) => void;
  onDelete: (id: string) => void;
}

export const ObservacoesSection: React.FC<ObservacoesSectionProps> = ({
  user,
  observacoes,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const defaultLinha: Linha = user.linhas[0] || 'MON';
  const [selectedLinha, setSelectedLinha] = useState<Linha>(defaultLinha);
  const [selectedTurno, setSelectedTurno] = useState<Turno>('1º turno');
  const [textInput, setTextInput] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!textInput.trim()) {
      alert('Digite o texto da observação antes de adicionar.');
      return;
    }

    if (editingId) {
      onUpdate({
        id: editingId,
        linha: selectedLinha,
        turno: selectedTurno,
        observacao: textInput.trim(),
      });
      setEditingId(null);
    } else {
      onAdd({
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        linha: selectedLinha,
        turno: selectedTurno,
        observacao: textInput.trim(),
      });
    }

    setTextInput('');
  };

  const handleStartEdit = (item: ObservacaoItem) => {
    setEditingId(item.id);
    setSelectedLinha(item.linha);
    setSelectedTurno(item.turno);
    setTextInput(item.observacao);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTextInput('');
  };

  return (
    <div className="bg-[#0D120F] rounded-xl border border-white/10 p-5 sm:p-6 shadow-xs hover:border-white/15 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-white/[0.06] text-slate-300 rounded-lg shrink-0">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight">OBSERVAÇÕES OPERACIONAIS</h2>
            <p className="text-xs text-slate-500">Registre ocorrências, paradas de linha ou ressalvas da jornada.</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleAddOrUpdate} className="mt-5 bg-[#090D0A] p-4 rounded-xl border border-white/10 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {user.linhas.length > 1 && (
            <div className="sm:col-span-5">
              <LineSelector
                linhas={user.linhas}
                selectedLinha={selectedLinha}
                onChange={setSelectedLinha}
              />
            </div>
          )}

          <div className={user.linhas.length > 1 ? 'sm:col-span-7' : 'sm:col-span-12'}>
            <ShiftSelector
              selectedShift={selectedTurno}
              onChange={setSelectedTurno}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Observação do turno
          </label>
          <textarea
            rows={3}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Ex: A linha permaneceu parada durante 20 minutos no 1º turno para manutenção corretiva do equipamento."
            className="w-full bg-[#0D120F] border border-white/15 rounded-lg px-3 py-2 text-xs font-medium text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
          />
        </div>

        <div className="flex justify-end pt-1">
          {editingId ? (
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors shadow-2xs"
              >
                <Check className="w-4 h-4" />
                <span>Salvar alteração</span>
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
              <span>Adicionar observação</span>
            </button>
          )}
        </div>
      </form>

      {/* Observations List */}
      <div className="mt-5 space-y-2">
        {observacoes.length === 0 ? (
          <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-xl bg-[#090D0A]">
            <MessageSquareText className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-slate-500">Nenhuma observação adicionada</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Utilize este campo para relatar paradas ou avisos de turno.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-[#0D120F]">
            {observacoes.map((item) => (
              <div key={item.id} className="p-3 sm:px-4 hover:bg-[#090D0A] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      {user.linhas.length > 1 && (
                        <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                          {item.linha}
                        </span>
                      )}
                      <span className="bg-white/[0.06] text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-white/10">
                        {item.turno}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium bg-[#090D0A] p-2.5 rounded-lg border border-white/5">
                      {item.observacao}
                    </p>
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

      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir observação?"
        description="Esta ação removerá a observação da lista do apontamento atual."
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
