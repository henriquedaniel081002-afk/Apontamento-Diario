import React from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Factory,
  MessageSquareText,
  Pencil,
  UserX,
  Zap,
} from 'lucide-react';
import { FaltaItem, ObservacaoItem, ProducaoItem, TipoBobina, User } from '../../types';
import { formatDateBR, formatPotencia } from '../../utils/formatters';
import { Badge, Button, Surface } from '../common/ui';

export type EditableApontamentoStep = 1 | 2 | 3;

interface ReviewSectionProps {
  user: User;
  selectedDate: string;
  tipoBobina: TipoBobina | '';
  producoes: ProducaoItem[];
  faltas: FaltaItem[];
  observacoes: ObservacaoItem[];
  onEditStep: (step: EditableApontamentoStep) => void;
}

interface ReviewCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  onEdit: () => void;
  children: React.ReactNode;
}

function ReviewCard({ title, count, icon, onEdit, children }: ReviewCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]" aria-label={title}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[var(--text-tertiary)]">{icon}</span>
          <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">{title}</h3>
          <Badge variant={count > 0 ? 'success' : 'neutral'}>{count}</Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leftIcon={<Pencil aria-hidden="true" className="h-3.5 w-3.5" />}
          onClick={onEdit}
        >
          Editar
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({
  user,
  selectedDate,
  tipoBobina,
  producoes,
  faltas,
  observacoes,
  onEditStep,
}) => {
  const totalProducao = producoes.reduce((sum, item) => sum + item.quantidade, 0);
  const totalFaltas = faltas.reduce((sum, item) => sum + item.quantidade, 0);
  const totalItems = producoes.length + faltas.length + observacoes.length;

  return (
    <Surface className="record-industrial overflow-hidden" padding="none" role="region" aria-labelledby="revisao-title">
      <div className="border-b border-[var(--border-subtle)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Etapa 4</p>
            <h2 id="revisao-title" className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Revisão e envio
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Confira o contexto e os registros. Você pode voltar a qualquer etapa antes de salvar.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              <CalendarDays aria-hidden="true" className="h-4 w-4" /> Data
            </dt>
            <dd className="mt-2 text-sm font-bold text-[var(--text-primary)]">
              {selectedDate ? formatDateBR(selectedDate) : 'Não selecionada'}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              <Factory aria-hidden="true" className="h-4 w-4" /> Unidade
            </dt>
            <dd className="mt-2 text-sm font-bold text-[var(--text-primary)]">{user.setor || 'Não definida'}</dd>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {user.setor === 'BOBINA AT/BT' ? 'Tipo de bobina' : 'Linhas permitidas'}
            </dt>
            <dd className="mt-2 text-sm font-bold text-[var(--text-primary)]">
              {user.setor === 'BOBINA AT/BT' ? (tipoBobina || 'Não selecionado') : (user.linhas.join(' e ') || 'Não informadas')}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {totalItems === 0 && (
          <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">Apontamento sem itens detalhados</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Produção, faltas e observações são opcionais. Se este cenário está correto, você pode salvar normalmente.
            </p>
          </div>
        )}

        <ReviewCard
          title="Produção"
          count={producoes.length}
          icon={<Zap aria-hidden="true" className="h-4 w-4" />}
          onEdit={() => onEditStep(1)}
        >
          {producoes.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">Nenhum registro de produção.</p>
          ) : (
            <div className="space-y-2">
              {producoes.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {item.linha} · {item.potenciaFormatted || formatPotencia(item.potencia)} kVA
                  </span>
                  <span className="text-sm font-bold text-[var(--accent)]">
                    {item.quantidade} {item.quantidade === 1 ? 'unidade' : 'unidades'}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-right text-xs font-semibold text-[var(--text-secondary)]">
                Total produzido: <span className="text-[var(--text-primary)]">{totalProducao} unidades</span>
              </p>
            </div>
          )}
        </ReviewCard>

        <ReviewCard
          title="Faltas e ausências"
          count={faltas.length}
          icon={<UserX aria-hidden="true" className="h-4 w-4" />}
          onEdit={() => onEditStep(2)}
        >
          {faltas.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">Nenhuma falta registrada.</p>
          ) : (
            <div className="space-y-2">
              {faltas.map((item) => (
                <div key={item.id} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{item.linha} · {item.turno}</span>
                    <span className="text-sm font-bold text-[var(--warning)]">
                      {item.quantidade} {item.quantidade === 1 ? 'falta' : 'faltas'}
                    </span>
                  </div>
                  {item.justificativa && <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{item.justificativa}</p>}
                </div>
              ))}
              <p className="pt-1 text-right text-xs font-semibold text-[var(--text-secondary)]">
                Total de faltas: <span className="text-[var(--text-primary)]">{totalFaltas}</span>
              </p>
            </div>
          )}
        </ReviewCard>

        <ReviewCard
          title="Observações"
          count={observacoes.length}
          icon={<MessageSquareText aria-hidden="true" className="h-4 w-4" />}
          onEdit={() => onEditStep(3)}
        >
          {observacoes.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">Nenhuma observação registrada.</p>
          ) : (
            <div className="space-y-2">
              {observacoes.map((item) => (
                <div key={item.id} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{item.linha} · {item.turno}</p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]">{item.observacao}</p>
                </div>
              ))}
            </div>
          )}
        </ReviewCard>
      </div>
    </Surface>
  );
};
