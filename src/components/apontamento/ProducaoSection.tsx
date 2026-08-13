import React, { useState, useRef } from 'react';
import { Linha, ProducaoItem, User } from '../../types';
import { LineSelector } from '../common/LineSelector';
import { parsePotencia, formatPotencia } from '../../utils/formatters';
import { ConfirmModal } from '../common/ConfirmModal';
import { Zap, Plus, Trash2, Edit2, Layers, Check } from 'lucide-react';

interface ProducaoSectionProps {
  user: User;
  producoes: ProducaoItem[];
  onAdd: (item: ProducaoItem) => void;
  onUpdate: (item: ProducaoItem) => void;
  onDelete: (id: string) => void;
}

export const ProducaoSection: React.FC<ProducaoSectionProps> = ({
  user,
  producoes,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const defaultLinha: Linha = user.linhas[0] || 'MON';
  const [selectedLinha, setSelectedLinha] = useState<Linha>(defaultLinha);
  const [potenciaInput, setPotenciaInput] = useState<string>('');
  const [quantidadeInput, setQuantidadeInput] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Duplicate prompt state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState<{
    existingItem: ProducaoItem;
    newQuantity: number;
  } | null>(null);

  // Delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const potenciaRef = useRef<HTMLInputElement>(null);

  const totalUnidades = producoes.reduce((sum, p) => sum + p.quantidade, 0);

  const handleAddOrUpdate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const potNum = parsePotencia(potenciaInput);
    const qtdNum = parseInt(quantidadeInput.trim(), 10);

    if (isNaN(potNum) || potNum <= 0) {
      alert('Informe uma potência válida (ex: 75, 112,5).');
      return;
    }

    if (isNaN(qtdNum) || qtdNum <= 0) {
      alert('Informe uma quantidade válida maior que 0.');
      return;
    }

    // Check if editing existing item in list
    if (editingId) {
      onUpdate({
        id: editingId,
        linha: selectedLinha,
        potencia: potNum,
        potenciaFormatted: formatPotencia(potNum),
        quantidade: qtdNum,
      });
      setEditingId(null);
      resetInputsAndFocus();
      return;
    }

    // Check for duplicate Line + Potência
    const existing = producoes.find(
      (p) => p.linha === selectedLinha && Math.abs(p.potencia - potNum) < 0.01
    );

    if (existing) {
      setDuplicatePending({
        existingItem: existing,
        newQuantity: qtdNum,
      });
      setDuplicateModalOpen(true);
      return;
    }

    // Normal Add
    onAdd({
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      linha: selectedLinha,
      potencia: potNum,
      potenciaFormatted: formatPotencia(potNum),
      quantidade: qtdNum,
    });

    resetInputsAndFocus();
  };

  const resetInputsAndFocus = () => {
    setPotenciaInput('');
    setQuantidadeInput('');
    if (potenciaRef.current) {
      potenciaRef.current.focus();
    }
  };

  const handleConfirmDuplicateAdd = () => {
    if (duplicatePending) {
      const { existingItem, newQuantity } = duplicatePending;
      // Add quantity to existing item
      onUpdate({
        ...existingItem,
        quantidade: existingItem.quantidade + newQuantity,
      });
    }
    setDuplicateModalOpen(false);
    setDuplicatePending(null);
    resetInputsAndFocus();
  };

  const handleConfirmDuplicateReplace = () => {
    if (duplicatePending) {
      const { existingItem, newQuantity } = duplicatePending;
      // Replace quantity
      onUpdate({
        ...existingItem,
        quantidade: newQuantity,
      });
    }
    setDuplicateModalOpen(false);
    setDuplicatePending(null);
    resetInputsAndFocus();
  };

  const handleStartEdit = (item: ProducaoItem) => {
    setEditingId(item.id);
    setSelectedLinha(item.linha);
    setPotenciaInput(formatPotencia(item.potencia));
    setQuantidadeInput(item.quantidade.toString());
    if (potenciaRef.current) {
      potenciaRef.current.focus();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetInputsAndFocus();
  };

  return (
    <div className="bg-[#0D120F] rounded-xl border border-white/10 p-5 sm:p-6 shadow-xs hover:border-white/15 transition-colors">
      {/* Header of Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/5 gap-2">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight">PRODUÇÃO POR POTÊNCIA</h2>
            <p className="text-xs text-slate-500">Informe as potências (kVA) e as respectivas quantidades produzidas.</p>
          </div>
        </div>

        {/* Total Badge */}
        <div className="flex items-center space-x-2 bg-[#090D0A] border border-white/10 px-3 py-1.5 rounded-lg w-fit">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500 font-medium">Total:</span>
          <span className="text-xs font-bold text-emerald-300">{totalUnidades} {totalUnidades === 1 ? 'unidade' : 'unidades'}</span>
        </div>
      </div>

      {/* Entry Form */}
      <form onSubmit={handleAddOrUpdate} className="mt-5 bg-[#090D0A] p-4 rounded-xl border border-white/10">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* Linha Selector (if user has 2 lines) */}
          {user.linhas.length > 1 && (
            <div className="sm:col-span-3">
              <LineSelector
                linhas={user.linhas}
                selectedLinha={selectedLinha}
                onChange={setSelectedLinha}
              />
            </div>
          )}

          {/* Potência input */}
          <div className={user.linhas.length > 1 ? 'sm:col-span-4' : 'sm:col-span-5'}>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Potência <span className="text-slate-500 font-normal">(kVA)</span>
            </label>
            <div className="relative">
              <input
                ref={potenciaRef}
                type="text"
                value={potenciaInput}
                onChange={(e) => setPotenciaInput(e.target.value)}
                placeholder="Ex: 75 ou 112,5"
                className="w-full bg-[#0D120F] border border-white/15 rounded-lg px-3 py-2 text-sm font-semibold text-slate-100 placeholder:text-slate-500 placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-12 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                kVA
              </span>
            </div>
          </div>

          {/* Quantidade input */}
          <div className={user.linhas.length > 1 ? 'sm:col-span-3' : 'sm:col-span-4'}>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Quantidade produzida
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantidadeInput}
              onChange={(e) => setQuantidadeInput(e.target.value)}
              placeholder="Ex: 6"
              className="w-full bg-[#0D120F] border border-white/15 rounded-lg px-3 py-2 text-sm font-semibold text-slate-100 placeholder:text-slate-500 placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Action button */}
          <div className={user.linhas.length > 1 ? 'sm:col-span-2' : 'sm:col-span-3'}>
            {editingId ? (
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-2xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-white/[0.10] hover:bg-white/[0.15] text-slate-300 font-semibold py-2 px-2 rounded-lg text-xs transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Production List */}
      <div className="mt-5 space-y-2">
        {producoes.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-white/10 rounded-xl bg-[#090D0A]">
            <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">Nenhuma produção adicionada</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Adicione a potência e quantidade acima para registrar a produção.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-[#0D120F]">
            {producoes.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 sm:px-4 hover:bg-[#090D0A] transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  {user.linhas.length > 1 && (
                    <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                      {item.linha}
                    </span>
                  )}
                  <div>
                    <span className="text-sm font-bold text-slate-100">
                      {item.potenciaFormatted || formatPotencia(item.potencia)} kVA
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <span className="text-xs font-bold text-slate-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                    {item.quantidade} {item.quantidade === 1 ? 'unidade' : 'unidades'}
                  </span>

                  <div className="flex items-center space-x-1">
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

      {/* Delete Item Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir registro de produção?"
        description="Esta ação removerá a potência da lista de apontamento atual."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />

      {/* Duplicate Power Modal */}
      {duplicateModalOpen && duplicatePending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#0D120F] rounded-xl max-w-md w-full p-6 shadow-xl border border-white/10">
            <h3 className="text-base font-bold text-slate-100">Registro duplicado detectado</h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Já existe um registro para a linha <strong className="text-slate-100">{duplicatePending.existingItem.linha}</strong> com potência{' '}
              <strong className="text-slate-100">{formatPotencia(duplicatePending.existingItem.potencia)} kVA</strong> (Quantidade atual:{' '}
              <strong>{duplicatePending.existingItem.quantidade}</strong>).
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Deseja somar a nova quantidade (<strong>+{duplicatePending.newQuantity}</strong>) ou substituir?
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setDuplicateModalOpen(false);
                  setDuplicatePending(null);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicateReplace}
                className="px-3 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 rounded-lg transition-colors"
              >
                Substituir ({duplicatePending.newQuantity})
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicateAdd}
                className="px-3 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors"
              >
                Somar ({duplicatePending.existingItem.quantidade + duplicatePending.newQuantity})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
