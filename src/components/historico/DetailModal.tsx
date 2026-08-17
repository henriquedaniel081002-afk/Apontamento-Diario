import React from 'react';
import { Clock, MessageSquareText, UserRound, UserX, Zap } from 'lucide-react';
import { Apontamento } from '../../types';
import { formatDateBR, formatPotencia } from '../../utils/formatters';
import { getApontamentoTotals, getOperationalUnitLabel } from '../../utils/operational';
import { ModalShell } from '../common/ModalShell';
import { Badge, Button, Surface } from '../common/ui';

interface DetailModalProps {
  apontamento: Apontamento | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ apontamento, isOpen, onClose }) => {
  if (!apontamento) return null;

  const totals = getApontamentoTotals(apontamento);
  const updatedAt = new Date(apontamento.updatedAt);
  const formattedUpdate = Number.isNaN(updatedAt.getTime())
    ? 'Horário não informado'
    : updatedAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Apontamento de ${formatDateBR(apontamento.data)}`}
      description={`${getOperationalUnitLabel(apontamento)} • Responsável: ${apontamento.userName}`}
      size="lg"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="size-4" aria-hidden="true" />
            Última atualização: {formattedUpdate}
          </p>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5 text-sm text-slate-300">
          <UserRound className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span className="truncate">Registrado por <strong className="text-slate-100">{apontamento.userName}</strong></span>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Surface tone="inset" padding="sm" className="border-emerald-400/20 bg-emerald-400/[0.07] text-center">
            <dt className="text-[10px] font-black uppercase tracking-[0.11em] text-emerald-300">Produção total</dt>
            <dd className="mt-1 text-xl font-black text-emerald-100">{totals.producao} unid.</dd>
          </Surface>
          <Surface tone="inset" padding="sm" className="border-amber-400/20 bg-amber-400/[0.07] text-center">
            <dt className="text-[10px] font-black uppercase tracking-[0.11em] text-amber-300">Faltas</dt>
            <dd className="mt-1 text-xl font-black text-amber-100">{totals.faltas}</dd>
          </Surface>
          <Surface tone="inset" padding="sm" className="text-center">
            <dt className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">Observações</dt>
            <dd className="mt-1 text-xl font-black text-slate-100">{totals.observacoes}</dd>
          </Surface>
        </dl>

        <section aria-labelledby="detail-production-title">
          <div className="mb-3 flex items-center gap-2 border-b border-white/[0.08] pb-2">
            <Zap className="size-4 text-emerald-400" aria-hidden="true" />
            <h3 id="detail-production-title" className="text-xs font-black uppercase tracking-[0.12em] text-slate-200">Produção por potência</h3>
          </div>
          {apontamento.producoes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-black/15 p-4 text-center text-sm text-slate-500">Nenhuma produção registrada neste apontamento.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <ul className="divide-y divide-white/[0.07]">
                {apontamento.producoes.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 bg-white/[0.02] p-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="success">{item.linha}</Badge>
                      <span className="truncate font-bold text-slate-100">{item.potenciaFormatted || formatPotencia(item.potencia)} kVA</span>
                    </div>
                    <strong className="shrink-0 text-emerald-200">{item.quantidade} unid.</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="detail-absences-title">
          <div className="mb-3 flex items-center gap-2 border-b border-white/[0.08] pb-2">
            <UserX className="size-4 text-amber-400" aria-hidden="true" />
            <h3 id="detail-absences-title" className="text-xs font-black uppercase tracking-[0.12em] text-slate-200">Faltas</h3>
          </div>
          {apontamento.faltas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-black/15 p-4 text-center text-sm text-slate-500">Nenhuma falta registrada neste apontamento.</p>
          ) : (
            <ul className="space-y-2">
              {apontamento.faltas.map((item) => (
                <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">{item.linha}</Badge>
                    <Badge variant="warning">{item.turno}</Badge>
                    <strong className="text-sm text-slate-100">{item.quantidade} {item.quantidade === 1 ? 'falta' : 'faltas'}</strong>
                  </div>
                  {item.justificativa && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-400"><strong className="text-slate-300">Justificativa:</strong> {item.justificativa}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="detail-observations-title">
          <div className="mb-3 flex items-center gap-2 border-b border-white/[0.08] pb-2">
            <MessageSquareText className="size-4 text-slate-400" aria-hidden="true" />
            <h3 id="detail-observations-title" className="text-xs font-black uppercase tracking-[0.12em] text-slate-200">Observações operacionais</h3>
          </div>
          {apontamento.observacoes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-black/15 p-4 text-center text-sm text-slate-500">Nenhuma observação registrada neste apontamento.</p>
          ) : (
            <ul className="space-y-2">
              {apontamento.observacoes.map((item) => (
                <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">{item.linha}</Badge>
                    <Badge>{item.turno}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{item.observacao}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ModalShell>
  );
};
