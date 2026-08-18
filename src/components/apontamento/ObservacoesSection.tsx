import React, { useId, useState } from 'react';
import { Check, Edit2, MessageSquareText, Plus, Trash2 } from 'lucide-react';
import { Linha, ObservacaoItem, Turno, User } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { LineSelector } from '../common/LineSelector';
import { ShiftSelector } from '../common/ShiftSelector';
import { Button, EmptyState, FieldError, Surface } from '../common/ui';

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
  const [textInput, setTextInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const textId = useId();
  const textErrorId = `${textId}-error`;

  const clearForm = () => {
    setTextInput('');
    setTextError(null);
  };

  const handleAddOrUpdate = (event: React.FormEvent) => {
    event.preventDefault();

    const observacao = textInput.trim();
    if (!observacao) {
      setTextError('Digite a observação antes de adicioná-la.');
      return;
    }

    const item: ObservacaoItem = {
      id: editingId || `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      linha: selectedLinha,
      turno: selectedTurno,
      observacao,
    };

    if (editingId) {
      onUpdate(item);
      setEditingId(null);
    } else {
      onAdd(item);
    }
    clearForm();
  };

  const handleStartEdit = (item: ObservacaoItem) => {
    setEditingId(item.id);
    setSelectedLinha(item.linha);
    setSelectedTurno(item.turno);
    setTextInput(item.observacao);
    setTextError(null);
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
    <Surface as="section" className="record-industrial overflow-hidden" aria-labelledby="observacoes-title">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[var(--text-secondary)]">
            <MessageSquareText aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Etapa 3</p>
            <h2 id="observacoes-title" className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Observações operacionais
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Registre ocorrências, paradas de linha ou ressalvas da jornada. Esta etapa é opcional.
            </p>
          </div>
        </div>

        <div className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3">
          <span className="text-sm text-[var(--text-secondary)]">Registros</span>
          <strong className="text-sm text-[var(--text-primary)]">{observacoes.length}</strong>
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
              <div className="sm:col-span-5">
                <LineSelector linhas={user.linhas} selectedLinha={selectedLinha} onChange={setSelectedLinha} />
              </div>
            )}

            <div className={user.linhas.length > 1 ? 'sm:col-span-7' : 'sm:col-span-12'}>
              <ShiftSelector selectedShift={selectedTurno} onChange={setSelectedTurno} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor={textId} className="text-sm font-medium text-[var(--text-primary)]">
                Observação do turno
              </label>
              <span className="text-xs text-[var(--text-tertiary)]">Obrigatória para adicionar</span>
            </div>
            <textarea
              id={textId}
              rows={4}
              value={textInput}
              onChange={(event) => {
                setTextInput(event.target.value);
                setTextError(null);
              }}
              placeholder="Ex.: A linha ficou parada por 20 minutos para manutenção corretiva."
              aria-invalid={Boolean(textError)}
              aria-describedby={textError ? textErrorId : undefined}
              className="field-control min-h-28 resize-y"
            />
            {textError && <FieldError id={textErrorId} role="alert">{textError}</FieldError>}
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
              {editingId ? 'Salvar alteração' : 'Adicionar observação'}
            </Button>
          </div>
        </form>

        {observacoes.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText aria-hidden="true" className="h-6 w-6" />}
            title="Nenhuma observação adicionada"
            description="Use esta etapa apenas quando houver uma ocorrência ou informação relevante para registrar."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)]" aria-label="Observações adicionadas">
            {observacoes.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-[var(--surface-hover)]">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-1 text-xs font-bold text-[var(--accent)]">
                      {item.linha}
                    </span>
                    <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {item.turno}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]">{item.observacao}</p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar observação da linha ${item.linha}, ${item.turno}`}
                    onClick={() => handleStartEdit(item)}
                  >
                    <Edit2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir observação da linha ${item.linha}, ${item.turno}`}
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
        title="Excluir observação?"
        description="Esta ação removerá a observação da lista do apontamento atual."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Surface>
  );
};
