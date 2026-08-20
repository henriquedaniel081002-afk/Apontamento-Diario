import React from 'react';
import { FileCheck2, LockKeyhole, Zap } from 'lucide-react';
import { ProducaoItem } from '../../types';
import { formatPotencia } from '../../utils/formatters';
import { Badge, EmptyState, Surface } from '../common/ui';

interface ImportedProductionSectionProps {
  producoes: ProducaoItem[];
}

export function ImportedProductionSection({ producoes }: ImportedProductionSectionProps) {
  const total = producoes.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

  return (
    <Surface as="section" className="record-industrial overflow-hidden" aria-labelledby="imported-production-title">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <FileCheck2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Etapa 1</p>
              <Badge variant="success">Importada pela Coordenação</Badge>
            </div>
            <h2 id="imported-production-title" className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Produção do dia
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Confira os dados extraídos do Excel. Potências e quantidades são bloqueadas para o apontador.
            </p>
          </div>
        </div>

        <div className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 text-[var(--accent)]">
          <Zap aria-hidden="true" className="h-4 w-4" />
          <strong className="text-sm">{total} {total === 1 ? 'unidade' : 'unidades'}</strong>
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {producoes.length === 0 ? (
          <EmptyState
            icon={<Zap aria-hidden="true" className="h-6 w-6" />}
            title="Nenhuma produção importada"
            description="A Coordenação precisa reimportar esta data para disponibilizar os dados de produção."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            <div className="hidden grid-cols-[120px_1fr_160px] gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] sm:grid">
              <span>Linha</span>
              <span>Potência</span>
              <span className="text-right">Quantidade</span>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {producoes.map((item) => (
                <li key={item.id} className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-[120px_1fr_160px] sm:items-center sm:gap-3">
                  <span className="text-sm font-black text-[var(--accent)]">{item.linha}</span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {item.potenciaFormatted || formatPotencia(item.potencia)} kVA
                  </span>
                  <span className="col-span-2 text-sm font-bold text-[var(--text-secondary)] sm:col-span-1 sm:text-right">
                    {item.quantidade} {item.quantidade === 1 ? 'unidade' : 'unidades'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs leading-5 text-[var(--text-tertiary)]">
          <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Para corrigir produção, a Coordenação deve importar novamente o Excel da mesma data. A nova importação substitui a produção anterior.
        </div>
      </div>
    </Surface>
  );
}
