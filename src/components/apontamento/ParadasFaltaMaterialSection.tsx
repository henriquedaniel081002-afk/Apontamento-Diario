import React, { useId, useState } from 'react';
import { Boxes, Check, Edit2, Plus, Trash2 } from 'lucide-react';
import { ParadaFaltaMaterialItem } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button, EmptyState, FieldError, Surface } from '../common/ui';

interface Props {
  itens: ParadaFaltaMaterialItem[];
  onAdd: (item: ParadaFaltaMaterialItem) => void;
  onUpdate: (item: ParadaFaltaMaterialItem) => void;
  onDelete: (id: string) => void;
}

export const ParadasFaltaMaterialSection: React.FC<Props> = ({ itens, onAdd, onUpdate, onDelete }) => {
  const causaId = useId();
  const materialId = useId();
  const inicioId = useId();
  const fimId = useId();
  const [causaMotivo, setCausaMotivo] = useState('');
  const [material, setMaterial] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setCausaMotivo(''); setMaterial(''); setHoraInicio(''); setHoraFim(''); setError(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!causaMotivo.trim() || !material.trim() || !horaInicio || !horaFim) {
      setError('Preencha causa/motivo, material, hora de início e hora de fim.');
      return;
    }
    const item: ParadaFaltaMaterialItem = {
      id: editingId || `material-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      causaMotivo: causaMotivo.trim(), material: material.trim(), horaInicio, horaFim,
    };
    editingId ? onUpdate(item) : onAdd(item);
    setEditingId(null); clear();
  };

  const edit = (item: ParadaFaltaMaterialItem) => {
    setEditingId(item.id); setCausaMotivo(item.causaMotivo); setMaterial(item.material);
    setHoraInicio(item.horaInicio); setHoraFim(item.horaFim); setError(null);
  };

  return (
    <Surface as="section" className="record-industrial overflow-hidden" aria-labelledby="material-title">
      <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] p-5 sm:p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><Boxes className="h-5 w-5" /></span>
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Ocorrência opcional</p><h2 id="material-title" className="text-lg font-bold text-[var(--text-primary)]">Parada por Falta de Material</h2><p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Adicione quantas paradas forem necessárias. Se não houve ocorrência, deixe esta etapa vazia.</p></div>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label htmlFor={causaId} className="block"><span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Causa / Motivo</span><input id={causaId} value={causaMotivo} onChange={(e) => { setCausaMotivo(e.target.value); setError(null); }} className="field-control" placeholder="Ex.: Material não abastecido" /></label>
            <label htmlFor={materialId} className="block"><span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Material</span><input id={materialId} value={material} onChange={(e) => { setMaterial(e.target.value); setError(null); }} className="field-control" placeholder="Ex.: Chapa 2 mm" /></label>
            <label htmlFor={inicioId} className="block"><span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Hora de início</span><input id={inicioId} type="time" value={horaInicio} onChange={(e) => { setHoraInicio(e.target.value); setError(null); }} className="field-control [color-scheme:dark]" /></label>
            <label htmlFor={fimId} className="block"><span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Hora de fim</span><input id={fimId} type="time" value={horaFim} onChange={(e) => { setHoraFim(e.target.value); setError(null); }} className="field-control [color-scheme:dark]" /></label>
          </div>
          <FieldError role="alert">{error}</FieldError>
          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">{editingId && <Button variant="ghost" onClick={() => { setEditingId(null); clear(); }}>Cancelar edição</Button>}<Button type="submit" leftIcon={editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}>{editingId ? 'Salvar parada' : 'Adicionar parada'}</Button></div>
        </form>
        {itens.length === 0 ? <EmptyState icon={<Boxes className="h-6 w-6" />} title="Nenhuma parada por falta de material" description="Não é necessário adicionar nada quando não houver ocorrência." /> : <ul className="space-y-2">{itens.map((item, index) => <li key={item.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Parada #{index + 1}</p><p className="mt-1 font-bold text-[var(--text-primary)]">{item.material}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.causaMotivo}</p><p className="mt-2 text-xs font-semibold text-[var(--text-tertiary)]">{item.horaInicio} → {item.horaFim}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Editar parada" onClick={() => edit(item)}><Edit2 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Excluir parada" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button></div></div></li>)}</ul>}
      </div>
      <ConfirmModal isOpen={Boolean(deleteId)} title="Excluir parada?" description="Esta ocorrência será removida do apontamento." confirmLabel="Excluir" onConfirm={() => { if (deleteId) onDelete(deleteId); if (editingId === deleteId) { setEditingId(null); clear(); } setDeleteId(null); }} onCancel={() => setDeleteId(null)} />
    </Surface>
  );
};
