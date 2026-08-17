import React, { useId, useRef, useState } from 'react';
import { Check, Edit2, Layers3, Plus, Trash2, Zap } from 'lucide-react';
import { Linha, ProducaoItem, User } from '../../types';
import { formatPotencia, parsePotencia } from '../../utils/formatters';
import { ConfirmModal } from '../common/ConfirmModal';
import { LineSelector } from '../common/LineSelector';
import { ModalShell } from '../common/ModalShell';
import { Button, EmptyState, FieldError, Surface } from '../common/ui';

interface ProducaoSectionProps {
  user: User;
  producoes: ProducaoItem[];
  onAdd: (item: ProducaoItem) => void;
  onUpdate: (item: ProducaoItem) => void;
  onDelete: (id: string) => void;
}

interface ValidationErrors {
  potencia?: string;
  quantidade?: string;
}

interface DuplicatePending {
  existingItem: ProducaoItem;
  newQuantity: number;
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
  const [potenciaInput, setPotenciaInput] = useState('');
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [duplicatePending, setDuplicatePending] = useState<DuplicatePending | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const potenciaRef = useRef<HTMLInputElement>(null);
  const potenciaId = useId();
  const quantidadeId = useId();
  const potenciaErrorId = `${potenciaId}-error`;
  const quantidadeErrorId = `${quantidadeId}-error`;

  const totalUnidades = producoes.reduce((sum, item) => sum + item.quantidade, 0);

  const resetInputs = (focusPotencia = true) => {
    setPotenciaInput('');
    setQuantidadeInput('');
    setErrors({});
    if (focusPotencia) {
      window.requestAnimationFrame(() => potenciaRef.current?.focus());
    }
  };

  const handleAddOrUpdate = (event: React.FormEvent) => {
    event.preventDefault();

    const potencia = parsePotencia(potenciaInput);
    const quantidade = Number.parseInt(quantidadeInput.trim(), 10);
    const nextErrors: ValidationErrors = {};

    if (Number.isNaN(potencia) || potencia <= 0) {
      nextErrors.potencia = 'Informe uma potência válida maior que zero, como 75 ou 112,5.';
    }
    if (Number.isNaN(quantidade) || quantidade <= 0) {
      nextErrors.quantidade = 'Informe uma quantidade produzida maior que zero.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (editingId) {
      onUpdate({
        id: editingId,
        linha: selectedLinha,
        potencia,
        potenciaFormatted: formatPotencia(potencia),
        quantidade,
      });
      setEditingId(null);
      resetInputs();
      return;
    }

    const existingItem = producoes.find(
      (item) => item.linha === selectedLinha && Math.abs(item.potencia - potencia) < 0.01,
    );

    if (existingItem) {
      setDuplicatePending({ existingItem, newQuantity: quantidade });
      return;
    }

    onAdd({
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      linha: selectedLinha,
      potencia,
      potenciaFormatted: formatPotencia(potencia),
      quantidade,
    });
    resetInputs();
  };

  const handleDuplicateChoice = (mode: 'sum' | 'replace') => {
    if (!duplicatePending) return;

    const { existingItem, newQuantity } = duplicatePending;
    onUpdate({
      ...existingItem,
      quantidade: mode === 'sum' ? existingItem.quantidade + newQuantity : newQuantity,
    });
    setDuplicatePending(null);
    resetInputs();
  };

  const handleStartEdit = (item: ProducaoItem) => {
    setEditingId(item.id);
    setSelectedLinha(item.linha);
    setPotenciaInput(formatPotencia(item.potencia));
    setQuantidadeInput(item.quantidade.toString());
    setErrors({});
    window.requestAnimationFrame(() => potenciaRef.current?.focus());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetInputs();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    onDelete(deleteId);
    if (editingId === deleteId) {
      setEditingId(null);
      resetInputs(false);
    }
    setDeleteId(null);
  };

