import React, { useId, useState } from 'react';
import { Check, Edit2, Plus, Trash2, UserX } from 'lucide-react';
import { FaltaItem, Linha, Turno, User } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { LineSelector } from '../common/LineSelector';
import { ShiftSelector } from '../common/ShiftSelector';
import { Button, EmptyState, FieldError, Surface } from '../common/ui';

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
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [justificativaInput, setJustificativaInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  const quantidadeId = useId();
  const justificativaId = useId();
  const quantityErrorId = `${quantidadeId}-error`;
  const totalFaltas = faltas.reduce((sum, item) => sum + item.quantidade, 0);

  const clearForm = () => {
    setQuantidadeInput('');
    setJustificativaInput('');
    setQuantityError(null);
  };

  const handleAddOrUpdate = (event: React.FormEvent) => {
    event.preventDefault();

    const quantidade = Number.parseInt(quantidadeInput.trim(), 10);
    if (Number.isNaN(quantidade) || quantidade <= 0) {
      setQuantityError('Informe uma quantidade de faltas maior que zero.');
      return;
    }

    const item: FaltaItem = {
      id: editingId || `falta-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      linha: selectedLinha,
      turno: selectedTurno,
      quantidade,
      justificativa: justificativaInput.trim() || undefined,
    };

    if (editingId) {
      onUpdate(item);
      setEditingId(null);
    } else {
      onAdd(item);
    }
    clearForm();
  };

  const handleStartEdit = (item: FaltaItem) => {
    setEditingId(item.id);
    setSelectedLinha(item.linha);
    setSelectedTurno(item.turno);
    setQuantidadeInput(item.quantidade.toString());
    setJustificativaInput(item.justificativa || '');
    setQuantityError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    clearForm();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    onDelete(deleteId);
    if (editingId === deleteId) {
      setEditingId(null);
      clearForm();
    }
    setDeleteId(null);
  };

  return (
    <Surface as="section" className="overflow-hidden" aria-labelledby="faltas-title">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
            <UserX aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--warning)]">Etapa 2</p>
            <h2 id="faltas-title" className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Faltas e ausências
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Registre as ausências por linha e turno. A justificativa e esta etapa são opcionais.
            </p>
          </div>
        </div>

        <div className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3">
          <span className="text-sm text-[var(--text-secondary)]">Total</span>
          <strong className="text-sm text-[var(--text-primary)]">
            {totalFaltas} {totalFaltas === 1 ? 'falta' : 'faltas'}
          </strong>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <form
          onSubmit={handleAddOrUpdate}
          noValidate
          className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"
        >
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-12">
            {user.linhas.length > 1 && (
              <div className="sm:col-span-4">
                <LineSelector linhas={user.linhas} selectedLinha={selectedLinha} onChange={setSelectedLinha} />
              </div>
            )}

            <div className={user.linhas.length > 1 ? 'sm:col-span-5' : 'sm:col-span-6'}>
              <ShiftSelector selectedShift={selectedTurno} onChange={setSelectedTurno} />
            </div>

            <div className={user.linhas.length > 1 ? 'sm:col-span-3' : 'sm:col-span-6'}>
              <label htmlFor={quantidadeId} className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Quantidade de faltas
              </label>
              <input
                id={quantidadeId}
                type="number"
                min="1"
                step="1"
                value={quantidadeInput}
                onChange={(event) => {
                  setQuantidadeInput(event.target.value);
                  setQuantityError(null);
                }}
                placeholder="Ex.: 2"
                aria-invalid={Boolean(quantityError)}
                aria-describedby={quantityError ? quantityErrorId : undefined}
                className="field-control"
              />
              {quantityError && <FieldError id={quantityErrorId} role="alert">{quantityError}</FieldError>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor={justificativaId} className="text-sm font-medium text-[var(--text-primary)]">
                Justificativa
              </label>
              <span className="text-xs text-[var(--text-tertiary)]">Opcional</span>
            </div>
            <textarea
              id={justificativaId}
              rows={3}
              value={justificativaInput}
              onChange={(event) => setJustificativaInput(event.target.value)}
              placeholder="Ex.: Um colaborador apresentou atestado médico."
              className="field-control resize-y"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-end">
            {editingId && (
              <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                Cancelar edição
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              leftIcon={editingId ? <Check aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
            >
              {editingId ? 'Salvar falta' : 'Adicionar falta'}
            </Button>
          </div>
        </form>

        {faltas.length === 0 ? (
          <EmptyState
            icon={<UserX aria-hidden="true" className="h-6 w-6" />}
            title="Nenhuma falta registrada"
            description="Se houve ausências, registre os detalhes por linha e turno acima."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)]" aria-label="Faltas adicionadas">
            {faltas.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-[var(--surface-hover)]">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-1 text-xs font-bold text-[var(--accent)]">
                      {item.linha}
                    </span>
                    <span className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-2 py-1 text-xs font-semibold text-[var(--warning)]">
                      {item.turno}
                    </span>
                    <strong className="text-sm text-[var(--text-primary)]">
                      {item.quantidade} {item.quantidade === 1 ? 'falta' : 'faltas'}
                    </strong>
                  </div>
                  {item.justificativa && (
                    <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-sm leading-6 text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--text-primary)]">Justificativa:</span> {item.justificativa}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar falta de ${item.quantidade} no ${item.turno}`}
                    onClick={() => handleStartEdit(item)}
                  >
                    <Edit2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir falta de ${item.quantidade} no ${item.turno}`}
                    onClick={() => setDeleteId(item.id)}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4 text-[var(--danger)]" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title="Excluir falta registrada?"
        description="Esta ação removerá o registro de falta da lista do apontamento atual."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Surface>
  );
};
