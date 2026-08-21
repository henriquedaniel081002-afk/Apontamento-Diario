import React, { useId, useState } from 'react';
import { Check, Edit2, Plus, Trash2, UserX } from 'lucide-react';
import { FaltaItem } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button, EmptyState, FieldError, Surface } from '../common/ui';
import { CustomSelect } from '../common/CustomSelect';

interface FaltasSectionProps {
  faltas: FaltaItem[];
  onAdd: (item: FaltaItem) => void;
  onUpdate: (item: FaltaItem) => void;
  onDelete: (id: string) => void;
}

function isLegacy(item: FaltaItem): boolean {
  return !item.nome && Boolean(item.linha || item.turno || item.quantidade || item.justificativa);
}

export const FaltasSection: React.FC<FaltasSectionProps> = ({ faltas, onAdd, onUpdate, onDelete }) => {
  const nomeId = useId();
  const motivoId = useId();
  const atestadoId = useId();
  const [nome, setNome] = useState('');
  const [motivoJustificativa, setMotivo] = useState('');
  const [atestado, setAtestado] = useState<'SIM' | 'NAO' | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clear = () => { setNome(''); setMotivo(''); setAtestado(''); setError(null); };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const item: FaltaItem = {
      id: editingId || `falta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: nome.trim(),
      motivoJustificativa: motivoJustificativa.trim(),
      atestado: atestado ? atestado === 'SIM' : undefined,
    };
    editingId ? onUpdate(item) : onAdd(item);
    setEditingId(null);
    clear();
  };

  const edit = (item: FaltaItem) => {
    if (isLegacy(item)) return;
    setEditingId(item.id);
    setNome(item.nome || '');
    setMotivo(item.motivoJustificativa || '');
    setAtestado(item.atestado === true ? 'SIM' : item.atestado === false ? 'NAO' : '');
    setError(null);
  };

  return (
    <Surface as="section" className="record-industrial overflow-hidden" aria-labelledby="faltas-title">
      <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] p-5 sm:p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]"><UserX className="h-5 w-5" /></span>
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--warning)]">Ocorrência opcional</p><h2 id="faltas-title" className="text-lg font-bold text-[var(--text-primary)]">Faltas</h2><p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Registre cada colaborador ausente individualmente. Os campos podem ser preenchidos parcialmente e complementados depois.</p></div>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label htmlFor={nomeId}><span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Nome</span><input id={nomeId} value={nome} onChange={(e) => { setNome(e.target.value); setError(null); }} className="field-control" placeholder="Nome do colaborador" /></label>
            <div><label htmlFor={atestadoId} className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Atestado</label><CustomSelect id={atestadoId} value={atestado} onChange={(value) => { setAtestado(value as 'SIM' | 'NAO' | ''); setError(null); }} ariaLabel="Atestado" options={[{ value: '', label: 'Selecione' }, { value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} /></div>
            <label htmlFor={motivoId} className="md:col-span-2"><span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Motivo / Justificativa</span><textarea id={motivoId} rows={3} value={motivoJustificativa} onChange={(e) => { setMotivo(e.target.value); setError(null); }} className="field-control resize-y" placeholder="Informe o motivo ou justificativa" /></label>
          </div>
          <FieldError role="alert">{error}</FieldError>
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] pt-4 min-[420px]:flex-row min-[420px]:justify-end">{editingId && <Button variant="ghost" onClick={() => { setEditingId(null); clear(); }}>Cancelar edição</Button>}<Button type="submit" leftIcon={editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}>{editingId ? 'Salvar falta' : 'Adicionar falta'}</Button></div>
        </form>

        {faltas.length === 0 ? <EmptyState icon={<UserX className="h-6 w-6" />} title="Nenhuma falta registrada" description="Não é necessário adicionar nada quando não houver ausência." /> : (
          <ul className="space-y-2" aria-label="Faltas adicionadas">
            {faltas.map((item, index) => {
              const legacy = isLegacy(item);
              return <li key={item.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-wider text-[var(--warning)]">Falta #{index + 1}</p>{legacy && <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-[var(--text-tertiary)]">Registro antigo</span>}</div>{legacy ? <><p className="mt-1 font-bold text-[var(--text-primary)]">{item.linha || 'Linha não informada'} · {item.turno || 'Turno não informado'}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">Quantidade: {item.quantidade ?? 0}</p>{item.justificativa && <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.justificativa}</p>}</> : <><p className="mt-1 font-bold text-[var(--text-primary)]">{item.nome || 'Nome não informado'}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.motivoJustificativa || 'Motivo não informado'}</p><p className="mt-2 text-xs font-semibold text-[var(--text-tertiary)]">Atestado: {typeof item.atestado === 'boolean' ? (item.atestado ? 'Sim' : 'Não') : 'Não informado'}</p></>}</div><div className="flex gap-1">{!legacy && <Button size="icon" variant="ghost" aria-label="Editar falta" onClick={() => edit(item)}><Edit2 className="h-4 w-4" /></Button>}<Button size="icon" variant="ghost" aria-label="Excluir falta" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button></div></div></li>;
            })}
          </ul>
        )}
      </div>
      <ConfirmModal isOpen={Boolean(deleteId)} title="Excluir falta?" description="Este registro será removido do apontamento." confirmLabel="Excluir" onConfirm={() => { if (deleteId) onDelete(deleteId); if (editingId === deleteId) { setEditingId(null); clear(); } setDeleteId(null); }} onCancel={() => setDeleteId(null)} />
    </Surface>
  );
};