  return (
    <Surface as="section" className="overflow-hidden" aria-labelledby="producao-title">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Zap aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Etapa 1</p>
            <h2 id="producao-title" className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Produção por potência
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Informe as potências em kVA e as quantidades concluídas. Esta etapa é opcional.
            </p>
          </div>
        </div>

        <div className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3">
          <Layers3 aria-hidden="true" className="h-4 w-4 text-[var(--text-tertiary)]" />
          <span className="text-sm text-[var(--text-secondary)]">Total</span>
          <strong className="text-sm text-[var(--text-primary)]">
            {totalUnidades} {totalUnidades === 1 ? 'unidade' : 'unidades'}
          </strong>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <form
          onSubmit={handleAddOrUpdate}
          noValidate
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"
        >
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-12">
            {user.linhas.length > 1 && (
              <div className="sm:col-span-3">
                <LineSelector linhas={user.linhas} selectedLinha={selectedLinha} onChange={setSelectedLinha} />
              </div>
            )}

            <div className={user.linhas.length > 1 ? 'sm:col-span-4' : 'sm:col-span-5'}>
              <label htmlFor={potenciaId} className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Potência <span className="font-normal text-[var(--text-tertiary)]">(kVA)</span>
              </label>
              <div className="relative">
                <input
                  ref={potenciaRef}
                  id={potenciaId}
                  type="text"
                  inputMode="decimal"
                  value={potenciaInput}
                  onChange={(event) => {
                    setPotenciaInput(event.target.value);
                    setErrors((current) => ({ ...current, potencia: undefined }));
                  }}
                  placeholder="Ex.: 112,5"
                  aria-invalid={Boolean(errors.potencia)}
                  aria-describedby={errors.potencia ? potenciaErrorId : undefined}
                  className="field-control pr-14"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-tertiary)]">
                  kVA
                </span>
              </div>
              {errors.potencia && <FieldError id={potenciaErrorId} role="alert">{errors.potencia}</FieldError>}
            </div>

            <div className={user.linhas.length > 1 ? 'sm:col-span-3' : 'sm:col-span-4'}>
              <label htmlFor={quantidadeId} className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Quantidade produzida
              </label>
              <input
                id={quantidadeId}
                type="number"
                min="1"
                step="1"
                value={quantidadeInput}
                onChange={(event) => {
                  setQuantidadeInput(event.target.value);
                  setErrors((current) => ({ ...current, quantidade: undefined }));
                }}
                placeholder="Ex.: 6"
                aria-invalid={Boolean(errors.quantidade)}
                aria-describedby={errors.quantidade ? quantidadeErrorId : undefined}
                className="field-control"
              />
              {errors.quantidade && <FieldError id={quantidadeErrorId} role="alert">{errors.quantidade}</FieldError>}
            </div>

            <div className={`${user.linhas.length > 1 ? 'sm:col-span-2' : 'sm:col-span-3'} sm:pt-7`}>
              <Button
                type="submit"
                className="w-full"
                variant="primary"
                leftIcon={editingId ? <Check aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
              >
                {editingId ? 'Salvar' : 'Adicionar'}
              </Button>
            </div>
          </div>

          {editingId && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
              <p className="text-sm text-[var(--text-secondary)]">Editando um registro já adicionado.</p>
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
                Cancelar edição
              </Button>
            </div>
          )}
        </form>

        {producoes.length === 0 ? (
          <EmptyState
            icon={<Zap aria-hidden="true" className="h-6 w-6" />}
            title="Nenhuma produção adicionada"
            description="Se houve produção no período, adicione cada combinação de linha e potência acima."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            <div className="hidden grid-cols-[minmax(90px,0.7fr)_minmax(120px,1fr)_minmax(120px,1fr)_96px] gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] sm:grid">
              <span>Linha</span>
              <span>Potência</span>
              <span>Quantidade</span>
              <span className="text-right">Ações</span>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]" aria-label="Produções adicionadas">
              {producoes.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] sm:grid-cols-[minmax(90px,0.7fr)_minmax(120px,1fr)_minmax(120px,1fr)_96px]"
                >
                  <span className="w-fit rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-1 text-xs font-bold text-[var(--accent)]">
                    {item.linha}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {item.potenciaFormatted || formatPotencia(item.potencia)} kVA
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {item.quantidade} {item.quantidade === 1 ? 'unidade' : 'unidades'}
                  </span>
                  <div className="row-span-2 flex justify-end gap-1 sm:row-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar produção de ${formatPotencia(item.potencia)} kVA`}
                      onClick={() => handleStartEdit(item)}
                    >
                      <Edit2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir produção de ${formatPotencia(item.potencia)} kVA`}
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4 text-[var(--danger)]" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title="Excluir registro de produção?"
        description="Esta ação removerá a potência da lista do apontamento atual."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ModalShell
        isOpen={Boolean(duplicatePending)}
        onClose={() => setDuplicatePending(null)}
        title="Produção já adicionada"
        description="Escolha como tratar a nova quantidade sem criar uma linha duplicada."
        size="sm"
        footer={duplicatePending ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setDuplicatePending(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleDuplicateChoice('replace')}>
              Substituir por {duplicatePending.newQuantity}
            </Button>
            <Button type="button" variant="primary" onClick={() => handleDuplicateChoice('sum')}>
              Somar e ficar com {duplicatePending.existingItem.quantidade + duplicatePending.newQuantity}
            </Button>
          </div>
        ) : undefined}
      >
        {duplicatePending && (
          <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
            Já existe um registro da linha <strong className="text-[var(--text-primary)]">{duplicatePending.existingItem.linha}</strong> para{' '}
            <strong className="text-[var(--text-primary)]">{formatPotencia(duplicatePending.existingItem.potencia)} kVA</strong>, com quantidade{' '}
            <strong className="text-[var(--text-primary)]">{duplicatePending.existingItem.quantidade}</strong>. A nova quantidade é{' '}
            <strong className="text-[var(--text-primary)]">{duplicatePending.newQuantity}</strong>.
          </div>
        )}
      </ModalShell>
    </Surface>
  );
};
